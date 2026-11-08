/**
 * Where an orbit can look and when it can talk home.
 * - Earth (and Mars) orbits: the ground track sampled every 30 s (a circular orbit whose node drifts with J2
 *   while the planet turns underneath) against grids of target points (the cross-track distance from each 30 s
 *   arc, and whether the ground is sunlit) and against ground stations (elevation mask, slant range).
 * - GEO: which points of a region see the slot high enough above the horizon.
 * - The Moon: when a far-side site sees the relay while the relay sees Earth, and when Earth is hidden.
 * - Mars: the Earth–Mars distance through the mission, and the solar-conjunction blackout.
 */
import { LUNAR_SITES, REGIONS, inRegion, regionBox, regionGrid, type RegionId } from './regions';
import { AU, BODIES, DEG, type Body } from './types';

export interface AccessSensor {
  id: string;
  /** Half the instrument's swath, as an angle at the planet's centre (rad). */
  halfSwathRad: number;
  /** How far to the side it can look, swath included (rad at the centre). */
  reachRad: number;
  daylight: boolean;
}

export interface AccessStation {
  id: string;
  lat: number;
  lon: number;
  minElDeg: number;
}

export interface AccessInput {
  body: Body;
  altKm: number;
  incDeg: number;
  raanDeg: number;
  days: number;
  stepS: number;
  sensors: AccessSensor[];
  regions: RegionId[];
  stations: AccessStation[];
}

export interface SensorAccess {
  /** Mean days between looks at a point of the region, and the longest wait anywhere. */
  revisitDays: number;
  maxGapDays: number;
  /** Per grid point: passes that could look at it, and passes that imaged it straight down (mapping). */
  lookPasses: number[];
  mapPasses: number[];
}

export interface RegionAccess {
  points: number;
  sensors: Record<string, SensorAccess>;
  /** Seconds per day with the ground track inside the region: in all, and with the ground below sunlit. */
  overSecondsPerDay: number;
  overLitSecondsPerDay: number;
  /** Mean wait from flying over the region to the next ground contact (hours). */
  latencyH: number;
}

export interface ContactSample {
  station: number;
  t: number;
  rangeM: number;
}

export interface AccessResult {
  regions: Partial<Record<RegionId, RegionAccess>>;
  contacts: ContactSample[];
  stepS: number;
  days: number;
  contactMinPerDay: number[];
  passesPerDay: number[];
  /** Longest time without any station in view (hours). */
  maxGapH: number;
}

const unit = (latDeg: number, lonDeg: number): [number, number, number] => {
  const la = latDeg * DEG, lo = lonDeg * DEG;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};

/** Angle at the planet's centre between the point below and a point seen `offNadirDeg` to the side. */
export function reachAngle(body: Body, altKm: number, offNadirDeg: number): number {
  const k = (body.radius + altKm * 1000) / body.radius;
  const eta = offNadirDeg * DEG;
  const s = k * Math.sin(eta);
  return s >= 1 ? Math.acos(1 / k) : Math.asin(s) - eta;
}

const cache = new Map<string, AccessResult>();

export function computeAccess(inp: AccessInput): AccessResult {
  const key = JSON.stringify({ ...inp, body: inp.body.id });
  const hit = cache.get(key);
  if (hit) return hit;
  const res = run(inp);
  if (cache.size > 40) cache.delete(cache.keys().next().value as string);
  cache.set(key, res);
  return res;
}

function run(inp: AccessInput): AccessResult {
  const b = inp.body;
  const R = b.radius;
  const r = R + inp.altKm * 1000;
  const n = Math.sqrt(b.mu / r ** 3);
  const inc = inp.incDeg * DEG;
  const ci = Math.cos(inc), si = Math.sin(inc);
  const raanRate = -1.5 * n * b.j2 * (R / r) ** 2 * ci;
  const step = inp.stepS;
  const steps = Math.ceil((inp.days * 86_400) / step);
  const span = steps * step;
  const sinSun = Math.sin(10 * DEG);
  const ce = Math.cos(b.obliquity), se = Math.sin(b.obliquity);

  const stations = inp.stations.map((s) => ({ g: unit(s.lat, s.lon), sinMin: Math.sin(s.minElDeg * DEG) }));
  const inView = stations.map(() => false);
  const contactS = stations.map(() => 0);
  const passes = stations.map(() => 0);
  const contacts: ContactSample[] = [];
  let lastContact = -Infinity, firstContact = Infinity, maxGap = 0;

  const maxReach = Math.max(0, ...inp.sensors.map((x) => Math.max(x.reachRad, x.halfSwathRad)));
  const seg = n * step;
  const regs = inp.regions.map((id) => {
    const reg = REGIONS[id];
    const grid = regionGrid(reg);
    const box = regionBox(reg);
    const m = (maxReach + seg) / DEG + 0.5;
    return {
      id, reg, box,
      pts: grid.map((p) => unit(p.lat, p.lon)),
      latMin: box.latMin - m, latMax: box.latMax + m, margin: m,
      over: 0, overLit: 0, overTimes: [] as number[],
      sens: inp.sensors.map(() => ({
        lastLook: new Float64Array(grid.length).fill(-Infinity),
        firstLook: new Float64Array(grid.length).fill(NaN),
        maxGap: new Float64Array(grid.length),
        looks: new Int32Array(grid.length),
        lastMap: new Float64Array(grid.length).fill(-Infinity),
        maps: new Int32Array(grid.length),
      })),
    };
  });

  let px = 0, py = 0, pz = 0;
  for (let k = 0; k <= steps; k++) {
    const t = k * step;
    const u = n * t;
    const node = inp.raanDeg * DEG + raanRate * t - b.rotation * t;
    const cu = Math.cos(u), su = Math.sin(u), cn = Math.cos(node), sn = Math.sin(node);
    const sx = cu * cn - su * ci * sn, sy = cu * sn + su * ci * cn, sz = su * si;
    // the Sun in the planet-fixed frame (circular orbit around the Sun; t = 0 at the March equinox, noon at lon 0)
    const L = b.sunRate * t, th = b.rotation * t;
    const ix = Math.cos(L), iy = ce * Math.sin(L);
    const ux = ix * Math.cos(th) + iy * Math.sin(th), uy = -ix * Math.sin(th) + iy * Math.cos(th), uz = se * Math.sin(L);

    // ground stations
    let any = false;
    for (let j = 0; j < stations.length; j++) {
      const { g, sinMin } = stations[j];
      const rx = r * sx - R * g[0], ry = r * sy - R * g[1], rz = r * sz - R * g[2];
      const d = Math.hypot(rx, ry, rz);
      const vis = (rx * g[0] + ry * g[1] + rz * g[2]) / d >= sinMin;
      if (vis) {
        contacts.push({ station: j, t, rangeM: d });
        contactS[j] += step;
        if (!inView[j]) passes[j]++;
        any = true;
      }
      inView[j] = vis;
    }
    if (any) {
      if (lastContact > -Infinity) maxGap = Math.max(maxGap, t - lastContact);
      if (firstContact === Infinity) firstContact = t;
      lastContact = t;
    }

    const lat = Math.asin(sz) / DEG;
    const lon = Math.atan2(sy, sx) / DEG;
    for (const g of regs) {
      // time over the region (nadir inside it)
      if (lat >= g.box.latMin && lat <= g.box.latMax && lon >= g.box.lonMin && lon <= g.box.lonMax && inRegion(g.reg, lat, lon)) {
        g.over += step;
        if (sx * ux + sy * uy + sz * uz >= sinSun) g.overLit += step;
        g.overTimes.push(t);
      }
      if (k === 0 || lat < g.latMin || lat > g.latMax) continue;
      const cl = Math.max(0.15, Math.cos(lat * DEG));
      if (g.reg.rings.length && (lon < g.box.lonMin - g.margin / cl || lon > g.box.lonMax + g.margin / cl)) continue;
      // the arc flown since the last sample: its pole, then each point's distance across it
      let nx = py * sz - pz * sy, ny = pz * sx - px * sz, nz = px * sy - py * sx;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl; ny /= nl; nz /= nl;
      for (let p = 0; p < g.pts.length; p++) {
        const q = g.pts[p];
        const d = q[0] * nx + q[1] * ny + q[2] * nz;
        if (Math.abs(d) > Math.sin(maxReach)) continue;
        // between the two ends of the arc
        const a1 = (py * q[2] - pz * q[1]) * nx + (pz * q[0] - px * q[2]) * ny + (px * q[1] - py * q[0]) * nz;
        const a2 = (q[1] * sz - q[2] * sy) * nx + (q[2] * sx - q[0] * sz) * ny + (q[0] * sy - q[1] * sx) * nz;
        if (a1 < 0 || a2 < 0) continue;
        const lit = q[0] * ux + q[1] * uy + q[2] * uz >= sinSun;
        const ad = Math.asin(Math.min(1, Math.abs(d)));
        for (let i = 0; i < inp.sensors.length; i++) {
          const sen = inp.sensors[i];
          if (sen.daylight && !lit) continue;
          const st = g.sens[i];
          if (ad <= Math.max(sen.reachRad, sen.halfSwathRad)) {
            if (t - st.lastLook[p] > 3600) {
              if (st.looks[p] === 0) st.firstLook[p] = t;
              else st.maxGap[p] = Math.max(st.maxGap[p], t - st.lastLook[p]);
              st.looks[p]++;
            }
            st.lastLook[p] = t;
          }
          if (ad <= sen.halfSwathRad) {
            if (t - st.lastMap[p] > 3600) st.maps[p]++;
            st.lastMap[p] = t;
          }
        }
      }
    }
    px = sx; py = sy; pz = sz;
  }
  if (lastContact > -Infinity) maxGap = Math.max(maxGap, span - lastContact + firstContact);

  const days = span / 86_400;
  const regions: Partial<Record<RegionId, RegionAccess>> = {};
  for (const g of regs) {
    const sensors: Record<string, SensorAccess> = {};
    inp.sensors.forEach((sen, i) => {
      const st = g.sens[i];
      let sum = 0, worst = 0;
      for (let p = 0; p < g.pts.length; p++) {
        const lk = st.looks[p];
        sum += lk > 0 ? days / lk : 2 * days;
        // the wait before the first look and after the last one count too
        const edge = lk > 0 ? Math.max(st.firstLook[p], span - st.lastLook[p], st.maxGap[p]) : 2 * span;
        worst = Math.max(worst, edge);
      }
      sensors[sen.id] = {
        revisitDays: sum / g.pts.length,
        maxGapDays: worst / 86_400,
        lookPasses: Array.from(st.looks),
        mapPasses: Array.from(st.maps),
      };
    });
    // latency: from each moment over the region to the next contact (wrapping round the period)
    let wait = 0, j = 0;
    for (const t of g.overTimes) {
      while (j < contacts.length && contacts[j].t < t) j++;
      wait += j < contacts.length ? contacts[j].t - t : contacts.length ? span - t + contacts[0].t : span;
    }
    regions[g.id] = {
      points: g.pts.length,
      sensors,
      overSecondsPerDay: g.over / days,
      overLitSecondsPerDay: g.overLit / days,
      latencyH: g.overTimes.length ? wait / g.overTimes.length / 3600 : Infinity,
    };
  }
  return {
    regions, contacts, stepS: step, days,
    contactMinPerDay: contactS.map((s) => s / 60 / days),
    passesPerDay: passes.map((p) => p / days),
    maxGapH: stations.length && contacts.length ? maxGap / 3600 : Infinity,
  };
}

/** The point below the satellite every `stepS` for `hours` (same circular J2 orbit as computeAccess). */
export function groundTrack(body: Body, altKm: number, incDeg: number, raanDeg: number, hours: number, stepS = 60): { lat: number; lon: number; lit: boolean }[] {
  const r = body.radius + altKm * 1000;
  const n = Math.sqrt(body.mu / r ** 3);
  const inc = incDeg * DEG;
  const raanRate = -1.5 * n * body.j2 * (body.radius / r) ** 2 * Math.cos(inc);
  const ce = Math.cos(body.obliquity), se = Math.sin(body.obliquity);
  const out: { lat: number; lon: number; lit: boolean }[] = [];
  for (let t = 0; t <= hours * 3600; t += stepS) {
    const u = n * t;
    const node = raanDeg * DEG + raanRate * t - body.rotation * t;
    const x = Math.cos(u) * Math.cos(node) - Math.sin(u) * Math.cos(inc) * Math.sin(node);
    const y = Math.cos(u) * Math.sin(node) + Math.sin(u) * Math.cos(inc) * Math.cos(node);
    const z = Math.sin(u) * Math.sin(inc);
    const L = body.sunRate * t, th = body.rotation * t;
    const ix = Math.cos(L), iy = ce * Math.sin(L);
    const sun = x * (ix * Math.cos(th) + iy * Math.sin(th)) + y * (-ix * Math.sin(th) + iy * Math.cos(th)) + z * se * Math.sin(L);
    out.push({ lat: Math.asin(z) / DEG, lon: Math.atan2(y, x) / DEG, lit: sun > 0 });
  }
  return out;
}

/** Angle at the planet's centre out to where a station sees the satellite `minElDeg` above its horizon (rad). */
export function horizonAngle(body: Body, altKm: number, minElDeg: number): number {
  const el = minElDeg * DEG;
  return Math.acos((body.radius * Math.cos(el)) / (body.radius + altKm * 1000)) - el;
}

/** Share of a region whose points see a GEO slot at least `minElDeg` above the horizon. */
export function geoService(lonDeg: number, region: RegionId, minElDeg = 20): number {
  const pts = regionGrid(REGIONS[region]);
  const k = BODIES.earth.radius / 42_164_000;
  let ok = 0;
  for (const p of pts) {
    const c = Math.acos(Math.cos(p.lat * DEG) * Math.cos((p.lon - lonDeg) * DEG));
    const el = Math.atan2(Math.cos(c) - k, Math.sin(c));
    if (el >= minElDeg * DEG) ok++;
  }
  return ok / pts.length;
}

export interface LunarRelayGeometry {
  /** Per site: share of the time it sees the relay, and sees it while the relay sees Earth; ranges to the relay. */
  sites: Record<string, { seen: number; relayed: number; maxRangeM: number; typRangeM: number }>;
  /** Share of the time the relay sees Earth, and the share with Earth hidden behind the Moon (radio-quiet). */
  earthInView: number;
  quiet: number;
  earthRangeM: [number, number];
}

const lunarCache = new Map<string, LunarRelayGeometry>();

/**
 * The relay's motion in the Moon-fixed frame (x toward Earth, z north; the Moon keeps one face to Earth):
 * the L2 halo as a loop 64 500 km beyond the far side (first-order shape: ±8 000 × ±24 000 × ±13 000 km,
 * 14.8 days); LLO and ELFO as Kepler orbits whose planes stay fixed among the stars while the Moon turns.
 */
export function lunarRelayGeometry(type: 'llo' | 'elfo' | 'halo'): LunarRelayGeometry {
  const hit = lunarCache.get(type);
  if (hit) return hit;
  const moon = BODIES.moon;
  const R = moon.radius;
  const E: [number, number, number] = [3.844e8, 0, 0];
  const days = 29.5, step = 300;
  const steps = Math.ceil((days * 86_400) / step);
  const siteIds = Object.keys(LUNAR_SITES);
  const sites = siteIds.map((id) => unit(LUNAR_SITES[id].lat, LUNAR_SITES[id].lon));
  const seen = siteIds.map(() => 0), relayed = siteIds.map(() => 0);
  const ranges: number[][] = siteIds.map(() => []);
  const earthRanges: number[] = [];
  let earthIn = 0;
  const elfo = { a: 6_142_000, e: 0.636, i: 57.7 * DEG, w: 90 * DEG };
  const llo = { r: R + 100_000 };
  for (let k = 0; k < steps; k++) {
    const t = k * step;
    let pos: [number, number, number];
    if (type === 'halo') {
      const th = (2 * Math.PI * t) / (14.8 * 86_400);
      pos = [-(64_500_000 + 8_000_000 * Math.cos(th)), 24_000_000 * Math.sin(th), -13_000_000 * Math.cos(th)];
    } else {
      const node = -moon.rotation * t;
      let x: number, y: number, inc: number, w: number;
      if (type === 'llo') {
        const u = Math.sqrt(moon.mu / llo.r ** 3) * t;
        x = llo.r * Math.cos(u); y = llo.r * Math.sin(u); inc = 90 * DEG; w = 0;
      } else {
        const M = Math.sqrt(moon.mu / elfo.a ** 3) * t;
        let Ea = M;
        for (let it = 0; it < 12; it++) Ea -= (Ea - elfo.e * Math.sin(Ea) - M) / (1 - elfo.e * Math.cos(Ea));
        x = elfo.a * (Math.cos(Ea) - elfo.e);
        y = elfo.a * Math.sqrt(1 - elfo.e ** 2) * Math.sin(Ea);
        inc = elfo.i; w = elfo.w;
      }
      // perifocal → Moon-fixed: rotate by ω, then the inclination, then the turning node
      const xw = x * Math.cos(w) - y * Math.sin(w), yw = x * Math.sin(w) + y * Math.cos(w);
      const yi = yw * Math.cos(inc), zi = yw * Math.sin(inc);
      pos = [xw * Math.cos(node) - yi * Math.sin(node), xw * Math.sin(node) + yi * Math.cos(node), zi];
    }
    // Earth in view unless the Moon's disc blocks the line
    const dx = E[0] - pos[0], dy = E[1] - pos[1], dz = E[2] - pos[2];
    const dl2 = dx * dx + dy * dy + dz * dz;
    const s = Math.max(0, Math.min(1, -(pos[0] * dx + pos[1] * dy + pos[2] * dz) / dl2));
    const blocked = Math.hypot(pos[0] + s * dx, pos[1] + s * dy, pos[2] + s * dz) < R;
    if (!blocked) earthIn++;
    earthRanges.push(Math.sqrt(dl2));
    for (let j = 0; j < sites.length; j++) {
      const g = sites[j];
      const rx = pos[0] - R * g[0], ry = pos[1] - R * g[1], rz = pos[2] - R * g[2];
      const d = Math.hypot(rx, ry, rz);
      if ((rx * g[0] + ry * g[1] + rz * g[2]) / d >= Math.sin(10 * DEG)) {
        seen[j]++;
        ranges[j].push(d);
        if (!blocked) relayed[j]++;
      }
    }
  }
  const median = (a: number[]) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : Infinity);
  const out: LunarRelayGeometry = {
    sites: Object.fromEntries(siteIds.map((id, j) => [id, {
      seen: seen[j] / steps, relayed: relayed[j] / steps,
      maxRangeM: ranges[j].length ? Math.max(...ranges[j]) : Infinity, typRangeM: median(ranges[j]),
    }])),
    earthInView: earthIn / steps,
    quiet: 1 - earthIn / steps,
    earthRangeM: [median(earthRanges), Math.max(...earthRanges)],
  };
  lunarCache.set(type, out);
  return out;
}

/** Earth–Mars distance and the Sun–Earth–Mars angle `days` after arriving at Mars (circular, coplanar orbits). */
export function earthMarsGeometry(days: number): { distM: number; sepDeg: number } {
  const a = BODIES.mars.sunDistance / AU;
  // after a Hohmann-type transfer Earth leads Mars by ~75°, and gains 0.4616° a day
  const phi = (75 + 0.4616 * days) * DEG;
  const d = Math.sqrt(1 + a * a - 2 * a * Math.cos(phi));
  const sep = Math.acos(Math.max(-1, Math.min(1, (1 + d * d - a * a) / (2 * d)))) / DEG;
  return { distM: d * AU, sepDeg: sep };
}
