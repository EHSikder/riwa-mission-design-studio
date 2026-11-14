# References

Everything this project uses that we did not create. The hackathon rules require every source to be cited, even free ones, and every licence to be identified. Keep this list current: when you add a data set, add it here.

Every number in the catalogs carries its own source note in the code (`src/studio/model/catalog.ts` and `instruments.ts`). Prices, and many masses and power figures, are our estimates; the game marks them.

## NASA data and resources

| Resource | How the game uses it |
|---|---|
| [Blue Marble Next Generation](https://visibleearth.nasa.gov/collection/1484/blue-marble) (July, `world.topo.bathy.200407`) | The Earth map under every ground track, resized to 4096 × 2048 (`public/assets/textures/earth_day_4k.jpg`) |
| [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851), NASA Scientific Visualization Studio | The star background, resized to 2048 × 1024 (`public/assets/textures/stars_2k.jpg`) |
| [Landsat 8 and 9 Collection 2 Level-2](https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2) (NASA and USGS), read through the Microsoft Planetary Computer's STAC API (free, no account) | How clear Angola's sky is, month by month: the land cloud cover (`landsat:cloud_cover_land`) of 13,482 scenes over Angola from 2021 to 2025. `scripts/landsat-sky.mjs` (`npm run sky`) fetches them and writes `src/studio/model/angolaSky.ts`. Used for a camera's clear revisit and coverage, the flood response and first light. Landsat data from USGS are in the public domain |
| [Mars Reconnaissance Orbiter](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/): HiRISE, CTX, CRISM, Mars Climate Sounder, SHARAD | Resolution, swath, mass and power of the Mars instruments, and the size of the Mars platform |
| [Lunar Reconnaissance Orbiter](https://science.nasa.gov/mission/lro/): LROC narrow-angle camera | The lunar camera |
| [MAVEN](https://science.nasa.gov/mission/maven/): imaging ultraviolet spectrograph, magnetometer (with Mars Global Surveyor) | The Mars atmosphere and magnetic-field instruments, as class references |
| [Small Spacecraft Technology State of the Art](https://www.nasa.gov/smallsat-institute/sst-soa) | Solar cells, batteries, cold-gas thrusters, onboard computers, attitude control; from the power and communications chapters: panels 40–75 W/kg, battery packs 110–250 Wh/kg, CubeSat radio data rates and transmit power (0.5–5 W) |
| [DSN Telecommunications Link Design Handbook (810-005)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/) | The receiving performance of the Deep Space Network's 34 m antennas |
| [Orion spacecraft](https://www.nasa.gov/humans-in-space/orion-spacecraft/) and the European Service Module | The deep-space capsule: mass, habitable volume (about 9 m³), 4 crew for 21 days, the service module's engine and wings (`src/studio/model/catalog.ts`) |
| [Space Launch System](https://www.nasa.gov/humans-in-space/space-launch-system/) (Block 1) | The crew-rated Moon rocket (more than 27 t toward the Moon) |
| [Artemis II](https://www.nasa.gov/mission/artemis-ii/) (1–10 April 2026) | The crewed mission's free-return trajectory, its length (about 10 days), the high-Earth-orbit checkout and manual piloting demonstration, the optical communications terminal (O2O), and the AVATAR organ-chip experiment |
| [Artemis I](https://www.nasa.gov/mission/artemis-i/) (2022) and its radiation results (Zeitlin et al., *Space radiation measurements during the Artemis I lunar mission*, Nature, 2024) | Cosmic-ray dose per day beyond Earth's magnetic field, and how much the Orion storm shelter cuts a solar storm (`src/studio/model/crew.ts`) |
| NASA Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570 | Oxygen, water, food and carbon dioxide per crew member per day |
| NASA Office of Inspector General reports on Artemis costs | The order of magnitude of a crewed launch's cost (estimates) |
| NASA astronaut radiation limit (600 mSv career, NASA-STD-3001) | The scale for the crew's dose |
| [NASA Systems Engineering Handbook](https://www.nasa.gov/reference/systems-engineering-handbook/) (SP-2016-6105 Rev 2) and NPR 7120.5: [the project life cycle](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/) | The game's steps (concept, design, review, build and test, operations), the review board, the names of NASA's reviews in the flight, the technology readiness rule and the 15%/75% cost lesson in the glossary |
| NPR 8705.4B, Risk Classification for NASA Payloads | The risk class (A to D, by planned lifetime) on the review board |
| NASA lessons from Kepler (K2), Galileo (high-gain antenna) and InSight (instrument leak found in testing) | The kind of problems in orbit, and why the test campaign matters; the anomaly causes are written by us |
| [Jet Propulsion Laboratory Team X](https://jplteamx.jpl.nasa.gov/) | The concurrent-design desks |

### From the challenge's Resources tab

Every resource on the tab, the links we followed inside them, and what the game takes from each is in [CHALLENGE-RESOURCES.md](CHALLENGE-RESOURCES.md). In short:

| Resource | How the game uses it |
|---|---|
| [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) (NASA Small Spacecraft Systems Virtual Institute, 2025) | The four mission segments (launch, space, ground, user) on the review board, and "start from the user" in the brief |
| [General Mission Analysis Tool (GMAT)](https://software.nasa.gov/software/GSC-19468-1), NASA, Apache License 2.0 | The physical constants of the Earth, Moon and Mars (GMAT's defaults and gravity models) and the geostationary radius (`src/studio/model/types.ts`) |
| Wessen, Borden, Ziemer and Kwok, [*Space mission concept development using concept maturity levels*](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299), JPL, 2013 (CC0) | The concept-maturity checklist on the review board, the 35% point-design margins and 3 dB link margin, and the mass growth event (`src/studio/model/maturity.ts`) |
| [Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/), NASA Goddard | Its 16 disciplines and its point-design rule, in the brief and the review board |
| [NASA Mission Viz](https://nasa.github.io/mission-viz/) (Marshall) | The equations of the orbit view (`src/studio/ui/OrbitView.tsx`). Its code has no licence file, so none of it is used |
| [Build It Yourself: Telescope](https://science.nasa.gov/mission/webb/game-build-it-yourself/), NASA Webb | The idea of "real missions like yours" at the end of the report |
| [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf), NASA CubeSat Launch Initiative, 2017 | CubeSat schedules, the 10% reserve floor, the day-in-the-life test, the licences step, deployment and tracking after launch, the burn-wire flaw |
| [LSP-REQ-317.01](https://www.nasa.gov/pdf/627972main_LSP-REQ-317_01A.pdf), NASA's launch rules for CubeSats (linked from CubeSat 101) | Vibration and bake-out test levels (`src/studio/model/tests.ts`) |
| [Visualize a Space Mission Using Virtual Reality](https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/) (Space Apps 2023) | Its links to GMAT and Mission Viz; its brief (concept, trajectory, timeline, free hosting) |

### Real missions named in the report

Short summaries of public mission pages, with links in the game: [Landsat 9](https://science.nasa.gov/mission/landsat-9/), [PUNCH](https://science.nasa.gov/mission/punch/), [Lunar Reconnaissance Orbiter](https://science.nasa.gov/mission/lro/), [CAPSTONE](https://www.nasa.gov/mission/capstone/), [Mars Reconnaissance Orbiter](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/), [MAVEN](https://science.nasa.gov/mission/maven/), [MarCO](https://science.nasa.gov/mission/marco/), [Artemis I](https://www.nasa.gov/mission/artemis-i/), [Artemis II](https://www.nasa.gov/mission/artemis-ii/) and [Apollo 8](https://www.nasa.gov/mission/apollo-8/) (NASA); [Sentinel-2](https://www.esa.int/Applications/Observing_the_Earth/Copernicus/Sentinel-2/) (ESA); GhanaSat-1 (All Nations University, Ghana); ANGOSAT-2 (Angola); Queqiao and Queqiao-2 (China). No data or pictures come from them.

## Space agency partner data

| Resource | How the game uses it |
|---|---|
| Angola National Space Programme Management Office (GGPEN): [challenge statement](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) and [partner page](https://www.spaceappschallenge.org/2026/space-agency-partners/) | The Angola missions are inspired by GGPEN's public description of its work. **Add here:** the GGPEN data sets, due 13 November 2026 |
| ESA / INTA: Maspalomas station; Φ-sat-1 (onboard cloud screening); Sentinel-2 class bands | A ground station, the edge processor, and a class reference for an imager |
| SANSA: Hartebeesthoek station | A ground station |
| ISRO: PSLV capacity | A launcher |
| [ESA Concurrent Design Facility](https://www.esa.int/Enabling_Support/Space_Engineering_Technology/CDF) (ESTEC) and the ESA Academy Concurrent Engineering Challenge | The concurrent-design desks and how student teams learn mission design |
| Angola's signature of the Artemis Accords (30 November 2023) | The crewed mission's customer: an Artemis Accords partnership |
| CSA [Digital Games and Activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) (the challenge's partner resource) | Reviewed (RADARSAT and OSIRIS-REx games and others); nothing from them is used |

## Other public sources

**Books and standards**
- Wertz and Larson, *Space Mission Analysis and Design* (solar cell degradation, array losses, structure fraction, hydrazine performance).
- Vallado, *Fundamentals of Astrodynamics and Applications*, Table 8-4 (exponential atmosphere).
- ITU-R P.618 (the shape of the rain-fade figures, which are our estimates for a tropical climate).
- NASA GMAT's default constants (see above); the Moon's and Mars's orbits and years from the NASA fact sheets.
- [CubeSat Design Specification Rev 14.1](https://www.cubesat.org/s/CDS-REV14_1-2022-02-09.pdf) (Cal Poly, 2022): 6U and 12U mass limits, deployment timers, the propulsion rule.
- [FCC Public Notice DA 13-445](https://docs.fcc.gov/public/attachments/DA-13-445A1.pdf) (2013): small satellite licensing times.

**Launchers** (published capacities; prices and some capacities are estimates)
- SpaceX: Falcon 9, Falcon Heavy, rideshare price list.
- Arianespace: Ariane 62, Ariane 64, Vega-C.
- Rocket Lab: Electron, and CAPSTONE as a lunar reference.

**Ground stations**
- KSAT SvalSat; commercial lunar and deep-space networks (KSAT, SSC, Goonhilly class).
- Luanda: the location is approximate and the 9 m antenna is assumed, until GGPEN's data replaces them.

**Instruments and parts, as class references**
- Imagers: Simera and Dragonfly class CubeSat cameras; NigeriaSat-X and UK-DMC-2; Sentinel-2 class bands; small-satellite 1–3 m telescopes; Landsat TIRS class thermal imagers; PRISMA and EnMAP hyperspectral instruments.
- Radar and tracking: ICEYE and Capella small radar satellites; space-based AIS receivers.
- Communications: DVB-S2 transponders; high-throughput multi-spot Ka satellites.
- Propulsion: Ariane Group S400 apogee engine; SPT-100 class electric thrusters.
- Platforms: SSTL-300 and ESPA Grande class; Eurostar and SSL-1300 class GEO buses.
- Avionics: RAD750 class flight computers; Pléiades class agile pointing.
- Far-side relays: published figures for the Queqiao relay satellite and the Netherlands-China Low-Frequency Explorer, used only as size references. No data or material came from those programmes.

**Crewed flight**
- Apollo: command module volume, lunar orbit insertion and departure burns (about 0.9 and 1 km/s), the lithium hydroxide canisters, and Apollo 13 as the reason for margin days.
- Crew Dragon and Starliner: built-in abort engines as a class reference; Soyuz and Orion: launch escape towers.
- The masses, power, prices and fault rates of the life-support systems, shelters and escape systems are our estimates (marked ⚠).

**How real teams work**
- The test campaign (vibration, thermal vacuum, deployment, ground-station compatibility, mission rehearsal) follows the usual "test as you fly" practice of space projects; durations and costs are our estimates.
- The anomalies (failed solar string, star-tracker blinding, wheel friction, gyro drift, ground-station faults, rain, amplifier trips, contamination, memory leaks, tank leaks, CO₂ scrubber faults, cabin leaks) are written by us after typical spacecraft failure reports; the telemetry values are illustrative.

**Maps**
- Angola's outline is simplified by hand from public-domain maps, until GGPEN's data replaces it.

## Software

The built game contains only these packages (checked from the build's source map). All are MIT licensed.

| Package | Version |
|---|---|
| react, react-dom | 19.3.0 |
| scheduler | 0.28.0 |
| use-sync-external-store | 1.7.0 |
| three | 0.186.1 |
| three-stdlib | 2.36.1 |
| @react-three/fiber | 9.8.1 |
| @react-three/drei | 10.7.9 |
| its-fine | 2.1.1 |
| react-use-measure | 2.1.7 |
| suspend-react | 0.1.3 |
| @babel/runtime | 7.29.10 |
| zustand | 5.0.15 |

Typefaces, loaded from Google Fonts when the game has a connection (otherwise Helvetica or Arial): Archivo, Newsreader and JetBrains Mono, all under the SIL Open Font License 1.1.

Used to build and test it, not shipped: Vite 8.3.4 (MIT), @vitejs/plugin-react 6.1.2 (MIT), Vitest 5.0.4 (MIT), TypeScript 7.0.2 (Apache-2.0).

The server (`server/`) uses only Node.js itself.

## AI tools

Claude Code (Anthropic), a code generation assistant. It wrote the code, tests and documents under the team's direction. The sound effects and the background music are synthesized in the browser by that code (oscillators and filtered noise, Web Audio), not recordings or AI audio files. The game contains no AI-generated images or video, and no AI-generated content uses NASA branding.

## Our own work

The game's design, code, text, 3D spacecraft (built from code, with no model files), launch animation (SVG and CSS), sound effects and music (Web Audio code) were created for this project and are released under the Apache License 2.0. The Moon and Mars surfaces in the 3D view are drawn by code; the Earth is NASA's Blue Marble.
