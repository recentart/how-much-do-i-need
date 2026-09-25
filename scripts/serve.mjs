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

export function createStaticServer(dir) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const send = (file, status) => {
      res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
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
