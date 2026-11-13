/**
 * The rooms for network team play (docs/03 §7). No dependencies. Each room keeps an ordered log of operations;
 * clients add operations with POST and receive the log, then every new operation, over Server-Sent Events. The
 * server never interprets the game: every client applies the same log through the same reducer, so all screens agree.
 *
 *   GET  /api/info                       this computer's LAN addresses (for the join link)
 *   GET  /api/rooms                      rooms and their results (the competitive leaderboard)
 *   GET  /api/room/:code/events?from=N   operations after N, then live (SSE)
 *   POST /api/room/:code/op              append an operation; answers { seq }
 *
 * Rooms live in memory, so a restart empties them. The limits below keep a public server safe from running out
 * of memory; a whole game needs far less than they allow.
 */
import { networkInterfaces } from 'node:os';

/** @typedef {import('node:http').IncomingMessage} Req */
/** @typedef {import('node:http').ServerResponse} Res */
/** @typedef {{ name: string, total: number, rank: string, outcome: string, team: string[] }} Flight */
/** @typedef {{ code: string, ops: string[], bytes: number, clients: Set<Res>, touched: number, scenario: string, difficulty: string, players: string[], flights: Flight[] }} Room */

/** @type {Map<string, Room>} */
const rooms = new Map();
export const MAX_ROOMS = 200;
export const MAX_ROOM_BYTES = 1024 * 1024;
export const MAX_BODY = 64 * 1024;
const IDLE_MS = 12 * 3600 * 1000;

/** Virtual network adapters that a teammate on the Wi-Fi could never reach. */
const VIRTUAL = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|docker|Loopback/i;

/** This computer's addresses on the local network, the likeliest Wi-Fi address first. */
export function lanAddresses() {
  const entries = Object.entries(networkInterfaces()).flatMap(([name, list]) =>
    (list ?? []).filter((a) => a.family === 'IPv4' && !a.internal).map((a) => ({ name, address: a.address })));
  const real = entries.filter((e) => !VIRTUAL.test(e.name));
  /** @param {string} a */
  const rank = (a) => (a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : 2);
  return (real.length ? real : entries).map((e) => e.address).sort((a, b) => rank(a) - rank(b));
}

/** @param {string} code @returns {Room | null} the room, or null when the server is full of rooms in use */
function roomOf(code) {
  const found = rooms.get(code);
  if (found) return found;
  if (rooms.size >= MAX_ROOMS) {
    // make space: the empty room that has been idle the longest
    /** @type {Room | null} */
    let oldest = null;
    for (const r of rooms.values()) if (r.clients.size === 0 && (!oldest || r.touched < oldest.touched)) oldest = r;
    if (!oldest) return null;
    rooms.delete(oldest.code);
  }
  /** @type {Room} */
  const room = { code, ops: [], bytes: 0, clients: new Set(), touched: Date.now(), scenario: '', difficulty: '', players: [], flights: [] };
  rooms.set(code, room);
  return room;
}

/** @param {unknown} v */
const text = (v) => String(v ?? '').slice(0, 60);

/**
 * Keep what the leaderboard shows of a room up to date: its mission, its players and its flights. Anyone can
 * post to a public server, so nothing here trusts the shape of an operation.
 * @param {Room} r
 * @param {any} op
 */
function note(r, op) {
  if (op.t === 'setup') {
    r.scenario = text(op.scenario);
    r.difficulty = text(op.difficulty);
    // the host arrives with the setup, everyone else with a join
    if (Array.isArray(op.players)) for (const p of op.players) if (p?.name) r.players.push(text(p.name));
  }
  if (op.t === 'team' && op.op?.t === 'join' && op.op.player?.name) r.players.push(text(op.op.player.name));
  if (op.t === 'score') {
    r.flights.push({
      name: text(op.name),
      total: Number(op.total) || 0,
      rank: text(op.rank),
      outcome: text(op.outcome),
      team: Array.isArray(op.team) ? op.team.slice(0, 4).map(text) : [],
    });
  }
}

/** @param {Room} r */
const summary = (r) => ({
  code: r.code, scenario: r.scenario, difficulty: r.difficulty, players: r.players, flights: r.flights, online: r.clients.size, touched: r.touched,
});

/** @param {Res} res @param {number} status @param {unknown} body */
function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

/** @param {Req} req @returns {Promise<string>} */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    /** @type {Buffer[]} */
    const chunks = [];
    req.on('data', (/** @type {Buffer} */ c) => {
      size += c.length;
      if (size <= MAX_BODY) chunks.push(c);
    });
    req.on('end', () => (size > MAX_BODY ? reject(new Error('too large')) : resolve(Buffer.concat(chunks).toString('utf8'))));
    req.on('error', reject);
  });
}

/** The request came to a local or private address, not to a public host name. */
const isLocalRequest = (/** @type {Req} */ req) => /^(\[|localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(req.headers.host ?? '');

/** @param {Req} req @param {Res} res @param {() => void} next */
export function roomHandler(req, res, next) {
  const url = new URL(req.url ?? '/', 'http://local');
  if (!url.pathname.startsWith('/api/')) return next();
  // a copy of the game on another site (the Vercel one) may use these rooms: allow it to ask
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' });
    return res.end();
  }
  const now = Date.now();
  for (const [code, r] of rooms) if (r.clients.size === 0 && now - r.touched > IDLE_MS) rooms.delete(code);

  if (url.pathname === '/api/info' && req.method === 'GET') return json(res, 200, { addresses: isLocalRequest(req) ? lanAddresses() : [] });
  if (url.pathname === '/api/rooms' && req.method === 'GET') return json(res, 200, [...rooms.values()].map(summary));

  const m = /^\/api\/room\/([A-Z0-9]{3,8})\/(events|op)$/.exec(url.pathname);
  if (!m) return json(res, 404, { error: 'unknown endpoint' });
  const room = roomOf(m[1]);
  if (!room) return json(res, 503, { error: 'the server is full, try again later' });

  if (m[2] === 'events' && req.method === 'GET') {
    const from = Math.max(0, Number(url.searchParams.get('from')) || 0);
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    // how long the log is, so a client that has seen more knows the server restarted and lost the room
    res.write(`event: hello\ndata: {"length":${room.ops.length}}\n\n`);
    // the log so far, then live
    for (let seq = from + 1; seq <= room.ops.length; seq++) res.write(`data: {"seq":${seq},"op":${room.ops[seq - 1]}}\n\n`);
    room.clients.add(res);
    room.touched = now;
    const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
    req.on('close', () => { clearInterval(ping); room.clients.delete(res); room.touched = Date.now(); });
    return;
  }
  if (m[2] === 'op' && req.method === 'POST') {
    readBody(req).then((body) => {
      let op;
      try { op = JSON.parse(body); } catch { return json(res, 400, { error: 'not JSON' }); }
      if (!op || typeof op !== 'object' || Array.isArray(op)) return json(res, 400, { error: 'not an operation' });
      const raw = JSON.stringify(op);
      if (room.bytes + raw.length > MAX_ROOM_BYTES) return json(res, 409, { error: 'room log full' });
      room.ops.push(raw);
      room.bytes += raw.length;
      room.touched = Date.now();
      note(room, op);
      const seq = room.ops.length;
      for (const c of room.clients) c.write(`data: {"seq":${seq},"op":${raw}}\n\n`);
      json(res, 200, { seq });
    }, () => json(res, 413, { error: 'operation too large' }));
    return;
  }
  json(res, 405, { error: 'method not allowed' });
}
