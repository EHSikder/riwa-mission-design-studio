/**
 * Target regions (simplified outlines, lon/lat degrees) and the grids of points the coverage models test.
 * The outlines are hand-simplified from public-domain maps (tens of vertices, a few km of error) and are
 * meant to be replaced by the GGPEN data sets (GeoJSON) once they are published on 13 November.
 */
import type { BodyId, LatLon } from './types';

export type RegionId = 'angola' | 'coast' | 'luanda' | 'sadc' | 'africa' | 'mars';

export interface Region {
  name: string;
  body: BodyId;
  /** Outer rings, each a list of [lon, lat] in degrees. Empty for a whole-body region. */
  rings: [number, number][][];
  /** Grid spacing for the coverage model (deg). */
  gridDeg: number;
  note?: string;
}

const ANGOLA_MAINLAND: [number, number][] = [
  [12.25, -6.1], [13.43, -5.88], [14.4, -5.9], [15.6, -5.9], [16.55, -5.9], [16.95, -7], [17.6, -8.1], [18.8, -8],
  [19.4, -7.95], [19.55, -7], [20.5, -6.95], [21.8, -7.3], [21.8, -8.5], [22.2, -9.8], [22.3, -11], [23, -10.9],
  [24, -11], [24, -13], [22, -13], [22, -16.2], [23.4, -17.6], [21, -18], [20, -17.9], [18.5, -17.4], [16, -17.4],
  [14.2, -17.4], [13.4, -17], [11.75, -17.25], [11.8, -16], [12.15, -15.2], [12.5, -13.9], [13, -13], [13.4, -12.6],
  [13.8, -11], [13.75, -10.7], [13.2, -9.6], [13.23, -8.84], [13.1, -7.85], [12.86, -7.23], [12.35, -6.4],
];
const CABINDA: [number, number][] = [
  [12.15, -5.77], [12.13, -5.22], [11.83, -4.9], [12.02, -4.38], [12.7, -4.4], [13.09, -4.66], [12.75, -5.05], [12.55, -5.75],
];

export const REGIONS: Record<RegionId, Region> = {
  angola: { name: 'Angola', body: 'earth', rings: [ANGOLA_MAINLAND, CABINDA], gridDeg: 0.5, note: 'Simplified outline (≈40 vertices)' },
  coast: {
    name: 'Angolan coast and offshore fields',
    body: 'earth',
    gridDeg: 0.25,
    rings: [[
      [11.75, -17.25], [11.8, -16], [12.15, -15.2], [12.5, -13.9], [13, -13], [13.4, -12.6], [13.8, -11], [13.2, -9.6],
      [13.23, -8.84], [13.1, -7.85], [12.86, -7.23], [12.35, -6.4], [12.25, -6.1], [12.13, -5.22], [11.83, -4.9], [11, -4.9],
      [11.4, -6.1], [11.9, -7.3], [12.2, -8.8], [12.3, -9.7], [12.8, -11], [12.4, -12.6], [11.6, -13.9], [11.2, -15.2],
      [10.9, -16], [10.9, -17.3],
    ]],
  },
  luanda: { name: 'Luanda', body: 'earth', gridDeg: 0.1, rings: [[[13, -8.65], [13.45, -8.65], [13.45, -9.1], [13, -9.1]]] },
  sadc: {
    name: 'SADC region (southern Africa)',
    body: 'earth',
    gridDeg: 1.5,
    rings: [[
      [12, -5], [12.5, 4.5], [19, 5], [27, 5], [31, 3], [30, -1], [34, -1], [39.5, -4.7], [40, -10], [40.5, -15],
      [35.5, -23.5], [32.9, -26.9], [30.9, -30.5], [27, -34], [20, -35], [18.4, -34], [17, -29], [15, -27], [14.5, -23],
      [11.8, -17], [13.2, -9.6],
    ]],
  },
  africa: {
    name: 'Africa',
    body: 'earth',
    gridDeg: 3,
    rings: [[
      [-17, 15], [-17, 21], [-10, 28], [-6, 35.8], [10, 37.3], [32, 31.5], [35, 28], [43, 12], [51, 12], [51, 10], [40, -2],
      [40.5, -15], [35, -24], [32.9, -27], [27, -34], [20, -35], [17, -29], [12, -18], [12, -5], [9, -1], [9, 4], [5, 5],
      [-8, 4.5], [-15, 10],
    ]],
  },
  mars: { name: 'Mars (whole planet)', body: 'mars', rings: [], gridDeg: 5 },
};

/** Far-side and polar landing sites for the lunar relay (selenographic, deg). */
export const LUNAR_SITES: Record<string, LatLon & { name: string; explain: string }> = {
  vonKarman: { name: 'Von Kármán crater', lat: -45.5, lon: 177.6, explain: 'Where Chang\'e 4 landed in 2019: deep on the far side, never in view of Earth.' },
  southPole: { name: 'Lunar south pole', lat: -89.5, lon: 0, explain: 'Where Artemis astronauts will land: ice in permanent shadow, Earth low on the horizon or hidden.' },
  schrodinger: { name: 'Schrödinger basin', lat: -75, lon: 132.4, explain: 'A young far-side basin near the pole, a prime target for future landers.' },
};

function inRing(lon: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function inRegion(r: Region, lat: number, lon: number): boolean {
  if (r.rings.length === 0) return true;
  return r.rings.some((ring) => inRing(lon, lat, ring));
}

export function regionBox(r: Region): { latMin: number; latMax: number; lonMin: number; lonMax: number } {
  if (r.rings.length === 0) return { latMin: -90, latMax: 90, lonMin: -180, lonMax: 180 };
  let latMin = 90, latMax = -90, lonMin = 180, lonMax = -180;
  for (const ring of r.rings) for (const [lon, lat] of ring) {
    latMin = Math.min(latMin, lat); latMax = Math.max(latMax, lat);
    lonMin = Math.min(lonMin, lon); lonMax = Math.max(lonMax, lon);
  }
  return { latMin, latMax, lonMin, lonMax };
}

/** Points on a near-equal-area grid inside the region (always at least one: the box centre). */
export function regionGrid(r: Region): LatLon[] {
  const b = regionBox(r);
  const pts: LatLon[] = [];
  const d = r.gridDeg;
  for (let lat = b.latMin + d / 2; lat < b.latMax; lat += d) {
    const dl = d / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    for (let lon = b.lonMin + dl / 2; lon < b.lonMax; lon += dl) if (inRegion(r, lat, lon)) pts.push({ lat, lon });
  }
  if (pts.length === 0) pts.push({ lat: (b.latMin + b.latMax) / 2, lon: (b.lonMin + b.lonMax) / 2 });
  return pts;
}

/** Area of the region's rings on a sphere of radius `radiusM` (m²). */
export function regionArea(r: Region, radiusM: number): number {
  if (r.rings.length === 0) return 4 * Math.PI * radiusM ** 2;
  const rad = Math.PI / 180;
  let total = 0;
  for (const ring of r.rings) {
    let s = 0;
    for (let i = 0; i < ring.length; i++) {
      const [l1, p1] = ring[i];
      const [l2, p2] = ring[(i + 1) % ring.length];
      s += (l2 - l1) * rad * (2 + Math.sin(p1 * rad) + Math.sin(p2 * rad));
    }
    total += Math.abs((s * radiusM * radiusM) / 2);
  }
  return total;
}
