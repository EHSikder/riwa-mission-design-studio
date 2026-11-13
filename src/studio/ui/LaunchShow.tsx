/**
 * Launch day, as a show: the countdown, ignition, the rocket climbing out of a darkening sky, booster
 * separation, and orbit; or, when the rocket's luck runs out, the failure (and, for a crew, the escape system
 * pulling the capsule clear). Drawn in SVG and CSS, with sound from ui/sound.ts. The flight has already been
 * decided by the time it starts; the show only tells it. Skip it any time.
 */
import { useEffect, useRef, useState } from 'react';
import type { MissionRun } from '../model/simulate';
import { sfx, stopAll } from './sound';

const REDUCED = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function LaunchShow({ run, rocket, onDone }: { run: MissionRun; rocket: string; onDone: () => void }) {
  const failed = run.events.some((e) => e.id === 'launch-failure');
  const escaped = run.st.endReason === 'Launch failure (crew escaped)';
  const crew = !!run.a.crew;
  const [t, setT] = useState(0);
  const start = useRef(performance.now());
  const played = useRef(new Set<string>());
  const once = (key: string, f: () => void) => { if (!played.current.has(key)) { played.current.add(key); f(); } };
  useEffect(() => {
    const id = setInterval(() => setT(performance.now() - start.current), 50);
    return () => { clearInterval(id); stopAll(); };
  }, []);
  const end = REDUCED ? 3500 : failed ? 9500 : 11000;
  useEffect(() => { if (t > end + 1500) onDone(); }, [t]);
  // the soundtrack
  if (!REDUCED) {
    if (t > 0) once('3', () => sfx('beep'));
    if (t > 1000) once('2', () => sfx('beep'));
    if (t > 2000) once('1', () => sfx('beep'));
    if (t > 3000) once('go', () => sfx('liftoff'));
    if (!failed && t > 5600) once('stage', () => sfx('stage'));
    if (failed && t > 4800) once('fail', () => { stopAll(); sfx('fail'); if (crew) setTimeout(() => sfx('alarm'), 250); });
    if (!failed && t > 8200) once('orbit', () => sfx('orbit'));
  } else if (t > 200) once('r', () => sfx(failed ? 'fail' : 'orbit'));
  const count = t < 3000 ? 3 - Math.floor(t / 1000) : 0;
  const phase = REDUCED ? (failed ? 'fail' : 'orbit') : t < 3000 ? 'count' : failed && t > 4800 ? 'fail' : !failed && t > 8200 ? 'orbit' : !failed && t > 5600 ? 'stage' : 'climb';
  const outcome = run.events.find((e) => e.id === 'launch-failure')?.text ?? run.events.find((e) => e.id === 'launch')?.outcome ?? '';
  const caption = {
    count: `T−${count}`,
    climb: 'Liftoff',
    stage: 'Booster separation',
    orbit: crew ? 'Orbit. The cabin goes quiet.' : 'Orbit · spacecraft separation',
    fail: escaped ? 'Abort! The escape system fired' : 'Launch failure',
  }[phase];
  return (
    <div className={`st-launch ${phase} ${REDUCED ? 'still' : ''}`} role="dialog" aria-modal="true" aria-label="Launch">
      <div className="st-launch-sky" />
      <div className="st-launch-stars" />
      <div className="st-launch-earth" />
      <div className="st-launch-scene">
        <div className="st-launch-ground"><div className="st-launch-tower" /></div>
        <div className="st-launch-rocket">
          <svg viewBox="0 0 60 220" width="60" height="220" aria-hidden>
            <defs>
              <linearGradient id="lr-body" x1="0" x2="1">
                <stop offset="0" stopColor="#b9c2cf" /><stop offset="0.45" stopColor="#ffffff" /><stop offset="1" stopColor="#9aa3b5" />
              </linearGradient>
            </defs>
            {/* the payload under its fairing, or a capsule with its escape tower */}
            <g className="st-lr-top">
              {crew ? (
                <>
                  <rect x="28.5" y="2" width="3" height="18" fill="#e9edf2" />
                  <path d="M18 40 L30 20 L42 40 Z" fill="url(#lr-body)" />
                </>
              ) : (
                <path d="M18 44 Q18 14 30 4 Q42 14 42 44 Z" fill="url(#lr-body)" />
              )}
            </g>
            <rect x="18" y="44" width="24" height="96" fill="url(#lr-body)" />
            <rect x="18" y="70" width="24" height="6" fill="#175195" />
            <text x="30" y="118" textAnchor="middle" fontSize="7" fill="#175195" fontFamily="monospace" transform="rotate(-90 30 118)">ANGOLA</text>
            {/* side boosters */}
            <g className="st-lr-boosters">
              <path d="M6 150 V96 Q6 84 12 80 Q18 84 18 96 V150 Z" fill="url(#lr-body)" />
              <path d="M42 150 V96 Q42 84 48 80 Q54 84 54 96 V150 Z" fill="url(#lr-body)" />
            </g>
            <rect x="18" y="140" width="24" height="18" fill="#9aa3b5" />
            <path d="M20 158 L24 166 H36 L40 158 Z" fill="#3a4255" />
            {/* the flame */}
            <g className="st-lr-flame">
              <path d="M22 166 Q30 230 38 166 Z" fill="#ffffff" opacity="0.95" />
              <path d="M24 166 Q30 205 36 166 Z" fill="#bfe6ff" />
              <path d="M8 150 Q12 195 16 150 Z" fill="#ffffff" opacity="0.85" className="st-lr-bflame" />
              <path d="M44 150 Q48 195 52 150 Z" fill="#ffffff" opacity="0.85" className="st-lr-bflame" />
            </g>
          </svg>
        </div>
        <div className="st-launch-smoke">{Array.from({ length: 9 }, (_, k) => <i key={k} style={{ ['--k' as string]: k }} />)}</div>
        {failed && <div className="st-launch-burst" />}
        {escaped && <div className="st-launch-escape" />}
      </div>
      <div className="st-launch-text">
        <span className="st-kicker">{rocket} · {run.a.design.name}</span>
        <b key={caption}>{caption}</b>
        {(phase === 'orbit' || phase === 'fail') && <p>{outcome}</p>}
      </div>
      <button type="button" className={`st-launch-skip ${phase === 'orbit' || phase === 'fail' ? 'st-primary' : 'st-ghost'}`} data-sfx="none" onClick={() => { stopAll(); onDone(); }}>
        {phase === 'orbit' || phase === 'fail' ? 'Continue →' : 'Skip'}
      </button>
    </div>
  );
}
