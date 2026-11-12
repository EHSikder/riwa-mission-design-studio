/**
 * Saved designs, share codes and the local leaderboard. Browser storage only (it can be empty or blocked:
 * every access is guarded); a share code is the design itself, compressed into the link, so it works on any
 * computer without a server.
 */
import type { StudioDesign } from './model/design';
import type { Report } from './model/score';
import type { Difficulty, ScenarioId } from './model/types';

const KEY = 'underdogs.studio.v1';

export interface SavedDesign {
  id: string;
  name: string;
  scenario: ScenarioId;
  savedAt: number;
  design: StudioDesign;
}

export interface ScoreEntry {
  scenario: ScenarioId;
  difficulty: Difficulty;
  name: string;
  team: string;
  total: number;
  rank: string;
  outcome: string;
  at: number;
}

interface Stored {
  designs: SavedDesign[];
  scores: ScoreEntry[];
}

function read(): Stored {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as Partial<Stored>;
      return { designs: s.designs ?? [], scores: s.scores ?? [] };
    }
  } catch { /* storage unavailable: start empty */ }
  return { designs: [], scores: [] };
}

function write(s: Stored) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked: keep playing */ }
}

export function saveDesign(design: StudioDesign): SavedDesign {
  const s = read();
  const entry: SavedDesign = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: design.name, scenario: design.scenario, savedAt: Date.now(), design };
  s.designs = [entry, ...s.designs].slice(0, 60);
  write(s);
  return entry;
}

export function addScore(r: Report, scenario: ScenarioId, difficulty: Difficulty, team = 'Solo') {
  const s = read();
  s.scores = [...s.scores, { scenario, difficulty, name: r.name, team, total: r.score.total, rank: r.score.rank, outcome: r.outcome, at: Date.now() }].slice(-500);
  write(s);
}

export const topScores = (scenario: ScenarioId, difficulty: Difficulty, n = 10) =>
  read().scores.filter((x) => x.scenario === scenario && x.difficulty === difficulty).sort((a, b) => b.total - a.total).slice(0, n);

/** The design as a URL-safe code. */
export function shareCode(d: StudioDesign): string {
  const bytes = new TextEncoder().encode(JSON.stringify(d));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function parseShareCode(code: string): StudioDesign | null {
  try {
    const bin = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as StudioDesign;
    return d && d.version === 1 && typeof d.scenario === 'string' ? d : null;
  } catch {
    return null;
  }
}

export const shareLink = (d: StudioDesign) => `${location.origin}${location.pathname}#design=${shareCode(d)}`;
