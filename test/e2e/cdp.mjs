// Minimal Chrome DevTools Protocol driver (Node 22+: global fetch and WebSocket). No dependencies.
// Launches headless Chrome, opens pages, evaluates JavaScript, emulates devices and offline mode.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Connection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  waitFor(predicate, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(fn);
        reject(new Error('Timed out waiting for a DevTools event'));
      }, timeoutMs);
      const fn = (msg) => {
        if (predicate(msg)) {
          clearTimeout(timer);
          this.listeners.delete(fn);
          resolve(msg);
        }
      };
      this.listeners.add(fn);
    });
  }
}

export class Page {
  constructor(conn, sessionId) {
    this.conn = conn;
    this.sessionId = sessionId;
    this.consoleErrors = [];
    this.requests = [];
    conn.listeners.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.exceptionThrown') this.consoleErrors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        this.consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') this.consoleErrors.push(msg.params.entry.text);
      if (msg.method === 'Network.requestWillBeSent') this.requests.push(msg.params.request.url);
    });
  }

  send(method, params) {
    return this.conn.send(method, params, this.sessionId);
  }

  async init() {
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Network.enable');
  }

  async goto(url) {
    const loaded = this.conn.waitFor((m) => m.sessionId === this.sessionId && m.method === 'Page.loadEventFired');
    const res = await this.send('Page.navigate', { url });
    if (res.errorText) throw new Error(`Navigation to ${url} failed: ${res.errorText}`);
    await loaded;
    // Module scripts run before load, but give microtasks a moment to settle.
    await sleep(50);
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) throw new Error(`Page error: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text}`);
    return res.result.value;
  }

  async setViewport(width, height, mobile = false) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }

  async offline(on) {
    await this.send('Network.emulateNetworkConditions', { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }

  async screenshot(file, { fullPage = true } = {}) {
    let clip;
    if (fullPage) {
      const { cssContentSize } = await this.send('Page.getLayoutMetrics');
      clip = { x: 0, y: 0, width: Math.ceil(cssContentSize.width), height: Math.min(Math.ceil(cssContentSize.height), 12000), scale: 1 };
    }
    const { data } = await this.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip, captureBeyondViewport: true } : {}) });
    writeFileSync(file, Buffer.from(data, 'base64'));
  }

  async typeInto(selector, text) {
    await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); el.focus(); el.select && el.select(); })()`);
    await this.send('Input.insertText', { text });
  }
}

export async function launch({ port = 9300 + Math.floor(Math.random() * 400) } = {}) {
  const exe = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!exe) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Edge executable.');
  const userDir = mkdtempSync(path.join(tmpdir(), 'hmdin-chrome-'));
  const proc = spawn(
    exe,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-networking',
      '--hide-scrollbars',
      '--mute-audio',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );

  let wsUrl;
  for (let i = 0; i < 150 && !wsUrl; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      wsUrl = (await r.json()).webSocketDebuggerUrl;
    } catch {
      await sleep(100);
    }
  }
  if (!wsUrl) {
    proc.kill();
    throw new Error('Chrome did not start');
  }
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const conn = new Connection(ws);

  return {
    async newPage() {
      const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(conn, sessionId);
      page.targetId = targetId;
      await page.init();
      return page;
    },
    async closePage(page) {
      await conn.send('Target.closeTarget', { targetId: page.targetId });
    },
    async close() {
      try {
        await conn.send('Browser.close');
      } catch {
        /* already closed */
      }
      ws.close();
      // Wait for Chrome to actually exit so it releases its profile folder (Windows locks it).
      const exited = new Promise((resolve) => (proc.exitCode !== null ? resolve() : proc.once('exit', resolve)));
      proc.kill();
      await Promise.race([exited, sleep(5000)]);
      try {
        rmSync(userDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
      } catch {
        /* best effort: a leftover temp profile must never fail a test run */
      }
    },
  };
}
