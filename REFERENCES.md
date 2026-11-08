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

**Add here:** the NASA data you use from the challenge's Resources tab (due 13 November 2026).

## Space agency partner data

| Resource | How the game uses it |
|---|---|
| Angola National Space Programme Management Office (GGPEN): [challenge statement](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/) and [partner page](https://www.spaceappschallenge.org/2026/space-agency-partners/) | The Angola missions are inspired by GGPEN's public description of its work. **Add here:** the GGPEN data sets, due 13 November 2026 |
| ESA / INTA: Maspalomas station; Φ-sat-1 (onboard cloud screening); Sentinel-2 class bands | A ground station, the edge processor, and a class reference for an imager |
| SANSA: Hartebeesthoek station | A ground station |
| ISRO: PSLV capacity | A launcher |

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

Claude Code (Anthropic), a code generation assistant. It wrote the code, tests and documents under the team's direction. The game contains no AI-generated images, video or audio, and no AI-generated content uses NASA branding.

## Our own work

The game's design, code, text and 3D spacecraft (built from code, with no model files) were created for this project and are released under the Apache License 2.0.
