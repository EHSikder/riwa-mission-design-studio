/**
 * Angola's sky month by month, as Landsat 8 and 9 saw it (model/sky.ts): how much of the land a camera sees
 * clear (blue) and how much is under cloud (pale), with the year's average as a dashed line.
 */
import { ANGOLA_SKY, CLEAR_BY_MONTH, CLEAR_YEAR, CLEAREST, CLOUDIEST, MONTHS, pct } from '../model/sky';

const W = 336, H = 126, TOP = 34, GAP = 6;
const BW = (W - GAP * 11) / 12;
const y = (v: number) => TOP + (1 - v) * (H - TOP);

export function SkyChart() {
  const label = `How much of Angola Landsat 8 and 9 saw clear, by month: ${CLEAR_BY_MONTH.map((c, k) => `${MONTHS[k]} ${pct(c)}`).join(', ')}. Over a year ${pct(CLEAR_YEAR)}.`;
  return (
    <figure className="st-sky">
      <svg viewBox={`0 0 ${W} ${H + 20}`} role="img" aria-label={label}>
        <g aria-hidden>
          <rect x={0} y={3} width={11} height={11} rx={2} className="clear" />
          <text x={16} y={13}>clear</text>
          <rect x={64} y={3} width={11} height={11} rx={2} className="cloud" />
          <text x={80} y={13}>cloud</text>
          <line x1={132} x2={152} y1={8.5} y2={8.5} className="avg" />
          <text x={157} y={13}>year {pct(CLEAR_YEAR)}</text>
        </g>
        {CLEAR_BY_MONTH.map((c, k) => {
          const x = k * (BW + GAP);
          return (
            <g key={k}>
              <title>{`${MONTHS[k]}: ${pct(c)} clear (${ANGOLA_SKY.months[k].scenes.toLocaleString('en-GB')} pictures)`}</title>
              <rect x={x} y={TOP} width={BW} height={H - TOP} rx={4} className="cloud" />
              <rect x={x} y={y(c)} width={BW} height={H - y(c)} rx={4} className="clear" />
              {(k === CLEAREST || k === CLOUDIEST) && <text x={x + BW / 2} y={y(c) - 5} textAnchor="middle" className="val">{pct(c)}</text>}
              <text x={x + BW / 2} y={H + 15} textAnchor="middle">{MONTHS[k][0]}</text>
            </g>
          );
        })}
        <line x1={0} x2={W} y1={y(CLEAR_YEAR)} y2={y(CLEAR_YEAR)} className="avg" />
      </svg>
      <figcaption>
        Measured by NASA and USGS's Landsat 8 and 9 in {ANGOLA_SKY.scenes.toLocaleString('en-GB')} pictures of Angola
        from {ANGOLA_SKY.from.slice(0, 4)} to {ANGOLA_SKY.to.slice(0, 4)}, through the Microsoft Planetary Computer. Radar sees through cloud all year.
      </figcaption>
    </figure>
  );
}
