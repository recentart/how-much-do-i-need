// Tiny static server for local testing. Mirrors how Cloudflare serves dist/ with
// html_handling "auto-trailing-slash" and not_found_handling "404-page".
//   node scripts/serve.mjs            -> http://localhost:8788

import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const isFile = (f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
};

// Parses _headers the way Cloudflare does: rules apply in order, a later rule adds headers, and
// "! Name" removes a header set by an earlier rule. Only "*" wildcards are supported.
export function parseHeaders(text) {
  const rules = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const re = new RegExp(`^${line.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
      rules.push({ re, set: [], detach: [] });
    } else if (rules.length) {
      const t = line.trim();
      if (t.startsWith('!')) rules.at(-1).detach.push(t.slice(1).trim().toLowerCase());
      else {
        const i = t.indexOf(':');
        rules.at(-1).set.push([t.slice(0, i).trim(), t.slice(i + 1).trim()]);
      }
    }
  }
  return (pathname) => {
    const out = new Map();
    for (const r of rules) {
      if (!r.re.test(pathname)) continue;
      for (const d of r.detach) out.delete(d);
      for (const [k, v] of r.set) {
        const prev = out.get(k.toLowerCase());
        out.set(k.toLowerCase(), prev ? [prev[0], `${prev[1]}, ${v}`] : [k, v]);
      }
    }
    return Object.fromEntries([...out.values()]);
  };
}

export function createStaticServer(dir) {
  let headersFor = () => ({});
  try {
    headersFor = parseHeaders(readFileSync(path.join(dir, '_headers'), 'utf8'));
  } catch {
    // No _headers file: serve without extra headers.
  }
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const send = (file, status) => {
      res.writeHead(status, { ...headersFor(pathname), 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(readFileSync(file));
    };
    if (pathname.includes('..') || pathname.includes('\0')) {
      res.writeHead(400).end();
      return;
    }
    const target = path.join(dir, pathname);
    if (pathname.endsWith('/index.html')) {
      res.writeHead(307, { Location: pathname.slice(0, -'index.html'.length) + url.search }).end();
      return;
    }
    if (pathname.endsWith('/') && isFile(path.join(target, 'index.html'))) return send(path.join(target, 'index.html'), 200);
    if (!pathname.endsWith('/') && isFile(path.join(target, 'index.html'))) {
      res.writeHead(307, { Location: `${pathname}/${url.search}` }).end();
      return;
    }
    if (isFile(target) && path.basename(target) !== '_headers') return send(target, 200);
    return send(path.join(dir, '404.html'), 404);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  const port = Number(process.env.PORT) || 8788;
  createStaticServer(root).listen(port, () => console.log(`Serving dist/ at http://localhost:${port}`));
}
