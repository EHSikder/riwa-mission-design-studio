/**
 * The studio's controls: option cards, segmented choices, sliders that recalculate when released (the analysis
 * is too heavy to run on every pixel of a drag), an "i" button with a plain-language explanation, and status
 * badges that carry an icon and a word, never colour alone.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import type { Status } from '../model/analyze';

export function Info({ text }: { text: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="st-info">
      <button type="button" className="st-info-btn" aria-label="Explain" aria-expanded={open} onClick={() => setOpen(!open)} onBlur={() => setOpen(false)}>
        i
      </button>
      {open && <span className="st-info-pop" role="note">{text}</span>}
    </span>
  );
}

export function Section(props: { title: string; info?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="st-section">
      <header>
        <h4>{props.title}</h4>
        {props.info && <Info text={props.info} />}
        <span className="st-section-right">{props.right}</span>
      </header>
      {props.children}
    </section>
  );
}

const STATUS_LABEL: Record<Status, [string, string]> = {
  good: ['✓', 'OK'],
  warn: ['!', 'Thin'],
  fail: ['✕', 'Fails'],
  over: ['◇', 'Oversized'],
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const [icon, word] = STATUS_LABEL[status];
  return (
    <span className={`st-badge ${status}`}>
      <b aria-hidden>{icon}</b>
      {label ?? word}
    </span>
  );
}

export interface CardOption<T extends string> {
  value: T;
  title: string;
  lines?: ReactNode[];
  tag?: ReactNode;
  disabled?: boolean;
  note?: ReactNode;
  info?: ReactNode;
}

/** Big option cards: one choice (or several with `multi`). */
export function Cards<T extends string>(props: {
  options: CardOption<T>[];
  value: T | T[];
  onPick: (v: T) => void;
  multi?: boolean;
  columns?: number;
}) {
  const on = (v: T) => (Array.isArray(props.value) ? props.value.includes(v) : props.value === v);
  return (
    <div className="st-cards" style={{ gridTemplateColumns: `repeat(${props.columns ?? 2}, minmax(0, 1fr))` }} role={props.multi ? 'group' : 'radiogroup'}>
      {props.options.map((o) => (
        <button
          key={o.value}
          type="button"
          role={props.multi ? 'checkbox' : 'radio'}
          aria-checked={on(o.value)}
          disabled={o.disabled}
          className={`st-card ${on(o.value) ? 'on' : ''}`}
          onClick={() => props.onPick(o.value)}
        >
          <span className="st-card-top">
            {props.multi && <span className="st-check" aria-hidden>{on(o.value) ? '✓' : ''}</span>}
            <span className="st-card-title">{o.title}</span>
            {o.tag && <span className="st-card-tag">{o.tag}</span>}
          </span>
          {o.lines?.map((l, i) => (
            <span key={i} className="st-card-line">{l}</span>
          ))}
          {o.note && <span className="st-card-note">{o.note}</span>}
        </button>
      ))}
    </div>
  );
}

export function Seg<T extends string | number>(props: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onPick: (v: T) => void; label?: string }) {
  return (
    <div className="st-seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={props.value === o.value} disabled={o.disabled} className={props.value === o.value ? 'on' : ''} onClick={() => props.onPick(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * A slider that shows its value live while dragging and commits on release. `log` spreads values that span
 * orders of magnitude (battery, transmitter power).
 */
export function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  log?: boolean;
  format: (v: number) => string;
  onCommit: (v: number) => void;
  info?: ReactNode;
  extra?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const [live, setLive] = useState(props.value);
  useEffect(() => setLive(props.value), [props.value]);
  const toPos = (v: number) => (props.log ? Math.log(v / props.min) / Math.log(props.max / props.min) : (v - props.min) / (props.max - props.min));
  const fromPos = (p: number) => {
    const v = props.log ? props.min * (props.max / props.min) ** p : props.min + p * (props.max - props.min);
    const st = props.step ?? 0;
    return st ? Math.round(v / st) * st : v;
  };
  const commit = () => {
    if (live !== props.value) props.onCommit(live);
  };
  return (
    <div className="st-range">
      <div className="st-range-head">
        <label htmlFor={id}>{props.label}</label>
        {props.info && <Info text={props.info} />}
        <span className="st-range-value">{props.format(live)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1000}
        step={1}
        disabled={props.disabled}
        value={Math.round(Math.max(0, Math.min(1, toPos(live))) * 1000)}
        onChange={(e) => setLive(Math.min(props.max, Math.max(props.min, fromPos(Number(e.target.value) / 1000))))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      {props.extra}
    </div>
  );
}

export function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void; info?: ReactNode; disabled?: boolean }) {
  return (
    <label className="st-toggle">
      <input type="checkbox" checked={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
      {props.info && <Info text={props.info} />}
    </label>
  );
}

/** A compact table of lines with values (budgets). */
export function Lines(props: { lines: { name: string; value: number }[]; format: (v: number) => string; total?: { name: string; value: number } }) {
  const max = Math.max(...props.lines.map((l) => Math.abs(l.value)), 1e-9);
  return (
    <div className="st-lines">
      {props.lines.filter((l) => Math.abs(l.value) > 1e-6).map((l) => (
        <div key={l.name} className="st-line">
          <span className="st-line-name">{l.name}</span>
          <span className="st-line-bar"><span style={{ width: `${(Math.abs(l.value) / max) * 100}%` }} /></span>
          <span className="st-line-val">{props.format(l.value)}</span>
        </div>
      ))}
      {props.total && (
        <div className="st-line total">
          <span className="st-line-name">{props.total.name}</span>
          <span />
          <span className="st-line-val">{props.format(props.total.value)}</span>
        </div>
      )}
    </div>
  );
}

export const fmt = {
  kg: (v: number) => (v < 10 ? `${v.toFixed(1)} kg` : `${Math.round(v).toLocaleString('en-US')} kg`),
  w: (v: number) => (v < 10 ? `${v.toFixed(1)} W` : `${Math.round(v).toLocaleString('en-US')} W`),
  m: (v: number) => `$${v < 10 ? v.toFixed(2) : v.toFixed(1)}M`,
  wh: (v: number) => `${Math.round(v).toLocaleString('en-US')} Wh`,
  mbps: (v: number) => (v >= 100 ? `${v.toFixed(0)} Mbps` : v >= 1 ? `${v.toFixed(1)} Mbps` : `${(v * 1000).toFixed(v < 0.01 ? 1 : 0)} kbps`),
  gbit: (v: number) => (v >= 100 ? `${v.toFixed(0)} Gbit` : `${v.toFixed(1)} Gbit`),
  pct: (v: number) => (Math.abs(v) > 999 ? (v > 0 ? '> 999%' : '< −999%') : `${v.toFixed(0)}%`),
};
