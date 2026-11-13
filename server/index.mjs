/**
 * The game's own server: the built game from dist/, plus the rooms for network team play. No dependencies.
 *
 *   npm run lan    builds the game and starts this on your computer (teammates on the same Wi-Fi can join)
 *   npm start      starts it from an existing build (what a host like Render runs)
 *
 * The port comes from the PORT environment variable, or 5173.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { lanAddresses, roomHandler } from './rooms.mjs';

/** @type {Record<string, string>} */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);
const gzipAsync = promisify(gzip);

/** @param {string} path */
function cacheControl(path) {
  if (path.endsWith('.html')) return 'no-cache';
  // Vite puts a content hash in these names, so they never change
  if (/-[\w-]{8,}\.(js|css)$/.test(path)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=86400';
}

/**
 * Serves the files under `root`. The game uses only #hash links, so an unknown path is simply not found.
 * @param {string} root
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function staticHandler(root) {
  const base = resolve(root);
  /** @type {Map<string, { body: Buffer, zipped: Buffer | null }>} */
  const cache = new Map();
  /**
   * @param {import('node:http').ServerResponse} res
   * @param {number} status
   */
  const fail = (res, status) => {
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 404 ? 'Not found' : status === 405 ? 'Method not allowed' : 'Bad request');
  };
  return async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405);
    let path;
    try {
      path = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
    } catch {
      return fail(res, 400);
    }
    const file = resolve(base, `.${path === '/' ? '/index.html' : path}`);
    // nothing outside the folder of the build
    if (!file.startsWith(base + sep)) return fail(res, 404);
    let entry = cache.get(file);
    if (!entry) {
      let body;
      try {
        body = await readFile(file);
      } catch {
        return fail(res, 404);
      }
      entry = { body, zipped: COMPRESSIBLE.has(extname(file)) ? await gzipAsync(body) : null };
      cache.set(file, entry);
    }
    const accepts = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
    const out = accepts && entry.zipped ? entry.zipped : entry.body;
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Content-Length': out.length,
      'Cache-Control': cacheControl(file),
      Vary: 'Accept-Encoding',
      ...(out === entry.zipped ? { 'Content-Encoding': 'gzip' } : {}),
    });
    res.end(req.method === 'HEAD' ? undefined : out);
  };
}

/** The whole server: rooms first, then the game's files. @param {string} root */
export function createGameServer(root) {
  const files = staticHandler(root);
  return createServer((req, res) => {
    try {
      roomHandler(req, res, () => { void files(req, res); });
    } catch {
      // a request line that is not a URL
      res.writeHead(400);
      res.end();
    }
  });
}

function start() {
  const root = fileURLToPath(new URL('../dist/', import.meta.url));
  if (!existsSync(`${root}index.html`)) {
    console.error('\n  No build found. Run "npm run lan" (or "npm run build" first).\n');
    process.exit(1);
  }
  // one bad request must not end a game in progress
  process.on('uncaughtException', (e) => console.error(e));
  const port = Number(process.env.PORT) || 5173;
  const server = createGameServer(root);
  server.on('error', (/** @type {NodeJS.ErrnoException} */ e) => {
    console.error(e.code === 'EADDRINUSE' ? `\n  Port ${port} is already in use. Close the other copy of the game, or set the PORT variable.\n` : e);
    process.exit(1);
  });
  server.listen(port, '0.0.0.0', () => {
    console.log(`\n  RIWA Space Journey (team Space Underdogs)\n\n  On this computer:   http://localhost:${port}`);
    for (const a of lanAddresses()) console.log(`  On the same Wi-Fi:  http://${a}:${port}`);
    console.log('\n  Press Ctrl+C to stop.\n');
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) start();
