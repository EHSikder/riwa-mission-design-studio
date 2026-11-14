/**
 * How clear Angola's sky is, month by month, measured by Landsat 8 and 9 (angolaSky.ts, written by
 * scripts/landsat-sky.mjs from the Microsoft Planetary Computer). The coverage models need the chance that a
 * place is clear on one pass of a camera: one minus the average cloud over land.
 */
import { ANGOLA_SKY } from './angolaSky';

export { ANGOLA_SKY };

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const mean = (v: readonly number[]) => v.reduce((s, x) => s + x, 0) / v.length;

/** The chance that a place in Angola is clear on one pass, by month (0 = January). */
export const CLEAR_BY_MONTH: readonly number[] = ANGOLA_SKY.months.map((m) => 1 - m.cloudPct / 100);
/** Over a whole year, each month counting the same. */
export const CLEAR_YEAR = mean(CLEAR_BY_MONTH);
/** The rainy months, November to March: the cloudiest five, and the time of floods. */
export const RAINY_MONTHS = [10, 11, 0, 1, 2];
export const CLEAR_RAINY = mean(RAINY_MONTHS.map((m) => CLEAR_BY_MONTH[m]));
/** The dry months, May to August: the clearest four. */
export const DRY_MONTHS = [4, 5, 6, 7];
export const CLEAR_DRY = mean(DRY_MONTHS.map((m) => CLEAR_BY_MONTH[m]));
/** The clearest and the cloudiest month (0 = January). */
export const CLEAREST = CLEAR_BY_MONTH.indexOf(Math.max(...CLEAR_BY_MONTH));
export const CLOUDIEST = CLEAR_BY_MONTH.indexOf(Math.min(...CLEAR_BY_MONTH));

/** The calendar month (0 = January) a number of months after a project that starts in January. */
export const monthOf = (monthsFromStart: number) => ((Math.floor(monthsFromStart) % 12) + 12) % 12;

/** "61%" */
export const pct = (x: number) => `${Math.round(x * 100)}%`;
