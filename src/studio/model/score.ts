/**
 * After the flight (docs/03 §8): what each requirement actually achieved, the score out of 1 000 (mission
 * success 400, value delivered 300, efficiency 200, decisions and teamwork 100), a rank, and the post-mission
 * analysis — what worked, what limited the mission, and what to try next — in plain words.
 */
import type { Line, ReqResult } from './analyze';
import type { Level } from './design';
import type { Objective, Requirement } from './scenarios';
import type { MissionRun } from './simulate';

export type Rank = 'Platinum' | 'Gold' | 'Silver' | 'Bronze' | 'Learning flight';

export interface FlownRequirement {
  req: Requirement;
  objective: Objective | null;
  level: Level;
  predicted: string;
  achieved: number;
  display: string;
  met: 'goal' | 'threshold' | 'fail';
  credit: number;
  why: string;
}

export interface Report {
  seed: number;
  name: string;
  scenario: string;
  difficulty: string;
  outcome: string;
  endReason: string;
  flownYears: number;
  score: { success: number; value: number; efficiency: number; decisions: number; total: number; rank: Rank };
  efficiencyParts: Line[];
  requirements: FlownRequirement[];
  objectives: { id: string; name: string; predicted: number; achieved: number }[];
  money: { budgetM: number; spentM: number; revenueM: number; leftM: number };
  data: { deliveredTbit: number; lostPct: number; expectedTbit: number };
  decisions: { title: string; chosen: string; quality: number; lesson?: string }[];
  worked: string[];
  limited: string[];
  tryNext: string[];
  /** Collaboration score from the team game (0–1), when played as a team. */
  teamwork?: number;
  /** The people on board, and how they fared (crewed missions). */
  crew?: { callSign: string; size: number; alive: boolean; doseMsv: number; moonDays: number; days: number };
}

// Platinum needs goal-level requirements: thresholds alone top out near 900
const rankOf = (t: number): Rank => (t >= 930 ? 'Platinum' : t >= 800 ? 'Gold' : t >= 600 ? 'Silver' : t >= 400 ? 'Bronze' : 'Learning flight');
const f1 = (x: number) => (Number.isFinite(x) ? (Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(1)) : '∞');

export function evaluate(run: MissionRun, opts: { assisted?: boolean; teamwork?: number } = {}): Report {
  const a = run.a, st = run.st, d = a.design, s = a.scenario;
  const operated = st.day > 0 && (st.phase === 'ended' || st.phase === 'operations');
  const flownYears = operated ? Math.max(0, st.day) / 365.25 : 0;
  const opsDays = Math.max(1, st.day);
  const uptime = operated ? st.scienceDays / opsDays : 0;
  const dataShare = st.expectedGbit > 0 ? st.deliveredGbit / st.expectedGbit : uptime;
  const health = (o: Objective | null) => {
    if (!o) return 1;
    const useful = d.instruments.filter((i) => (o.value[i] ?? 0) >= 0.5);
    return useful.length ? Math.max(...useful.map((i) => st.health[i] ?? 1)) : 1;
  };

  // ---------------------------------------------------------------- requirements as flown
  const requirements: FlownRequirement[] = a.requirements.map((r: ReqResult) => {
    let v = r.value;
    const m = r.req.metric;
    const h = health(r.objective);
    if (!operated && m !== 'launchMonth') v = r.req.better === 'lower' ? Infinity : 0;
    else if (m === 'lifetime') v = flownYears;
    else if (m === 'launchMonth') v = st.launchMonth;
    else if (m === 'gsd') v = h > 0 ? r.value * st.smear : Infinity;
    else if (m === 'revisit' || m === 'latency') v = r.value / Math.max(uptime * Math.max(h, 0.05), 0.02);
    else if (m === 'mapped' || m === 'relayCoverage') v = r.value * uptime * Math.min(1, h * 1.2);
    else if (m === 'marsMapped') v = 100 * (1 - Math.pow(1 - Math.min(r.value, 99.9) / 100, Math.max(0, dataShare)));
    else if (m === 'dataReturn') v = r.value * Math.max(0, dataShare);
    else if (m === 'capacity') v = r.value * h * ((st as { leased?: boolean }).leased ? 0.85 : 1);
    else if (m === 'relayRate') v = r.value * h;
    else if (m === 'crewDose') v = st.crew ? st.crew.doseMsv : r.value;
    else if (m === 'supplies') v = st.crew ? Math.max(0, st.crew.supplyDays) : 0;
    else if (m === 'moonDays') v = st.crew?.moonDays ?? 0;
    else if (m === 'downlink') v = r.value * st.linkFactor;
    else if (m === 'crewSize') v = st.crew?.alive ? r.value : 0;
    const ok = (x: number, y: number) => (r.req.better === 'lower' ? x <= y : x >= y);
    const met: FlownRequirement['met'] = Number.isNaN(v) ? 'fail' : ok(v, r.req.goal) ? 'goal' : ok(v, r.req.threshold) ? 'threshold' : 'fail';
    // aiming for the goal pays if you make it, and costs if you fall short
    const credit = r.level === 'goal' ? (met === 'goal' ? 1 : met === 'threshold' ? 0.6 : 0) : met === 'goal' ? 0.85 : met === 'threshold' ? 0.8 : 0;
    const shown = r.req.unit === '%' && v >= 99 && v < 100 ? v.toFixed(2) : f1(v);
    const display = Number.isFinite(v) ? `${shown} ${r.req.unit}` : r.req.better === 'lower' ? 'never' : `0 ${r.req.unit}`;
    const why = !operated && m !== 'launchMonth'
      ? 'The spacecraft never operated.'
      : met === r.met || m === 'launchMonth'
        ? r.why
        : `${r.why} In flight: ${uptime < 0.97 ? `working ${f1(uptime * 100)}% of the days` : ''}${h < 1 ? `${uptime < 0.97 ? ', ' : ''}instruments at ${f1(h * 100)}% quality` : ''}${dataShare < 0.97 && m !== 'gsd' ? `, ${f1(dataShare * 100)}% of the expected data delivered` : ''}.`;
    return { req: r.req, objective: r.objective, level: r.level, predicted: r.display, achieved: v, display, met, credit, why };
  });
  const weight = (r: FlownRequirement) => (!r.objective ? 1 : r.objective.id === d.primary ? 1 : 0.5);
  const wSum = requirements.reduce((acc, r) => acc + weight(r), 0);
  // a crew that does not come home is the whole result
  const crewLost = !!st.crew && !st.crew.alive;
  const success = operated && !crewLost ? (400 * requirements.reduce((acc, r) => acc + weight(r) * r.credit, 0)) / Math.max(1e-9, wSum) : 0;

  // ---------------------------------------------------------------- value delivered
  const objectives = Object.keys(a.value).map((id) => ({
    id,
    name: s.objectives.find((o) => o.id === id)?.name ?? id,
    predicted: a.value[id],
    achieved: Math.min(1.2, (st.value[id] ?? 0) + (st.bonus[id] ?? 0)),
  }));
  const vp = objectives.find((o) => o.id === d.primary)?.achieved ?? 0;
  const vs = objectives.filter((o) => o.id !== d.primary).reduce((acc, o) => acc + o.achieved, 0);
  const value = crewLost ? 0 : 300 * Math.min(1, vp + 0.35 * vs);

  // ---------------------------------------------------------------- efficiency
  const budgetM = a.cost.budgetM;
  const spentM = run.spentM();
  const net = spentM - st.revenueM;
  const leftM = budgetM - net;
  const budgetPts = !Number.isFinite(budgetM) ? 40 : leftM >= 0 ? 40 + 40 * Math.min(1, (leftM / budgetM) * 4) : Math.max(0, 40 + (200 * leftM) / budgetM);
  const band = (x: number, lo: number, hi: number) => (x < 0 ? 0 : x < lo ? 15 : x <= hi ? 30 : 20);
  const late = st.launchMonth - a.time.deadlineMonth;
  const lostShare = st.lostGbit / Math.max(1e-9, st.lostGbit + st.deliveredGbit);
  const efficiencyParts: Line[] = [
    { name: leftM >= 0 ? `Budget: $${f1(leftM)}M left` : `Budget: $${f1(-leftM)}M over`, value: budgetPts },
    { name: `Mass margin ${f1(a.mass.marginPct)}%`, value: band(a.mass.marginPct, 5, 60) },
    { name: `Power margin ${f1(a.power.marginPct)}%`, value: band(a.power.marginPct, 10, 80) },
    { name: late <= 0 ? 'Launched on schedule' : `Launched ${f1(late)} months late`, value: late <= 0 ? 30 : Math.max(0, 30 - 5 * late) },
    { name: `Data lost ${f1(lostShare * 100)}%`, value: 30 * (1 - lostShare) },
  ];
  // money is only well spent if the mission flew: a lost or shortened mission keeps part of these points
  const flownShare = a.crew ? Math.min(1, Math.max(0, st.day) / a.crew.days) : Math.min(1, flownYears / Math.max(0.25, d.plannedYears));
  const efficiency = efficiencyParts.reduce((acc, l) => acc + l.value, 0) * (0.4 + 0.6 * flownShare) * (crewLost ? 0.2 : 1);

  // ---------------------------------------------------------------- decisions (and teamwork, in the team game)
  const judged = run.events.filter((e) => e.quality !== undefined);
  let decisionsPts = judged.length ? 100 * (judged.reduce((acc, e) => acc + e.quality!, 0) / judged.length) : 75;
  if (opts.teamwork !== undefined) decisionsPts = 0.6 * decisionsPts + 40 * opts.teamwork;
  if (opts.assisted && a.difficulty !== 'cadet') decisionsPts *= 0.6;

  const total = Math.round(success + value + efficiency + decisionsPts);
  const failed = requirements.filter((r) => r.met === 'fail');
  const outcome = crewLost
    ? 'Crew lost'
    : !operated
    ? 'Mission lost'
    : st.endReason !== 'Mission complete'
      ? `Ended early (${st.endReason})`
      : failed.length === 0
        ? (requirements.every((r) => r.met === 'goal' || r.level === 'threshold') ? 'Full success' : 'Success')
        : failed.length <= requirements.length / 3 ? 'Partial success' : 'Mostly failed';

  // ---------------------------------------------------------------- post-mission analysis
  const worked: string[] = [];
  const limited: string[] = [];
  const tryNext: string[] = [];
  for (const r of requirements.filter((x) => x.met === 'goal')) worked.push(`${r.req.label} reached the goal (${r.display}).`);
  for (const e of judged.filter((x) => x.quality! >= 0.8)) worked.push(`“${e.options?.find((o) => o.id === e.chosen)?.label}” during “${e.title}” was a sound call. ${e.lesson ?? ''}`);
  if (lostShare < 0.01 && st.deliveredGbit > 0) worked.push(`Every bit of the ${f1(st.deliveredGbit / 1000)} Tbit of data reached the ground.`);
  if (leftM > 0 && Number.isFinite(budgetM)) worked.push(`The mission finished $${f1(leftM)}M under budget.`);
  if (st.endReason && st.endReason !== 'Mission complete') {
    const ev = [...run.events].reverse().find((e) => e.kind === 'failure');
    limited.push(`The mission ended ${operated ? (a.crew ? `on flight day ${Math.max(1, Math.round(st.day))}` : `after ${f1(flownYears)} years`) : 'before it could operate'}: ${st.endReason.toLowerCase()}. ${ev?.lesson ?? ''}`);
    if (/computer/i.test(st.endReason)) tryNext.push(d.redundant ? 'A radiation-hardened computer fails far less often.' : 'Carry a spare computer (Expert) or a more reliable one: one failure ended everything.');
    if (/decay/i.test(st.endReason)) tryNext.push('Fly higher, or add propulsion to hold the altitude against drag.');
    if (/launch/i.test(st.endReason)) tryNext.push(d.insurance ? 'Insurance got money back; a more reliable rocket lowers the odds.' : 'Insure the launch, or choose a rocket with a better record.');
    if (/propellant/i.test(st.endReason)) tryNext.push('Carry more propellant, or use a more efficient engine (electric for station keeping).');
    if (/debris/i.test(st.endReason)) tryNext.push('Carry propulsion so you can dodge debris.');
  }
  if (lostShare > 0.05) {
    limited.push(`${f1(lostShare * 100)}% of the data never reached the ground: the downlink or the storage could not keep up.`);
    tryNext.push('A faster band, more transmitter power, a better antenna, more ground stations or more onboard storage.');
  }
  if (operated && uptime < 0.95) limited.push(`${f1((1 - uptime) * opsDays)} days were lost to safe mode, failures and outages.`);
  for (const r of failed) {
    limited.push(`${r.objective ? `${r.objective.name}: ` : ''}${r.req.label} was ${r.display} against ${r.level === 'goal' ? r.req.goal : r.req.threshold} ${r.req.unit}. ${r.why}`);
  }
  for (const e of judged.filter((x) => x.quality! < 0.4)) limited.push(`“${e.options?.find((o) => o.id === e.chosen)?.label}” during “${e.title}” was a gamble. ${e.lesson ?? ''}`);
  if (leftM < 0) {
    limited.push(`The mission went $${f1(-leftM)}M over budget.`);
    tryNext.push('Cheaper parts, a cheaper launcher, fewer years of operations, or a bigger reserve for surprises.');
  }
  if (st.batteryWarned) tryNext.push('A bigger battery: each eclipse would drain it less and it would last longer.');
  if (st.radiationWarned) tryNext.push('A radiation-hardened computer, or a shorter mission in this orbit.');
  for (const i of a.issues.filter((x) => x.level !== 'info' && x.fix)) tryNext.push(i.fix!);
  if (leftM > 0.25 * budgetM && Number.isFinite(budgetM)) tryNext.push(`You had $${f1(leftM)}M to spare: a better instrument, a goal-level requirement or a second objective could have raised the score.`);

  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    seed: run.seed,
    name: d.name,
    scenario: s.name,
    difficulty: a.difficulty,
    outcome,
    endReason: st.endReason ?? '',
    flownYears,
    score: { success, value, efficiency, decisions: decisionsPts, total, rank: rankOf(total) },
    efficiencyParts,
    requirements,
    objectives,
    money: { budgetM, spentM, revenueM: st.revenueM, leftM },
    data: { deliveredTbit: st.deliveredGbit / 1000, lostPct: lostShare * 100, expectedTbit: st.expectedGbit / 1000 },
    decisions: judged.map((e) => ({ title: e.title, chosen: e.options?.find((o) => o.id === e.chosen)?.label ?? e.chosen ?? '', quality: e.quality!, lesson: e.lesson })),
    worked: uniq(worked).slice(0, 4),
    limited: uniq(limited).slice(0, 5),
    tryNext: uniq(tryNext).slice(0, 4),
    teamwork: opts.teamwork,
    crew: st.crew && a.crew ? { callSign: a.crew.callSign, size: a.crew.size, alive: st.crew.alive, doseMsv: st.crew.doseMsv, moonDays: st.crew.moonDays, days: Math.max(0, Math.round(st.day)) } : undefined,
  };
}
