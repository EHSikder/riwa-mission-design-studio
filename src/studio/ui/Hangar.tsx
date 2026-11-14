/**
 * The hangar: designs saved in this browser for the current mission. Save the one on the table, open a saved
 * one, delete one, or tick two or three and compare them side by side: mass, power, money, schedule, the
 * requirements each one meets, and what each would still need to fly.
 */
import { useMemo, useState } from 'react';
import { create } from 'zustand';
import { analyze } from '../model/analyze';
import { cloneDesign, normalizeDesign } from '../model/design';
import { canEdit } from '../model/team';
import { useStudio } from '../state';
import { deleteDesign, listDesigns, saveDesign, shareLink, type SavedDesign } from '../storage';
import { StatusBadge, fmt } from './controls';
import { sfx } from './sound';

export const useHangar = create<{ open: boolean; show: () => void; hide: () => void }>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

const savedAt = (t: number) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function Hangar() {
  const open = useHangar((s) => s.open);
  const hide = useHangar((s) => s.hide);
  const scenario = useStudio((s) => s.scenario);
  const design = useStudio((s) => s.design);
  const difficulty = useStudio((s) => s.difficulty);
  const team = useStudio((s) => s.team);
  const [version, setVersion] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [flash, setFlash] = useState('');
  const saved = useMemo(() => (open && scenario ? listDesigns(scenario) : []), [open, scenario, version]);
  // every design of a mission has the mission's name, so saved ones are numbered in the order they were saved
  const number = useMemo(() => new Map([...saved].sort((x, y) => x.savedAt - y.savedAt).map((s, k) => [s.id, k + 1])), [saved]);
  const compare = useMemo(() => {
    const rows: { id: string; name: string; a: ReturnType<typeof analyze> }[] = [];
    if (design && picked.includes('current')) rows.push({ id: 'current', name: 'On the table now', a: analyze(design, difficulty) });
    for (const s of saved.filter((x) => picked.includes(x.id))) rows.push({ id: s.id, name: `Design ${number.get(s.id)}`, a: analyze(normalizeDesign(s.design), difficulty) });
    return rows;
  }, [picked, saved, number, design, difficulty]);
  if (!open || !scenario || !design) return null;
  const mayLoad = canEdit(team, 'director');
  const pick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id].slice(-3)));
  const load = (s: SavedDesign) => {
    useStudio.getState().dispatch({ t: 'replace', role: 'director', by: team.active, design: normalizeDesign(cloneDesign(s.design)) });
    hide();
  };
  return (
    <div className="st-modal" role="dialog" aria-modal="true" aria-labelledby="st-hangar-title" onClick={hide} onKeyDown={(e) => e.key === 'Escape' && hide()}>
      <div className="st-hangar" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="st-hangar-title">Designs <em>hangar</em></h2>
          <button type="button" className="st-ghost" onClick={hide} aria-label="Close">✕</button>
        </header>
        <p className="st-sub">Saved in this browser only. Tick up to three to compare them; share a design with its link.</p>
        <div className="st-hangar-actions">
          <button type="button" className="st-primary" data-sfx="add" onClick={() => { saveDesign(cloneDesign(design)); setVersion((v) => v + 1); setFlash('Saved.'); sfx('good'); }}>Save this design</button>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(shareLink(design)); setFlash('Link copied: anyone who opens it gets this design.'); }}>Copy a share link</button>
          {flash && <span className="st-flash">{flash}</span>}
        </div>
        <ul className="st-hangar-list">
          <li>
            <label><input type="checkbox" checked={picked.includes('current')} onChange={() => pick('current')} /> <b>{design.name}</b> <span className="st-dim">on the table now</span></label>
          </li>
          {saved.map((s) => (
            <li key={s.id}>
              <label><input type="checkbox" checked={picked.includes(s.id)} onChange={() => pick(s.id)} /> <b>Design {number.get(s.id)}</b> <span className="st-dim">saved {savedAt(s.savedAt)}</span></label>
              <span className="st-hangar-btns">
                <button type="button" disabled={!mayLoad} onClick={() => load(s)}>Open</button>
                <button type="button" className="st-ghost" data-sfx="remove" onClick={() => { deleteDesign(s.id); setPicked((p) => p.filter((x) => x !== s.id)); setVersion((v) => v + 1); }}>Delete</button>
              </span>
            </li>
          ))}
          {saved.length === 0 && <li className="st-dim">No saved designs for this mission yet.</li>}
        </ul>
        {compare.length >= 2 && (
          <div className="st-compare">
            <table className="st-table">
              <thead><tr><th />{compare.map((c) => <th key={c.id}>{c.name}</th>)}</tr></thead>
              <tbody>
                <tr><td>Mass</td>{compare.map((c) => <td key={c.id} className="mono">{fmt.kg(c.a.mass.wetKg)} <StatusBadge status={c.a.resources.mass.status} /></td>)}</tr>
                <tr><td>Power to spare</td>{compare.map((c) => <td key={c.id} className="mono">{c.a.design.arrayM2 > 0 ? `${c.a.power.marginPct.toFixed(0)}%` : '—'} <StatusBadge status={c.a.resources.power.status} /></td>)}</tr>
                <tr><td>Total cost</td>{compare.map((c) => <td key={c.id} className="mono">{fmt.m(c.a.cost.totalM)} <StatusBadge status={c.a.resources.budget.status} /></td>)}</tr>
                <tr><td>Launch month</td>{compare.map((c) => <td key={c.id} className="mono">{Number.isFinite(c.a.time.launchMonth) ? c.a.time.launchMonth.toFixed(0) : 'never'}</td>)}</tr>
                <tr><td>Data home a day</td>{compare.map((c) => <td key={c.id} className="mono">{fmt.gbit(c.a.data.deliveredGbitDay)}</td>)}</tr>
                <tr><td>Requirements met</td>{compare.map((c) => <td key={c.id} className="mono">{c.a.requirements.filter((r) => r.met !== 'fail').length} of {c.a.requirements.length}</td>)}</tr>
                <tr><td>Tests planned</td>{compare.map((c) => <td key={c.id} className="mono">{c.a.tests.planned.length} of {c.a.tests.planned.length + c.a.tests.skipped.length}</td>)}</tr>
                <tr><td>Blocking problems</td>{compare.map((c) => { const n = c.a.issues.filter((i) => i.level === 'fail').length; return <td key={c.id}>{n ? <StatusBadge status="fail" label={`${n}`} /> : <StatusBadge status="good" label="none" />}</td>; })}</tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
