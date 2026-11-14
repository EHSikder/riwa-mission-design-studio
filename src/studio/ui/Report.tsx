/**
 * The mission report and post-mission analysis (docs/03 §8): the score and its parts, every requirement as
 * predicted and as flown with the reason, the value of each objective, the flight charts, what worked, what
 * limited the mission and what to try next, the decisions, a comparison with this session's other flights,
 * and the local leaderboard. From here: improve the design, fly again, save, share or print.
 */
import { useEffect, useState } from 'react';
import { DIFFICULTY } from '../model/design';
import { realMissionsLike } from '../model/realMissions';
import { listRooms } from '../net/room';
import { useStudio } from '../state';
import { saveDesign, shareLink, topScores } from '../storage';
import { StatusBadge } from './controls';
import { Charts, Timeline } from './Fly';
import { TeamworkPanel } from './team';

const PARTS = [
  { key: 'success', label: 'Mission success', max: 400, explain: 'Requirements met: goals you aimed for and reached count most.' },
  { key: 'value', label: 'Value delivered', max: 300, explain: 'What the customer actually got: data, service, science, over the whole mission.' },
  { key: 'efficiency', label: 'Efficient use of resources', max: 200, explain: 'Money left, healthy margins, on schedule, no data lost.' },
  { key: 'decisions', label: 'Decisions and teamwork', max: 100, explain: 'How sound the team\'s calls were when things happened, and (in a team game) how well the team worked together.' },
] as const;

/** Every team on this network that flew the same mission at the same difficulty (competitive play). */
function RoomBoard() {
  const scenario = useStudio((s) => s.scenario);
  const difficulty = useStudio((s) => s.difficulty);
  const room = useStudio((s) => s.room);
  const [rows, setRows] = useState<{ room: string; team: string; name: string; total: number; rank: string }[]>([]);
  useEffect(() => {
    if (!room) return;
    let alive = true;
    const load = () => listRooms().then((rooms) => {
      if (!alive) return;
      setRows(rooms.filter((x) => x.scenario === scenario && x.difficulty === difficulty)
        .flatMap((x) => x.flights.map((f) => ({ room: x.code, team: f.team.join(', '), name: f.name, total: f.total, rank: f.rank })))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10));
    });
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, [room, scenario, difficulty]);
  if (!room) return null;
  return (
    <>
      <h3>Teams on this network</h3>
      {rows.length === 0 ? <p className="st-sub">No other team has flown this mission yet.</p> : (
        <ol className="st-board">
          {rows.map((b, k) => <li key={k} className={b.room === room.code ? 'on' : ''}><span>{b.team}</span><span className="st-dim">{b.name}</span><b>{b.total}</b></li>)}
        </ol>
      )}
    </>
  );
}

/** Real missions closest to the design that flew, as NASA's "Build It Yourself: Telescope" game shows its players. */
function RealMissions() {
  const run = useStudio((s) => s.run);
  if (!run) return null;
  const like = realMissionsLike(run.a);
  if (!like.length) return null;
  return (
    <section className="st-card-panel wide">
      <h3>Real missions like yours</h3>
      <div className="st-real">
        {like.map(({ mission: m, why }) => (
          <article key={m.id}>
            <b>{m.name}</b>
            <span className="st-dim">{m.who} · {m.year}</span>
            <p>{m.what}</p>
            {why.length > 0 && <p className="st-real-why">Like yours: {why.join(', ')}.</p>}
            {m.link && <a href={m.link} target="_blank" rel="noreferrer">Learn more →</a>}
          </article>
        ))}
      </div>
      <p className="st-sub">The idea comes from NASA's "Build It Yourself: Telescope" game, which ends by showing the real telescopes your design resembles.</p>
    </section>
  );
}

export function ReportScreen() {
  const report = useStudio((s) => s.report)!;
  const reports = useStudio((s) => s.reports);
  const run = useStudio((s) => s.run)!;
  const { setPhase, fly, scenario, difficulty } = useStudio.getState();
  const [note, setNote] = useState<string | null>(null);
  const board = scenario ? topScores(scenario, difficulty) : [];
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(null), 2500); };
  const r = report;
  return (
    <div className="st-report">
      <header className={`st-report-hero rank-${r.score.rank.split(' ')[0].toLowerCase()}`}>
        <div>
          <div className="st-kicker">Mission report · {r.scenario} · {DIFFICULTY[r.difficulty as keyof typeof DIFFICULTY].name}</div>
          <h2>{r.name}</h2>
          <p className="st-outcome">{r.outcome}{r.crew ? ` · ${r.crew.days}-day flight · ${r.crew.alive ? 'everyone came home' : 'the crew was lost'}` : r.flownYears > 0 ? ` · ${r.flownYears.toFixed(1)} years of operations` : ''}</p>
        </div>
        <div className="st-score">
          <b>{r.score.total}</b>
          <span>/ 1000</span>
          <em>{r.score.rank}</em>
        </div>
      </header>

      <div className="st-report-actions">
        <button type="button" className="st-primary" onClick={() => setPhase('design')}>Improve the design</button>
        <button type="button" onClick={() => fly()}>Fly again (new luck)</button>
        <button type="button" onClick={() => fly(r.seed)} title="Same random events: the fair way to test a design change">Fly again (same luck)</button>
        <button type="button" onClick={() => { saveDesign(r.design); flash('Design saved on this computer.'); }}>Save design</button>
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(shareLink(r.design)); flash('Share link copied: anyone opening it gets this design.'); } catch { flash(shareLink(r.design)); } }}>Copy share link</button>
        <button type="button" className="st-ghost" onClick={() => window.print()}>Print</button>
        {note && <span className="st-flash" role="status">{note}</span>}
      </div>

      <div className="st-report-grid">
        {r.crew && (
          <section className="st-card-panel wide">
            <h3>The crew of {r.crew.callSign}</h3>
            <div className="st-facts">
              <div><span>Astronauts</span><b>{r.crew.size}, {r.crew.alive ? 'all home safe' : 'lost'}</b></div>
              <div><span>Radiation per astronaut</span><b>{r.crew.doseMsv.toFixed(0)} mSv (career limit 600)</b></div>
              <div><span>Days at the Moon</span><b>{r.crew.moonDays}</b></div>
            </div>
          </section>
        )}
        <section className="st-card-panel">
          <h3>Score</h3>
          {PARTS.map((p) => {
            const v = r.score[p.key];
            return (
              <div key={p.key} className="st-scorebar" title={p.explain}>
                <span>{p.label}</span>
                <span className="st-bar"><span style={{ width: `${(v / p.max) * 100}%` }} /></span>
                <b>{v.toFixed(0)} / {p.max}</b>
              </div>
            );
          })}
          <h3>Efficiency in detail</h3>
          {r.efficiencyParts.map((l) => <div key={l.name} className="st-mini-row"><span>{l.name}</span><b>{l.value.toFixed(0)}</b></div>)}
          <h3>Value of each objective</h3>
          {r.objectives.map((o) => (
            <div key={o.id} className="st-scorebar">
              <span>{o.name}</span>
              <span className="st-bar two"><span style={{ width: `${Math.min(100, o.achieved * 100)}%` }} /><i style={{ left: `${Math.min(100, o.predicted * 100)}%` }} /></span>
              <b>{(o.achieved * 100).toFixed(0)}%</b>
            </div>
          ))}
          <p className="st-sub">The tick marks what the design promised before flight.</p>
        </section>

        <section className="st-card-panel">
          <h3>Why it went this way</h3>
          {r.worked.length > 0 && <><h4 className="st-good">What worked</h4><ul className="st-why">{r.worked.map((t) => <li key={t}>{t}</li>)}</ul></>}
          {r.limited.length > 0 && <><h4 className="st-bad">What limited the mission</h4><ul className="st-why">{r.limited.map((t) => <li key={t}>{t}</li>)}</ul></>}
          {r.tryNext.length > 0 && <><h4 className="st-next">Try next time</h4><ul className="st-why">{r.tryNext.map((t) => <li key={t}>{t}</li>)}</ul></>}
        </section>

        <RealMissions />



        <section className="st-card-panel wide">
          <h3>Requirements: promised and delivered</h3>
          <table className="st-table">
            <thead><tr><th>Requirement</th><th>Target</th><th>Predicted</th><th>Flown</th><th /></tr></thead>
            <tbody>
              {r.requirements.map((q) => (
                <tr key={q.req.id} title={q.why}>
                  <td>{q.objective ? <span className="st-dim">{q.objective.name}: </span> : null}{q.req.label}</td>
                  <td className="mono">{q.level === 'goal' ? 'goal' : 'threshold'} {q.req.better === 'lower' ? '≤' : '≥'} {q.level === 'goal' ? q.req.goal : q.req.threshold} {q.req.unit}</td>
                  <td className="mono">{q.predicted}</td>
                  <td className="mono">{q.display}</td>
                  <td><StatusBadge status={q.met === 'fail' ? 'fail' : q.met === 'goal' || q.level === 'threshold' ? 'good' : 'warn'} label={q.met === 'goal' ? 'Goal' : q.met === 'threshold' ? 'Threshold' : 'Missed'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="st-sub">Hover a row for the reason.</p>
        </section>

        <section className="st-card-panel wide">
          <h3>The flight</h3>
          <Charts run={run} />
        </section>

        <section className="st-card-panel">
          <h3>Decisions</h3>
          {r.decisions.length === 0 ? <p className="st-sub">No decisions were needed on this flight.</p> : (
            <ul className="st-why">
              {/* the same call made again (a standing flight rule) is listed once, with a count */}
              {Object.values(r.decisions.reduce<Record<string, (typeof r.decisions)[number] & { n: number }>>((acc, x) => {
                const k = `${x.title}|${x.chosen}`;
                acc[k] = acc[k] ? { ...acc[k], n: acc[k].n + 1 } : { ...x, n: 1 };
                return acc;
              }, {})).map((x) => (
                <li key={`${x.title}|${x.chosen}`}>
                  <b>{x.title}{x.n > 1 ? ` ×${x.n}` : ''}:</b> {x.chosen}{' '}
                  <StatusBadge status={x.quality >= 0.75 ? 'good' : x.quality >= 0.45 ? 'warn' : 'fail'} label={x.quality >= 0.75 ? 'sound' : x.quality >= 0.45 ? 'debatable' : 'risky'} />
                  {x.lesson && <span className="st-dim"> {x.lesson}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        {r.team && <TeamworkPanel tw={r.team} />}

        <section className="st-card-panel">
          <h3>Mission log</h3>
          <div className="st-report-log"><Timeline events={run.events} crew={!!r.crew} /></div>
        </section>

        {reports.length > 1 && (
          <section className="st-card-panel wide">
            <h3>Your flights this session</h3>
            <table className="st-table">
              <thead><tr><th>#</th><th>Design</th><th>Mass</th><th>Cost</th><th>Outcome</th><th>Score</th></tr></thead>
              <tbody>
                {reports.map((x, k) => (
                  <tr key={k} className={x === r ? 'on' : ''}>
                    <td>{k + 1}</td>
                    <td>{x.name}</td>
                    <td className="mono">{x.design.platform} · {x.design.instruments.length} instr.</td>
                    <td className="mono">${x.money.spentM.toFixed(1)}M</td>
                    <td>{x.outcome}</td>
                    <td className="mono"><b>{x.score.total}</b> {x.score.rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section className="st-card-panel">
          <h3>Leaderboard · {r.scenario} · {DIFFICULTY[r.difficulty as keyof typeof DIFFICULTY].name}</h3>
          <ol className="st-board">
            {board.map((b, k) => <li key={k} className={b.total === r.score.total && b.name === r.name ? 'on' : ''}><span>{b.name}</span><span className="st-dim">{b.team}</span><b>{b.total}</b></li>)}
          </ol>
          <p className="st-sub">Scores stay on this computer. Seed {r.seed.toString(16).toUpperCase()}.</p>
          <RoomBoard />
        </section>
      </div>
    </div>
  );
}
