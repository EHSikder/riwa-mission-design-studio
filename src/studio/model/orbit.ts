/**
 * What an orbit means for the spacecraft, computed wherever a formula exists: period and speed (Kepler), the
 * sun-synchronous tilt (J2), the eclipse on each orbit (the angle β between the orbit plane and the Sun, and
 * the cylindrical shadow), how fast drag pulls a low orbit down (exponential atmosphere, ballistic
 * coefficient), the radiation dose, the distance to Earth for the radio link, and the Δv to get there and stay.
 */
import { ORBIT_TYPES, type LaunchTarget, type OrbitTypeId } from './catalog';
import type { OrbitChoice } from './design';
import { BODIES, DEG, G0, YEAR, type Body } from './types';

export interface OrbitFacts {
  body: Body;
  type: OrbitTypeId;
  target: LaunchTarget;
  /** Altitude (circular) or low point (km), and the high point. */
  altKm: number;
  apoKm: number;
  incDeg: number;
  /** Ascending node at the start, from the Sun's direction (deg): the ground-track model's RAAN. */
  raanDeg: number;
  periodMin: number;
  speedKms: number;
  /** Altitude the instruments look down from (km), and the share of each orbit spent that low. */
  imagingAltKm: number;
  imagingShare: number;
  /** Worst-season share of each orbit in shadow, the longest shadow (min), shadows per year. */
  eclipseFrac: number;
  eclipseMin: number;
  eclipsesPerYear: number;
  /** β: the smallest over the year (worst shadow) and the range it sweeps (deg). */
  betaMinDeg: number;
  betaRangeDeg: [number, number];
  /** Sunlight relative to Earth's distance from the Sun. */
  sunFactor: number;
  /** Earth–spacecraft distance for the radio link (m): typical and worst; 0 for Earth orbits (from the passes). */
  earthRangeM: [number, number];
  /** Cruise from launch to the operating orbit (days). */
  transferDays: number;
  radKradPerYear: number;
}

export const circularPeriodS = (b: Body, rM: number) => 2 * Math.PI * Math.sqrt(rM ** 3 / b.mu);

/** Inclination that makes the orbit plane turn with the Sun (deg); NaN if the altitude is too high. */
export function ssoInclinationDeg(b: Body, altKm: number): number {
  const a = b.radius + altKm * 1000;
  const c = -(2 * b.sunRate * a ** 3.5) / (3 * b.j2 * b.radius ** 2 * Math.sqrt(b.mu));
  return Math.abs(c) <= 1 ? Math.acos(c) / DEG : NaN;
}

/** Share of a circular orbit in the cylindrical shadow at angle β. */
export function eclipseFraction(b: Body, altKm: number, betaRad: number): number {
  const r = b.radius + altKm * 1000;
  const betaStar = Math.asin(b.radius / r);
  if (Math.abs(betaRad) >= betaStar) return 0;
  const h = altKm * 1000;
  return Math.acos(Math.sqrt(h * h + 2 * b.radius * h) / (r * Math.cos(betaRad))) / Math.PI;
}

/** |β| over one year, sampled: a sun-synchronous orbit keeps its node `nodeFromSun` from the Sun. */
function betaSweep(b: Body, incRad: number, nodeFromSun: number | null): number[] {
  const out: number[] = [];
  const n = 72;
  for (let k = 0; k < n; k++) {
    const L = (k / n) * 2 * Math.PI;
    const sun = [Math.cos(L), Math.cos(b.obliquity) * Math.sin(L), Math.sin(b.obliquity) * Math.sin(L)];
    const ra = Math.atan2(sun[1], sun[0]);
    const nodes = nodeFromSun === null ? Array.from({ length: 12 }, (_, j) => (j / 12) * 2 * Math.PI) : [ra + nodeFromSun];
    for (const node of nodes) {
      const nrm = [Math.sin(node) * Math.sin(incRad), -Math.cos(node) * Math.sin(incRad), Math.cos(incRad)];
      out.push(Math.abs(Math.asin(nrm[0] * sun[0] + nrm[1] * sun[1] + nrm[2] * sun[2])));
    }
  }
  return out;
}

// Exponential atmosphere (Vallado, Fundamentals of Astrodynamics, Table 8-4): base altitude (km), density (kg/m³), scale height (km)
const ATMOSPHERE: [number, number, number][] = [
  [100, 5.297e-7, 5.877], [110, 9.661e-8, 7.263], [120, 2.438e-8, 9.473], [130, 8.484e-9, 12.636], [140, 3.845e-9, 16.149],
  [150, 2.07e-9, 22.523], [180, 5.464e-10, 29.74], [200, 2.789e-10, 37.105], [250, 7.248e-11, 45.546], [300, 2.418e-11, 53.628],
  [350, 9.518e-12, 53.298], [400, 3.725e-12, 58.515], [450, 1.585e-12, 60.828], [500, 6.967e-13, 63.822], [600, 1.454e-13, 71.835],
  [700, 3.614e-14, 88.667], [800, 1.17e-14, 124.64], [900, 5.245e-15, 181.05], [1000, 3.019e-15, 268],
];

export function airDensity(altKm: number): number {
  let row = ATMOSPHERE[0];
  for (const r of ATMOSPHERE) if (altKm >= r[0]) row = r;
  return row[1] * Math.exp(-(altKm - row[0]) / row[2]);
}

/** Years for drag to bring a circular Earth orbit down from `altKm` (B = Cd·A/m, m²/kg); capped at 1000. */
export function decayYears(altKm: number, ballistic: number): number {
  const b = BODIES.earth;
  let t = 0;
  for (let h = altKm; h > 150; h -= 1) {
    const hm = h - 0.5;
    const rate = airDensity(hm) * ballistic * Math.sqrt(b.mu * (b.radius + hm * 1000));
    t += 1000 / rate;
    if (t > 1000 * YEAR) return 1000;
  }
  return t / YEAR;
}

/** Δv per year to hold a circular Earth orbit against drag (m/s). */
export function dragDvPerYear(altKm: number, ballistic: number): number {
  const b = BODIES.earth;
  const v2 = b.mu / (b.radius + altKm * 1000);
  return 0.5 * airDensity(altKm) * v2 * ballistic * YEAR;
}

/** Δv to drop the low point of a circular Earth orbit to 200 km, so drag finishes the job (m/s). */
export function deorbitDv(altKm: number): number {
  const b = BODIES.earth;
  const r = b.radius + altKm * 1000;
  const rp = b.radius + 200_000;
  const a = (r + rp) / 2;
  return Math.sqrt(b.mu / r) - Math.sqrt(b.mu * (2 / r - 1 / a));
}

/** The burn at the high point of a transfer orbit from a launch site of latitude `incDeg` to GEO (m/s). */
export function gtoToGeoDv(incDeg: number): number {
  const b = BODIES.earth;
  const rp = b.radius + 250_000;
  const ra = 42_164_000;
  const a = (rp + ra) / 2;
  const va = Math.sqrt(b.mu * (2 / ra - 1 / a));
  const vg = Math.sqrt(b.mu / ra);
  return Math.sqrt(va * va + vg * vg - 2 * va * vg * Math.cos(incDeg * DEG));
}

/** Low-thrust climbs spiral slowly and lose to gravity: Δv ≈ 1.3× the impulsive one (estimate). */
export const ELECTRIC_CLIMB_FACTOR = 1.3;

/** Hyperbolic excess speed arriving at Mars on a Hohmann-type transfer (m/s). */
export const MARS_VINF = 2_650;
/** High point of the capture ellipse (one Mars day) and of the high science orbit (km above the surface). */
export const MARS_CAPTURE_APO_KM = 33_000;

export function marsCaptureDv(periKm: number, apoKm: number | null): number {
  const b = BODIES.mars;
  const rp = b.radius + periKm * 1000;
  const vHyp = Math.sqrt(MARS_VINF ** 2 + (2 * b.mu) / rp);
  if (apoKm === null) return vHyp - Math.sqrt(b.mu / rp);
  const a = (rp + b.radius + apoKm * 1000) / 2;
  return vHyp - Math.sqrt(b.mu * (2 / rp - 1 / a));
}

/** Lunar orbits from a translunar coast: insertion Δv, transfer time, station keeping per year, disposal (estimates). */
// LLO ≈ Apollo LOI (889 m/s); ELFO from a 12 h frozen orbit at 500 km; L2 halo via a lunar flyby (Queqiao, 25 days) or a ballistic low-energy transfer (CAPSTONE, ~4 months); estimates
export const LUNAR_DV: Record<'llo' | 'elfo' | 'halo', { insertion: number; lowEnergy?: number; days: number; lowEnergyDays?: number; keepPerYear: number; disposal: number }> = {
  llo: { insertion: 850, days: 4.5, keepPerYear: 80, disposal: 0 },
  elfo: { insertion: 450, days: 5, keepPerYear: 5, disposal: 10 },
  halo: { insertion: 200, lowEnergy: 60, days: 25, lowEnergyDays: 100, keepPerYear: 20, disposal: 10 },
};

export function orbitFacts(o: OrbitChoice): OrbitFacts {
  const t = ORBIT_TYPES[o.type];
  const body = BODIES[t.body];
  const sunFactor = (BODIES.earth.sunDistance / body.sunDistance) ** 2;
  const base = { body, type: o.type, target: t.target, sunFactor, raanDeg: 0 };

  if (o.type === 'sso' || o.type === 'leo' || o.type === 'marsLow') {
    const alt = o.altKm;
    const r = body.radius + alt * 1000;
    const period = circularPeriodS(body, r);
    const sso = o.type !== 'leo';
    const inc = sso ? ssoInclinationDeg(body, alt) : o.incDeg;
    const nodeFromSun = sso ? (o.ltanH - 12) * 15 * DEG : null;
    const betas = betaSweep(body, inc * DEG, nodeFromSun);
    const bMin = Math.min(...betas);
    const bMax = Math.max(...betas);
    const fWorst = eclipseFraction(body, alt, bMin);
    // shadowed orbits per year: the share of the β samples with any shadow, times the orbits flown
    const shadowed = betas.filter((b) => eclipseFraction(body, alt, b) > 0).length / betas.length;
    const isMars = o.type === 'marsLow';
    return {
      ...base,
      altKm: alt, apoKm: alt, incDeg: inc, raanDeg: sso ? (o.ltanH - 12) * 15 : 0,
      periodMin: period / 60, speedKms: Math.sqrt(body.mu / r) / 1000,
      imagingAltKm: alt, imagingShare: 1,
      eclipseFrac: fWorst, eclipseMin: (fWorst * period) / 60, eclipsesPerYear: (shadowed * YEAR) / period,
      betaMinDeg: bMin / DEG, betaRangeDeg: [bMin / DEG, bMax / DEG],
      earthRangeM: isMars ? [2.25e11, 3.75e11] : [0, 0],
      transferDays: isMars ? 210 : 0,
      radKradPerYear: isMars ? 2 : 0.15 * Math.exp((alt - 400) / 170) * (1 + 0.8 * Math.abs(Math.sin(inc * DEG))),
    };
  }
  if (o.type === 'geo') {
    const r = 42_164_000;
    const period = circularPeriodS(body, r);
    const f = eclipseFraction(body, 35_786, 0);
    return {
      ...base,
      altKm: 35_786, apoKm: 35_786, incDeg: 0, periodMin: period / 60, speedKms: Math.sqrt(body.mu / r) / 1000,
      imagingAltKm: 35_786, imagingShare: 1,
      // shadow only within ~±22 days of each equinox, once a day
      eclipseFrac: f, eclipseMin: (f * period) / 60, eclipsesPerYear: 88,
      betaMinDeg: 0, betaRangeDeg: [0, body.obliquity / DEG],
      earthRangeM: [0, 0], transferDays: 10, radKradPerYear: 7,
    };
  }
  if (o.type === 'llo') {
    const alt = 100;
    const r = body.radius + alt * 1000;
    const period = circularPeriodS(body, r);
    const f = eclipseFraction(body, alt, 0);
    return {
      ...base,
      altKm: alt, apoKm: alt, incDeg: 90, periodMin: period / 60, speedKms: Math.sqrt(body.mu / r) / 1000,
      imagingAltKm: alt, imagingShare: 1,
      // the plane stays fixed among the stars while the Sun goes round once a year: shadows two-thirds of the year
      eclipseFrac: f, eclipseMin: (f * period) / 60, eclipsesPerYear: (0.66 * YEAR) / period,
      betaMinDeg: 0, betaRangeDeg: [0, 90],
      earthRangeM: [3.84e8, 4.06e8], transferDays: LUNAR_DV.llo.days, radKradPerYear: 2,
    };
  }
  if (o.type === 'elfo') {
    // 12 h frozen orbit: 500 km over the north, ~8 300 km over the south, 57.7° (Ely & Lieb)
    return {
      ...base,
      altKm: 500, apoKm: 8_310, incDeg: 57.7, periodMin: 720, speedKms: 1.1,
      imagingAltKm: 500, imagingShare: 0.1,
      eclipseFrac: 137 / 720, eclipseMin: 137, eclipsesPerYear: 150,
      betaMinDeg: 0, betaRangeDeg: [0, 90],
      earthRangeM: [3.84e8, 4.06e8], transferDays: LUNAR_DV.elfo.days, radKradPerYear: 2,
    };
  }
  if (o.type === 'halo') {
    return {
      ...base,
      altKm: 64_500, apoKm: 64_500, incDeg: 0, periodMin: 14.8 * 1440, speedKms: 0.15,
      imagingAltKm: 64_500, imagingShare: 1,
      // phased to dodge the Earth's shadow; the rare lunar eclipse is a flight event
      eclipseFrac: 0, eclipseMin: 0, eclipsesPerYear: 0,
      betaMinDeg: 0, betaRangeDeg: [0, 30],
      earthRangeM: [4.45e8, 4.8e8], transferDays: o.transfer === 'lowEnergy' ? LUNAR_DV.halo.lowEnergyDays! : LUNAR_DV.halo.days, radKradPerYear: 2,
    };
  }
  // marsHigh: 1-sol ellipse, low point o.altKm
  const rp = body.radius + o.altKm * 1000;
  const ra = body.radius + MARS_CAPTURE_APO_KM * 1000;
  const a = (rp + ra) / 2;
  return {
    ...base,
    altKm: o.altKm, apoKm: MARS_CAPTURE_APO_KM, incDeg: 75, periodMin: circularPeriodS(body, a) / 60,
    speedKms: Math.sqrt(body.mu / a) / 1000,
    imagingAltKm: o.altKm, imagingShare: 0.08,
    eclipseFrac: 120 / 1477, eclipseMin: 120, eclipsesPerYear: 100,
    betaMinDeg: 0, betaRangeDeg: [0, 90],
    earthRangeM: [2.25e11, 3.75e11], transferDays: 210, radKradPerYear: 2,
  };
}

/** Propellant (kg) for a Δv (m/s) from a dry mass, by the rocket equation. */
export const propellantFor = (dryKg: number, dv: number, isp: number) => (isp > 0 ? dryKg * (Math.exp(dv / (isp * G0)) - 1) : Infinity);
/** Δv a propellant load can give (m/s). */
export const dvFor = (dryKg: number, propKg: number, isp: number) => (isp > 0 && propKg > 0 ? isp * G0 * Math.log((dryKg + propKg) / dryKg) : 0);
