/**
 * Building and flying the mission (docs/03 §6). A strip of stages (build, test, launch, commissioning, cruise,
 * operations), a mission clock with speed control, the mission log, the spacecraft against its planet, live
 * charts and the health board (and the crew, on a crewed flight). The run stops for each hands-on step (its
 * owner presses the button) and each decision (the team votes); problems in orbit come with the telemetry the
 * flight controllers would see. Launch day is a show: countdown, ignition, the climb, and the result.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import { LAUNCHERS } from '../model/catalog';
import { CALL_SIGNS } from '../model/crew';
import { INSTRUMENTS, type InstrumentId } from '../model/instruments';
import type { MissionRun, SimEvent, SimSample, Stage } from '../model/simulate';
import { canEdit, ownerOf } from '../model/team';
import { ROLES } from '../model/types';
import { SpacecraftView } from '../three/SpacecraftView';
import { useStudio } from '../state';
import { fmt } from './controls';
import { LaunchShow } from './LaunchShow';
import { sfx, type Sfx } from './sound';
import { VoteRow } from './team';

const SPEEDS = [
  { label: '❚❚', mult: 0 },
  { label: '1×', mult: 1 },
  { label: '4×', mult: 4 },
  { label: '16×', mult: 16 },
];

const START = new Date(2027, 0, 1);
const monthLabel = (m: number) => {
  if (!Number.isFinite(m)) return 'never';
  const d = new Date(START);
  d.setMonth(d.getMonth() + Math.round(m));
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/** A small line chart of one sampled quantity: a sky (or accent) line over a soft fade, as the design system draws charts. */
export function Spark({ samples, pick, label, format, color = '#60bee8' }: { samples: SimSample[]; pick: (s: SimSample) => number; label: string; format: (v: number) => string; color?: string }) {
  const W = 260, H = 64;
  const ys = samples.map(pick);
  const xs = samples.map((s) => s.day);
  const x0 = Math.min(...xs, 0), x1 = Math.max(...xs, 1);
  const y0 = 0, y1 = Math.max(...ys, 1e-9);
  const pts = xs.map((x, i) => `${(((x - x0) / (x1 - x0)) * W).toFixed(1)},${(H - ((ys[i] - y0) / (y1 - y0)) * (H - 6) - 3).toFixed(1)}`).join(' ');
  const last = ys.length ? ys[ys.length - 1] : 0;
  const fade = `fade-${label.replace(/\W/g, '')}`;
  return (
    <figure className="st-spark">
      <figcaption><span>{label}</span><b>{format(last)}</b></figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${format(last)}`}>
        <defs>
          <linearGradient id={fade} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="rgba(255,255,255,0.12)" />
        {samples.length > 1 && (
          <>
            <polygon points={`${pts} ${W},${H} 0,${H}`} fill={`url(#${fade})`} />
            <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </figure>
  );
}

export function Charts({ run }: { run: MissionRun }) {
  const s = run.samples;
  return (
    <div className="st-charts">
      {run.a.orbit.eclipseMin > 0 && <Spark samples={s} pick={(x) => x.soc} label="Battery left after an eclipse" format={(v) => `${v.toFixed(0)}%`} />}
      <Spark samples={s} pick={(x) => x.powerW} label="Solar power" format={fmt.w} color="#3792c2" />
      {run.a.data.generatedGbitDay > 0 && <Spark samples={s} pick={(x) => x.backlogGbit} label="Data waiting on board" format={fmt.gbit} color="#3792c2" />}
      {run.a.data.generatedGbitDay > 0 && <Spark samples={s} pick={(x) => x.deliveredGbit / 1000} label="Data delivered" format={(v) => `${v.toFixed(v < 10 ? 2 : 0)} Tbit`} />}
      <Spark samples={s} pick={(x) => x.value} label="Mission value" format={(v) => `${(v * 100).toFixed(0)}`} />
      <Spark samples={s} pick={(x) => x.spentM} label="Money spent" format={fmt.m} color="#3792c2" />
    </div>
  );
}

const KIND_ICON: Record<SimEvent['kind'], string> = { decision: '?', action: '▶', failure: '✕', info: 'i', milestone: '★', good: '✓' };

export function Timeline({ events, crew }: { events: SimEvent[]; crew?: boolean }) {
  return (
    <ol className="st-timeline">
      {[...events].reverse().map((e, k) => (
        <li key={`${e.id}-${k}`} className={e.kind}>
          <span className="st-tl-icon" aria-hidden>{KIND_ICON[e.kind]}</span>
          <div>
            <span className="st-tl-when">{e.when}{crew && e.role ? <span className="st-callsign">{CALL_SIGNS[e.role]}</span> : null}</span>
            <b>{e.title}</b>
            <p>{e.text}</p>
            {e.chosen && e.options && e.options.length > 1 && <p className="st-tl-choice">Chose: {e.options.find((o) => o.id === e.chosen)?.label}</p>}
            {e.outcome && <p className="st-tl-outcome">{e.outcome}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

const STAGES: { id: Stage; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'test', label: 'Test' },
  { id: 'launch', label: 'Launch' },
  { id: 'commission', label: 'Commission' },
  { id: 'cruise', label: 'Cruise' },
  { id: 'operate', label: 'Operate' },
  { id: 'ended', label: 'End' },
];

function Clock({ run }: { run: MissionRun }) {
  const st = run.st;
  const crew = run.a.crew;
  const stages = STAGES.filter((s) => s.id !== 'cruise' || run.a.orbit.transferDays + run.a.time.raiseDays > 3 || st.stage === 'cruise');
  const at = stages.findIndex((s) => s.id === st.stage);
  const total = run.plannedDays;
  const text =
    st.phase === 'development' ? `${st.stage === 'test' ? 'Testing' : 'Building'} · month ${Math.floor(st.month)} · launch ${monthLabel(st.launchMonth)}`
      : st.phase === 'cruise' ? `On the way · ${Math.max(0, -Math.round(st.day))} days to go`
        : st.phase === 'operations' ? (crew ? `${crew.callSign} · flight day ${Math.max(1, Math.round(st.day))} of ${total}` : `Operations · day ${Math.round(st.day)} of ${total} · year ${(st.day / 365.25).toFixed(1)}`)
          : st.endReason ?? 'Ended';
  return (
    <div className="st-clock">
      <ol aria-label="Stages">
        {stages.map((p, k) => <li key={p.id} className={k < at ? 'done' : k === at ? 'on' : ''}>{p.label}</li>)}
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
    ['Solar arrays', st.arrayFactor, st.arrayFactor < 1 ? `${Math.round(st.arrayFactor * 100)}% of the power` : st.phase === 'development' ? 'in the test hall' : 'deployed'],
    ['Battery', st.batteryHealth, `${(st.batteryHealth * 100).toFixed(0)}% of its charge`],
    ['Pointing', 1 / st.smear, st.smear > 1 ? 'degraded' : st.agility ? 'precise' : 'three wheels'],
    ['Radio link', st.linkFactor, st.linkFactor < 1 ? `${Math.round(st.linkFactor * 100)}% of the rate` : 'nominal'],
    ['Computer', st.alive ? 1 - st.resetLoss : 0, a.design.redundant ? (st.spareComputer ? 'spare ready' : 'on the spare') : 'single string'],
    ...(Object.keys(st.health) as InstrumentId[]).map((id) => [INSTRUMENTS[id].short, st.health[id] ?? 0, `${((st.health[id] ?? 0) * 100).toFixed(0)}%`] as [string, number, string]),
  ];
  return (
    <div>
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
        {a.data.generatedGbitDay > 0 && <div><span>Data delivered</span><b>{fmt.gbit(st.deliveredGbit)}</b></div>}
        {a.data.generatedGbitDay > 0 && <div><span>Data lost</span><b>{fmt.gbit(st.lostGbit)}</b></div>}
        <div><span>Radiation dose</span><b>{st.doseKrad.toFixed(1)} krad</b></div>
        <div><span>Δv left</span><b>{a.dv.capabilityMs > 0 ? `${Math.max(0, st.dvLeft).toFixed(0)} m/s` : 'no engine'}</b></div>
      </div>
    </div>
  );
}

const CREW_NAMES = ['Commander', 'Pilot', 'Mission specialist 1', 'Mission specialist 2'];
/** The crew when nobody at the table is flying: made-up names. */
const ASTRONAUTS = ['Ana Kiala', 'Bento Lunda', 'Carla Nzinga', 'Dário Mbala'];

function CrewPanel({ run }: { run: MissionRun }) {
  const team = useStudio((s) => s.team);
  const c = run.st.crew!, plan = run.a.crew!;
  const names = team.mode === 'solo' ? ASTRONAUTS : [...team.players.map((p) => p.name), ...ASTRONAUTS].slice(0, 4);
  const left = Math.max(0, run.plannedDays - Math.max(0, run.st.day));
  return (
    <div className="st-crew">
      <h3>Crew of {plan.callSign}</h3>
      <ul className="st-crew-list">
        {names.slice(0, plan.size).map((n, k) => (
          <li key={k} className={c.alive ? '' : 'lost'}><span className="st-crew-badge" aria-hidden>{k + 1}</span>{n}<em>{CREW_NAMES[k]}</em></li>
        ))}
      </ul>
      <div className={`st-health-row ${c.supplyDays < left ? 'bad' : c.supplyDays < left + 2 ? 'warn' : ''}`}>
        <span>Air, food</span>
        <span className="st-bar"><span style={{ width: `${Math.min(100, (c.supplyDays / plan.supplyDays) * 100)}%` }} /></span>
        <em>{c.supplyDays.toFixed(1)} days left</em>
      </div>
      <div className={`st-health-row ${c.doseMsv > 150 ? 'bad' : c.doseMsv > 80 ? 'warn' : ''}`}>
        <span>Radiation</span>
        <span className="st-bar"><span style={{ width: `${Math.min(100, (c.doseMsv / 150) * 100)}%` }} /></span>
        <em>{c.doseMsv.toFixed(0)} / 150 mSv</em>
      </div>
      <div className={`st-health-row ${c.morale < 0.6 ? 'warn' : ''}`}>
        <span>Morale</span>
        <span className="st-bar"><span style={{ width: `${Math.max(0, c.morale) * 100}%` }} /></span>
        <em>{c.morale >= 0.9 ? 'high' : c.morale >= 0.6 ? 'tired' : 'low'}</em>
      </div>
      <p className="st-sub">{c.alive ? `${c.moonDays} day${c.moonDays === 1 ? '' : 's'} at the Moon so far.` : 'The crew was lost.'}</p>
    </div>
  );
}

/** A small picture for each kind of step. */
const ART: Record<string, JSX.Element> = {
  vibration: <path d="M4 18h16M7 18v-3h10v3M9 15V8h6v7M3 11l2-2 2 2M17 11l2-2 2 2" />,
  tvac: <><rect x="5" y="4" width="14" height="16" rx="3" /><path d="M9 9h6v6H9zM12 2v2M12 20v2" /></>,
  deploy: <><rect x="10" y="9" width="4" height="6" /><path d="M10 12H3M14 12h7M3 9v6M21 9v6" /></>,
  compat: <><path d="M5 19 12 8l7 11" /><path d="M8.5 6.5a5 5 0 0 1 7 0M6.5 4.5a8 8 0 0 1 11 0" /></>,
  signal: <><path d="M5 19 12 8l7 11" /><path d="M8.5 6.5a5 5 0 0 1 7 0M6.5 4.5a8 8 0 0 1 11 0" /></>,
  rehearsal: <><rect x="4" y="5" width="16" height="11" rx="1" /><path d="M8 20h8M12 16v4M7 12l3-3 2 2 4-4" /></>,
  abort: <><path d="M12 3v10M9 6l3-3 3 3M8 21l4-8 4 8" /></>,
  eclss: <><circle cx="12" cy="12" r="8" /><path d="M8 12c1.5-2 2.5-2 4 0s2.5 2 4 0" /></>,
  launch: <><path d="M12 2c3 3 4 7 4 11l-4 3-4-3c0-4 1-8 4-11zM8 13l-3 4h4M16 13l3 4h-4M10 19l2 3 2-3" /></>,
  burn: <><path d="M12 3v8M8 11h8l-2 6h-4zM10 19l2 2 2-2" /></>,
  light: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  anomaly: <><path d="M12 3 2 20h20zM12 9v5M12 17v.5" /></>,
  storm: <><circle cx="7" cy="7" r="3" /><path d="M10 10l9 9M13 8l6 1M8 13l1 6" /></>,
  moon: <><path d="M15 3a9 9 0 1 0 6 13A7 7 0 0 1 15 3z" /></>,
  splash: <><path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M12 3v9M9 9l3 3 3-3" /></>,
};
/** The sound a step makes when its button is pressed. */
const STEP_SFX: Record<string, Sfx> = { vibration: 'shake', tvac: 'hiss', eclss: 'hiss', deploy: 'whoosh', compat: 'radio', signal: 'radio', rehearsal: 'beep', abort: 'stage', burn: 'burn', light: 'step', launch: 'none', splash: 'splash' };

function Art({ id }: { id?: string }) {
  return (
    <span className="st-art" aria-hidden>
      <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{ART[id ?? 'anomaly'] ?? ART.anomaly}</svg>
    </span>
  );
}

function StepCard({ run, onChange }: { run: MissionRun; onChange: () => void }) {
  const p = run.pending;
  const team = useStudio((s) => s.team);
  const { vote, act, teamOp } = useStudio.getState();
  // one shared screen: whoever owns this step gets the controls
  useEffect(() => {
    if (p?.role && team.mode === 'hotseat' && team.roles[p.role] !== team.active) teamOp({ t: 'active', player: team.roles[p.role] });
  }, [p?.index]);
  if (!p) return null;
  const solo = team.mode === 'solo';
  const action = p.kind === 'action';
  const owner = p.role ? ownerOf(team, p.role) : undefined;
  const mine = !p.role || solo || team.mode === 'hotseat' || canEdit(team, p.role) || canEdit(team, 'director');
  const votes = team.votes[p.index] ?? {};
  const waiting = team.players.filter((x) => votes[x.id] === undefined).map((x) => x.name);
  const canForce = team.mode === 'hotseat' || canEdit(team, 'director');
  const alarm = p.id.startsWith('anomaly:') || p.id.startsWith('flaw:') || p.id.startsWith('found:');
  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-labelledby="st-dec-title">
      <div className={`st-decision ${action ? 'action' : ''} ${alarm ? 'alarm' : ''}`}>
        <div className="st-dec-head">
          <Art id={p.art} />
          <div>
            <div className="st-kicker">
              {p.when} · {action ? 'your step' : solo ? 'decision' : 'team vote'}
              {p.role && <> · <span className={`st-role-chip ${p.role}`}>{run.a.crew ? CALL_SIGNS[p.role] : ROLES[p.role].short}</span></>}
              {!solo && owner && <b style={{ color: owner.color }}>{owner.name}</b>}
            </div>
            <h2 id="st-dec-title">{p.title}</h2>
          </div>
        </div>
        <p>{p.text}</p>
        {p.telemetry && (
          <table className="st-telemetry">
            <caption>Telemetry</caption>
            <tbody>
              {p.telemetry.map((r) => (
                <tr key={r.label} className={r.state}>
                  <th scope="row">{r.label}</th>
                  <td><i aria-hidden /> {r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {action ? (
          <div className="st-dec-options">
            {mine ? (
              <button type="button" className="st-primary big st-step-go" autoFocus data-guide="action" data-sfx={STEP_SFX[p.art ?? ''] ?? 'step'} onClick={() => { act(p.options![0].id); onChange(); }}>
                {p.options![0].label}
                <span>{p.options![0].explain}</span>
              </button>
            ) : (
              <p className="st-sub">Waiting for {owner?.name ?? 'its owner'} ({p.role ? ROLES[p.role].name : ''}) to do this step.</p>
            )}
          </div>
        ) : (
          <>
            <div className="st-dec-options">
              {p.options!.map((o, k) => (
                <div key={o.id} className="st-dec-option">
                  <button type="button" autoFocus={k === 0} data-guide={k === 0 ? 'action' : undefined} onClick={() => { vote(o.id); onChange(); }}>
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
          </>
        )}
      </div>
    </div>
  );
}

/** The sound an event makes when it lands in the log. */
function eventSound(e: SimEvent): Sfx {
  if (e.id === 'launch' || e.id === 'launch-failure') return 'none';
  if (e.id.startsWith('test:')) return e.outcome?.startsWith('Passed') ? 'good' : 'warn';
  if (e.id === 'end') return e.title === 'Splashdown' ? 'splash' : 'fanfare';
  if (e.id === 'arrive' || e.id === 'flyby') return 'orbit';
  if (e.kind === 'failure') return 'fail';
  if (e.kind === 'milestone') return 'good';
  return 'none';
}

export function Fly() {
  const run = useStudio((s) => s.run)!;
  const finish = useStudio((s) => s.finish);
  // re-render when the team decides, even while paused
  useStudio((s) => s.decided);
  const [speed, setSpeed] = useState(1);
  const [, setTick] = useState(0);
  const [show, setShow] = useState(false);
  const shown = useRef<MissionRun | null>(null);
  const heard = useRef({ run: null as MissionRun | null, events: 0, pending: -1, ended: false });
  const last = useRef(performance.now());
  const pause = useRef(false);
  pause.current = show;
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
      const mult = SPEEDS[speed].mult;
      if (!run.pending && !run.ended && mult > 0 && !pause.current) {
        const st = run.st;
        const rate = st.phase === 'development' ? 30 : st.phase === 'cruise' ? Math.max(10, run.plannedDays / 150) : Math.max(0.25, run.plannedDays / 150);
        run.advance(rate * mult * dt);
      }
      // sounds for whatever just happened
      const h = heard.current;
      if (h.run !== run) heard.current = { run, events: run.events.length, pending: -1, ended: false };
      else {
        for (const e of run.events.slice(h.events)) sfx(eventSound(e));
        h.events = run.events.length;
        if (run.pending && run.pending.index !== h.pending) {
          h.pending = run.pending.index;
          sfx(run.pending.id.startsWith('anomaly:') || run.pending.id.startsWith('flaw:') ? 'alarm' : run.pending.kind === 'action' ? 'beep' : 'warn');
        }
        if (run.ended && !h.ended) {
          h.ended = true;
          if (run.st.endReason !== 'Mission complete' && !/launch/i.test(run.st.endReason ?? '')) setTimeout(() => sfx('lost'), 400);
        }
      }
      // launch day: the show, once per flight
      if (shown.current !== run && run.events.some((e) => e.id === 'launch' && e.chosen)) {
        shown.current = run;
        setShow(true);
      }
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
  const crew = !!run.a.crew;
  const good = run.st.endReason === 'Mission complete' || run.st.endReason === 'Returned from Earth orbit';
  return (
    <div className="st-fly">
      <aside className="st-fly-left">
        <h3>{crew ? 'Flight loop' : 'Mission log'}</h3>
        <Timeline events={run.events} crew={crew} />
      </aside>
      <main className="st-fly-main">
        <div className="st-fly-head">
          <Clock run={run} />
          <div className="st-speed" role="group" aria-label="Simulation speed">
            {SPEEDS.map((s, k) => <button key={s.label} type="button" className={speed === k ? 'on' : ''} onClick={() => setSpeed(k)} aria-label={k === 0 ? 'Pause' : `Speed ${s.label}`}>{s.label}</button>)}
            <button type="button" onClick={toEnd} disabled={run.ended} title="Run until the next step, decision or the end">⏭</button>
          </div>
        </div>
        <div className="st-fly-craft">
          <SpacecraftView d={run.a.design} body={run.st.phase === 'development' ? 'earth' : run.a.scenario.body} />
          {run.ended && (
            <div className={`st-fly-end ${good ? 'good' : 'bad'}`}>
              <b>{run.st.endReason === 'Mission complete' && crew ? 'Splashdown: everyone home' : run.st.endReason}</b>
              <button type="button" className="st-primary big" data-guide="to-report" onClick={finish}>See the mission report →</button>
            </div>
          )}
        </div>
        <Charts run={run} />
      </main>
      <aside className="st-fly-right">
        {crew && run.st.crew && <CrewPanel run={run} />}
        <Health run={run} />
      </aside>
      {run.pending && !show && <StepCard run={run} onChange={() => setTick((t) => t + 1)} />}
      {show && <LaunchShow run={run} rocket={LAUNCHERS[run.a.design.launcher].name} onDone={() => setShow(false)} />}
    </div>
  );
}
