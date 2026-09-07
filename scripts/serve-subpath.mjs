/**
 * Serves the static export the way GitHub Pages will, from a sub-path.
 *
 * A project site lives at `/<repo>/`, not at the root, and that difference is not
 * cosmetic: it broke a `fetch('/evidence.json')` that worked perfectly on every local
 * check because every local check served from `/`. Nothing catches that class of bug
 * except serving the built output under the same prefix production uses, so this exists
 * to make that a one-command check rather than a deploy-and-hope.
 *
 *   npm run serve:static          # http://localhost:4500/north/
 *   BASE_PATH=/foo PORT=5000 npm run serve:static
 */

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../apps/web/out');
const base = process.env.BASE_PATH ?? '/north';
const port = Number(process.env.PORT ?? 4500);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.xml': 'application/atom+xml; charset=utf-8',
};

if (!existsSync(root)) {
  console.error(`No static export at ${root}. Run: npm run build:static`);
  process.exit(1);
}

createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);

  // Requests outside the prefix are the bug this script exists to catch, so they fail
  // loudly here rather than silently resolving as they would from a root-served site.
  if (!path.startsWith(base)) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end(`outside base path ${base}`);
  }

  const rel = path.slice(base.length) || '/';
  const file = [
    resolve(root, `.${rel}`),
    resolve(root, `.${rel}.html`),
    resolve(root, `.${rel}`, 'index.html'),
    resolve(root, `.${rel.replace(/\/$/, '')}.html`),
  ].find(
    (candidate) =>
      candidate.startsWith(root) && existsSync(candidate) && statSync(candidate).isFile(),
  );

  if (!file) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    return res.end('not found');
  }

  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(port, () => {
  console.log(`Static export served at http://localhost:${port}${base}/`);
});
