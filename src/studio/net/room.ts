/**
 * Joining a network room (docs/03 §7). Operations go up with POST and come back to everyone, in one order, over
 * Server-Sent Events (server/rooms.mjs). Nothing is applied until the server has ordered it, so every screen
 * replays the same log. A dropped connection retries and resumes after the last operation seen; a server that
 * restarted has lost the room, and the player is told.
 */
export type RoomStatus = 'connecting' | 'open' | 'retrying' | 'lost';

export interface RoomLink {
  code: string;
  send: (op: object) => void;
  close: () => void;
}

export interface RoomSummary {
  code: string;
  scenario: string;
  difficulty: string;
  players: string[];
  flights: { name: string; total: number; rank: string; outcome: string; team: string[] }[];
  online: number;
  touched: number;
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newRoomCode = () => Array.from({ length: 4 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
export const cleanCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);

export function joinRoom(code: string, onOp: (op: unknown, seq: number) => void, onStatus: (s: RoomStatus) => void): RoomLink {
  let last = 0;
  let closed = false;
  let es: EventSource | null = null;
  // a free host sleeps after minutes without a request, and sleeping empties its rooms: keep asking while in one
  const keepAwake = setInterval(() => { fetch('/api/info').catch(() => {}); }, 5 * 60_000);
  const stop = () => {
    closed = true;
    clearInterval(keepAwake);
    es?.close();
  };
  const open = () => {
    if (closed) return;
    onStatus('connecting');
    es = new EventSource(`/api/room/${code}/events?from=${last}`);
    es.onopen = () => onStatus('open');
    es.addEventListener('hello', (e) => {
      const { length } = JSON.parse((e as MessageEvent<string>).data) as { length: number };
      if (length < last) {
        stop();
        onStatus('lost');
      }
    });
    es.onmessage = (e) => {
      const { seq, op } = JSON.parse(e.data) as { seq: number; op: unknown };
      if (seq <= last) return;
      last = seq;
      onOp(op, seq);
    };
    es.onerror = () => {
      if (closed) return;
      es?.close();
      onStatus('retrying');
      setTimeout(open, 1500);
    };
  };
  open();
  return {
    code,
    send: (op) => {
      if (closed) return;
      fetch(`/api/room/${code}/op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) })
        .catch(() => onStatus('retrying'));
    },
    close: stop,
  };
}

/** Whether this copy of the game has the room server behind it. A static host has not. */
export async function roomsAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/api/info');
    return r.ok && (r.headers.get('content-type') ?? '').includes('application/json');
  } catch {
    return false;
  }
}

/** This computer's LAN addresses, so the host can show teammates where to connect. */
export async function lanAddresses(): Promise<string[]> {
  try {
    const r = await fetch('/api/info');
    return r.ok ? ((await r.json()) as { addresses: string[] }).addresses : [];
  } catch {
    return [];
  }
}

export async function listRooms(): Promise<RoomSummary[]> {
  try {
    const r = await fetch('/api/rooms');
    return r.ok ? ((await r.json()) as RoomSummary[]) : [];
  } catch {
    return [];
  }
}
