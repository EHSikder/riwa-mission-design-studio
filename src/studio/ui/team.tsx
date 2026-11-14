/**
 * Team play on screen (docs/03 §7): choosing who plays, the LAN lobby, the player chips, desk ownership, the
 * allocation meters and change requests, the Resource Manager's split and inbox, the GO/NO-GO poll, voting on
 * flight decisions, each role's private goal, and the teamwork part of the report.
 */
import { useEffect, useState } from 'react';
import type { Analysis } from '../model/analyze';
import {
  ALLOC_DESKS, MAX_PLAYERS, PLAYER_COLORS, ROLE_GOALS, ROLE_IDS, canEdit, overruns, ownerOf, pools, proposeSplit, rolesOf, unanimousGo, usage,
  type AllocDesk, type Allocation, type Teamwork,
} from '../model/team';
import { ROLES, type RoleId } from '../model/types';
import type { Player } from '../model/team';
import { lanAddresses } from '../net/room';
import { useStudio } from '../state';
import { Lines, NumberBox, StatusBadge, fmt, numText } from './controls';

// -------------------------------------------------------------------- who plays

export type PlayMode = 'solo' | 'hotseat' | 'host';

export function TeamPicker(props: {
  mode: PlayMode; setMode: (m: PlayMode) => void; names: string[]; setNames: (n: string[]) => void; rooms: boolean | null;
  roles: Record<RoleId, string>; setRoles: (r: Record<RoleId, string>) => void; seats: Player[];
}) {
  const { mode, names, rooms, roles, seats } = props;
  const modes: { id: PlayMode; title: string; text: string }[] = [
    { id: 'solo', title: 'Solo', text: 'You hold all five roles and open each desk yourself.' },
    { id: 'hotseat', title: 'Team on one screen', text: '2–4 players around one laptop or a big screen. Each desk has an owner; when you open a desk, the controls go to its owner.' },
    { id: 'host', title: 'Team online', text: 'Each player on their own computer, anywhere. You open a room and share its 4-letter code.' },
  ];
  return (
    <div className="st-who">
      <div className="st-diff-row three" role="radiogroup" aria-label="Players">
        {modes.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} autoFocus={mode === m.id} className={mode === m.id ? 'on' : ''} disabled={m.id === 'host' && rooms === false} onClick={() => props.setMode(m.id)}>
            <b>{m.title}</b>
            <span>{m.text}</span>
          </button>
        ))}
      </div>
      {rooms === false && <p className="st-sub">This copy of the game has no room server, so online rooms are off here. Use the game's Render link for online play, or “Team on one screen”.</p>}
      {mode === 'hotseat' && (
        <>
          <div className="st-names">
            {names.map((n, i) => (
              <label key={i} className="st-name-field">
                <span className="st-dot" style={{ background: PLAYER_COLORS[i] }} />
                <input value={n} placeholder={`Player ${i + 1}`} aria-label={`Player ${i + 1} name`} onChange={(e) => props.setNames(names.map((x, k) => (k === i ? e.target.value : x)))} />
                {names.length > 2 && <button type="button" className="st-ghost" onClick={() => props.setNames(names.filter((_, k) => k !== i))} aria-label={`Remove player ${i + 1}`}>✕</button>}
              </label>
            ))}
            {names.length < MAX_PLAYERS && <button type="button" className="st-link" onClick={() => props.setNames([...names, ''])}>+ Add a player</button>}
          </div>
          <RoleGrid players={seats} roles={roles} onPick={(r, id) => props.setRoles({ ...roles, [r]: id })} />
        </>
      )}
      {mode === 'host' && (
        <div className="st-names">
          <label className="st-name-field">
            <span>Your name</span>
            <input value={names[0]} placeholder="Your name" onChange={(e) => props.setNames([e.target.value, ...names.slice(1)])} />
          </label>
        </div>
      )}
      {mode !== 'solo' && <HowWePlay />}
    </div>
  );
}

/** Who does what: one row per role, one column per player. Shared out already; a click moves a role. */
export function RoleGrid({ players, roles, onPick, canPick = () => true }: { players: Player[]; roles: Record<RoleId, string>; onPick: (r: RoleId, player: string) => void; canPick?: (r: RoleId) => boolean }) {
  return (
    <div className="st-rolegrid" role="table" aria-label="Who handles which role">
      <div className="st-rolegrid-row head" role="row" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${players.length}, 92px)` }}>
        <span role="columnheader">Role</span>
        {players.map((p) => <span key={p.id} role="columnheader" style={{ color: p.color }}>{p.name}</span>)}
      </div>
      {ROLE_IDS.map((r) => (
        <div key={r} className="st-rolegrid-row" role="row" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${players.length}, 92px)` }}>
          <span role="rowheader"><span className={`st-role-chip ${r}`}>{ROLES[r].short}</span><span className="st-dim">{ROLES[r].explain}</span></span>
          {players.map((p) => (
            <span key={p.id} role="cell">
              <button
                type="button"
                className={`st-rolegrid-pick ${roles[r] === p.id ? 'on' : ''}`}
                style={{ ['--pc' as string]: p.color }}
                aria-pressed={roles[r] === p.id}
                aria-label={`${p.name} handles ${ROLES[r].name}`}
                disabled={!canPick(r)}
                onClick={() => onPick(r, p.id)}
              >
                {roles[r] === p.id ? '●' : ''}
              </button>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** The three ways to play together, in plain words. */
export function HowWePlay() {
  return (
    <details className="st-howplay" open>
      <summary>How playing together works</summary>
      <div className="st-howplay-grid">
        <div>
          <b>On one screen</b>
          <p>One laptop (or a laptop plugged into a TV), everyone around it. Each role has an owner, shown on its desk button. Open a desk and the controls go to its owner. Hands-on steps in flight go to their owner too; decisions are a quick vote round the table.</p>
        </div>
        <div>
          <b>Online, each on their own computer</b>
          <p>Open the game's Render link (the one ending in <code>onrender.com</code>) and choose Team online. Share the 4-letter room code or the link it shows. Works from anywhere with internet. The free server sleeps when nobody uses it: the first visit wakes it in about a minute.</p>
        </div>
        <div>
          <b>Same room, no internet</b>
          <p>One laptop runs <code>npm run lan</code> from the game's folder. Everyone on the same Wi-Fi opens the address it prints. Same rooms and codes as online.</p>
        </div>
      </div>
      <p className="st-sub">Roles are shared out for you. Change who does what in the grid (one click moves a role); one player can hold several. The Mission Director breaks ties and can launch without a unanimous GO, at a cost in teamwork points.</p>
    </details>
  );
}

// -------------------------------------------------------------------- the LAN lobby

export function Lobby() {
  const { team, room, roomStatus, me, scenario, teamOp, setPhase, exit } = useStudio();
  const [addresses, setAddresses] = useState<string[]>([]);
  useEffect(() => { lanAddresses().then(setAddresses); }, []);
  const port = location.port ? `:${location.port}` : '';
  const host = team.players[0];
  const everyone = ROLE_IDS.every((r) => team.players.some((p) => p.id === team.roles[r]));
  // teammates cannot reach "localhost": give them this computer's network address instead
  const onThisComputer = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const onLan = onThisComputer || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname);
  const links = onThisComputer && addresses.length
    ? addresses.map((a) => `http://${a}${port}/#room=${room?.code}`)
    : [`${location.origin}${location.pathname}#room=${room?.code}`];
  return (
    <div className="st-lobby">
      <div className="st-kicker">Network room</div>
      <h2>Room <span className="st-code">{room?.code}</span></h2>
      <p className="st-sub">{roomStatus === 'open' ? 'Connected.' : roomStatus === 'retrying' ? 'Reconnecting…' : roomStatus === 'lost' ? 'This room is gone.' : 'Connecting…'} {scenario ? '' : 'Waiting for the room\'s mission (check the code with your host).'}</p>
      <div className="st-lobby-grid">
        <section className="st-card-panel">
          <h3>Teammates join here</h3>
          {links.map((l) => <code key={l} className="st-join-link">{l}</code>)}
          <p className="st-sub">{onLan ? 'Same Wi-Fi, any browser.' : 'Any browser, anywhere.'} Up to {MAX_PLAYERS} players.</p>
          <h3>Players</h3>
          <ul className="st-players">
            {team.players.map((p) => <li key={p.id}><span className="st-dot" style={{ background: p.color }} />{p.name}{p.id === me ? ' (you)' : ''}{p.id === host?.id ? ' · host' : ''}</li>)}
          </ul>
        </section>
        <section className="st-card-panel">
          <h3>Who does what <span className="st-sub">shared out as players join; {me === host?.id ? 'you can move any role' : 'click in your own column to take a role'}</span></h3>
          <RoleGrid
            players={team.players}
            roles={team.roles}
            canPick={() => !!me}
            onPick={(r, id) => {
              // the host places anyone; a player can only take a role for themselves
              if (me === host?.id || id === me) teamOp({ t: 'claim', role: r, player: id });
            }}
          />
        </section>
      </div>
      <HowWePlay />
      <div className="st-lobby-go">
        <button type="button" className="st-ghost big" onClick={exit}>← Leave the room</button>
        <button type="button" className="st-primary big" disabled={!scenario || !everyone || me !== host?.id} onClick={() => setPhase('brief')}>
          {me === host?.id ? 'Start the mission →' : `Waiting for ${host?.name ?? 'the host'} to start`}
        </button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- top bar chips

export function TeamChips() {
  const team = useStudio((s) => s.team);
  const room = useStudio((s) => s.room);
  const status = useStudio((s) => s.roomStatus);
  const teamOp = useStudio((s) => s.teamOp);
  if (team.mode === 'solo') return null;
  return (
    <div className="st-chips" role={team.mode === 'hotseat' ? 'radiogroup' : undefined} aria-label="Players">
      {room && <span className={`st-chip ${status === 'open' ? '' : 'dim'}`} title={status ?? ''}>Room {room.code}</span>}
      {team.players.map((p) => (
        <button
          key={p.id}
          type="button"
          role={team.mode === 'hotseat' ? 'radio' : undefined}
          aria-checked={team.active === p.id}
          className={`st-pchip ${team.active === p.id ? 'on' : ''}`}
          style={{ ['--pc' as string]: p.color }}
          disabled={team.mode !== 'hotseat'}
          title={`${p.name}: ${rolesOf(team, p.id).map((r) => ROLES[r].short).join(', ') || 'no role'}${team.mode === 'hotseat' ? ' · click to hand over the keyboard' : ''}`}
          onClick={() => teamOp({ t: 'active', player: p.id })}
        >
          <span className="st-dot" />
          {p.name}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------------------- desks: ownership, goal, allocation

export function DeskBanner({ role, a }: { role: RoleId; a: Analysis }) {
  const team = useStudio((s) => s.team);
  if (team.mode === 'solo') return null;
  const owner = ownerOf(team, role);
  const mine = canEdit(team, role);
  return (
    <div className={`st-banner ${mine ? 'mine' : ''}`}>
      {mine ? (
        <>
          <span><b>Your desk.</b> Secret goal: <i>{ROLE_GOALS[role].title}</i> <span className="st-dim">— {ROLE_GOALS[role].text}</span></span>
        </>
      ) : (
        <span>This desk belongs to <b style={{ color: owner?.color }}>{owner?.name}</b>.{team.mode === 'hotseat' ? ' Hand them the keyboard (top right) to change it.' : ' Ask them, or send a change request.'}</span>
      )}
      {(role === 'spacecraft' || role === 'science' || role === 'comms') && <AllocationMeter desk={role} a={a} mine={mine} />}
    </div>
  );
}

function AllocationMeter({ desk, a, mine }: { desk: AllocDesk; a: Analysis; mine: boolean }) {
  const team = useStudio((s) => s.team);
  const teamOp = useStudio((s) => s.teamOp);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  if (!team.allocations) return <p className="st-sub">No allocation yet: the Resource Manager has not split the mass, power and money.</p>;
  const u = usage(a)[desk], al = team.allocations[desk];
  const over = overruns(a, team)[desk];
  const open = team.requests.find((r) => r.desk === desk && r.status === 'open');
  const row = (label: string, used: number, cap: number, f: (v: number) => string) => (
    <div className={`st-alloc-row ${used > cap + 1e-6 ? 'over' : ''}`}>
      <span>{label}</span>
      <span className="st-bar"><span style={{ width: `${Math.min(100, (used / Math.max(cap, 1e-9)) * 100)}%` }} /></span>
      <em>{f(used)} / {f(cap)}</em>
    </div>
  );
  return (
    <div className="st-alloc">
      {row('Mass', u.massKg, al.massKg, fmt.kg)}
      {row('Power', u.powerW, al.powerW, fmt.w)}
      {row('Money', u.costM, al.costM, fmt.m)}
      {over.length > 0 && <p className="st-over">Over the allocation: {over.join(', ')}.</p>}
      {open ? <p className="st-sub">Change request waiting for the Resource Manager.</p> : mine && over.length > 0 && !asking && <button type="button" className="st-link" onClick={() => setAsking(true)}>Ask for more…</button>}
      {asking && (
        <div className="st-ask">
          <input value={reason} placeholder="Why does this desk need it?" onChange={(e) => setReason(e.target.value)} aria-label="Reason for the request" />
          <button
            type="button"
            className="st-primary"
            onClick={() => {
              const ask: Allocation = { massKg: Math.max(0, u.massKg - al.massKg), powerW: Math.max(0, u.powerW - al.powerW), costM: Math.max(0, u.costM - al.costM) };
              teamOp({ t: 'request', req: { id: `r${Date.now().toString(36)}`, desk, by: team.active, ask, reason: reason.trim() || 'Needed for the design', status: 'open' } });
              setAsking(false);
              setReason('');
            }}
          >
            Send request
          </button>
        </div>
      )}
    </div>
  );
}

/** The Resource Manager's split and inbox (on the Resources desk). */
export function AllocationsPanel({ a }: { a: Analysis }) {
  const team = useStudio((s) => s.team);
  const teamOp = useStudio((s) => s.teamOp);
  const [note, setNote] = useState('');
  if (team.mode === 'solo') return null;
  const mine = canEdit(team, 'resources');
  const pool = pools(a), u = usage(a);
  const al = team.allocations;
  const shared = (k: keyof Allocation) => (al ? ALLOC_DESKS.reduce((acc, d) => acc + al[d][k], 0) : 0);
  const setOne = (d: AllocDesk, k: keyof Allocation, v: number) => al && teamOp({ t: 'alloc', allocations: { ...al, [d]: { ...al[d], [k]: Math.max(0, v) } } });
  const open = team.requests.filter((r) => r.status === 'open');
  const name = (id: string) => team.players.find((p) => p.id === id)?.name ?? '?';
  return (
    <section className="st-section">
      <header><h4>Splitting the resources</h4></header>
      <p className="st-sub">Give each building desk its share of mass, power and money. Anything not handed out is the team's margin. A desk that goes over must ask you.</p>
      {!al ? (
        <button type="button" className="st-primary" disabled={!mine} onClick={() => teamOp({ t: 'alloc', allocations: proposeSplit(a) })}>Propose a first split</button>
      ) : (
        <table className="st-table st-alloc-table">
          <thead><tr><th>Desk</th><th>Mass (kg)</th><th>Power (W)</th><th>Money ($M)</th></tr></thead>
          <tbody>
            {ALLOC_DESKS.map((d) => (
              <tr key={d}>
                <td><span className={`st-role-chip ${d}`}>{ROLES[d].short}</span></td>
                {(['massKg', 'powerW', 'costM'] as (keyof Allocation)[]).map((k) => (
                  <td key={k}>
                    <NumberBox label={`${ROLES[d].short} ${k}`} value={al[d][k]} min={0} disabled={!mine} onCommit={(v) => setOne(d, k, v)} />
                    <span className={`st-used ${u[d][k] > al[d][k] + 1e-6 ? 'over' : ''}`}>uses {numText(u[d][k])}</span>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="st-pool">
              <td>Left as margin</td>
              <td className="mono">{(pool.massKg - shared('massKg')).toFixed(0)}</td>
              <td className="mono">{(pool.powerW - shared('powerW')).toFixed(0)}</td>
              <td className="mono">{Number.isFinite(a.cost.budgetM) ? (pool.costM - shared('costM')).toFixed(1) : '∞'}</td>
            </tr>
          </tbody>
        </table>
      )}
      <header><h4>Change requests</h4></header>
      {team.requests.length === 0 && <p className="st-sub">None yet.</p>}
      <ul className="st-requests">
        {[...team.requests].reverse().map((r) => (
          <li key={r.id} className={r.status}>
            <span className={`st-role-chip ${r.desk}`}>{ROLES[r.desk].short}</span>
            <b>{name(r.by)}</b> asks for {[r.ask.massKg > 0 && fmt.kg(r.ask.massKg), r.ask.powerW > 0 && fmt.w(r.ask.powerW), r.ask.costM > 0 && fmt.m(r.ask.costM)].filter(Boolean).join(', ')}: “{r.reason}”
            {r.status === 'open' ? (
              mine && (
                <span className="st-req-actions">
                  <input value={note} placeholder="Note (optional)" onChange={(e) => setNote(e.target.value)} aria-label="Note" />
                  <button type="button" className="st-primary" onClick={() => { teamOp({ t: 'answer', id: r.id, status: 'approved', by: team.active, note }); setNote(''); }}>Approve</button>
                  <button type="button" onClick={() => { teamOp({ t: 'answer', id: r.id, status: 'rejected', by: team.active, note }); setNote(''); }}>Reject</button>
                </span>
              )
            ) : (
              <span className="st-dim"> — {r.status} by {name(r.answeredBy ?? '')}{r.note ? `: ${r.note}` : ''}</span>
            )}
          </li>
        ))}
      </ul>
      {open.length > 0 && !mine && <p className="st-sub">Waiting for {ownerOf(team, 'resources')?.name}.</p>}
    </section>
  );
}

// -------------------------------------------------------------------- the GO/NO-GO poll

export function GoPoll({ a }: { a: Analysis }) {
  const team = useStudio((s) => s.team);
  const teamOp = useStudio((s) => s.teamOp);
  const fly = useStudio((s) => s.fly);
  const [reasons, setReasons] = useState<Partial<Record<RoleId, string>>>({});
  const over = overruns(a, team);
  const allGo = unanimousGo(team);
  const director = canEdit(team, 'director');
  return (
    <div className="st-poll">
      <h3>GO / NO-GO poll <span className="st-sub">every position calls; launch needs all GO</span></h3>
      <ul>
        {ROLE_IDS.map((r) => {
          const o = ownerOf(team, r);
          const call = team.calls[r];
          const blockers = [
            ...a.issues.filter((i) => i.role === r && i.level === 'fail').map((i) => i.text),
            ...((r === 'spacecraft' || r === 'science' || r === 'comms') ? over[r].map((x) => `Over its allocation (${x})`) : []),
          ];
          return (
            <li key={r} className={call ? (call.go ? 'go' : 'nogo') : ''}>
              <span className={`st-role-chip ${r}`}>{ROLES[r].short}</span>
              <span className="st-poll-who" style={{ color: o?.color }}>{o?.name}</span>
              <span className="st-poll-state">{call ? (call.go ? 'GO' : 'NO-GO') : '—'}{call?.reason ? ` · ${call.reason}` : ''}</span>
              {blockers.length > 0 && <span className="st-poll-warn" title={blockers.join('\n')}>! {blockers.length} concern{blockers.length > 1 ? 's' : ''}</span>}
              {canEdit(team, r) && (
                <span className="st-poll-buttons">
                  <input value={reasons[r] ?? ''} placeholder="Reason" onChange={(e) => setReasons({ ...reasons, [r]: e.target.value })} aria-label={`${ROLES[r].short} reason`} />
                  <button type="button" className="st-primary" onClick={() => teamOp({ t: 'call', role: r, go: true, reason: reasons[r] ?? '' })}>GO</button>
                  <button type="button" onClick={() => teamOp({ t: 'call', role: r, go: false, reason: reasons[r] ?? '' })}>NO-GO</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="st-poll-launch">
        <button type="button" className="st-primary big" data-guide="go-fly-main" data-sfx="go" disabled={!allGo || !director} onClick={() => fly()}>{allGo ? 'Build and fly →' : 'Waiting for every GO'}</button>
        {director && !allGo && (
          <button type="button" data-guide="go-fly" onClick={() => { teamOp({ t: 'override' }); fly(); }} title="Launch without a unanimous GO: it costs teamwork points">
            Director: launch anyway
          </button>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------- voting on a flight decision

export function VoteRow({ option, index }: { option: string; index: number }) {
  const team = useStudio((s) => s.team);
  const vote = useStudio((s) => s.vote);
  const votes = team.votes[index] ?? {};
  return (
    <span className="st-votes">
      {team.players.map((p) => {
        const mine = votes[p.id] === option;
        const can = team.mode === 'hotseat' || p.id === team.active;
        return (
          <button
            key={p.id}
            type="button"
            className={`st-pchip small ${mine ? 'on' : ''}`}
            style={{ ['--pc' as string]: p.color }}
            disabled={!can}
            onClick={(e) => { e.stopPropagation(); vote(option, { player: p.id }); }}
            title={can ? `${p.name} votes for this` : `${p.name}'s vote`}
          >
            <span className="st-dot" />
            {p.name}
          </button>
        );
      })}
    </span>
  );
}

// -------------------------------------------------------------------- the report

export function TeamworkPanel({ tw }: { tw: Teamwork }) {
  const team = useStudio((s) => s.team);
  return (
    <section className="st-card-panel">
      <h3>Teamwork <span className="st-sub">{(tw.score * 100).toFixed(0)}% · 40 of the decision points</span></h3>
      <Lines lines={tw.parts.map((p) => ({ name: p.name, value: p.value * 100 }))} format={(v) => `${v.toFixed(0)}`} />
      <h3>Secret goals</h3>
      <ul className="st-why">
        {ROLE_IDS.map((r) => (
          <li key={r}>
            <span className={`st-role-chip ${r}`}>{ROLES[r].short}</span>
            <b style={{ color: ownerOf(team, r)?.color }}>{ownerOf(team, r)?.name}</b> — {ROLE_GOALS[r].title}: <span className="st-dim">{ROLE_GOALS[r].text}</span>{' '}
            <StatusBadge status={tw.goals[r] ? 'good' : 'fail'} label={tw.goals[r] ? 'reached' : 'missed'} />
          </li>
        ))}
      </ul>
    </section>
  );
}
