# References

Everything this project uses that we did not create. The hackathon rules require every source to be cited, even free ones, and every licence to be identified. Keep this list current: when you add a data set, add it here.

Every number in the catalogs carries its own source note in the code (`src/studio/model/catalog.ts` and `instruments.ts`). Prices, and many masses and power figures, are our estimates; the game marks them.

## NASA data and resources

| Resource | How the game uses it |
|---|---|
| [Blue Marble Next Generation](https://visibleearth.nasa.gov/collection/1484/blue-marble) (July, `world.topo.bathy.200407`) | The Earth map under every ground track, resized to 4096 × 2048 (`public/assets/textures/earth_day_4k.jpg`) |
| [Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851), NASA Scientific Visualization Studio | The star background, resized to 2048 × 1024 (`public/assets/textures/stars_2k.jpg`) |
| [Mars Reconnaissance Orbiter](https://science.nasa.gov/mission/mars-reconnaissance-orbiter/): HiRISE, CTX, CRISM, Mars Climate Sounder, SHARAD | Resolution, swath, mass and power of the Mars instruments, and the size of the Mars platform |
| [Lunar Reconnaissance Orbiter](https://science.nasa.gov/mission/lro/): LROC narrow-angle camera | The lunar camera |
| [MAVEN](https://science.nasa.gov/mission/maven/): imaging ultraviolet spectrograph, magnetometer (with Mars Global Surveyor) | The Mars atmosphere and magnetic-field instruments, as class references |
| [Small Spacecraft Technology State of the Art](https://www.nasa.gov/smallsat-institute/sst-soa) | Solar cells, batteries, cold-gas thrusters, onboard computers, attitude control |
| [DSN Telecommunications Link Design Handbook (810-005)](https://deepspace.jpl.nasa.gov/dsndocs/810-005/) | The receiving performance of the Deep Space Network's 34 m antennas |
| LOLA reference radius of the Moon | A physical constant (`src/studio/model/types.ts`) |
| [Orion spacecraft](https://www.nasa.gov/humans-in-space/orion-spacecraft/) and the European Service Module | The deep-space capsule: mass, habitable volume (about 9 m³), 4 crew for 21 days, the service module's engine and wings (`src/studio/model/catalog.ts`) |
| [Space Launch System](https://www.nasa.gov/humans-in-space/space-launch-system/) (Block 1) | The crew-rated Moon rocket (more than 27 t toward the Moon) |
| [Artemis II](https://www.nasa.gov/mission/artemis-ii/) (1–10 April 2026) | The crewed mission's free-return trajectory, its length (about 10 days), the high-Earth-orbit checkout and manual piloting demonstration, the optical communications terminal (O2O), and the AVATAR organ-chip experiment |
| [Artemis I](https://www.nasa.gov/mission/artemis-i/) (2022) and its radiation results (Zeitlin et al., *Space radiation measurements during the Artemis I lunar mission*, Nature, 2024) | Cosmic-ray dose per day beyond Earth's magnetic field, and how much the Orion storm shelter cuts a solar storm (`src/studio/model/crew.ts`) |
| NASA Baseline Values and Assumptions Document (BVAD), NASA/TP-2015-218570 | Oxygen, water, food and carbon dioxide per crew member per day |
| NASA Office of Inspector General reports on Artemis costs | The order of magnitude of a crewed launch's cost (estimates) |
| NASA astronaut radiation limit (600 mSv career, NASA-STD-3001) | The scale for the crew's dose |
| [NASA Systems Engineering Handbook](https://www.nasa.gov/reference/systems-engineering-handbook/) and NPR 7120.5: [the project life cycle](https://www.nasa.gov/reference/3-0-nasa-program-project-life-cycle/) | The game's steps (concept, design, review, build and test, operations) and the review board |
| NASA lessons from Kepler (K2), Galileo (high-gain antenna) and InSight (instrument leak found in testing) | The kind of problems in orbit, and why the test campaign matters; the anomaly causes are written by us |
| [Jet Propulsion Laboratory Team X](https://jplteamx.jpl.nasa.gov/) | The concurrent-design desks |

**Add here:** the NASA data you use from the challenge's Resources tab (due 13 November 2026).

## Space agency partner data

| Resource | How the game uses it |
|---|---|
| Angola National Space Programme Management Office (GGPEN): [challenge statement](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) and [partner page](https://www.spaceappschallenge.org/2026/space-agency-partners/) | The Angola missions are inspired by GGPEN's public description of its work. **Add here:** the GGPEN data sets, due 13 November 2026 |
| ESA / INTA: Maspalomas station; Φ-sat-1 (onboard cloud screening); Sentinel-2 class bands | A ground station, the edge processor, and a class reference for an imager |
| SANSA: Hartebeesthoek station | A ground station |
| ISRO: PSLV capacity | A launcher |
| [ESA Concurrent Design Facility](https://www.esa.int/Enabling_Support/Space_Engineering_Technology/CDF) (ESTEC) and the ESA Academy Concurrent Engineering Challenge | The concurrent-design desks and how student teams learn mission design |
| Angola's signature of the Artemis Accords (30 November 2023) | The crewed mission's customer: an Artemis Accords partnership |

## Other public sources

**Books and standards**
- Wertz and Larson, *Space Mission Analysis and Design* (solar cell degradation, array losses, structure fraction, hydrazine performance).
- Vallado, *Fundamentals of Astrodynamics and Applications*, Table 8-4 (exponential atmosphere).
- ITU-R P.618 (the shape of the rain-fade figures, which are our estimates for a tropical climate).
- WGS-84 (Earth's size and shape); standard values for Earth's GM, J2 and rotation rate.
- CubeSat Design Specification, [cubesat.org](https://www.cubesat.org/cubesatinfo) (6U and 12U limits).

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

Claude Code (Anthropic), a code generation assistant. It wrote the code, tests and documents under the team's direction. The sound effects are synthesized in the browser by that code (oscillators and filtered noise, Web Audio), not recordings or AI audio files. The game contains no AI-generated images or video, and no AI-generated content uses NASA branding.

## Our own work

The game's design, code, text, 3D spacecraft (built from code, with no model files), launch animation (SVG and CSS) and sound effects (Web Audio code) were created for this project and are released under the Apache License 2.0. The Moon and Mars surfaces in the 3D view are drawn by code; the Earth is NASA's Blue Marble.
