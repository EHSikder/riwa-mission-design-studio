/**
 * Flying the mission (docs/03 §6): a mission clock with speed control, the event timeline, the spacecraft, live
 * charts (battery, data on board, data delivered, value, money) and the health board. When an event needs a
 * decision the run pauses and the team chooses.
 */
import { useEffect, useRef, useState } from 'react';
import { INSTRUMENTS, type InstrumentId } from '../model/instruments';
import type { MissionRun, SimEvent, SimSample } from '../model/simulate';
import { SpacecraftView } from '../three/SpacecraftView';
import { canEdit } from '../model/team';
import { useStudio } from '../state';
import { fmt } from './controls';
import { VoteRow } from './team';

const SPEEDS = [
  { label: '❚❚', days: 0 },
  { label: '1×', days: 15 },
  { label: '4×', days: 60 },
  { label: '16×', days: 240 },
];

const START = new Date(2027, 0, 1);
const monthLabel = (m: number) => {
  if (!Number.isFinite(m)) return 'never';
  const d = new Date(START);
  d.setMonth(d.getMonth() + Math.round(m));
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/** A small line chart of one sampled quantity. */
export function Spark({ samples, pick, label, format, color = '#5ad1ff', min }: { samples: SimSample[]; pick: (s: SimSample) => number; label: string; format: (v: number) => string; color?: string; min?: number }) {
  const W = 260, H = 64;
  const ys = samples.map(pick);
  const xs = samples.map((s) => s.day);
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, 1);
  const y0 = min ?? Math.min(...ys, 0), y1 = Math.max(...ys, y0 + 1e-9);
  const pts = xs.map((x, i) => `${(((x - x0) / (x1 - x0)) * W).toFixed(1)},${(H - ((ys[i] - y0) / (y1 - y0)) * (H - 6) - 3).toFixed(1)}`).join(' ');
  const last = ys.length ? ys[ys.length - 1] : 0;
  return (
    <figure className="st-spark">
      <figcaption><span>{label}</span><b>{format(last)}</b></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${format(last)}`}>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="rgba(255,255,255,0.12)" />
        {samples.length > 1 && <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />}
      </svg>
    </figure>
  );
}

export function Charts({ run }: { run: MissionRun }) {
  const s = run.samples;
  return (
    <div className="st-charts">
      {run.a.orbit.eclipseMin > 0 && <Spark samples={s} pick={(x) => x.soc} min={0} label="Battery left after an eclipse" format={(v) => `${v.toFixed(0)}%`} color="#4fd18b" />}
      <Spark samples={s} pick={(x) => x.powerW} min={0} label="Solar power" format={fmt.w} color="#ffb547" />
      {run.a.data.generatedGbitDay > 0 && <Spark samples={s} pick={(x) => x.backlogGbit} min={0} label="Data waiting on board" format={fmt.gbit} color="#ff7ad9" />}
      {run.a.data.generatedGbitDay > 0 && <Spark samples={s} pick={(x) => x.deliveredGbit / 1000} min={0} label="Data delivered" format={(v) => `${v.toFixed(v < 10 ? 2 : 0)} Tbit`} />}
      <Spark samples={s} pick={(x) => x.value} min={0} label="Mission value" format={(v) => `${(v * 100).toFixed(0)}`} color="#b49cff" />
      <Spark samples={s} pick={(x) => x.spentM} min={0} label="Money spent" format={fmt.m} color="#8fd3ff" />
    </div>
  );
}

const KIND_ICON: Record<SimEvent['kind'], string> = { decision: '?', failure: '✕', info: 'i', milestone: '★', good: '✓' };

export function Timeline({ events }: { events: SimEvent[] }) {
  return (
    <ol className="st-timeline">
      {[...events].reverse().map((e, k) => (
        <li key={`${e.id}-${k}`} className={e.kind}>
          <span className="st-tl-icon" aria-hidden>{KIND_ICON[e.kind]}</span>
          <div>
            <span className="st-tl-when">{e.when}</span>
            <b>{e.title}</b>
            <p>{e.text}</p>
            {e.chosen && e.options && <p className="st-tl-choice">Chose: {e.options.find((o) => o.id === e.chosen)?.label}</p>}
            {e.outcome && <p className="st-tl-outcome">{e.outcome}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Clock({ run }: { run: MissionRun }) {
  const st = run.st;
  const total = Math.round(run.a.design.plannedYears * 365.25);
  const at = ['development', 'cruise', 'operations', 'ended'].indexOf(st.phase);
  const text =
    st.phase === 'development' ? `Building · month ${Math.floor(st.month)} · launch planned ${monthLabel(st.launchMonth)}`
      : st.phase === 'cruise' ? `On the way · ${Math.max(0, -Math.round(st.day))} days to the operating orbit`
        : st.phase === 'operations' ? `Operations · day ${Math.round(st.day)} of ${total} · year ${(st.day / 365.25).toFixed(1)}`
          : st.endReason ?? 'Ended';
  return (
    <div className="st-clock">
      <ol>
        {['Build', 'Launch & cruise', 'Operations', 'End'].map((p, k) => <li key={p} className={k < at ? 'done' : k === at ? 'on' : ''}>{p}</li>)}
      </ol>
      <b>{text}</b>
      {st.phase === 'operations' && <span className="st-clock-bar"><span style={{ width: `${Math.min(100, (st.day / total) * 100)}%` }} /></span>}
    </div>
  );
}

function Health({ run }: { run: MissionRun }) {
  const st = run.st, a = run.a;
  const spent = run.spentM();
  const rows: [string, number, string][] = [
    ['Solar arrays', st.arrayFactor, st.arrayFactor < 1 ? 'one wing stuck' : 'deployed'],
    ['Battery', st.batteryHealth, `${(st.batteryHealth * 100).toFixed(0)}% of its charge`],
    ['Pointing', 1 / st.smear, st.smear > 1 ? 'degraded' : st.agility ? 'precise' : 'three wheels'],
    ['Computer', st.alive ? 1 : 0, a.design.redundant ? (st.spareComputer ? 'spare ready' : 'on the spare') : 'single string'],
    ...(Object.keys(st.health) as InstrumentId[]).map((id) => [INSTRUMENTS[id].short, st.health[id] ?? 0, `${((st.health[id] ?? 0) * 100).toFixed(0)}%`] as [string, number, string]),
  ];
  return (
    <div className="st-health">
      <h3>Spacecraft health</h3>
      {rows.map(([n, v, t]) => (
        <div key={n} className={`st-health-row ${v < 0.5 ? 'bad' : v < 0.9 ? 'warn' : ''}`}>
          <span>{n}</span>
          <span className="st-bar"><span style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} /></span>
          <em>{t}</em>
        </div>
      ))}
      {st.safeDays > 0 && <p className="st-safe">SAFE MODE · {st.safeDays.toFixed(1)} days left</p>}
      <h3>Resources in flight</h3>
      <div className="st-facts two">
        <div><span>Money spent</span><b>{fmt.m(spent)}</b></div>
        <div><span>Budget</span><b>{Number.isFinite(a.cost.budgetM) ? fmt.m(a.cost.budgetM) : '∞'}</b></div>
        <div><span>Data delivered</span><b>{fmt.gbit(st.deliveredGbit)}</b></div>
        <div><span>Data lost</span><b>{fmt.gbit(st.lostGbit)}</b></div>
        <div><span>Radiation dose</span><b>{st.doseKrad.toFixed(1)} krad</b></div>
        <div><span>Δv left</span><b>{a.dv.capabilityMs > 0 ? `${Math.max(0, st.dvLeft).toFixed(0)} m/s` : 'no engine'}</b></div>
      </div>
    </div>
  );
}

function Decision({ run, onChange }: { run: MissionRun; onChange: () => void }) {
  const p = run.pending;
  const team = useStudio((s) => s.team);
  const vote = useStudio((s) => s.vote);
  if (!p) return null;
  const solo = team.mode === 'solo';
  const votes = team.votes[p.index] ?? {};
  const waiting = team.players.filter((x) => votes[x.id] === undefined).map((x) => x.name);
  const canForce = team.mode === 'hotseat' || canEdit(team, 'director');
  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-labelledby="st-dec-title">
      <div className="st-decision">
        <div className="st-kicker">{p.when} · {solo ? 'decision' : 'team vote'}</div>
        <h2 id="st-dec-title">{p.title}</h2>
        <p>{p.text}</p>
        <div className="st-dec-options">
          {p.options!.map((o) => (
            <div key={o.id} className="st-dec-option">
              <button type="button" onClick={() => { vote(o.id); onChange(); }}>
                <b>{o.label}</b>
                <span>{o.explain}</span>
              </button>
              {!solo && <VoteRow option={o.id} index={p.index} />}
            </div>
          ))}
        </div>
        {!solo && (
          <div className="st-dec-foot">
            <span className="st-sub">{waiting.length ? `Waiting for ${waiting.join(', ')}.` : 'Everyone has voted.'} Most votes wins; a tie goes to the Mission Director.</span>
            {canForce && Object.keys(votes).length > 0 && <button type="button" onClick={() => { vote('', { now: true }); onChange(); }}>Decide now</button>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Fly() {
  const run = useStudio((s) => s.run)!;
  const finish = useStudio((s) => s.finish);
  // re-render when the team decides, even while paused
  useStudio((s) => s.decided);
  const [speed, setSpeed] = useState(2);
  const [, setTick] = useState(0);
  const last = useRef(performance.now());
  useEffect(() => {
    // a timer rather than animation frames: it keeps the mission clock (and the team's shared decisions)
    // moving when the tab is in the background; each tick covers the real time since the last one
    const step = () => {
      const now = performance.now();
      const dt = Math.min(0.5, (now - last.current) / 1000);
      last.current = now;
      // a decision the team has already made (on this screen or another) is applied when the run reaches it
      const decided = run.pending ? useStudio.getState().decided[run.pending.index] : undefined;
      if (decided !== undefined) run.choose(decided);
      if (!run.pending && !run.ended && SPEEDS[speed].days > 0) run.advance(SPEEDS[speed].days * dt * (run.st.phase === 'development' ? 2 : 1));
      setTick((t) => t + 1);
    };
    last.current = performance.now();
    const id = setInterval(step, 50);
    return () => clearInterval(id);
  }, [run, speed]);
  const toEnd = () => {
    run.advance(1e6);
    setTick((t) => t + 1);
  };
  return (
    <div className="st-fly">
      <aside className="st-fly-left">
        <h3>Mission log</h3>
        <Timeline events={run.events} />
      </aside>
      <main className="st-fly-main">
        <div className="st-fly-head">
          <Clock run={run} />
          <div className="st-speed" role="group" aria-label="Simulation speed">
            {SPEEDS.map((s, k) => <button key={s.label} type="button" className={speed === k ? 'on' : ''} onClick={() => setSpeed(k)} aria-label={k === 0 ? 'Pause' : `Speed ${s.label}`}>{s.label}</button>)}
            <button type="button" onClick={toEnd} disabled={run.ended} title="Run until the next decision or the end">⏭</button>
          </div>
        </div>
        <div className="st-fly-craft">
          <SpacecraftView d={run.a.design} />
          {run.ended && (
            <div className={`st-fly-end ${run.st.endReason === 'Mission complete' ? 'good' : 'bad'}`}>
              <b>{run.st.endReason}</b>
              <button type="button" className="st-primary big" onClick={finish}>See the mission report →</button>
            </div>
          )}
        </div>
        <Charts run={run} />
      </main>
      <aside className="st-fly-right">
        <Health run={run} />
      </aside>
      {run.pending && <Decision run={run} onChange={() => setTick((t) => t + 1)} />}
    </div>
  );
}
