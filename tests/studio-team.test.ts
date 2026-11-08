/**
 * Step 5D: team play. The role split, the operations that change the team, allocations and change requests,
 * the vote tally, the teamwork score, and the room server's log over real HTTP.
 */
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { roomHandler } from '../server/rooms.mjs';
import { analyze } from '../src/studio/model/analyze';
import { SCENARIOS } from '../src/studio/model/scenarios';
import { evaluate } from '../src/studio/model/score';
import { MissionRun } from '../src/studio/model/simulate';
import {
  PLAYER_COLORS, ROLE_IDS, canEdit, defaultRoles, makePlayer, newTeam, overruns, pools, proposeSplit, tally, teamReduce, teamwork, usage, type TeamState,
} from '../src/studio/model/team';

const players = (n: number) => Array.from({ length: n }, (_, i) => makePlayer(`P${i + 1}`, i, `p${i + 1}`));

describe('the team', () => {
  it('splits five roles over one to four players, every role held', () => {
    for (const n of [1, 2, 3, 4]) {
      const ps = players(n);
      const roles = defaultRoles(ps);
      for (const r of ROLE_IDS) expect(ps.map((p) => p.id)).toContain(roles[r]);
      // every player gets at least one role
      for (const p of ps) expect(ROLE_IDS.some((r) => roles[r] === p.id)).toBe(true);
    }
  });

  it('players join with their own colour, claim roles, and only the owner may edit a desk', () => {
    let t: TeamState = newTeam('lan', []);
    t = teamReduce(t, { t: 'join', player: { id: 'a', name: 'Ana', color: '' } });
    t = teamReduce(t, { t: 'join', player: { id: 'b', name: 'Ben', color: '' } });
    expect(t.players.map((p) => p.color)).toEqual(PLAYER_COLORS.slice(0, 2));
    expect(t.roles.science).toBe('a');
    t = teamReduce(t, { t: 'claim', role: 'science', player: 'b' });
    expect(t.roles.science).toBe('b');
    expect(canEdit({ ...t, active: 'a' }, 'science')).toBe(false);
    expect(canEdit({ ...t, active: 'b' }, 'science')).toBe(true);
    expect(canEdit({ ...t, mode: 'solo', active: 'a' }, 'science')).toBe(true);
  });

  it('allocations: usage is counted per desk, the first split fits the pools, an overrun is spotted and an approved request covers it', () => {
    const a = analyze(SCENARIOS['angola-eo'].example);
    const u = usage(a), pool = pools(a), split = proposeSplit(a);
    const sumMass = a.mass.lines.filter((l) => l.desk === 'spacecraft' || l.desk === 'science' || l.desk === 'comms').reduce((s, l) => s + l.value, 0);
    expect(u.spacecraft.massKg + u.science.massKg + u.comms.massKg).toBeCloseTo(sumMass, 6);
    for (const k of ['massKg', 'powerW', 'costM'] as const) expect(split.spacecraft[k] + split.science[k] + split.comms[k]).toBeLessThanOrEqual(pool[k] + 0.5);
    let t = teamReduce(newTeam('hotseat', players(3)), { t: 'alloc', allocations: { ...split, science: { ...split.science, massKg: 10 } } });
    expect(overruns(a, t).science.length).toBeGreaterThan(0);
    t = teamReduce(t, { t: 'request', req: { id: 'r1', desk: 'science', by: 'p3', ask: { massKg: u.science.massKg - 10, powerW: 0, costM: 0 }, reason: 'two cameras', status: 'open' } });
    t = teamReduce(t, { t: 'answer', id: 'r1', status: 'approved', by: 'p1' });
    expect(overruns(a, t).science).toEqual([]);
    expect(t.requests[0].status).toBe('approved');
  });

  it('a design change resets the poll; votes are tallied, ties go to the director', () => {
    let t = newTeam('hotseat', players(4));
    t = teamReduce(t, { t: 'call', role: 'science', go: true, reason: '' });
    t = teamReduce(t, { t: 'resetPoll' });
    expect(t.calls).toEqual({});
    t = teamReduce(t, { t: 'vote', index: 0, player: 'p1', option: 'safe' });
    t = teamReduce(t, { t: 'vote', index: 0, player: 'p2', option: 'go' });
    expect(tally(t, 0, ['go', 'safe'])).toBe('safe');
    t = teamReduce(t, { t: 'vote', index: 0, player: 'p3', option: 'go' });
    expect(tally(t, 0, ['go', 'safe'])).toBe('go');
  });

  it('teamwork rewards a unanimous GO, answered requests, everyone contributing and the private goals', () => {
    const a = analyze(SCENARIOS['angola-eo'].example);
    const r = evaluate(new MissionRun(a, 4).runToEnd());
    let t = newTeam('hotseat', players(2));
    const lazy = teamwork(t, a, r);
    t = teamReduce(t, { t: 'alloc', allocations: proposeSplit(a) });
    for (const role of ROLE_IDS) t = teamReduce(t, { t: 'call', role, go: true, reason: '' });
    for (let k = 0; k < 3; k++) for (const p of t.players) t = teamReduce(t, { t: 'edited', player: p.id });
    const good = teamwork(t, a, r);
    expect(good.score).toBeGreaterThan(lazy.score + 0.4);
    expect(good.score).toBeLessThanOrEqual(1);
    expect(Object.keys(good.goals)).toHaveLength(5);
    // the team score feeds the decision points
    expect(evaluate(new MissionRun(a, 4).runToEnd(), { teamwork: 1 }).score.decisions).toBeGreaterThan(evaluate(new MissionRun(a, 4).runToEnd(), { teamwork: 0 }).score.decisions);
  });
});

describe('the room server', () => {
  let server: Server;
  let base = '';
  beforeAll(async () => {
    server = createServer((req, res) => roomHandler(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const addr = server.address() as { port: number };
    base = `http://127.0.0.1:${addr.port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  const post = (code: string, op: object) => fetch(`${base}/api/room/${code}/op`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) }).then((r) => r.json() as Promise<{ seq: number }>);

  it('keeps an ordered log, replays it to a newcomer, and summarises the room', async () => {
    expect((await post('TEST', { t: 'setup', scenario: 'angola-eo', difficulty: 'engineer', mode: 'lan', players: [{ id: 'h', name: 'Host' }] })).seq).toBe(1);
    expect((await post('TEST', { t: 'team', op: { t: 'join', player: { id: 'a', name: 'Ana' } } })).seq).toBe(2);
    expect((await post('TEST', { t: 'score', name: 'Sat', total: 812, rank: 'Gold', outcome: 'Success', team: ['Ana'] })).seq).toBe(3);
    // a newcomer asking from op 1 gets ops 2 and 3, in order
    const ctl = new AbortController();
    const res = await fetch(`${base}/api/room/TEST/events?from=1`, { signal: ctl.signal });
    const reader = res.body!.getReader();
    let text = '';
    while (!text.includes('"seq":3')) text += new TextDecoder().decode((await reader.read()).value);
    ctl.abort();
    const seqs = [...text.matchAll(/"seq":(\d+)/g)].map((m) => Number(m[1]));
    expect(seqs).toEqual([2, 3]);
    const rooms = (await (await fetch(`${base}/api/rooms`)).json()) as { code: string; scenario: string; players: string[]; flights: { total: number }[] }[];
    const room = rooms.find((x) => x.code === 'TEST')!;
    expect(room.scenario).toBe('angola-eo');
    expect(room.players).toEqual(['Host', 'Ana']);
    expect(room.flights[0].total).toBe(812);
  });

  it('refuses what is not an operation', async () => {
    const r = await fetch(`${base}/api/room/TEST/op`, { method: 'POST', body: 'not json' });
    expect(r.status).toBe(400);
    expect((await fetch(`${base}/api/nothing`)).status).toBe(404);
  });
});
