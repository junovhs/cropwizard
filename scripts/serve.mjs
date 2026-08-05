// Zero-dependency static server for dist/, so `npm run serve` needs nothing
// but node. Dev-only: it never ships with the app.
import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const root = 'dist';
const port = Number(process.env.PORT ?? 4173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (rel.split(/[/\\]/).includes('..')) {
    res.writeHead(403).end('forbidden');
    return;
  }

  const file = join(root, rel);
  let size;
  try {
    const info = statSync(file);
    if (info.isDirectory()) throw new Error('directory');
    size = info.size;
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    return;
  }

  res.writeHead(200, {
    'content-type': types[extname(file)] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store'
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`cropwizard: http://localhost:${port}/`);
});
