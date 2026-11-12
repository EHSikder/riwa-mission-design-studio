/**
 * The game's own server (server/index.mjs): the built files, and the limits that keep a public room server safe.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createGameServer } from '../server/index.mjs';
import { MAX_BODY, MAX_ROOM_BYTES } from '../server/rooms.mjs';

describe('the game server', () => {
  let server: Server;
  let base = '';
  let port = 0;
  let dir = '';
  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'underdogs-server-'));
    mkdirSync(join(dir, 'build', 'assets'), { recursive: true });
    writeFileSync(join(dir, 'build', 'index.html'), '<!doctype html><title>game</title>');
    writeFileSync(join(dir, 'build', 'assets', 'index-AbCd1234.js'), 'console.log("game");'.repeat(100));
    writeFileSync(join(dir, 'build', 'assets', 'map.jpg'), 'not really a jpeg');
    writeFileSync(join(dir, 'secret.txt'), 'outside the build');
    server = createGameServer(join(dir, 'build'));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as { port: number }).port;
    base = `http://127.0.0.1:${port}`;
  });
  afterAll(async () => {
    await new Promise<void>((r) => server.close(() => r()));
    rmSync(dir, { recursive: true, force: true });
  });

  /** A raw request: fetch would tidy away the "../" that these tests need to send. */
  const raw = (path: string, method = 'GET', headers: Record<string, string> = {}) => new Promise<{ status: number; headers: Record<string, unknown>; body: Buffer }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });

  it('serves the game at the root, and hashed files for a long time', async () => {
    const home = await raw('/');
    expect(home.status).toBe(200);
    expect(home.headers['content-type']).toContain('text/html');
    expect(home.headers['cache-control']).toBe('no-cache');
    expect(home.body.toString()).toContain('<title>game</title>');
    const js = await raw('/assets/index-AbCd1234.js');
    expect(js.headers['content-type']).toContain('text/javascript');
    expect(js.headers['cache-control']).toContain('immutable');
    expect((await raw('/assets/map.jpg')).headers['content-type']).toBe('image/jpeg');
  });

  it('compresses text for browsers that ask, and not images', async () => {
    const js = await raw('/assets/index-AbCd1234.js', 'GET', { 'Accept-Encoding': 'gzip, br' });
    expect(js.headers['content-encoding']).toBe('gzip');
    expect(gunzipSync(js.body).toString()).toContain('console.log("game")');
    expect((await raw('/assets/map.jpg', 'GET', { 'Accept-Encoding': 'gzip' })).headers['content-encoding']).toBeUndefined();
  });

  it('answers HEAD without a body, and refuses other methods', async () => {
    const head = await raw('/', 'HEAD');
    expect(head.status).toBe(200);
    expect(head.body.length).toBe(0);
    expect((await raw('/', 'DELETE')).status).toBe(405);
  });

  it('never serves anything outside the build', async () => {
    for (const path of ['/../secret.txt', '/..%2Fsecret.txt', '/%2e%2e/secret.txt', '/assets/..%2F..%2Fsecret.txt', '/..%5Csecret.txt']) {
      const r = await raw(path);
      expect(r.status).toBe(404);
      expect(r.body.toString()).not.toContain('outside the build');
    }
    expect((await raw('/nothing-here.js')).status).toBe(404);
    expect((await raw('/%E0%A4%A')).status).toBe(400);
    expect((await raw('//')).status).toBe(400);
  });

  it('sends the API to the rooms', async () => {
    const r = await fetch(`${base}/api/info`);
    expect(r.headers.get('content-type')).toContain('application/json');
    expect(Array.isArray(((await r.json()) as { addresses: string[] }).addresses)).toBe(true);
    expect((await fetch(`${base}/api/nothing`)).status).toBe(404);
  });

  it('shows network addresses only on a local network, not behind a public name', async () => {
    const pub = await raw('/api/info', 'GET', { Host: 'underdogs.example.org' });
    expect(JSON.parse(pub.body.toString())).toEqual({ addresses: [] });
  });

  const post = (code: string, body: string) => fetch(`${base}/api/room/${code}/op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

  it('tells each client how long the log is, so a restart can be noticed', async () => {
    await post('HELLO', '{"t":"phase","phase":"brief"}');
    await post('HELLO', '{"t":"phase","phase":"design"}');
    const ctl = new AbortController();
    const res = await fetch(`${base}/api/room/HELLO/events?from=2`, { signal: ctl.signal });
    const { value } = await res.body!.getReader().read();
    ctl.abort();
    expect(new TextDecoder().decode(value)).toContain('event: hello\ndata: {"length":2}');
  });

  it('refuses an oversized operation, and a room log that has grown too long', async () => {
    expect((await post('BIG', JSON.stringify({ t: 'x', pad: 'y'.repeat(MAX_BODY) }))).status).toBe(413);
    const op = JSON.stringify({ t: 'x', pad: 'y'.repeat(MAX_BODY - 100) });
    let status = 200;
    for (let i = 0; i < 2 + MAX_ROOM_BYTES / (MAX_BODY - 100) && status === 200; i++) status = (await post('FULL', op)).status;
    expect(status).toBe(409);
  });

  it('survives operations of any shape, and keeps the leaderboard clean', async () => {
    for (const op of ['[1,2]', '"text"', 'null', '7']) expect((await post('ODD', op)).status).toBe(400);
    for (const op of [{ t: 'setup', players: 'nobody' }, { t: 'setup', players: [null, 5] }, { t: 'team', op: 'x' }, { t: 'score', team: 'not a list', total: 'lots' }]) {
      expect((await post('ODD', JSON.stringify(op))).status).toBe(200);
    }
    const rooms = (await (await fetch(`${base}/api/rooms`)).json()) as { code: string; flights: { total: number; team: string[] }[] }[];
    const flight = rooms.find((r) => r.code === 'ODD')!.flights[0];
    expect(flight.total).toBe(0);
    expect(flight.team).toEqual([]);
  });
});
