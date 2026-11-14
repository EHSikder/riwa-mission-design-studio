/**
 * Real missions like yours. After the flight the report names the real missions closest to the design, the way
 * NASA's "Build It Yourself: Telescope" game (a resource of the Space Apps challenge) shows players the real
 * telescopes their design resembles. The facts are short summaries of the missions' public pages, linked; no
 * data or pictures are copied from them.
 */
import type { Analysis } from './analyze';
import { PLATFORMS, type OrbitTypeId } from './catalog';
import { INSTRUMENTS } from './instruments';
import type { BodyId } from './types';

type Size = 'cubesat' | 'small' | 'large' | 'crew';
type Job = 'imaging' | 'comms' | 'relay' | 'science' | 'crew';

export interface RealMission {
  id: string;
  name: string;
  who: string;
  year: number;
  body: BodyId;
  orbits: OrbitTypeId[];
  size: Size;
  jobs: Job[];
  what: string;
  link?: string;
}

export const REAL_MISSIONS: RealMission[] = [
  {
    id: 'landsat9', name: 'Landsat 9', who: 'NASA and USGS', year: 2021, body: 'earth', orbits: ['sso'], size: 'large', jobs: ['imaging'],
    what: 'Images the whole Earth from a 705 km sun-synchronous orbit in 30 m pixels (15 m in black and white) along a 185 km strip. With Landsat 8 it sees every place every 8 days.',
    link: 'https://science.nasa.gov/mission/landsat-9/',
  },
  {
    id: 'sentinel2', name: 'Sentinel-2', who: 'ESA, for Copernicus', year: 2015, body: 'earth', orbits: ['sso'], size: 'large', jobs: ['imaging'],
    what: 'Two satellites half an orbit apart at 786 km: 10 m pixels, a 290 km wide strip, and every place seen every 5 days. Farmers and flood teams use its pictures every day.',
    link: 'https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2/',
  },
  {
    id: 'ghanasat1', name: 'GhanaSat-1', who: 'All Nations University, Ghana', year: 2017, body: 'earth', orbits: ['leo'], size: 'cubesat', jobs: ['imaging'],
    what: 'Ghana\'s first satellite: a 1U CubeSat with cameras, built by students and released from the International Space Station in 2017.',
  },
  {
    id: 'punch', name: 'PUNCH', who: 'NASA', year: 2025, body: 'earth', orbits: ['sso'], size: 'small', jobs: ['science'],
    what: 'Four suitcase-sized satellites in a low polar orbit along the line between day and night, imaging the solar wind together. Launched on 11 March 2025.',
    link: 'https://science.nasa.gov/mission/punch/',
  },
  {
    id: 'angosat2', name: 'ANGOSAT-2', who: 'Angola (GGPEN)', year: 2022, body: 'earth', orbits: ['geo'], size: 'large', jobs: ['comms'],
    what: 'Angola\'s geostationary communications satellite, launched in October 2022 and run from the GGPEN mission control centre near Luanda.',
  },
  {
    id: 'lro', name: 'Lunar Reconnaissance Orbiter', who: 'NASA', year: 2009, body: 'moon', orbits: ['llo', 'elfo'], size: 'large', jobs: ['imaging', 'science'],
    what: 'Has mapped the Moon since 2009, starting from a 50 km polar orbit. Its camera sees details half a metre across.',
    link: 'https://science.nasa.gov/mission/lro/',
  },
  {
    id: 'capstone', name: 'CAPSTONE', who: 'NASA', year: 2022, body: 'moon', orbits: ['halo', 'crewNrho'], size: 'cubesat', jobs: ['relay', 'science'],
    what: 'A 12U CubeSat of about 25 kg, launched on a Rocket Lab Electron in June 2022. After a four-month low-energy trip it became the first spacecraft in the near-rectilinear halo orbit planned for the Gateway station.',
    link: 'https://www.nasa.gov/mission/capstone/',
  },
  {
    id: 'queqiao', name: 'Queqiao and Queqiao-2', who: 'China (CNSA)', year: 2018, body: 'moon', orbits: ['halo', 'elfo'], size: 'small', jobs: ['relay'],
    what: 'Queqiao loops around the Earth–Moon L2 point beyond the far side, and let the Chang\'e-4 lander talk to Earth. Queqiao-2 followed in 2024 on a long elliptical lunar orbit, relaying for Chang\'e-6.',
  },
  {
    id: 'mro', name: 'Mars Reconnaissance Orbiter', who: 'NASA', year: 2005, body: 'mars', orbits: ['marsLow'], size: 'large', jobs: ['imaging', 'science', 'relay'],
    what: 'Aerobraked for about five months down to a low polar orbit around 300 km up. Its HiRISE camera sees details about 30 cm across, and it relays data from rovers on the surface.',
    link: 'https://science.nasa.gov/mission/mars-reconnaissance-orbiter/',
  },
  {
    id: 'maven', name: 'MAVEN', who: 'NASA', year: 2013, body: 'mars', orbits: ['marsHigh'], size: 'large', jobs: ['science'],
    what: 'On a long elliptical orbit since 2014, dipping to about 150 km to sample the upper atmosphere and learn how Mars lost most of its air.',
    link: 'https://science.nasa.gov/mission/maven/',
  },
  {
    id: 'marco', name: 'MarCO', who: 'NASA JPL', year: 2018, body: 'mars', orbits: ['marsLow', 'marsHigh'], size: 'cubesat', jobs: ['relay'],
    what: 'Two 6U CubeSats that flew to Mars with InSight in 2018 and relayed its landing to Earth: the first CubeSats in deep space.',
    link: 'https://science.nasa.gov/mission/marco/',
  },
  {
    id: 'artemis2', name: 'Artemis II', who: 'NASA, with the Canadian Space Agency', year: 2026, body: 'moon', orbits: ['freeReturn'], size: 'crew', jobs: ['crew'],
    what: 'Four astronauts flew around the far side of the Moon and home on a free-return path in April 2026: about ten days in Orion, launched by the SLS.',
    link: 'https://www.nasa.gov/mission/artemis-ii/',
  },
  {
    id: 'artemis1', name: 'Artemis I', who: 'NASA', year: 2022, body: 'moon', orbits: ['crewDro', 'crewNrho'], size: 'crew', jobs: ['crew'],
    what: 'Orion flew without a crew to a distant retrograde orbit around the Moon and back in 25.5 days, measuring the radiation a crew would receive.',
    link: 'https://www.nasa.gov/mission/artemis-i/',
  },
  {
    id: 'apollo8', name: 'Apollo 8', who: 'NASA', year: 1968, body: 'moon', orbits: ['crewLlo'], size: 'crew', jobs: ['crew'],
    what: 'The first crew to orbit the Moon: ten orbits about 110 km up, at Christmas 1968.',
    link: 'https://www.nasa.gov/mission/apollo-8/',
  },
];

const SIZE_ORDER: Size[] = ['cubesat', 'small', 'large'];
const JOB_OF: Record<string, Job> = { imager: 'imaging', sar: 'imaging', transponder: 'comms', relay: 'relay', spectrometer: 'science', sounder: 'science', field: 'science', receiver: 'science', crew: 'crew' };
const JOB_WORDS: Record<Job, string> = { imaging: 'takes pictures', comms: 'carries communications', relay: 'relays other missions', science: 'does science', crew: 'carries a crew' };

export interface MissionMatch { mission: RealMission; why: string[] }

/** The design's size class, in the missions' terms. */
function sizeOf(a: Analysis): Size {
  const p = PLATFORMS[a.design.platform];
  if (p.crew) return 'crew';
  if (p.cubesat) return 'cubesat';
  return a.design.platform === 'micro' || a.design.platform === 'small' ? 'small' : 'large';
}

/** Up to `n` real missions most like this design, with what they share. */
export function realMissionsLike(a: Analysis, n = 3): MissionMatch[] {
  const size = sizeOf(a);
  const jobs = new Set(a.design.instruments.map((i) => JOB_OF[INSTRUMENTS[i].kind]).filter(Boolean));
  if (a.crew) jobs.add('crew');
  const scored = REAL_MISSIONS
    .filter((m) => m.body === a.scenario.body && (m.size === 'crew') === (size === 'crew'))
    .map((m) => {
      const why: string[] = [];
      let score = 0;
      if (m.orbits.includes(a.design.orbit.type)) { score += 3; why.push('the same kind of orbit'); }
      if (m.size === size) { score += 3; why.push(size === 'cubesat' ? 'a CubeSat too' : size === 'crew' ? 'a crewed flight too' : 'a similar size'); }
      else if (size !== 'crew' && Math.abs(SIZE_ORDER.indexOf(m.size) - SIZE_ORDER.indexOf(size)) === 1) score += 1;
      const shared = m.jobs.filter((j) => jobs.has(j));
      score += 2 * Math.min(2, shared.length);
      if (shared.length && size !== 'crew') why.push(`it ${JOB_WORDS[shared[0]]} too`);
      return { mission: m, why, score };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || y.mission.year - x.mission.year);
  return scored.slice(0, n).map(({ mission, why }) => ({ mission, why }));
}
