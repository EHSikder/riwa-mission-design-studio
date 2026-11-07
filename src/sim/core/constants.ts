/**
 * Physical constants. SI units (m, s, kg, rad) unless the name says otherwise.
 * Sources: REFERENCES.md.
 */

export const DEG = Math.PI / 180;
export const DAY = 86_400;
export const J2000_JD = 2_451_545.0;
export const JULIAN_CENTURY_DAYS = 36_525;

/** Standard gravity, used to convert Isp (s) to exhaust velocity. */
export const G0 = 9.806_65;

/** Earth: GM, WGS-84 equatorial radius and flattening, J2, rotation rate. */
export const MU_EARTH = 3.986_004_418e14;
export const R_EARTH = 6_378_137;
export const EARTH_FLATTENING = 1 / 298.257_223_563;
export const J2_EARTH = 1.082_63e-3;
export const OMEGA_EARTH = 7.292_115e-5;

/** Moon: GM and LOLA reference radius. */
export const MU_MOON = 4.902_8e12;
export const R_MOON = 1_737_400;

/**
 * Earth–Moon distance used by the circular (CR3BP-consistent) Moon model.
 * 384,400 km is the standard CR3BP length unit used in cislunar mission-design literature.
 */
export const EARTH_MOON_DISTANCE = 384_400_000;

/** Mass parameter of the Earth–Moon CR3BP: m_moon / (m_earth + m_moon) ≈ 0.01215. */
export const MU_RATIO_EARTH_MOON = MU_MOON / (MU_EARTH + MU_MOON);

/** Inclination of the Moon's orbit to the ecliptic, and of the lunar equator to the ecliptic (Cassini's laws). */
export const MOON_ORBIT_INCLINATION = 5.145 * DEG;
export const MOON_EQUATOR_INCLINATION = 1.5427 * DEG;

/** Sun. */
export const MU_SUN = 1.327_124_400_18e20;
export const AU = 1.495_978_707e11;
export const R_SUN = 6.957e8;
export const SOLAR_FLUX_1AU = 1361;

/** Mean obliquity of the ecliptic at J2000. */
export const OBLIQUITY_J2000 = 23.439_291_1 * DEG;

export const STEFAN_BOLTZMANN = 5.670_374e-8;
export const C_LIGHT = 299_792_458;
