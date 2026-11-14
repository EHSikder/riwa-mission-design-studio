/**
 * Angola's sky as NASA/USGS Landsat 8 and 9 saw it, month by month. Written by scripts/landsat-sky.mjs from the
 * Microsoft Planetary Computer's STAC API: do not edit by hand, run `npm run sky` instead.
 */
export const ANGOLA_SKY = {
  source: 'Landsat 8 and 9 Collection 2 Level-2 (NASA/USGS), through the Microsoft Planetary Computer',
  collection: 'landsat-c2-l2',
  from: '2021-01-01',
  to: '2025-12-31',
  fetched: '2026-11-14',
  scenes: 13482,
  /** January to December: scenes, average cloud over the land in a scene (%), scenes with less than 20% cloud (%). */
  months: [
    { scenes: 1148, cloudPct: 62.5, under20Pct: 16 },
    { scenes: 1074, cloudPct: 55.9, under20Pct: 22.4 },
    { scenes: 1005, cloudPct: 53.1, under20Pct: 24.3 },
    { scenes: 1120, cloudPct: 39.8, under20Pct: 40.4 },
    { scenes: 1189, cloudPct: 17.7, under20Pct: 73.6 },
    { scenes: 1126, cloudPct: 14.4, under20Pct: 78.9 },
    { scenes: 1133, cloudPct: 16.9, under20Pct: 75.3 },
    { scenes: 1115, cloudPct: 21.4, under20Pct: 69.5 },
    { scenes: 1063, cloudPct: 29.7, under20Pct: 58.3 },
    { scenes: 1144, cloudPct: 38.6, under20Pct: 43.4 },
    { scenes: 1191, cloudPct: 56.5, under20Pct: 21.2 },
    { scenes: 1174, cloudPct: 58.8, under20Pct: 17.5 },
  ],
} as const;
