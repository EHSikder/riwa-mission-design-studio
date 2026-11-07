/**
 * Team play on screen (docs/03 §7): choosing who plays, the LAN lobby, the player chips, desk ownership, the
 * allocation meters and change requests, the Resource Manager's split and inbox, the GO/NO-GO poll, voting on
 * flight decisions, each role's private goal, and the teamwork part of the report.
 */
import { useEffect, useState } from 'react';
import type { Analysis } from '../model/analyze';
import {
  ALLOC_DESKS, MAX_PLAYERS, ROLE_GOALS, ROLE_IDS, canEdit, overruns, ownerOf, pools, proposeSplit, rolesOf, unanimousGo, usage,
  type AllocDesk, type Allocation, type Teamwork,
} from '../model/team';
import { ROLES, type RoleId } from '../model/types';
import { cleanCode, lanAddresses } from '../net/room';
import { useStudio } from '../state';
import { Lines, StatusBadge, fmt } from './controls';

// -------------------------------------------------------------------- who plays

export type PlayMode = 'solo' | 'hotseat' | 'host' | 'join';

export function TeamPicker(props: { mode: PlayMode; setMode: (m: PlayMode) => void; names: string[]; setNames: (n: string[]) => void; code: string; setCode: (c: string) => void; rooms: boolean | null }) {
  const { mode, names, rooms } = props;
  const modes: { id: PlayMode; title: string; text: string; network?: boolean }[] = [
    { id: 'solo', title: 'Solo', text: 'You hold all five roles.' },
    { id: 'hotseat', title: 'Team on this screen', text: '2–4 players share one computer and pass the keyboard.' },
    { id: 'host', title: 'Host a network room', text: 'Teammates join from their own computers.', network: true },
    { id: 'join', title: 'Join a network room', text: 'Enter the room code your host shows.', network: true },
  ];
  return (
    <div className="st-who">
      <h3>Who is playing?</h3>
      <div className="st-diff-row" role="radiogroup" aria-label="Players">
        {modes.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className={mode === m.id ? 'on' : ''} disabled={m.network && rooms === false} onClick={() => props.setMode(m.id)}>
            <b>{m.title}</b>
            <span>{m.text}</span>
          </button>
        ))}
      </div>
      {rooms === false && <p className="st-sub">This copy of the game has no room server, so network rooms are off here. “Team on this screen” works. To play across computers, one laptop runs the game with <code>npm run lan</code>.</p>}
      {mode === 'hotseat' && (
        <div className="st-names">
          {names.map((n, i) => (
            <label key={i} className="st-name-field">
              <span className="st-dot" style={{ background: ['#5ad1ff', '#ffb547', '#ff7ad9', '#4fd18b'][i] }} />
              <input value={n} placeholder={`Player ${i + 1}`} aria-label={`Player ${i + 1} name`} onChange={(e) => props.setNames(names.map((x, k) => (k === i ? e.target.value : x)))} />
              {names.length > 2 && <button type="button" className="st-ghost" onClick={() => props.setNames(names.filter((_, k) => k !== i))} aria-label={`Remove player ${i + 1}`}>✕</button>}
            </label>
          ))}
          {names.length < MAX_PLAYERS && <button type="button" className="st-link" onClick={() => props.setNames([...names, ''])}>+ Add a player</button>}
        </div>
      )}
      {(mode === 'host' || mode === 'join') && (
        <div className="st-names">
          <label className="st-name-field">
            <span>Your name</span>
            <input value={names[0]} placeholder="Your name" onChange={(e) => props.setNames([e.target.value, ...names.slice(1)])} />
          </label>
          {mode === 'join' && (
            <label className="st-name-field">
              <span>Room code</span>
              <input value={props.code} placeholder="ABCD" onChange={(e) => props.setCode(cleanCode(e.target.value))} className="st-code-input" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------- the LAN lobby

export function Lobby() {
  const { team, room, roomStatus, me, scenario, teamOp, setPhase } = useStudio();
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
          <h3>Roles <span className="st-sub">tap to take one; one player can hold several</span></h3>
          <ul className="st-role-table">
            {ROLE_IDS.map((r) => {
              const o = ownerOf(team, r);
              return (
                <li key={r}>
                  <span className={`st-role-chip ${r}`}>{ROLES[r].short}</span>
                  <span className="st-role-text">{ROLES[r].explain}</span>
                  <span className="st-role-owner" style={{ color: o?.color }}>{o?.name ?? '—'}</span>
                  <button type="button" disabled={!me || team.roles[r] === me} onClick={() => me && teamOp({ t: 'claim', role: r, player: me })}>Take</button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <div className="st-select-go">
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
                    <input type="number" step={k === 'costM' ? 0.1 : 1} disabled={!mine} value={Math.round(al[d][k] * 10) / 10} onChange={(e) => setOne(d, k, Number(e.target.value))} aria-label={`${ROLES[d].short} ${k}`} />
                    <span className={`st-used ${u[d][k] > al[d][k] + 1e-6 ? 'over' : ''}`}>uses {Math.round(u[d][k] * 10) / 10}</span>
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
                  <button type="button" className="st-go" onClick={() => teamOp({ t: 'call', role: r, go: true, reason: reasons[r] ?? '' })}>GO</button>
                  <button type="button" className="st-nogo" onClick={() => teamOp({ t: 'call', role: r, go: false, reason: reasons[r] ?? '' })}>NO-GO</button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="st-poll-launch">
        <button type="button" className="st-primary big" disabled={!allGo || !director} onClick={() => fly()}>{allGo ? 'Launch the mission' : 'Waiting for every GO'}</button>
        {director && !allGo && (
          <button type="button" className="st-danger" onClick={() => { teamOp({ t: 'override' }); fly(); }} title="Launch without a unanimous GO: it costs teamwork points">
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
