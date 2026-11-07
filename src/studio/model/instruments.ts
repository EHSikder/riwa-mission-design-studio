/**
 * Instruments and payloads: what the customer actually pays for. Each one has a mass, a power draw, a cost, a
 * development time, a data rate and a maturity (TRL). An imager's ground resolution and swath are given at a
 * reference altitude and scale with the altitude flown; its data rate follows from them (pixels per second ×
 * spectral bands × bits per pixel, compressed 2:1), so flying lower means sharper pictures *and* more data.
 */
import type { BodyId, Body, Sourced } from './types';

export type InstrumentId =
  | 'cubecam' | 'msWide' | 'ms10' | 'hr3' | 'vhr1' | 'sar' | 'tir' | 'hsi' | 'ais'
  | 'cband' | 'kuband' | 'kaHts'
  | 'proxS' | 'proxX' | 'lfr' | 'lunarCam'
  | 'hirise' | 'ctx' | 'crism' | 'sharad' | 'mcs' | 'uvs' | 'mag';

export type InstrumentKind = 'imager' | 'sar' | 'spectrometer' | 'sounder' | 'receiver' | 'transponder' | 'relay' | 'field';
export type CommsBand = 'C' | 'Ku' | 'Ka';

export interface Instrument extends Sourced {
  name: string;
  short: string;
  kind: InstrumentKind;
  bodies: BodyId[];
  explain: string;
  massKg: number;
  /** Power while operating (W). */
  powerW: number;
  costM: number;
  devMonths: number;
  /** Technology readiness level 1–9: below 7 it is still being proven (more mass growth, delays). */
  trl: number;
  /** Imagers: ground sample distance and swath at the reference altitude, bands and bits per pixel. */
  gsdM?: number;
  swathKm?: number;
  refAltKm?: number;
  bands?: number;
  bits?: number;
  /** Fixed data rate while operating (Mbps), for instruments that are not imagers. */
  dataMbps?: number;
  /** Passive optical: needs the ground below to be sunlit. */
  daylight: boolean;
  /** Clouds block it (optical and infrared imagers). */
  cloudLimited: boolean;
  /** Pointing precision it needs (deg). */
  pointingDeg: number;
  /** Side-looking reach (deg off straight down) without turning the spacecraft (radar). */
  reachDeg?: number;
  /** Largest fraction of the time it may operate (power, heat, data). */
  dutyMax: number;
  /** Communications payloads: throughput (Gbps), band, rain margin (dB) and how much of each region the beams cover. */
  throughputGbps?: number;
  commsBand?: CommsBand;
  marginDb?: number;
  beamCover?: Record<string, number>;
  /** Relay payloads: the band and dish used to talk with landers. */
  proxBand?: 'S' | 'X';
  proxDishM?: number;
  /** Total ionising dose its electronics survive (krad); default by maturity for low-orbit parts. */
  toleranceKrad?: number;
  /** Colour in the 3D model. */
  color: string;
}

const EST = { estimate: true } as const;

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  // -------------------------------------------------------------- Earth observation
  cubecam: {
    name: 'CubeSat multispectral camera', short: 'CubeCam', kind: 'imager', bodies: ['earth'],
    explain: 'A camera that fits in your hand: colour and near-infrared pictures of fields and forests, 15 m pixels from 500 km.',
    massKg: 1.2, powerW: 8, costM: 0.5, devMonths: 6, trl: 8,
    gsdM: 15, swathKm: 40, refAltKm: 500, bands: 4, bits: 12, daylight: true, cloudLimited: true, pointingDeg: 1, dutyMax: 0.3,
    color: '#8fd3ff', source: 'CubeSat imagers (e.g. Simera, Dragonfly class); values are estimates', ...EST,
  },
  msWide: {
    name: 'Wide-swath multispectral imager', short: 'MS-Wide', kind: 'imager', bodies: ['earth'],
    explain: 'Sees a 600 km wide strip at once with 22 m pixels: the whole of Angola every few days, but not fine detail.',
    massKg: 20, powerW: 30, costM: 5, devMonths: 10, trl: 9,
    gsdM: 22, swathKm: 600, refAltKm: 686, bands: 4, bits: 10, daylight: true, cloudLimited: true, pointingDeg: 0.5, dutyMax: 0.4,
    color: '#7ad7c4', source: 'DMC class (NigeriaSat-X, UK-DMC-2: 22 m, ~600 km swath); mass/power/cost are estimates', ...EST,
  },
  ms10: {
    name: 'Multispectral imager (10 m)', short: 'MS-10', kind: 'imager', bodies: ['earth'],
    explain: 'Five colour bands with 10 m pixels and a 100 km swath: the standard for crops, water and land cover.',
    massKg: 25, powerW: 45, costM: 6, devMonths: 12, trl: 8,
    gsdM: 10, swathKm: 100, refAltKm: 600, bands: 5, bits: 12, daylight: true, cloudLimited: true, pointingDeg: 0.1, dutyMax: 0.3,
    color: '#5ad1ff', source: 'Small-sat multispectral imagers (Sentinel-2-like bands at 10 m); estimates', ...EST,
  },
  hr3: {
    name: 'High-resolution camera (3 m)', short: 'HR-3', kind: 'imager', bodies: ['earth'],
    explain: 'A telescope with 3 m pixels: roads, fields and buildings, but only a 24 km wide strip at a time.',
    massKg: 45, powerW: 70, costM: 12, devMonths: 14, trl: 8,
    gsdM: 3, swathKm: 24, refAltKm: 500, bands: 4, bits: 12, daylight: true, cloudLimited: true, pointingDeg: 0.05, dutyMax: 0.2,
    color: '#b6a6ff', source: 'Small-sat high-resolution imagers (2.5–3 m class); estimates', ...EST,
  },
  vhr1: {
    name: 'Very-high-resolution telescope (1 m)', short: 'VHR-1', kind: 'imager', bodies: ['earth'],
    explain: 'Sees cars and single houses (1 m pixels), but a 12 km strip: superb for cities, hopeless for mapping a country.',
    massKg: 120, powerW: 150, costM: 35, devMonths: 20, trl: 7,
    gsdM: 1, swathKm: 12, refAltKm: 500, bands: 2, bits: 11, daylight: true, cloudLimited: true, pointingDeg: 0.05, dutyMax: 0.1,
    color: '#d9a6ff', source: 'Sub-metre to 1 m small-sat telescopes; estimates', ...EST,
  },
  sar: {
    name: 'Synthetic aperture radar (X-band)', short: 'SAR', kind: 'sar', bodies: ['earth'],
    explain: 'A radar that makes its own light: images through clouds and at night (3 m), sees floods and oil slicks. Needs ~900 W while it works.',
    massKg: 70, powerW: 900, costM: 18, devMonths: 14, trl: 8,
    gsdM: 3, swathKm: 30, refAltKm: 550, dataMbps: 600, reachDeg: 35, daylight: false, cloudLimited: false, pointingDeg: 0.1, dutyMax: 0.1,
    color: '#ffb547', source: 'Small SAR satellites (ICEYE / Capella class: ~3 m stripmap, ~100 kg); estimates', ...EST,
  },
  tir: {
    name: 'Thermal infrared imager', short: 'TIR', kind: 'imager', bodies: ['earth'],
    explain: 'Measures heat (70 m pixels): fires, droughts, water stress in crops, by day and by night.',
    massKg: 25, powerW: 40, costM: 7, devMonths: 14, trl: 7,
    gsdM: 70, swathKm: 180, refAltKm: 600, bands: 2, bits: 14, daylight: false, cloudLimited: true, pointingDeg: 0.2, dutyMax: 0.3,
    color: '#ff8a65', source: 'Thermal small-sat imagers (Landsat TIRS-like at small scale); estimates', ...EST,
  },
  hsi: {
    name: 'Hyperspectral imager', short: 'HSI', kind: 'spectrometer', bodies: ['earth'],
    explain: '200 colours instead of 5 (30 m pixels): tells crop types, minerals and pollution apart. Produces a flood of data.',
    massKg: 40, powerW: 80, costM: 14, devMonths: 16, trl: 7,
    gsdM: 30, swathKm: 30, refAltKm: 600, bands: 200, bits: 12, daylight: true, cloudLimited: true, pointingDeg: 0.1, dutyMax: 0.15,
    color: '#ff6bd5', source: 'Hyperspectral small-sat instruments (PRISMA / EnMAP class, scaled); estimates', ...EST,
  },
  ais: {
    name: 'AIS ship-tracking receiver', short: 'AIS', kind: 'receiver', bodies: ['earth'],
    explain: 'A radio that listens to the identity beacons ships broadcast: who is fishing or pumping oil off the coast.',
    massKg: 2, powerW: 5, costM: 0.5, devMonths: 4, trl: 9,
    dataMbps: 0.05, daylight: false, cloudLimited: false, pointingDeg: 10, dutyMax: 1,
    color: '#9bd36b', source: 'Space-based AIS receivers (CubeSat class); estimates', ...EST,
  },
  // -------------------------------------------------------------- GEO communications payloads
  cband: {
    name: 'C-band transponders (12 × 36 MHz)', short: 'C-band', kind: 'transponder', bodies: ['earth'],
    explain: 'The rugged band: barely affected by tropical rain, a continental beam over all of Africa, modest capacity.',
    massKg: 220, powerW: 2_200, costM: 35, devMonths: 24, trl: 9, toleranceKrad: 300,
    throughputGbps: 0.65, commsBand: 'C', marginDb: 4, beamCover: { angola: 1, sadc: 1, africa: 1 }, daylight: false, cloudLimited: false, pointingDeg: 0.1, dutyMax: 1,
    color: '#ffd166', source: '36 MHz transponders × ~1.5 bit/s/Hz (DVB-S2); mass/power/cost are estimates', ...EST,
  },
  kuband: {
    name: 'Ku-band transponders (24 × 36 MHz)', short: 'Ku-band', kind: 'transponder', bodies: ['earth'],
    explain: 'The TV band: small home dishes, a regional beam over Angola and its neighbours, sensitive to heavy rain.',
    massKg: 300, powerW: 4_800, costM: 50, devMonths: 24, trl: 9, toleranceKrad: 300,
    throughputGbps: 1.7, commsBand: 'Ku', marginDb: 6, beamCover: { angola: 1, sadc: 0.7, africa: 0.3 }, daylight: false, cloudLimited: false, pointingDeg: 0.1, dutyMax: 1,
    color: '#06d6a0', source: '36 MHz transponders × ~2 bit/s/Hz (DVB-S2); mass/power/cost are estimates', ...EST,
  },
  kaHts: {
    name: 'Ka-band high-throughput spot beams', short: 'Ka-HTS', kind: 'transponder', bodies: ['earth'],
    explain: 'Dozens of narrow beams reuse the same frequencies: ten times the capacity, but tropical storms can black out a beam.',
    massKg: 400, powerW: 6_500, costM: 80, devMonths: 30, trl: 8, toleranceKrad: 300,
    throughputGbps: 20, commsBand: 'Ka', marginDb: 8, beamCover: { angola: 1, sadc: 0.35, africa: 0.1 }, daylight: false, cloudLimited: false, pointingDeg: 0.05, dutyMax: 1,
    color: '#118ab2', source: 'High-throughput satellites (multi-spot Ka); estimates', ...EST,
  },
  // -------------------------------------------------------------- lunar relay payloads
  proxS: {
    name: 'S-band lander relay (1 m dish)', short: 'Relay-S', kind: 'relay', bodies: ['moon'],
    explain: 'Listens to landers on the far side with a 1 m dish and passes their data on to Earth. Works with any lander radio.',
    massKg: 18, powerW: 60, costM: 6, devMonths: 12, trl: 9,
    proxBand: 'S', proxDishM: 1, daylight: false, cloudLimited: false, pointingDeg: 0.5, dutyMax: 1,
    color: '#5ad1ff', source: 'Queqiao-class relay transponders (estimates)', ...EST,
  },
  proxX: {
    name: 'X-band high-rate lander relay (2 m dish)', short: 'Relay-X', kind: 'relay', bodies: ['moon'],
    explain: 'A 2 m dish on X-band: tens of megabits per second from landers that carry a small dish of their own.',
    massKg: 35, powerW: 120, costM: 14, devMonths: 16, trl: 8,
    proxBand: 'X', proxDishM: 2, daylight: false, cloudLimited: false, pointingDeg: 0.1, dutyMax: 1,
    color: '#118ab2', source: 'Queqiao (4.2 m relay antenna, X-band proximity links), scaled; estimates', ...EST,
  },
  lfr: {
    name: 'Low-frequency radio telescope', short: 'Radio', kind: 'receiver', bodies: ['moon'],
    explain: 'Listens to the faint radio hiss of the early Universe. Behind the Moon it is shielded from Earth\'s radio noise.',
    massKg: 10, powerW: 20, costM: 4, devMonths: 18, trl: 6,
    dataMbps: 1, daylight: false, cloudLimited: false, pointingDeg: 5, dutyMax: 0.5,
    color: '#f4a261', source: 'Netherlands-China Low-frequency Explorer (on Queqiao) class; estimates', ...EST,
  },
  lunarCam: {
    name: 'Lunar surface camera', short: 'MoonCam', kind: 'imager', bodies: ['moon'],
    explain: 'Half-metre pixels from 50 km: landing sites and boulders. The farther the orbit, the blurrier it gets.',
    massKg: 12, powerW: 25, costM: 6, devMonths: 12, trl: 9,
    gsdM: 0.5, swathKm: 5, refAltKm: 50, bands: 1, bits: 12, daylight: true, cloudLimited: false, pointingDeg: 0.05, dutyMax: 0.05,
    color: '#cfd8dc', source: 'LRO LROC NAC (0.5 m from 50 km); mass/power are estimates', ...EST,
  },
  // -------------------------------------------------------------- Mars science
  hirise: {
    name: 'High-resolution camera (HiRISE class)', short: 'HiRISE', kind: 'imager', bodies: ['mars'],
    explain: 'Sees rocks the size of a table (30 cm pixels) but a 6 km strip, and every picture is gigabits: you can only afford a few a day.',
    massKg: 65, powerW: 60, costM: 40, devMonths: 30, trl: 9,
    gsdM: 0.3, swathKm: 6, refAltKm: 300, bands: 1.2, bits: 14, daylight: true, cloudLimited: false, pointingDeg: 0.05, dutyMax: 0.01,
    color: '#e76f51', source: 'MRO HiRISE (0.3 m from 300 km, 6 km swath, 65 kg, 60 W); cost is an estimate', estimate: true,
  },
  ctx: {
    name: 'Context camera', short: 'CTX', kind: 'imager', bodies: ['mars'],
    explain: '6 m pixels over a 30 km strip: the camera that maps the whole planet, a strip at a time.',
    massKg: 3.4, powerW: 7, costM: 8, devMonths: 18, trl: 9,
    gsdM: 6, swathKm: 30, refAltKm: 300, bands: 1, bits: 8, daylight: true, cloudLimited: false, pointingDeg: 0.1, dutyMax: 0.15,
    color: '#f4a261', source: 'MRO CTX (6 m/pixel, 30 km swath, 3.4 kg); cost is an estimate', estimate: true,
  },
  crism: {
    name: 'Imaging spectrometer (CRISM class)', short: 'Spectrometer', kind: 'spectrometer', bodies: ['mars'],
    explain: 'Hundreds of colours reveal which minerals formed in water. 18 m pixels; data-hungry.',
    massKg: 33, powerW: 46, costM: 25, devMonths: 24, trl: 9,
    gsdM: 18, swathKm: 10, refAltKm: 300, bands: 544, bits: 12, daylight: true, cloudLimited: false, pointingDeg: 0.05, dutyMax: 0.05,
    color: '#ff6bd5', source: 'MRO CRISM (18 m/pixel, 544 channels, 33 kg); cost is an estimate', estimate: true,
  },
  sharad: {
    name: 'Subsurface sounding radar', short: 'Radar', kind: 'sounder', bodies: ['mars'],
    explain: 'Radar pulses that go through the ground and bounce off buried ice layers. Works best from a low orbit.',
    massKg: 17, powerW: 100, costM: 15, devMonths: 24, trl: 9,
    dataMbps: 1.5, daylight: false, cloudLimited: false, pointingDeg: 1, dutyMax: 0.2,
    color: '#ffd166', source: 'MRO SHARAD class; data rate and cost are estimates', ...EST,
  },
  mcs: {
    name: 'Climate sounder', short: 'Sounder', kind: 'sounder', bodies: ['mars'],
    explain: 'Measures temperature, dust and water vapour through the atmosphere, all day, every day.',
    massKg: 9, powerW: 12, costM: 10, devMonths: 20, trl: 9,
    dataMbps: 0.01, daylight: false, cloudLimited: false, pointingDeg: 0.5, dutyMax: 1,
    color: '#8fd3ff', source: 'MRO Mars Climate Sounder (9 kg); cost is an estimate', ...EST,
  },
  uvs: {
    name: 'Ultraviolet spectrograph', short: 'UV', kind: 'spectrometer', bodies: ['mars'],
    explain: 'Watches the upper atmosphere glow and leak into space: how Mars lost its water.',
    massKg: 22, powerW: 25, costM: 12, devMonths: 24, trl: 8,
    dataMbps: 0.05, daylight: false, cloudLimited: false, pointingDeg: 0.2, dutyMax: 0.5,
    color: '#b6a6ff', source: 'MAVEN IUVS class; estimates', ...EST,
  },
  mag: {
    name: 'Magnetometer', short: 'MAG', kind: 'field', bodies: ['earth', 'moon', 'mars'],
    explain: 'Measures magnetic fields: Mars\'s ancient crust, or the space weather around the Moon.',
    massKg: 3, powerW: 3, costM: 2, devMonths: 12, trl: 9,
    dataMbps: 0.002, daylight: false, cloudLimited: false, pointingDeg: 2, dutyMax: 1,
    color: '#9bd36b', source: 'Fluxgate magnetometers (MAVEN/MGS class); estimates', ...EST,
  },
};

/** 2:1 lossless-to-near-lossless compression of imager data. */
export const COMPRESSION = 2;

/** Ground speed of the point straight below an orbiter at this altitude (m/s). */
export const groundSpeed = (body: Body, altKm: number) => {
  const r = body.radius + altKm * 1000;
  return Math.sqrt(body.mu / r) * (body.radius / r);
};

/** Ground sample distance (m) and swath (km) at an altitude. */
export function imagerAt(ins: Instrument, altKm: number): { gsdM: number; swathKm: number } | null {
  if (!ins.gsdM || !ins.refAltKm) return null;
  // radar resolution does not depend on the distance; optics scale with it
  const k = ins.kind === 'sar' ? 1 : altKm / ins.refAltKm;
  return { gsdM: ins.gsdM * k, swathKm: (ins.swathKm ?? 0) * (ins.kind === 'sar' ? 1 : altKm / ins.refAltKm) };
}

/** Data rate while operating (Mbps) at an altitude. */
export function instrumentRateMbps(ins: Instrument, body: Body, altKm: number): number {
  if (ins.dataMbps !== undefined) return ins.dataMbps;
  const im = imagerAt(ins, altKm);
  if (!im) return 0;
  const vg = groundSpeed(body, altKm);
  return ((im.swathKm * 1000) / im.gsdM) * (vg / im.gsdM) * (ins.bands ?? 1) * (ins.bits ?? 12) / COMPRESSION / 1e6;
}

/** Mass growth allowance by maturity (AIAA S-120 trend): new technology grows more before it flies. */
export const massGrowth = (trl: number) => (trl >= 8 ? 0.05 : trl >= 6 ? 0.1 : 0.25);
