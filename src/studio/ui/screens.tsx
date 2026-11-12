/**
 * The studio's screens around the design desks: setting up a game (mission, difficulty, players), the
 * customer's brief (objectives and how ambitious each requirement is), and the mission review board before launch.
 */
import { useEffect, useState } from 'react';
import { DIFFICULTY } from '../model/design';
import { SCENARIOS } from '../model/scenarios';
import { RESOURCES, ROLES, type Difficulty, type ResourceId, type RoleId, type ScenarioId } from '../model/types';
import { cleanCode, roomsAvailable } from '../net/room';
import { useStudio } from '../state';
import { StatusBadge, fmt } from './controls';
import { IssueList, ResourceIcon } from './Dashboard';
import { ObjectivesPicker, RequirementsTable } from './desks';
import { GoPoll, TeamPicker, type PlayMode } from './team';
import { canEdit, ownerOf } from '../model/team';

const ORDER: ScenarioId[] = ['tutorial', 'angola-eo', 'geo-comms', 'lunar-relay', 'mars-orbiter'];

type Step = 'mission' | 'difficulty' | 'players' | 'join';
const STEPS: { id: Step; label: string }[] = [
  { id: 'mission', label: 'Mission' },
  { id: 'difficulty', label: 'Difficulty' },
  { id: 'players', label: 'Players' },
];
const BACK: Partial<Record<Step, Step>> = { difficulty: 'mission', players: 'difficulty', join: 'mission' };

/** Setting up a game, one decision per screen: the mission, then the difficulty, then who plays. Back (or Esc) returns. */
export function MissionSelect() {
  const { start, host, join } = useStudio.getState();
  // a #room=CODE link opens straight on "join"
  const linked = location.hash.startsWith('#room=') ? cleanCode(location.hash.slice(6)) : '';
  const [step, setStep] = useState<Step>(linked ? 'join' : 'mission');
  const [scenario, setScenario] = useState<ScenarioId>('angola-eo');
  const [difficulty, setDifficulty] = useState<Difficulty>('engineer');
  const [mode, setMode] = useState<PlayMode>('solo');
  const [names, setNames] = useState<string[]>(['', '']);
  const [code, setCode] = useState(linked);
  // a copy on a static host has no room server: network rooms are off there
  const [rooms, setRooms] = useState<boolean | null>(null);
  useEffect(() => {
    roomsAvailable().then((ok) => {
      setRooms(ok);
      if (!ok) {
        setMode((m) => (m === 'host' ? 'solo' : m));
        setStep((s) => (s === 'join' ? 'mission' : s));
      }
    });
  }, []);
  const sc = SCENARIOS[scenario];
  const at = STEPS.findIndex((s) => s.id === step);
  const back = BACK[step];
  const pickScenario = (id: ScenarioId) => {
    setScenario(id);
    // the tutorial is Cadet only; leaving it goes back to the real numbers
    if (SCENARIOS[id].tutorial) setDifficulty('cadet');
    else if (sc.tutorial) setDifficulty('engineer');
  };
  const go = () => {
    const named = names.map((n, i) => n.trim() || `Player ${i + 1}`);
    if (step === 'join') join(code, named[0]);
    else if (mode === 'solo') start({ scenario, difficulty, mode: 'solo', names: ['You'] });
    else if (mode === 'hotseat') start({ scenario, difficulty, mode: 'hotseat', names: named });
    else host({ scenario, difficulty, name: named[0] });
  };
  return (
    <div className="st-setup" onKeyDown={(e) => { if (e.key === 'Escape' && back) setStep(back); }}>
      <header className="st-setup-head">
        <div className="st-brand"><b>Space Underdogs</b><span>Mission design game</span></div>
        {step !== 'join' && (
          <ol className="st-setup-steps" aria-label="Setting up the game">
            {STEPS.map((s, k) => (
              <li key={s.id}>
                <button type="button" className={k === at ? 'on' : k < at ? 'done' : ''} disabled={k > at} aria-current={k === at ? 'step' : undefined} onClick={() => setStep(s.id)}>
                  <span>{String(k + 1).padStart(2, '0')}</span>{s.label}
                </button>
              </li>
            ))}
          </ol>
        )}
      </header>

      <div key={step} className="st-setup-body st-reveal">
        {step === 'mission' && (
          <>
            <p className="st-small-note">This game is at its best on a laptop or desktop. It works on a phone, with more scrolling.</p>
            <div className="st-kicker">NASA Space Apps 2026 · Space Mission Design Game</div>
            <h1>Choose your <em>mission</em>.</h1>
            <p className="st-lead">
              Decide what it is for, design the spacecraft, choose the orbit and the rocket, and keep six resources in balance: mass,
              power, money, data, communications and time. Then fly it, and find out what happened, and why.
            </p>
            <div className="st-scen-grid" role="radiogroup" aria-label="Mission">
              {ORDER.map((id) => {
                const s = SCENARIOS[id];
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={scenario === id}
                    autoFocus={scenario === id}
                    className={`st-scen ${scenario === id ? 'on' : ''} body-${s.tutorial ? 'tutorial' : s.body}`}
                    onClick={() => pickScenario(id)}
                    onDoubleClick={() => setStep('difficulty')}
                  >
                    <span className="st-scen-art" aria-hidden />
                    <span className="st-scen-name">{s.name}</span>
                    <span className="st-scen-tag">{s.tagline}</span>
                    <span className="st-scen-meta">{s.tutorial ? 'Tutorial · 10 minutes' : `${fmt.m(s.budgetM)} · launch within ${s.deadlineMonths} months`}</span>
                    <span className="st-scen-crit">
                      {s.critical.map((r: ResourceId) => <span key={r}><ResourceIcon id={r} /> {RESOURCES[r].name}</span>)}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="st-credit">
              Earth map: NASA Blue Marble Next Generation. Stars: NASA SVS Deep Star Maps 2020. Built with AI assistance.
              Made for NASA Space Apps 2026; not endorsed by NASA or GGPEN.
            </p>
          </>
        )}

        {step === 'difficulty' && (
          <>
            <div className="st-kicker">{sc.name}</div>
            <h1>How <em>hard</em>?</h1>
            <p className="st-lead">{sc.tutorial ? 'The tutorial is played on Cadet, with a coach for every step.' : 'The same mission, with more or less money, time and luck.'}</p>
            <div className="st-diff-row" role="radiogroup" aria-label="Difficulty">
              {(Object.keys(DIFFICULTY) as Difficulty[]).map((k) => {
                const budget = sc.budgetM * DIFFICULTY[k].budget;
                return (
                  <button key={k} type="button" role="radio" aria-checked={difficulty === k} autoFocus={difficulty === k} className={difficulty === k ? 'on' : ''} disabled={!!sc.tutorial && k !== 'cadet'} onClick={() => setDifficulty(k)} onDoubleClick={() => setStep('players')}>
                    <b>{DIFFICULTY[k].name}</b>
                    <span>{DIFFICULTY[k].explain}</span>
                    <em>Budget {Number.isFinite(budget) ? fmt.m(budget) : 'unlimited'} · {DIFFICULTY[k].events ? 'surprises in flight' : 'no random failures'}</em>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 'players' && (
          <>
            <div className="st-kicker">{sc.name} · {DIFFICULTY[difficulty].name}</div>
            <h1>Who is <em>flying</em>?</h1>
            <TeamPicker mode={mode} setMode={setMode} names={names} setNames={setNames} rooms={rooms} />
          </>
        )}

        {step === 'join' && (
          <>
            <div className="st-kicker">Network room</div>
            <h1>Join a <em>team</em>.</h1>
            <p className="st-lead">Enter the room code your host shows. The host has already chosen the mission and the difficulty.</p>
            <div className="st-names">
              <label className="st-name-field">
                <span>Your name</span>
                <input value={names[0]} placeholder="Your name" autoFocus onChange={(e) => setNames([e.target.value, ...names.slice(1)])} />
              </label>
              <label className="st-name-field">
                <span>Room code</span>
                <input value={code} placeholder="ABCD" onChange={(e) => setCode(cleanCode(e.target.value))} className="st-code-input" />
              </label>
            </div>
          </>
        )}
      </div>

      <footer className="st-setup-foot">
        {back ? <button type="button" className="st-ghost big" onClick={() => setStep(back)}>← Back</button> : rooms ? (
          <p className="st-sub">Joining a team? <button type="button" className="st-link" onClick={() => setStep('join')}>Enter a room code</button></p>
        ) : <span />}
        {step === 'mission' && <button type="button" className="st-primary big" onClick={() => setStep('difficulty')}>Next: difficulty →</button>}
        {step === 'difficulty' && <button type="button" className="st-primary big" onClick={() => setStep('players')}>Next: players →</button>}
        {step === 'players' && <button type="button" className="st-primary big" onClick={go}>{mode === 'host' ? 'Open the room →' : 'Start the mission →'}</button>}
        {step === 'join' && <button type="button" className="st-primary big" disabled={code.length < 3} onClick={go}>Join room {code || '…'} →</button>}
      </footer>
    </div>
  );
}

export function Brief() {
  const a = useStudio((s) => s.analysis)!;
  const edit = useStudio((s) => s.edit);
  const setPhase = useStudio((s) => s.setPhase);
  const team = useStudio((s) => s.team);
  const s = a.scenario;
  const director = canEdit(team, 'director');
  return (
    <div className="st-brief">
      <div className="st-brief-main">
        <div className="st-kicker">{s.customer}</div>
        <h2>{s.name}</h2>
        <p className="st-brief-text">{s.brief}</p>
        <div className="st-brief-facts">
          <span>Budget <b>{Number.isFinite(a.cost.budgetM) ? fmt.m(a.cost.budgetM) : 'unlimited'}</b></span>
          <span>Launch by <b>{Number.isFinite(a.time.deadlineMonth) ? `month ${a.time.deadlineMonth.toFixed(0)}` : 'any time'}</b> (project starts {s.startLabel})</span>
          <span>Critical resources <b>{s.critical.map((r) => RESOURCES[r].name).join(', ')}</b></span>
        </div>
        {!director && <p className="st-banner">The Mission Director, <b style={{ color: ownerOf(team, 'director')?.color }}>{ownerOf(team, 'director')?.name}</b>, chooses the objectives and the ambition. Talk it through together.</p>}
        <fieldset className="st-fieldset" disabled={!director}>
          <h3>1 · What is the mission for?</h3>
          <ObjectivesPicker a={a} edit={(c) => edit('director', c)} />
          <h3>2 · How ambitious?</h3>
          <p className="st-sub">
            For every requirement the customer names a <b>threshold</b> (the least they accept) and a <b>goal</b> (what they would love).
            Reaching a goal you aimed for scores the most; aiming high and falling short scores less than aiming for the threshold and making it.
          </p>
          <RequirementsTable a={a} edit={(c) => edit('director', c)} hidePrediction />
        </fieldset>
        <div className="st-brief-go">
          <button type="button" className="st-primary big" onClick={() => setPhase('design')}>Start designing →</button>
        </div>
      </div>
      <aside className="st-brief-side">
        <h3>What this mission teaches</h3>
        <ul>{s.lessons.map((l) => <li key={l}>{l}</li>)}</ul>
        <h3>The team</h3>
        <ul className="st-roles">
          {(Object.keys(ROLES) as RoleId[]).map((r) => (
            <li key={r}>
              <span className={`st-role-chip ${r}`}>{ROLES[r].short}</span>
              {team.mode !== 'solo' && <b style={{ color: ownerOf(team, r)?.color }}>{ownerOf(team, r)?.name} · </b>}
              {ROLES[r].explain}
            </li>
          ))}
        </ul>
        <p className="st-sub">
          {team.mode === 'solo'
            ? 'Playing alone, you hold all five roles: switch desks with the tabs on the left.'
            : 'Each role also has a secret goal, shown on its desk. They pull against each other: negotiate. Launch needs every role\'s GO.'}
        </p>
      </aside>
    </div>
  );
}

export function Review() {
  const a = useStudio((s) => s.analysis)!;
  const setPhase = useStudio((s) => s.setPhase);
  const solo = useStudio((s) => s.team.mode === 'solo');
  const fails = a.issues.filter((i) => i.level === 'fail');
  const go = fails.length === 0;
  return (
    <div className="st-review">
      <header>
        <div className="st-kicker">Mission review board</div>
        <h2>{a.design.name}</h2>
        <p className="st-sub">Before launch an independent board checks every resource and every requirement. Here is what it found.</p>
      </header>
      <div className="st-review-grid">
        <section>
          <h3>Resources</h3>
          <ul className="st-review-res">
            {(['mass', 'power', 'budget', 'data', 'comms', 'time'] as ResourceId[]).map((id) => {
              const r = a.resources[id];
              return (
                <li key={id}>
                  <span className="st-res-icon"><ResourceIcon id={id} /></span>
                  <b>{r.name}</b>
                  <span>{r.headline}</span>
                  <StatusBadge status={r.status} />
                  <p>{r.why}</p>
                </li>
              );
            })}
          </ul>
        </section>
        <section>
          <h3>Requirements, as predicted</h3>
          <RequirementsTable a={a} edit={() => undefined} readOnly />
        </section>
        <section>
          <h3>Findings</h3>
          <IssueList issues={a.issues} />
        </section>
      </div>
      {solo ? (
        <div className={`st-verdict ${go ? 'go' : 'nogo'}`}>
          <div>
            <b>{go ? 'GO for launch' : 'NO-GO'}</b>
            <span>{go ? 'No blocking problems. Every warning is a risk you choose to accept.' : `${fails.length} blocking problem${fails.length > 1 ? 's' : ''}. You can still fly, and learn from what goes wrong.`}</span>
          </div>
          <button type="button" className="st-ghost" onClick={() => setPhase('design')}>Back to the desks</button>
          <button type="button" className={go ? 'st-primary' : undefined} onClick={() => setPhase('fly')}>{go ? 'Launch the mission' : 'Fly anyway'}</button>
        </div>
      ) : (
        <GoPoll a={a} />
      )}
    </div>
  );
}
