/**
 * The mission's six resources, its requirements and its problems (docs/03 §3). The resources sit in one box that
 * is always open; requirements and problems fold away. Only one thing on the right is open at a time. A resource
 * has a sweet spot, not a "more is better": its bar's middle third is just right.
 */
import { useEffect, useRef, useState, type JSX } from 'react';
import type { Analysis, Issue, ResourceSummary } from '../model/analyze';
import { ROLES, type ResourceId } from '../model/types';
import { useStudio } from '../state';
import { MetBadge } from './desks';

const ICONS: Record<ResourceId, JSX.Element> = {
  mass: <path d="M5 6.5h6l2 7H3zM8 2.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 1 1 0-3.2" />,
  power: <path d="M9.2 1.5 3.5 9h4l-1 5.5L12.5 7h-4z" />,
  budget: <><circle cx="8" cy="8" r="6" /><path d="M10 5.6c-.5-.6-1.2-.9-2-.9-1.1 0-2 .6-2 1.5 0 2 4 1.2 4 3.3 0 .9-.9 1.6-2 1.6-.9 0-1.6-.4-2.1-1M8 3.4v9.2" /></>,
  data: <><ellipse cx="8" cy="4" rx="5" ry="1.8" /><path d="M3 4v8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V4M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8" /></>,
  comms: <><path d="M4 12l3.5-3.5M2.2 6.3a7 7 0 0 1 7.5 7.5M2.4 2.6a10.6 10.6 0 0 1 11 11" /><circle cx="3.6" cy="12.4" r="1.1" /></>,
  time: <><circle cx="8" cy="8" r="6" /><path d="M8 4.6V8l2.4 1.6" /></>,
};

export function ResourceIcon({ id }: { id: ResourceId }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[id]}
    </svg>
  );
}

export const RESOURCE_ORDER: ResourceId[] = ['mass', 'power', 'budget', 'data', 'comms', 'time'];

/**
 * The six resources in one box, two to a row like a game's stat panel: a name, a value and a bar whose middle
 * third is "just right". A click says what is wrong and why (or that it fits); one note is open at a time.
 */
/** The colour matches what a click says: red when it fails, yellow for anything else wrong (too little, too much), green when it fits. */
const toneOf = (r: ResourceSummary) => (r.status === 'fail' ? 'fail' : r.problems.length ? 'warn' : 'good');

function ResourceBox({ a }: { a: Analysis }) {
  const open = useStudio((s) => Object.keys(s.folds).find((k) => s.folds[k] && k.startsWith('res:')));
  const toggle = useStudio((s) => s.toggleFold);
  const rs = RESOURCE_ORDER.map((id) => a.resources[id]);
  const shown = rs.find((r) => open === `res:${r.id}`);
  return (
    <section className="st-stats" aria-label="Resources">
      <div className="st-stats-grid">
        {rs.map((r) => {
          // a problem the bar cannot show (nothing built, no launcher) takes the value's place, and the bar stays empty
          const tag = r.problems.find((p) => p.tag)?.tag;
          const on = open === `res:${r.id}`;
          return (
            <button key={r.id} type="button" className={`st-stat ${toneOf(r)} ${on ? 'on' : ''}`} aria-expanded={on} data-sfx={on ? 'close' : 'open'} onClick={() => toggle(`res:${r.id}`)}>
              <span className="st-stat-row">
                <b>{r.name}{r.critical && <i title="Critical for this mission">★</i>}</b>
                <em>{tag ?? r.gauge?.value ?? '—'}</em>
              </span>
              <span className="st-stat-bar" aria-hidden><span style={{ width: `${(!tag && r.gauge ? r.gauge.pos : 0) * 100}%` }} /></span>
            </button>
          );
        })}
      </div>
      {shown && (
        <div className={`st-stat-note ${toneOf(shown)} st-reveal-fast`} role="status">
          {shown.problems.length
            ? shown.problems.map((p) => <p key={p.title}><b>{p.title}.</b> {p.why}</p>)
            : <p><b>Fits well.</b></p>}
        </div>
      )}
    </section>
  );
}

function IssueRow({ i }: { i: Issue }) {
  return (
    <li className={`st-issue ${i.level}`}>
      <span className="st-issue-icon" aria-label={i.level}>{i.level === 'fail' ? '✕' : i.level === 'warn' ? '!' : 'i'}</span>
      <span>
        <span className={`st-role-chip ${i.role}`}>{ROLES[i.role].short}</span>
        {i.text}
        {i.fix && <span className="st-issue-fix">→ {i.fix}</span>}
      </span>
    </li>
  );
}

export function IssueList({ issues, limit }: { issues: Issue[]; limit?: number }) {
  const order = { fail: 0, warn: 1, info: 2 } as const;
  const sorted = [...issues].sort((x, y) => order[x.level] - order[y.level]);
  const shown = limit ? sorted.slice(0, limit) : sorted;
  if (!issues.length) return <p className="st-sub">No problems found. Every resource is within its limits.</p>;
  return (
    <ul className="st-issues">
      {shown.map((i, k) => <IssueRow key={k} i={i} />)}
      {limit && sorted.length > limit && <li className="st-sub">…and {sorted.length - limit} more</li>}
    </ul>
  );
}

/** A requirement: a cut-off name shows in full in a small tip while the pointer is on it, or for a few seconds after a tap. */
function ReqRow({ r, open, onOpen }: { r: Analysis['requirements'][number]; open: boolean; onOpen: () => void }) {
  const label = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [tip, setTip] = useState(false);
  const cut = () => !!label.current && label.current.scrollWidth > label.current.clientWidth + 1;
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <li className={`st-reqmini ${r.met}`}>
      <button
        type="button"
        onClick={onOpen}
        aria-expanded={open}
        onPointerEnter={(e) => { if (e.pointerType === 'mouse') setTip(cut()); }}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setTip(false); }}
        onPointerUp={(e) => {
          if (e.pointerType === 'mouse') return;
          setTip(cut());
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setTip(false), 3000);
        }}
        onFocus={() => setTip(cut())}
        onBlur={() => setTip(false)}
      >
        <span className="st-reqmini-label" ref={label}>{r.req.label}</span>
        <span className="st-reqmini-val">{r.display}</span>
        <MetBadge met={r.met} level={r.level} />
      </button>
      {tip && <span className="st-tip" role="tooltip">{r.req.label}</span>}
      {open && <span className="st-res-why">{r.why}</span>}
    </li>
  );
}

function RequirementList({ a }: { a: Analysis }) {
  const [open, setOpen] = useState<string | null>(null);
  return <ul className="st-reqmini-list">{a.requirements.map((r) => <ReqRow key={r.req.id} r={r} open={open === r.req.id} onOpen={() => setOpen(open === r.req.id ? null : r.req.id)} />)}</ul>;
}

/** A panel on the right that opens and closes; its summary shows while closed. */
function Fold(props: { id: string; title: string; summary: JSX.Element | string; children: JSX.Element }) {
  const open = useStudio((s) => !!s.folds[props.id]);
  const toggle = useStudio((s) => s.toggleFold);
  return (
    <section className={`st-rfold ${open ? 'open' : ''}`}>
      <button type="button" className="st-rfold-btn" aria-expanded={open} data-sfx={open ? 'close' : 'open'} data-guide={`fold:${props.id}`} onClick={() => toggle(props.id)}>
        <span className="st-rfold-title">{props.title}</span>
        <span className="st-rfold-sum">{props.summary}</span>
        <span className="st-chev" aria-hidden />
      </button>
      {open && <div className="st-rfold-body st-reveal-fast">{props.children}</div>}
    </section>
  );
}

export function Dashboard({ a }: { a: Analysis }) {
  const fails = a.issues.filter((i) => i.level === 'fail').length;
  const warns = a.issues.filter((i) => i.level === 'warn').length;
  const met = a.requirements.filter((r) => r.met !== 'fail').length;
  return (
    <div className="st-dash">
      <ResourceBox a={a} />
      <Fold id="requirements" title="Requirements" summary={<span className={met === a.requirements.length ? 'st-ok' : 'st-bad'}>{met} of {a.requirements.length} met</span>}>
        <RequirementList a={a} />
      </Fold>
      <Fold id="problems" title="Problems" summary={<span className={fails ? 'st-bad' : warns ? 'st-warnword' : 'st-ok'}>{fails ? `${fails} blocking` : 'none blocking'}{warns ? ` · ${warns} warnings` : ''}</span>}>
        <IssueList issues={a.issues} />
      </Fold>
    </div>
  );
}
