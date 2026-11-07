/**
 * The studio session: which mission, how hard, the design on the table (with undo), its analysis, the feed of
 * consequences, the team, the flight (a seeded MissionRun) and the reports of every flight this session.
 * Every shared change is an operation (StudioOp): applied at once in solo and same-screen games, sent through
 * the LAN room and applied when the room has ordered it in a network game, so every screen replays the same
 * log. Local view state (which desk is on screen) stays local.
 */
import { create } from 'zustand';
import { analyze, type Analysis } from './model/analyze';
import { cloneDesign, type StudioDesign } from './model/design';
import { diffNotes, type Tone } from './model/feedback';
import { SCENARIOS } from './model/scenarios';
import { evaluate, type Report } from './model/score';
import { MissionRun, randomSeed } from './model/simulate';
import { makePlayer, newTeam, tally, teamReduce, teamwork, type Player, type TeamMode, type TeamOp, type TeamState, type Teamwork } from './model/team';
import type { Difficulty, RoleId, ScenarioId } from './model/types';
import { joinRoom, newRoomCode, type RoomLink, type RoomStatus } from './net/room';
import { addScore } from './storage';

export type Phase = 'select' | 'lobby' | 'brief' | 'design' | 'review' | 'fly' | 'report';

export type StudioOp =
  | { t: 'setup'; scenario: ScenarioId; difficulty: Difficulty; mode: TeamMode; players: Player[]; design?: StudioDesign }
  | { t: 'patch'; role: RoleId; by: string; changes: Partial<StudioDesign> }
  | { t: 'replace'; role: RoleId; by: string; design: StudioDesign; assisted?: boolean }
  | { t: 'phase'; phase: Phase }
  | { t: 'fly'; seed: number }
  | { t: 'decide'; index: number; option: string }
  | { t: 'team'; op: TeamOp }
  | { t: 'score'; name: string; total: number; rank: string; outcome: string; team: string[] };

export interface FeedNote {
  id: number;
  text: string;
  tone: Tone;
  role: RoleId;
}

export interface FlownReport extends Report {
  /** The design that flew, to compare and to go back to. */
  design: StudioDesign;
  team?: Teamwork;
}

interface StudioState {
  phase: Phase;
  scenario: ScenarioId | null;
  difficulty: Difficulty;
  design: StudioDesign | null;
  analysis: Analysis | null;
  past: StudioDesign[];
  future: StudioDesign[];
  desk: RoleId;
  feed: FeedNote[];
  /** The example design was loaded: the decision score notes the help. */
  assisted: boolean;
  team: TeamState;
  room: RoomLink | null;
  roomStatus: RoomStatus | null;
  /** This device's player in a network game. */
  me: string | null;
  run: MissionRun | null;
  /** Decisions the team made in flight, by number. */
  decided: Record<number, string>;
  report: FlownReport | null;
  reports: FlownReport[];
  dispatch: (op: StudioOp) => void;
  /** A solo or same-screen game. */
  start: (o: { scenario: ScenarioId; difficulty: Difficulty; mode: 'solo' | 'hotseat'; names: string[]; design?: StudioDesign }) => void;
  begin: (s: ScenarioId, d: Difficulty, design?: StudioDesign) => void;
  /** Open a LAN room for this mission; returns its code. */
  host: (o: { scenario: ScenarioId; difficulty: Difficulty; name: string }) => string;
  join: (code: string, name: string) => void;
  teamOp: (op: TeamOp) => void;
  setPhase: (p: Phase) => void;
  setDesk: (r: RoleId) => void;
  /** Change the design as `role`; the analysis, the feed and the team follow. */
  edit: (role: RoleId, change: (d: StudioDesign) => void) => void;
  loadExample: () => void;
  undo: () => void;
  redo: () => void;
  /** Fly the current design (a fresh seed unless one is given: the same seed replays the same luck). */
  fly: (seed?: number) => void;
  /** Solo: decide. Team: vote (as `player`, by default the one at this screen), and decide once everyone has, or `now`. */
  vote: (option: string, o?: { player?: string; now?: boolean }) => void;
  finish: () => void;
  exit: () => void;
}

let noteId = 1;
const soloTeam = () => newTeam('solo', [makePlayer('You', 0, 'solo')]);

export const useStudio = create<StudioState>((set, get) => {
  /** A new design on the table: analysis, feed, undo history and the team's bookkeeping follow. */
  const commit = (next: StudioDesign, role: RoleId, by: string, record: boolean) => {
    const s = get();
    const a = analyze(next, s.difficulty);
    const notes = s.analysis ? diffNotes(s.analysis, a).map((n) => ({ ...n, id: noteId++, role })) : [];
    let team = s.team;
    if (team.mode !== 'solo') {
      team = teamReduce(team, { t: 'edited', player: by });
      if (Object.keys(team.calls).length) {
        team = teamReduce(team, { t: 'resetPoll' });
        notes.push({ id: noteId++, text: 'The design changed: the GO poll starts over.', tone: 'neutral', role });
      }
    }
    set({
      design: next,
      analysis: a,
      team,
      past: record && s.design && s.team.mode !== 'lan' ? [...s.past.slice(-49), s.design] : s.past,
      future: record ? [] : s.future,
      feed: [...notes.reverse(), ...s.feed].slice(0, 40),
    });
  };

  const apply = (op: StudioOp) => {
    const s = get();
    switch (op.t) {
      case 'setup': {
        const design = cloneDesign(op.design ?? SCENARIOS[op.scenario].starter);
        const team = newTeam(op.mode, op.players);
        set({
          scenario: op.scenario, difficulty: op.difficulty, design, analysis: analyze(design, op.difficulty),
          past: [], future: [], feed: [], assisted: false, run: null, report: null, reports: [], decided: {},
          team: op.mode === 'lan' && s.me ? { ...team, active: s.me } : team,
          phase: op.mode === 'lan' ? 'lobby' : op.design ? 'design' : 'brief', desk: 'director',
        });
        return;
      }
      case 'patch': {
        if (!s.design) return;
        commit({ ...cloneDesign(s.design), ...(JSON.parse(JSON.stringify(op.changes)) as Partial<StudioDesign>) }, op.role, op.by, true);
        return;
      }
      case 'replace': {
        if (op.assisted) set({ assisted: true });
        commit(cloneDesign(op.design), op.role, op.by, true);
        return;
      }
      case 'phase':
        set({ phase: op.phase });
        return;
      case 'fly':
        if (s.analysis) set({ run: new MissionRun(s.analysis, op.seed), decided: {}, report: null, phase: 'fly' });
        return;
      case 'decide': {
        if (s.decided[op.index] !== undefined) return;
        set({ decided: { ...s.decided, [op.index]: op.option } });
        const r = s.run;
        if (r?.pending && r.pending.index === op.index) r.choose(op.option);
        return;
      }
      case 'team': {
        let team = teamReduce(s.team, op.op);
        if (s.team.mode === 'lan' && s.me) team = { ...team, active: s.me };
        set({ team });
        // the last vote in: the deciding screen (the director's on a network, the shared one on the same screen) decides
        const v = op.op;
        const decider = team.mode === 'hotseat' || (team.mode === 'lan' && s.me === team.roles.director);
        if (v.t === 'vote' && decider && get().decided[v.index] === undefined) {
          const votes = team.votes[v.index] ?? {};
          if (team.players.every((p) => votes[p.id] !== undefined)) get().dispatch({ t: 'decide', index: v.index, option: tally(team, v.index, [...new Set(Object.values(votes))]) });
        }
        return;
      }
      case 'score':
        return;
    }
  };

  const connect = (code: string) => {
    const link = joinRoom(code, (op) => apply(op as StudioOp), (roomStatus) => set({ roomStatus }));
    set({ room: link, roomStatus: 'connecting' });
    return link;
  };

  return {
    phase: 'select',
    scenario: null,
    difficulty: 'engineer',
    design: null,
    analysis: null,
    past: [],
    future: [],
    desk: 'director',
    feed: [],
    assisted: false,
    team: soloTeam(),
    room: null,
    roomStatus: null,
    me: null,
    run: null,
    decided: {},
    report: null,
    reports: [],
    dispatch: (op) => {
      const room = get().room;
      if (room) room.send(op);
      else apply(op);
    },
    start: ({ scenario, difficulty, mode, names, design }) => {
      get().room?.close();
      const players = mode === 'solo' ? soloTeam().players : names.map((n, i) => makePlayer(n, i));
      set({ room: null, roomStatus: null, me: null });
      apply({ t: 'setup', scenario, difficulty, mode, players, design });
    },
    begin: (scenario, difficulty, design) => get().start({ scenario, difficulty, mode: 'solo', names: ['You'], design }),
    host: ({ scenario, difficulty, name }) => {
      get().room?.close();
      const code = newRoomCode();
      const me = makePlayer(name, 0);
      set({ me: me.id, team: newTeam('lan', []), phase: 'lobby' });
      connect(code).send({ t: 'setup', scenario, difficulty, mode: 'lan', players: [me] } satisfies StudioOp);
      return code;
    },
    join: (code, name) => {
      get().room?.close();
      const me = makePlayer(name, 0);
      set({ me: me.id, team: newTeam('lan', []), phase: 'lobby', scenario: null, design: null, analysis: null });
      // join once the room's log has started to arrive, so the join lands after the setup
      const link = connect(code);
      const sendJoin = () => link.send({ t: 'team', op: { t: 'join', player: me } } satisfies StudioOp);
      const wait = (tries: number) => {
        if (get().scenario || tries > 20) sendJoin();
        else setTimeout(() => wait(tries + 1), 150);
      };
      wait(0);
    },
    teamOp: (op) => get().dispatch({ t: 'team', op }),
    setPhase: (phase) => {
      const r = get().run;
      if (phase === 'fly' && (!r || r.ended)) get().fly();
      else if (phase === 'fly') set({ phase });
      else get().dispatch({ t: 'phase', phase });
    },
    setDesk: (desk) => set({ desk }),
    edit: (role, change) => {
      const d = get().design;
      if (!d) return;
      const next = cloneDesign(d);
      change(next);
      const changes: Record<string, unknown> = {};
      for (const k of Object.keys(next) as (keyof StudioDesign)[]) if (JSON.stringify(next[k]) !== JSON.stringify(d[k])) changes[k] = next[k];
      if (Object.keys(changes).length) get().dispatch({ t: 'patch', role, by: get().team.active, changes: changes as Partial<StudioDesign> });
    },
    loadExample: () => {
      const { scenario, design, team } = get();
      if (!scenario) return;
      const ex = cloneDesign(SCENARIOS[scenario].example);
      ex.name = design?.name ?? ex.name;
      get().dispatch({ t: 'replace', role: 'director', by: team.active, design: ex, assisted: true });
    },
    undo: () => {
      const { past, design, future, team } = get();
      if (!past.length || !design || team.mode === 'lan') return;
      set({ past: past.slice(0, -1), future: [design, ...future] });
      commit(past[past.length - 1], 'director', team.active, false);
    },
    redo: () => {
      const { future, design, past, team } = get();
      if (!future.length || !design || team.mode === 'lan') return;
      set({ future: future.slice(1), past: [...past, design] });
      commit(future[0], 'director', team.active, false);
    },
    fly: (seed) => get().dispatch({ t: 'fly', seed: seed ?? randomSeed() }),
    vote: (option, o = {}) => {
      const { run, team, me } = get();
      const p = run?.pending;
      if (!p) return;
      if (team.mode === 'solo') return get().dispatch({ t: 'decide', index: p.index, option });
      // the vote travels like any operation; the deciding screen decides when the last one arrives (see apply)
      if (option) get().teamOp({ t: 'vote', index: p.index, player: o.player ?? team.active, option });
      // forcing the call: the director (or anyone at a shared screen) decides with the votes so far
      if (o.now && (team.mode === 'hotseat' || me === team.roles.director) && get().decided[p.index] === undefined) {
        get().dispatch({ t: 'decide', index: p.index, option: tally(get().team, p.index, p.options!.map((x) => x.id)) });
      }
    },
    finish: () => {
      const { run, assisted, design, scenario, difficulty, reports, team, me, room } = get();
      if (!run || !design || !scenario) return;
      const base = evaluate(run, { assisted });
      let report: FlownReport = { ...base, design: cloneDesign(design) };
      if (team.mode !== 'solo') {
        const tw = teamwork(team, run.a, base);
        report = { ...evaluate(run, { assisted, teamwork: tw.score }), design: cloneDesign(design), team: tw };
      }
      const names = team.players.map((p) => p.name);
      addScore(report, scenario, difficulty, team.mode === 'solo' ? 'Solo' : names.join(', '));
      if (room && me === team.roles.director) room.send({ t: 'score', name: report.name, total: report.score.total, rank: report.score.rank, outcome: report.outcome, team: names } satisfies StudioOp);
      set({ report, reports: [...reports, report], phase: 'report' });
    },
    exit: () => {
      get().room?.close();
      set({ phase: 'select', scenario: null, design: null, analysis: null, past: [], future: [], feed: [], run: null, report: null, reports: [], decided: {}, team: soloTeam(), room: null, roomStatus: null, me: null });
    },
  };
});

// dev handle for browser testing, like window.__flight
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __studio: typeof useStudio }).__studio = useStudio;
