/**
 * Team play (docs/03 §7). Up to four players share the five roles. The Resource Manager splits mass, power and
 * money among the three building desks; a desk that needs more raises a change request, which the Resource
 * Manager approves or rejects. Each role carries a private goal that pulls against the others — science wants
 * instruments, the spacecraft wants margins, the money wants savings, comms wants every bit home, the director
 * wants ambition — so the team has to negotiate. Launch needs every role's GO; flight decisions are voted.
 * The team state changes only through operations (`TeamOp`), so a same-screen game and a LAN room run the same
 * reducer.
 */
import type { Analysis, Line } from './analyze';
import type { Report } from './score';
import { ROLES, type RoleId } from './types';

export type TeamMode = 'solo' | 'hotseat' | 'lan';
export type AllocDesk = 'spacecraft' | 'science' | 'comms';

export const ROLE_IDS = Object.keys(ROLES) as RoleId[];
export const ALLOC_DESKS: AllocDesk[] = ['spacecraft', 'science', 'comms'];
/** Sky, white, accent and the pale navy blue of the design system: one per player. */
export const PLAYER_COLORS = ['#60bee8', '#ffffff', '#3792c2', '#a7b2cb'];
export const MAX_PLAYERS = 4;

export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface Allocation {
  massKg: number;
  powerW: number;
  costM: number;
}

export interface ChangeRequest {
  id: string;
  desk: AllocDesk;
  by: string;
  ask: Allocation;
  reason: string;
  status: 'open' | 'approved' | 'rejected';
  answeredBy?: string;
  note?: string;
}

export interface TeamState {
  mode: TeamMode;
  players: Player[];
  /** Who holds each role (player id). */
  roles: Record<RoleId, string>;
  /** The player at the keyboard (same screen) or this device's player (LAN). */
  active: string;
  allocations: Record<AllocDesk, Allocation> | null;
  requests: ChangeRequest[];
  calls: Partial<Record<RoleId, { go: boolean; reason: string }>>;
  /** The director launched without a unanimous GO. */
  overridden: boolean;
  /** Decision number → player → chosen option. */
  votes: Record<number, Record<string, string>>;
  /** Player → design changes made (contribution). */
  edits: Record<string, number>;
  /** Someone has picked a role by hand: new players no longer reshuffle the roles. */
  manual?: boolean;
}

export type TeamOp =
  | { t: 'join'; player: Player }
  | { t: 'active'; player: string }
  | { t: 'claim'; role: RoleId; player: string }
  | { t: 'alloc'; allocations: Record<AllocDesk, Allocation> | null }
  | { t: 'request'; req: ChangeRequest }
  | { t: 'answer'; id: string; status: 'approved' | 'rejected'; by: string; note?: string }
  | { t: 'call'; role: RoleId; go: boolean; reason: string }
  | { t: 'resetPoll' }
  | { t: 'override' }
  | { t: 'vote'; index: number; player: string; option: string }
  | { t: 'edited'; player: string };

/** The usual split of five roles over 1–4 players: the director keeps the money, the builders get a desk each. */
export function defaultRoles(players: Player[]): Record<RoleId, string> {
  const p = players.map((x) => x.id);
  const at = (i: number) => p[Math.min(i, p.length - 1)];
  if (p.length <= 1) return { director: at(0), spacecraft: at(0), science: at(0), comms: at(0), resources: at(0) };
  if (p.length === 2) return { director: at(0), resources: at(0), comms: at(0), spacecraft: at(1), science: at(1) };
  if (p.length === 3) return { director: at(0), resources: at(0), spacecraft: at(1), science: at(2), comms: at(2) };
  return { director: at(0), resources: at(0), spacecraft: at(1), science: at(2), comms: at(3) };
}

export const makePlayer = (name: string, index: number, id?: string): Player => ({
  id: id ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: name.trim().slice(0, 18) || `Player ${index + 1}`,
  color: PLAYER_COLORS[index % PLAYER_COLORS.length],
});

export function newTeam(mode: TeamMode, players: Player[]): TeamState {
  return {
    mode,
    players,
    roles: defaultRoles(players),
    active: players[0]?.id ?? '',
    allocations: null,
    requests: [],
    calls: {},
    overridden: false,
    votes: {},
    edits: {},
  };
}

export function teamReduce(s: TeamState, op: TeamOp): TeamState {
  switch (op.t) {
    case 'join': {
      if (s.players.some((p) => p.id === op.player.id) || s.players.length >= MAX_PLAYERS) return s;
      const players = [...s.players, { ...op.player, color: PLAYER_COLORS[s.players.length % PLAYER_COLORS.length] }];
      // the roles are shared out again as each player arrives, until someone picks by hand
      const roles = s.manual ? s.roles : defaultRoles(players);
      return { ...s, players, roles, active: s.active || op.player.id };
    }
    case 'active':
      return { ...s, active: op.player };
    case 'claim':
      return { ...s, roles: { ...s.roles, [op.role]: op.player }, manual: true };
    case 'alloc':
      return { ...s, allocations: op.allocations };
    case 'request':
      return { ...s, requests: [...s.requests.filter((r) => r.id !== op.req.id), op.req] };
    case 'answer': {
      const req = s.requests.find((r) => r.id === op.id);
      if (!req || req.status !== 'open') return s;
      const requests = s.requests.map((r) => (r.id === op.id ? { ...r, status: op.status, answeredBy: op.by, note: op.note } : r));
      if (op.status !== 'approved' || !s.allocations) return { ...s, requests };
      const cur = s.allocations[req.desk];
      const allocations = { ...s.allocations, [req.desk]: { massKg: cur.massKg + req.ask.massKg, powerW: cur.powerW + req.ask.powerW, costM: cur.costM + req.ask.costM } };
      return { ...s, requests, allocations };
    }
    case 'call':
      return { ...s, calls: { ...s.calls, [op.role]: { go: op.go, reason: op.reason } } };
    case 'resetPoll':
      return Object.keys(s.calls).length || s.overridden ? { ...s, calls: {}, overridden: false } : s;
    case 'override':
      return { ...s, overridden: true };
    case 'vote':
      return { ...s, votes: { ...s.votes, [op.index]: { ...(s.votes[op.index] ?? {}), [op.player]: op.option } } };
    case 'edited':
      return { ...s, edits: { ...s.edits, [op.player]: (s.edits[op.player] ?? 0) + 1 } };
  }
}

// ------------------------------------------------------------------ allocations

const total = (lines: Line[], desk: RoleId) => lines.filter((l) => l.desk === desk).reduce((acc, l) => acc + l.value, 0);

/** What each building desk uses now: mass, average power and development money. */
export function usage(a: Analysis): Record<AllocDesk, Allocation> {
  const out = {} as Record<AllocDesk, Allocation>;
  for (const k of ALLOC_DESKS) out[k] = { massKg: total(a.mass.lines, k), powerW: total(a.power.lines, k), costM: total(a.cost.lines, k) };
  return out;
}

/**
 * What the Resource Manager has to share out: the mass limit less the propellant the orbit demands, the average
 * load the arrays can carry (after recharging the battery), and the budget less the launch, operations,
 * reserve and insurance.
 */
export function pools(a: Analysis): Allocation {
  const fixedCost = a.cost.lines.filter((l) => l.desk === 'director' || l.desk === 'resources').reduce((acc, l) => acc + l.value, 0);
  return {
    massKg: Math.max(0, a.mass.limitKg - a.mass.propellantKg),
    powerW: a.power.requiredW > 0 ? (a.power.loadW * a.power.eolW) / a.power.requiredW : 0,
    costM: Number.isFinite(a.cost.budgetM) ? Math.max(0, a.cost.budgetM - fixedCost) : 1e6,
  };
}

/** A first split: what each desk uses today plus 10%, trimmed to fit the pools. */
export function proposeSplit(a: Analysis): Record<AllocDesk, Allocation> {
  const u = usage(a), pool = pools(a);
  const out = {} as Record<AllocDesk, Allocation>;
  const keys: (keyof Allocation)[] = ['massKg', 'powerW', 'costM'];
  const want = Object.fromEntries(keys.map((k) => [k, ALLOC_DESKS.reduce((acc, d) => acc + Math.max(u[d][k], 1e-6) * 1.1, 0)])) as unknown as Allocation;
  for (const d of ALLOC_DESKS) {
    out[d] = { massKg: 0, powerW: 0, costM: 0 };
    for (const k of keys) {
      const scale = want[k] > pool[k] ? pool[k] / want[k] : 1;
      out[d][k] = Math.round(Math.max(u[d][k], 1e-6) * 1.1 * scale * 10) / 10;
    }
  }
  return out;
}

/** Where a desk is over its allocation, in plain words (empty when within it). */
export function overruns(a: Analysis, team: TeamState): Record<AllocDesk, string[]> {
  const out = { spacecraft: [] as string[], science: [] as string[], comms: [] as string[] };
  if (!team.allocations || team.mode === 'solo') return out;
  const u = usage(a);
  for (const d of ALLOC_DESKS) {
    const al = team.allocations[d], us = u[d];
    if (us.massKg > al.massKg + 0.05) out[d].push(`${(us.massKg - al.massKg).toFixed(1)} kg over`);
    if (us.powerW > al.powerW + 0.05) out[d].push(`${(us.powerW - al.powerW).toFixed(1)} W over`);
    if (us.costM > al.costM + 0.005) out[d].push(`$${(us.costM - al.costM).toFixed(2)}M over`);
  }
  return out;
}

/** The roles a player holds. */
export const rolesOf = (team: TeamState, player: string) => ROLE_IDS.filter((r) => team.roles[r] === player);
export const ownerOf = (team: TeamState, role: RoleId) => team.players.find((p) => p.id === team.roles[role]);
export const canEdit = (team: TeamState, role: RoleId) => team.mode === 'solo' || team.roles[role] === team.active;

/** Every role has called, and every call is GO. */
export const unanimousGo = (team: TeamState) => ROLE_IDS.every((r) => team.calls[r]?.go === true);

/** The team's choice: most votes; a tie goes to the director's vote, then to the first option. */
export function tally(team: TeamState, index: number, options: string[]): string {
  const votes = team.votes[index] ?? {};
  const count = new Map<string, number>();
  for (const o of Object.values(votes)) count.set(o, (count.get(o) ?? 0) + 1);
  const best = Math.max(0, ...count.values());
  const top = options.filter((o) => (count.get(o) ?? 0) === best && best > 0);
  if (top.length === 1) return top[0];
  const dir = votes[team.roles.director];
  if (dir && (top.length === 0 || top.includes(dir))) return dir;
  return top[0] ?? options[0];
}

// ------------------------------------------------------------------ private goals and the teamwork score

export interface RoleGoal {
  title: string;
  text: string;
  check: (a: Analysis, r: Report) => boolean;
}

export const ROLE_GOALS: Record<RoleId, RoleGoal> = {
  director: {
    title: 'Aim high',
    text: 'Set at least two requirements to their goal level, and reach them in flight.',
    check: (_, r) => r.requirements.filter((q) => q.level === 'goal' && q.met === 'goal').length >= 2,
  },
  spacecraft: {
    title: 'A robust spacecraft',
    text: 'Fly with at least 15% mass margin and 20% power margin.',
    check: (a) => a.mass.marginPct >= 15 && a.power.marginPct >= 20,
  },
  science: {
    title: 'Maximum science',
    text: 'Deliver at least 90% of the primary objective\'s value, with two or more useful instruments on board.',
    check: (a, r) => {
      const o = a.scenario.objectives.find((x) => x.id === a.design.primary);
      const useful = o ? a.design.instruments.filter((i) => (o.value[i] ?? 0) >= 0.5).length : 0;
      return (r.objectives.find((x) => x.id === a.design.primary)?.achieved ?? 0) >= 0.9 && useful >= 2;
    },
  },
  comms: {
    title: 'Every bit home',
    text: 'Lose less than 1% of the data, with at least 3 dB of link margin at the farthest point.',
    check: (a, r) => r.data.lostPct < 1 && a.comms.marginDb >= 3,
  },
  resources: {
    title: 'Money left over',
    text: 'Finish the mission with at least 10% of the budget unspent.',
    check: (_, r) => !Number.isFinite(r.money.budgetM) || r.money.leftM >= 0.1 * r.money.budgetM,
  },
};

export interface Teamwork {
  score: number;
  parts: Line[];
  goals: Record<RoleId, boolean>;
}

/** How well the team worked together (0–1), with its parts; feeds the decisions-and-teamwork score. */
export function teamwork(team: TeamState, a: Analysis, r: Report): Teamwork {
  const goals = Object.fromEntries(ROLE_IDS.map((k) => [k, ROLE_GOALS[k].check(a, r)])) as Record<RoleId, boolean>;
  const answered = team.requests.length ? team.requests.filter((x) => x.status !== 'open').length / team.requests.length : 1;
  const contributors = team.players.length ? team.players.filter((p) => (team.edits[p.id] ?? 0) >= 3).length / team.players.length : 0;
  const parts: Line[] = [
    { name: 'Unanimous GO for launch', value: unanimousGo(team) && !team.overridden ? 0.2 : 0 },
    { name: 'Resources split among the desks', value: team.allocations ? 0.1 : 0 },
    { name: 'Change requests answered', value: 0.15 * answered },
    { name: 'Everyone shaped the design', value: 0.2 * contributors },
    { name: 'Private role goals reached', value: (0.35 * Object.values(goals).filter(Boolean).length) / ROLE_IDS.length },
  ];
  return { score: parts.reduce((acc, l) => acc + l.value, 0), parts, goals };
}
