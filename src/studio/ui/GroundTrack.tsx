/**
 * A day of ground track on a world map: the orbit's path, each instrument's swath, the target regions, and the
 * ground stations with the circles inside which they can hear the satellite. For GEO: the area that sees the
 * slot above 20°. Drawn on a 2D canvas over the Earth texture (equirectangular), Africa or the whole world.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { groundTrack, horizonAngle } from '../model/access';
import type { Analysis } from '../model/analyze';
import { STATIONS } from '../model/catalog';
import { INSTRUMENTS } from '../model/instruments';
import { REGIONS, type RegionId } from '../model/regions';
import { Seg } from './controls';

const VIEWS = {
  africa: { lonMin: -30, lonMax: 70, latMin: -45, latMax: 40 },
  world: { lonMin: -180, lonMax: 180, latMin: -80, latMax: 80 },
};
type View = keyof typeof VIEWS;

let earthImage: HTMLImageElement | null = null;
const imageReady: Promise<HTMLImageElement> = new Promise((resolve) => {
  if (typeof Image === 'undefined') return;
  const img = new Image();
  img.onload = () => { earthImage = img; resolve(img); };
  img.src = `${import.meta.env.BASE_URL}assets/textures/earth_day_4k.jpg`;
});

/** Points of a small circle on the sphere around (lat, lon) with angular radius `rad`. */
function circle(lat: number, lon: number, rad: number, n = 72): [number, number][] {
  const d2r = Math.PI / 180;
  const la = lat * d2r, lo = lon * d2r;
  const out: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const b = (k / n) * 2 * Math.PI;
    const la2 = Math.asin(Math.sin(la) * Math.cos(rad) + Math.cos(la) * Math.sin(rad) * Math.cos(b));
    const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(rad) * Math.cos(la), Math.cos(rad) - Math.sin(la) * Math.sin(la2));
    out.push([lo2 / d2r, la2 / d2r]);
  }
  return out;
}

export function GroundTrack({ a }: { a: Analysis }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const geo = a.design.orbit.type === 'geo';
  const [view, setView] = useState<View>('africa');
  const [, setLoaded] = useState(!!earthImage);
  useEffect(() => { imageReady.then(() => setLoaded(true)); }, []);
  const o = a.orbit;
  const track = useMemo(() => (geo ? [] : groundTrack(o.body, o.altKm, o.incDeg, o.raanDeg, 24, 60)), [geo, o.body, o.altKm, o.incDeg, o.raanDeg]);
  const regions = useMemo(() => [...new Set(a.requirements.map((r) => r.req.region).filter((x): x is RegionId => !!x))], [a.requirements]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width, H = cv.height;
    const v = VIEWS[view];
    const X = (lon: number) => ((lon - v.lonMin) / (v.lonMax - v.lonMin)) * W;
    const Y = (lat: number) => ((v.latMax - lat) / (v.latMax - v.latMin)) * H;
    const pxPerDeg = W / (v.lonMax - v.lonMin);
    ctx.clearRect(0, 0, W, H);
    if (earthImage) {
      const iw = earthImage.width, ih = earthImage.height;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(earthImage, ((v.lonMin + 180) / 360) * iw, ((90 - v.latMax) / 180) * ih, ((v.lonMax - v.lonMin) / 360) * iw, ((v.latMax - v.latMin) / 180) * ih, 0, 0, W, H);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(2, 6, 16, 0.35)';
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = '#0a1a33';
      ctx.fillRect(0, 0, W, H);
    }
    const path = (pts: [number, number][]) => {
      ctx.beginPath();
      let prev: number | null = null;
      for (const [lon, lat] of pts) {
        const x = X(lon), y = Y(lat);
        if (prev !== null && Math.abs(lon - prev) > 180) ctx.moveTo(x, y);
        else if (prev === null) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        prev = lon;
      }
    };
    // target regions
    for (const id of regions) {
      for (const ring of REGIONS[id].rings) {
        path([...ring, ring[0]]);
        ctx.fillStyle = 'rgba(255, 181, 71, 0.22)';
        ctx.fill();
        ctx.strokeStyle = '#ffb547';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    if (geo) {
      const k = o.body.radius / 42_164_000;
      const el = (20 * Math.PI) / 180;
      const c = Math.acos(k * Math.cos(el)) - el;
      path(circle(0, a.design.orbit.lonDeg, c));
      ctx.fillStyle = 'rgba(90, 209, 255, 0.16)';
      ctx.fill();
      ctx.strokeStyle = '#5ad1ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#5ad1ff';
      ctx.beginPath();
      ctx.arc(X(a.design.orbit.lonDeg), Y(0), 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = '600 12px Inter, system-ui, sans-serif';
      ctx.fillText(`Slot ${a.design.orbit.lonDeg.toFixed(0)}°`, X(a.design.orbit.lonDeg) + 9, Y(0) - 8);
    } else {
      // swaths (widest first), then the track itself
      const swaths = a.design.instruments.map((id) => INSTRUMENTS[id]).filter((i) => i.swathKm).map((i) => ({ i, km: i.kind === 'sar' || !i.refAltKm ? i.swathKm! : (i.swathKm! * o.imagingAltKm) / i.refAltKm }))
        .sort((p, q) => q.km - p.km);
      const pts = track.map((p) => [p.lon, p.lat] as [number, number]);
      for (const { i, km } of swaths) {
        path(pts);
        ctx.strokeStyle = i.color;
        ctx.globalAlpha = 0.28;
        ctx.lineWidth = Math.max(2, (km / 111.32) * pxPerDeg);
        ctx.lineCap = 'round';
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      path(pts);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // ground stations and their hearing circles
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    for (const id of a.design.stations) {
      const st = STATIONS[id];
      if (st.deepSpace) continue;
      if (!geo) {
        path(circle(st.lat, st.lon, horizonAngle(o.body, o.altKm, st.minElDeg)));
        ctx.strokeStyle = 'rgba(79, 209, 139, 0.9)';
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#4fd18b';
      ctx.beginPath();
      ctx.arc(X(st.lon), Y(st.lat), 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText(st.short, X(st.lon) + 6, Y(st.lat) - 6);
    }
  }, [a, track, regions, view, geo, o]);

  return (
    <div className="st-map">
      <canvas
        ref={ref}
        width={720}
        height={Math.round((720 * (VIEWS[view].latMax - VIEWS[view].latMin)) / (VIEWS[view].lonMax - VIEWS[view].lonMin))}
        aria-label="Map of the orbit's ground track"
      />
      <div className="st-map-bar">
        <Seg label="Map view" value={view} options={[{ value: 'africa', label: 'Africa' }, { value: 'world', label: 'World' }]} onPick={setView} />
        <span className="st-legend">
          {!geo && <><i className="trk" /> track</>}
          <i className="reg" /> targets <i className="sta" /> stations
        </span>
      </div>
    </div>
  );
}
