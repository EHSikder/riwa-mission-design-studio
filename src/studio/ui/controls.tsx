/**
 * The studio's controls: sections that open and close with a click, option cards (with the guide's suggestion
 * marked in Guided games), segmented choices, sliders that recalculate when released (the analysis is too heavy
 * to run on every pixel of a drag), an "i" button with a plain-language explanation, status badges that carry
 * an icon and a word (never colour alone), and the sweet-spot gauge: too little, just right, more than needed.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Gauge, Status } from '../model/analyze';
import { useStudio } from '../state';

export function Info({ text }: { text: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="st-info">
      <button type="button" className="st-info-btn" aria-label="Explain" aria-expanded={open} data-sfx="open" onClick={() => setOpen(!open)} onBlur={() => setOpen(false)}>
        i
      </button>
      {open && <span className="st-info-pop" role="note">{text}</span>}
    </span>
  );
}

export type SectionState = 'done' | 'todo' | 'warn' | 'fail';
const STATE_ICON: Record<SectionState, string> = { done: '✓', todo: '○', warn: '!', fail: '✕' };

/**
 * A part of a desk. With an `id` it is a button that opens and closes (closed until clicked); its state and a
 * one-line summary show while closed, so the desk reads like a checklist.
 */
export function Section(props: { id?: string; title: string; info?: ReactNode; right?: ReactNode; state?: SectionState; children: ReactNode }) {
  const open = useStudio((s) => (props.id ? !!s.sections[props.id] : true));
  const toggle = useStudio((s) => s.openSection);
  if (!props.id) {
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
  const st = props.state;
  return (
    <section className={`st-section st-fold ${open ? 'open' : ''} ${st ?? ''}`}>
      <header>
        <button type="button" className="st-fold-btn" aria-expanded={open} data-guide={`section:${props.id}`} data-sfx={open ? 'close' : 'open'} onClick={() => toggle(props.id!)}>
          {st && <span className={`st-fold-state ${st}`} aria-label={st === 'done' ? 'chosen' : st === 'todo' ? 'not chosen yet' : st}>{STATE_ICON[st]}</span>}
          <span className="st-fold-title">{props.title}</span>
          {props.right && <span className="st-fold-sum">{props.right}</span>}
          <span className="st-chev" aria-hidden />
        </button>
        {props.info && <Info text={props.info} />}
      </header>
      {open && <div className="st-fold-body st-reveal-fast" data-guide={`body:${props.id}`}>{props.children}</div>}
    </section>
  );
}

const STATUS_LABEL: Record<Status, [string, string]> = {
  good: ['✓', 'OK'],
  warn: ['!', 'Thin'],
  fail: ['✕', 'Fails'],
  over: ['◇', 'More than needed'],
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

/** Too little · just right · more than needed, with the value marked and (open) why each end is a problem. */
export function GaugeBar({ g, open }: { g: Gauge; open?: boolean }) {
  const word = g.zone === 'under' ? 'Too little' : g.zone === 'right' ? 'Just right' : 'More than needed';
  return (
    <span className={`st-gauge ${g.zone}`}>
      <span className="st-gauge-top">
        <span>{g.label}</span>
        <b>{g.value}</b>
        <em>{word} · aim for {g.ideal}</em>
      </span>
      <span className="st-gauge-track" aria-hidden>
        <i className="under" /><i className="right" /><i className="over" />
        <span className="st-gauge-mark" style={{ left: `${(g.pos * 100).toFixed(1)}%` }} />
      </span>
      <span className="st-gauge-scale" aria-hidden><span>too little</span><span>just right</span><span>more than needed</span></span>
      {open && (
        <span className="st-gauge-why">
          <span className={g.zone === 'under' ? 'on' : ''}><b>Why too little is a problem:</b> {g.under}</span>
          <span className={g.zone === 'over' ? 'on' : ''}><b>Why too much is a problem:</b> {g.over}</span>
          {g.source && <span className="src"><b>Where this range comes from:</b> {g.source}</span>}
        </span>
      )}
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

/** Big option cards: one choice (or several with `multi`). `suggest` marks the guide's pick. */
export function Cards<T extends string>(props: {
  options: CardOption<T>[];
  value: T | T[];
  onPick: (v: T) => void;
  multi?: boolean;
  columns?: number;
  suggest?: T | readonly T[];
}) {
  const on = (v: T) => (Array.isArray(props.value) ? props.value.includes(v) : props.value === v);
  const suggested = (v: T) => (props.suggest === undefined ? false : Array.isArray(props.suggest) ? props.suggest.includes(v) : props.suggest === v);
  return (
    <div className="st-cards" style={{ gridTemplateColumns: `repeat(${props.columns ?? 2}, minmax(0, 1fr))` }} role={props.multi ? 'group' : 'radiogroup'}>
      {props.options.map((o) => {
        const sug = suggested(o.value) && !on(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={props.multi ? 'checkbox' : 'radio'}
            aria-checked={on(o.value)}
            disabled={o.disabled}
            className={`st-card ${on(o.value) ? 'on' : ''} ${sug ? 'suggest' : ''}`}
            data-suggest={sug ? '1' : undefined}
            data-sfx={props.multi && on(o.value) ? 'remove' : 'add'}
            onClick={() => props.onPick(o.value)}
          >
            <span className="st-card-top">
              {props.multi && <span className="st-check" aria-hidden>{on(o.value) ? '✓' : ''}</span>}
              <span className="st-card-title">{o.title}</span>
              {sug && <span className="st-card-suggest">Suggested</span>}
              {o.tag && <span className="st-card-tag">{o.tag}</span>}
            </span>
            {o.lines?.map((l, i) => (
              <span key={i} className="st-card-line">{l}</span>
            ))}
            {o.note && <span className="st-card-note">{o.note}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Seg<T extends string | number>(props: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onPick: (v: T) => void; label?: string; suggest?: T }) {
  return (
    <div className="st-seg" role="radiogroup" aria-label={props.label}>
      {props.options.map((o) => {
        const sug = props.suggest !== undefined && props.suggest === o.value && props.value !== o.value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={props.value === o.value} disabled={o.disabled} className={`${props.value === o.value ? 'on' : ''} ${sug ? 'suggest' : ''}`} data-suggest={sug ? '1' : undefined} onClick={() => props.onPick(o.value)}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A number as people write it: no float noise, up to six significant digits. */
export const numText = (v: number) => (Number.isFinite(v) ? String(Number(v.toPrecision(6))) : '');

/** A number box that takes any value as typed, and commits on Enter or when it loses focus (Esc restores). */
export function NumberBox(props: { value: number; onCommit: (v: number) => void; label: string; min?: number; max?: number; disabled?: boolean }) {
  const [text, setText] = useState(numText(props.value));
  const typing = useRef(false);
  const cancel = useRef(false);
  useEffect(() => { if (!typing.current) setText(numText(props.value)); }, [props.value]);
  const done = () => {
    typing.current = false;
    if (cancel.current) { cancel.current = false; setText(numText(props.value)); return; }
    const v = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(v)) { setText(numText(props.value)); return; }
    const c = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, v));
    setText(numText(c));
    if (c !== props.value) props.onCommit(c);
  };
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={props.min}
      max={props.max}
      aria-label={props.label}
      disabled={props.disabled}
      value={text}
      onFocus={(e) => { typing.current = true; e.currentTarget.select(); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={done}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); }
      }}
    />
  );
}

/** Positions on the slider track: fine enough that a drag never jumps between round numbers. */
const TRACK = 2000;

/**
 * A number with a slider and a box to type it in. Dragging moves in fine steps (three significant figures on a
 * log scale, a two-thousandth of the range otherwise); typing takes any value between `min` and `max`, exactly
 * as written. The slider shows its value live and commits on release; the box commits on Enter or when it loses
 * focus (Esc puts the old value back). `log` spreads values that span orders of magnitude (battery, transmitter
 * power, storage).
 */
export function Range(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** The unit written after the number box ("km", "%", "m²"). */
  unit: string;
  log?: boolean;
  /** Extra words about the value: a cost, a direction, a time of day. */
  note?: (v: number) => ReactNode;
  onCommit: (v: number) => void;
  info?: ReactNode;
  extra?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  const { min, max, log } = props;
  const [live, setLive] = useState(props.value);
  const [text, setText] = useState(numText(props.value));
  const typing = useRef(false);
  const cancel = useRef(false);
  useEffect(() => {
    setLive(props.value);
    if (!typing.current) setText(numText(props.value));
  }, [props.value]);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const toPos = (v: number) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
  const fromPos = (p: number) => {
    const v = log ? min * (max / min) ** p : min + p * (max - min);
    if (log) return clamp(Number(v.toPrecision(3)));
    const res = 10 ** Math.floor(Math.log10((max - min) / TRACK));
    return clamp(Number((Math.round(v / res) * res).toPrecision(12)));
  };
  const commit = (v: number) => {
    const c = clamp(v);
    setLive(c);
    setText(numText(c));
    if (c !== props.value) props.onCommit(c);
  };
  const typed = () => {
    typing.current = false;
    if (cancel.current) { cancel.current = false; setText(numText(props.value)); setLive(props.value); return; }
    const v = Number(text.trim().replace(',', '.'));
    if (text.trim() === '' || !Number.isFinite(v)) { setText(numText(live)); return; }
    commit(v);
  };
  return (
    <div className="st-range">
      <div className="st-range-head">
        <label htmlFor={id}>{props.label}</label>
        {props.info && <Info text={props.info} />}
        <span className="st-range-value">
          <input
            type="number"
            inputMode="decimal"
            step="any"
            min={min}
            max={max}
            aria-label={`${props.label}, in ${props.unit}`}
            disabled={props.disabled}
            value={text}
            onFocus={(e) => { typing.current = true; e.currentTarget.select(); }}
            onChange={(e) => setText(e.target.value)}
            onBlur={typed}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); }
            }}
          />
          <em>{props.unit}</em>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={TRACK}
        step={1}
        disabled={props.disabled}
        value={Math.round(Math.max(0, Math.min(1, toPos(live))) * TRACK)}
        onChange={(e) => { const v = fromPos(Number(e.target.value) / TRACK); setLive(v); setText(numText(v)); }}
        onPointerUp={() => commit(live)}
        onKeyUp={() => commit(live)}
        onBlur={() => { if (live !== props.value) commit(live); }}
      />
      <span className="st-range-ends">
        <span aria-hidden>{numText(min)} {props.unit}</span>
        {props.note && <b>{props.note(live)}</b>}
        <span aria-hidden>{numText(max)} {props.unit}</span>
      </span>
      {props.extra}
    </div>
  );
}

export function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void; info?: ReactNode; disabled?: boolean; suggest?: boolean }) {
  const sug = props.suggest !== undefined && props.suggest !== props.value;
  return (
    <label className={`st-toggle ${sug ? 'suggest' : ''}`} data-suggest={sug ? '1' : undefined}>
      <input type="checkbox" checked={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.target.checked)} />
      <span>{props.label}</span>
      {sug && <span className="st-card-suggest">Suggested</span>}
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
  m: (v: number) => (Math.abs(v) >= 1000 ? `$${(v / 1000).toFixed(2)}B` : `$${Math.abs(v) < 10 ? v.toFixed(2) : v.toFixed(1)}M`),
  wh: (v: number) => `${Math.round(v).toLocaleString('en-US')} Wh`,
  mbps: (v: number) => (v >= 100 ? `${v.toFixed(0)} Mbps` : v >= 1 ? `${v.toFixed(1)} Mbps` : `${(v * 1000).toFixed(v < 0.01 ? 1 : 0)} kbps`),
  gbit: (v: number) => (v >= 100 ? `${v.toFixed(0)} Gbit` : `${v.toFixed(1)} Gbit`),
  pct: (v: number) => (Math.abs(v) > 999 ? (v > 0 ? '> 999%' : '< −999%') : `${v.toFixed(0)}%`),
};
