/**
 * The orbit to scale, seen from above its plane, with the spacecraft going round it. The drawing uses the
 * equations of NASA's Mission Viz tutorials (a resource of the Space Apps challenge): an ellipse with the planet
 * at one focus, x = a(cos E − e), y = b·sin E, and Kepler's equation M = E − e·sin E, solved by Newton's method,
 * for where the spacecraft is at each moment. So on a stretched orbit it races past the low point and crawls at
 * the high point, as it really does. Time runs fast: one lap takes a few seconds.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Analysis } from '../model/analyze';
import { CREW_TRIPS, type CrewOrbitId } from '../model/crew';

const W = 420;
const H = 230;
/** Seconds on screen for one lap. */
const LAP_S = 8;
const BODY_FILL: Record<string, string> = { earth: '#3792c2', moon: '#a7b2cb', mars: '#9b8fa6' };
const EARTH_KM = 6_378, MOON_KM = 1_738, MOON_DIST_KM = 384_400;

/** Kepler's equation, M = E − e·sin E, by Newton's method. */
export function eccentricAnomaly(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let k = 0; k < 30; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

const km = (x: number) => `${Math.round(x).toLocaleString('en-US').replace(/,/g, ' ')} km`;
const span = (min: number) => (min >= 2 * 1440 ? `${(min / 1440).toFixed(1)} days` : min >= 120 ? `${(min / 60).toFixed(1)} h` : `${min.toFixed(0)} min`);
/** A round length for the scale bar, about a third of `x`. */
function niceLength(x: number): number {
  const t = x / 3;
  const p = 10 ** Math.floor(Math.log10(t));
  return [1, 2, 5, 10].map((m) => m * p).reduce((best, v) => (Math.abs(v - t) < Math.abs(best - t) ? v : best));
}

/** Seconds since the view appeared; stands still for people who asked for less motion. */
function useClock(): number {
  const [t, setT] = useState(0);
  const start = useRef(0);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    let id = 0;
    start.current = performance.now();
    const tick = (now: number) => { setT((now - start.current) / 1000); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return t;
}

/** The loop a crewed trip flies at the Moon (km, half-widths): Artemis I's wide orbit, the Gateway orbit, Apollo's low one. */
const CREW_LOOP: Partial<Record<CrewOrbitId, { rx: number; ry: number }>> = {
  crewDro: { rx: 64_000, ry: 64_000 },
  crewNrho: { rx: 3_000 + MOON_KM, ry: 70_000 },
  crewLlo: { rx: MOON_KM + 100, ry: MOON_KM + 100 },
};

export function OrbitView({ a }: { a: Analysis }) {
  const o = a.orbit;
  const tripId = a.design.orbit.type as CrewOrbitId;
  const crew = a.crew ? CREW_TRIPS[tripId] : null;
  const t = useClock();
  const phase = ((t / LAP_S) % 1) * 2 * Math.PI;
  const R = o.body.radius / 1000;

  let drawing: ReactNode;
  let caption: string;

  if (crew) {
    // the Earth–Moon distance to scale; the path is a sketch of a figure of eight around the far side
    const loop = CREW_LOOP[tripId];
    const s = (W - 50) / (MOON_DIST_KM + EARTH_KM + Math.max(crew.closestKm, loop?.rx ?? 0) + MOON_KM);
    const xE = 18 + EARTH_KM * s, xM = xE + MOON_DIST_KM * s, y0 = H / 2 - 4;
    const rE = Math.max(4, EARTH_KM * s), rM = Math.max(2.5, MOON_KM * s), d = Math.max(10, crew.closestKm * s);
    const ly = loop ? Math.max(rM + 3, loop.ry * s) : 0;
    const path = `M ${xE} ${y0 - rE} C ${xE + 0.45 * MOON_DIST_KM * s} ${y0 - 70}, ${xM - 30} ${y0 + d + 30}, ${xM} ${y0 + d} S ${xM + d + 8} ${y0 - 4}, ${xM} ${y0 - d} C ${xM - 30} ${y0 - d - 30}, ${xE + 0.45 * MOON_DIST_KM * s} ${y0 + 70}, ${xE} ${y0 + rE}`;
    drawing = (
      <>
        <path id="st-ov-path" d={path} className="st-ov-orbit" />
        {loop && <ellipse cx={xM} cy={y0} rx={Math.max(rM + 3, loop.rx * s)} ry={ly} className="st-ov-orbit loop" />}
        <circle cx={xE} cy={y0} r={rE} fill={BODY_FILL.earth} />
        <circle cx={xM} cy={y0} r={rM} fill={BODY_FILL.moon} />
        <text x={xE} y={y0 + rE + 16} className="st-ov-label" textAnchor="middle">Earth</text>
        <text x={xM} y={y0 + Math.max(d, ly) + 16} className="st-ov-label" textAnchor="middle">Moon</text>
        <circle r={4} className="st-ov-craft"><animateMotion dur={`${LAP_S}s`} repeatCount="indefinite"><mpath href="#st-ov-path" /></animateMotion></circle>
      </>
    );
    caption = `${crew.days} days there and back. The distance to the Moon is to scale (384 400 km); the Earth and the Moon are drawn larger so they show, and the path is a sketch.`;
  } else if (o.type === 'halo') {
    // the relay loops around the balance point beyond the far side, first-order size ±8 000 × ±24 000 km
    const D = 64_500, rx = 8_000, ry = 24_000;
    const s = Math.min((W - 60) / (R + D + rx + 6_000), (H - 40) / (2 * ry));
    const xM = 40, xL = xM + D * s, y0 = H / 2;
    drawing = (
      <>
        <text x={8} y={y0 - 12} className="st-ov-label">← Earth</text>
        <circle cx={xM} cy={y0} r={Math.max(3, R * s)} fill={BODY_FILL.moon} />
        <line x1={xM} y1={y0} x2={xL} y2={y0} className="st-ov-axis" />
        <ellipse cx={xL} cy={y0} rx={rx * s} ry={ry * s} className="st-ov-orbit" />
        <circle cx={xL + rx * s * Math.cos(phase)} cy={y0 + ry * s * Math.sin(phase)} r={4} className="st-ov-craft" />
        <text x={xM} y={y0 + 22} className="st-ov-label" textAnchor="middle">Moon</text>
        <text x={xL} y={y0 + 4} className="st-ov-label" textAnchor="middle">L2</text>
      </>
    );
    caption = `${km(D)} beyond the far side, one loop every ${span(o.periodMin)}. From here the relay sees the far side and the Earth at the same time.`;
  } else {
    // a Kepler orbit: the low point to the right, the body at the focus
    const rp = R + o.altKm, ra = R + o.apoKm;
    const sa = (rp + ra) / 2, e = (ra - rp) / (ra + rp), b = sa * Math.sqrt(1 - e * e), c = sa * e;
    const s = Math.min((W - 40) / (2 * sa), (H - 50) / (2 * Math.max(b, R)));
    const cx = W / 2, fx = cx + c * s, y0 = H / 2 + 6;
    const E = eccentricAnomaly(phase, e);
    const x = fx + sa * (Math.cos(E) - e) * s, y = y0 - b * Math.sin(E) * s;
    const bar = niceLength(2 * sa);
    drawing = (
      <>
        <ellipse cx={cx} cy={y0} rx={sa * s} ry={b * s} className="st-ov-orbit" />
        <circle cx={fx} cy={y0} r={Math.max(2, R * s)} fill={BODY_FILL[o.body.id] ?? BODY_FILL.moon} />
        <circle cx={x} cy={y} r={4} className="st-ov-craft" />
        <line x1={14} y1={H - 12} x2={14 + bar * s} y2={H - 12} className="st-ov-bar" />
        <text x={14} y={H - 18} className="st-ov-label">{km(bar)}</text>
      </>
    );
    caption = e < 0.01
      ? `${km(o.altKm)} up, one lap every ${span(o.periodMin)}. To scale: ${o.altKm < 0.3 * R ? 'a low orbit skims just above the surface.' : 'the planet is small seen from out here.'}`
      : `Low point ${km(o.altKm)}, high point ${km(o.apoKm)}, one lap every ${span(o.periodMin)}. It races past the low point and crawls at the high one, as Kepler's equation says.`;
  }

  return (
    <figure className="st-orbitview">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The orbit to scale, seen from above">
        {drawing}
      </svg>
      <figcaption>{caption} <span className="st-dim">Drawn with the equations of NASA's Mission Viz tutorials.</span></figcaption>
    </figure>
  );
}
