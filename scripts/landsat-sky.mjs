/**
 * How often is Angola's ground clear for a camera? This script asks NASA/USGS's Landsat 8 and 9 (Collection 2,
 * Level-2) for every scene over Angola in the chosen years, through the Microsoft Planetary Computer's STAC API
 * (free and public, no account), and writes the cloud cover by month to src/studio/model/angolaSky.ts.
 *
 *   npm run sky                (2021 to 2025)
 *   npm run sky -- 2019 2025   (other years)
 *
 * It reads Angola's outline straight from src/studio/model/regions.ts, so it needs Node 22.18 or newer.
 * Each scene's "landsat:cloud_cover_land" is the share of its land that Landsat's cloud mask (CFMask) found
 * under cloud; averaged over a month, it is the chance that a given place is hidden on a given pass.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SEARCH = 'https://planetarycomputer.microsoft.com/api/stac/v1/search';
const OUT = fileURLToPath(new URL('../src/studio/model/angolaSky.ts', import.meta.url));
const [from = 2021, to = 2025] = process.argv.slice(2).map(Number);

const { REGIONS } = await import('../src/studio/model/regions.ts').catch((e) => {
  console.error('Could not read src/studio/model/regions.ts. This script needs Node 22.18 or newer.\n', e.message);
  process.exit(1);
});
// GeoJSON wants each ring closed: the last point repeats the first
const closed = (ring) => [...ring, ring[0]];
const angola = { type: 'MultiPolygon', coordinates: REGIONS.angola.rings.map((r) => [closed(r)]) };

async function post(url, body, tries = 4) {
  for (let k = 1; ; k++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'landsat-sky-script' }, body: JSON.stringify(body) });
    if (res.ok) return res.json();
    if (k >= tries || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 2000 * k));
  }
}

const months = Array.from({ length: 12 }, () => ({ scenes: 0, cloud: 0, under20: 0 }));
let body = {
  collections: ['landsat-c2-l2'],
  intersects: angola,
  datetime: `${from}-01-01T00:00:00Z/${to}-12-31T23:59:59Z`,
  query: { platform: { in: ['landsat-8', 'landsat-9'] } },
  limit: 1000,
  fields: { include: ['id', 'properties.datetime', 'properties.eo:cloud_cover', 'properties.landsat:cloud_cover_land'], exclude: ['assets', 'links', 'geometry', 'bbox'] },
};
let url = SEARCH;
let total = 0;
let skipped = 0;
for (let page = 1; page < 200; page++) {
  const data = await post(url, body);
  for (const f of data.features ?? []) {
    const p = f.properties;
    // land cloud cover, or the whole scene's when a scene has no land figure (-1)
    const land = p['landsat:cloud_cover_land'];
    const c = typeof land === 'number' && land >= 0 ? land : p['eo:cloud_cover'];
    if (typeof c !== 'number' || c < 0) { skipped++; continue; }
    const m = months[new Date(p.datetime).getUTCMonth()];
    m.scenes++;
    m.cloud += c;
    if (c < 20) m.under20++;
    total++;
  }
  process.stdout.write(`\rpage ${page}: ${total} scenes`);
  const next = (data.links ?? []).find((l) => l.rel === 'next');
  if (!next) break;
  url = next.href;
  body = next.body ?? body;
}
process.stdout.write('\n');
if (months.some((m) => m.scenes === 0)) throw new Error('A month came back with no scenes: try more years.');

const round1 = (x) => Math.round(x * 10) / 10;
const rows = months.map((m) => ({ scenes: m.scenes, cloudPct: round1(m.cloud / m.scenes), under20Pct: round1((100 * m.under20) / m.scenes) }));
const today = new Date().toISOString().slice(0, 10);
const ts = `/**
 * Angola's sky as NASA/USGS Landsat 8 and 9 saw it, month by month. Written by scripts/landsat-sky.mjs from the
 * Microsoft Planetary Computer's STAC API: do not edit by hand, run \`npm run sky\` instead.
 */
export const ANGOLA_SKY = {
  source: 'Landsat 8 and 9 Collection 2 Level-2 (NASA/USGS), through the Microsoft Planetary Computer',
  collection: 'landsat-c2-l2',
  from: '${from}-01-01',
  to: '${to}-12-31',
  fetched: '${today}',
  scenes: ${total},
  /** January to December: scenes, average cloud over the land in a scene (%), scenes with less than 20% cloud (%). */
  months: [
${rows.map((r) => `    { scenes: ${r.scenes}, cloudPct: ${r.cloudPct}, under20Pct: ${r.under20Pct} },`).join('\n')}
  ],
} as const;
`;
writeFileSync(OUT, ts);
console.log(`${total} scenes${skipped ? ` (${skipped} without a cloud figure left out)` : ''}, ${from} to ${to}. Written to src/studio/model/angolaSky.ts`);
for (const [k, r] of rows.entries()) console.log(`${String(k + 1).padStart(2)}  ${String(r.scenes).padStart(5)} scenes  cloud ${String(r.cloudPct).padStart(5)}%  clear ${round1(100 - r.cloudPct)}%`);
