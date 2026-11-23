// Tiny static dev server: node scripts/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Same layout as GitHub Pages: website at /, web app at /app/
const www = resolve(fileURLToPath(new URL('../www', import.meta.url)));
const site = resolve(fileURLToPath(new URL('../site', import.meta.url)));
const port = Number(process.argv[2] || 5173);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/app') { res.writeHead(301, { Location: '/app/' }).end(); return; }
  const inApp = path.startsWith('/app/');
  const root = inApp ? www : site;
  if (inApp) path = path.slice(4);
  const file = normalize(join(root, path.endsWith('/') ? path + 'index.html' : path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Strova läuft auf http://localhost:${port}`));
