/**
 * What a change did: compare the analysis before and after an edit and say it in a sentence per resource
 * that moved, and per requirement whose verdict changed. This is the studio's cause-and-effect feed.
 */
import type { Analysis, Status } from './analyze';

export type Tone = 'good' | 'bad' | 'neutral';

const rank: Record<Status, number> = { fail: 0, warn: 1, over: 2, good: 3 };
const metRank = { fail: 0, threshold: 1, goal: 2 } as const;

const signed = (x: number, digits = 0) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}`;

export function diffNotes(a: Analysis, b: Analysis): { text: string; tone: Tone }[] {
  const out: { text: string; tone: Tone }[] = [];
  const toneOf = (better: boolean, worse: boolean): Tone => (better ? 'good' : worse ? 'bad' : 'neutral');
  const ra = a.resources, rb = b.resources;

  const dm = b.mass.wetKg - a.mass.wetKg;
  if (Math.abs(dm) >= Math.max(0.05, 0.002 * a.mass.wetKg)) {
    out.push({ text: `Mass ${signed(dm, Math.abs(dm) < 10 ? 1 : 0)} kg → ${b.mass.wetKg.toFixed(0)} of ${b.mass.limitKg.toFixed(0)} kg`, tone: toneOf(rank[rb.mass.status] > rank[ra.mass.status], rank[rb.mass.status] < rank[ra.mass.status] || dm > 0) });
  }
  const dp = b.power.requiredW - a.power.requiredW;
  const de = b.power.eolW - a.power.eolW;
  if (Math.abs(dp) >= 0.5 || Math.abs(de) >= 0.5) {
    const what = Math.abs(de) >= 0.5 && Math.abs(dp) < 0.5 ? `Arrays ${signed(de)} W` : `Power needed ${signed(dp)} W`;
    out.push({ text: `${what} → margin ${b.power.marginPct.toFixed(0)}%`, tone: toneOf(b.power.marginPct > a.power.marginPct && rb.power.status !== 'over', b.power.marginPct < a.power.marginPct) });
  }
  const dc = b.cost.totalM - a.cost.totalM;
  if (Math.abs(dc) >= 0.05) out.push({ text: `Cost ${signed(dc, Math.abs(dc) < 10 ? 1 : 0).replace(/^([+−])/, '$1$')}M → $${b.cost.totalM.toFixed(1)}M of $${b.cost.budgetM.toFixed(0)}M`, tone: dc < 0 ? 'good' : 'bad' });
  const dg = b.data.generatedGbitDay - a.data.generatedGbitDay;
  const dk = b.data.capacityGbitDay - a.data.capacityGbitDay;
  if (Math.abs(dg) >= 0.05 || Math.abs(dk) >= Math.max(0.05, 0.01 * a.data.capacityGbitDay)) {
    out.push({ text: `Data: ${b.data.generatedGbitDay.toFixed(1)} Gbit/day made, ${b.data.capacityGbitDay.toFixed(1)} can be sent`, tone: toneOf(rank[rb.data.status] > rank[ra.data.status], rank[rb.data.status] < rank[ra.data.status]) });
  }
  if (Math.abs(b.comms.rateMbps - a.comms.rateMbps) >= Math.max(0.01, 0.01 * a.comms.rateMbps)) {
    out.push({ text: `Downlink ${b.comms.rateMbps.toFixed(b.comms.rateMbps < 10 ? 2 : 0)} Mbps (was ${a.comms.rateMbps.toFixed(a.comms.rateMbps < 10 ? 2 : 0)})`, tone: b.comms.rateMbps > a.comms.rateMbps ? 'good' : 'bad' });
  }
  if (b.time.launchMonth !== a.time.launchMonth) out.push({ text: `Launch moves to month ${b.time.launchMonth.toFixed(0)} (was ${a.time.launchMonth.toFixed(0)})`, tone: b.time.launchMonth < a.time.launchMonth ? 'good' : 'bad' });
  if (Math.abs(b.time.lifetimeYears - a.time.lifetimeYears) >= 0.05) out.push({ text: `Lifetime ${b.time.lifetimeYears.toFixed(1)} years (was ${a.time.lifetimeYears.toFixed(1)})`, tone: b.time.lifetimeYears > a.time.lifetimeYears ? 'good' : 'bad' });

  for (const r of b.requirements) {
    const before = a.requirements.find((x) => x.req.id === r.req.id);
    if (!before || before.met === r.met) continue;
    const word = r.met === 'goal' ? 'meets the goal' : r.met === 'threshold' ? 'meets the threshold' : 'is no longer met';
    out.push({ text: `${r.req.label} ${word} (${r.display})`, tone: metRank[r.met] > metRank[before.met] ? 'good' : 'bad' });
  }
  const fails = (x: Analysis) => new Set(x.issues.filter((i) => i.level === 'fail').map((i) => i.text));
  const fa = fails(a);
  for (const t of fails(b)) if (!fa.has(t)) out.push({ text: t, tone: 'bad' });
  return out;
}
