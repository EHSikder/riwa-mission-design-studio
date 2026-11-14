# The challenge's resources, and what we used

The [Resources tab](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/?tab=resources) of the Space Mission Design Game challenge lists 9 resources: 8 from NASA and 1 from the Canadian Space Agency. On 14 November 2026 we opened every one of them, followed the links inside them (about 80 pages, PDFs and tools in all), and put into the game everything that fits it. This page says what we took from each one and where it lives in the code.

## At a glance

| # | Resource on the Resources tab | Used? | What the game takes from it |
|---|---|---|---|
| 1 | [Design and Develop Science Missions](https://www.nasa.gov/wp-content/uploads/2025/04/250323-design-and-develop-science-mission.pdf) (NASA) | Yes | The four mission segments and "start from the user", NASA's review names, the risk class, the phases and the technology readiness rule |
| 2 | [General Mission Analysis Tool (GMAT)](https://software.nasa.gov/software/GSC-19468-1) (NASA) | Yes | The physics: gravity, size, flattening (J2) and spin of the Earth, Moon and Mars, and the geostationary radius |
| 3 | [Concept Maturity Levels](https://dataverse.jpl.nasa.gov/dataset.xhtml?persistentId=hdl:2014/44299) (JPL) | Yes | The concept-maturity checklist on the review board, JPL's 35% margins and 3 dB link margin, and the "parts arrive heavier" event |
| 4 | [Mission Design Lab](https://etd.gsfc.nasa.gov/capabilities/integrated-design-center/mission-design-lab/) (NASA Goddard) | Yes | Its 16 disciplines and its point-design rule, in the brief and on the review board |
| 5 | [NASA Mission Viz](https://nasa.github.io/mission-viz/) | Yes | The new orbit view on the Mission desk, drawn with the equations of its tutorials |
| 6 | [A Learning Game About Telescopes](https://science.nasa.gov/mission/webb/game-build-it-yourself/) (NASA Webb) | Yes | "Real missions like yours" at the end of the report |
| 7 | [CubeSat 101](https://www3.nasa.gov/sites/default/files/atoms/files/nasa_csli_cubesat_101_508.pdf) (NASA CubeSat Launch Initiative) | Yes, the most | CubeSat mass limits and schedules, the reserve floor, the test levels and the day-in-the-life test, the licences step, the deployment timers, tracking after a rideshare, the burn-wire flaw, CubeSat radio power and data rates |
| 8 | [Visualize a Space Mission Using Virtual Reality](https://www.spaceappschallenge.org/2023/challenges/visualize-a-space-mission-using-virtual-reality/) (Space Apps 2023) | Partly | Its brief (show the concept, the trajectory and the timeline in a web page on free hosting) is what the orbit view, the flight log and our Vercel/Render hosting do. Its own resource links fed rows 2 and 5 |
| 9 | [Digital Games and Activities](https://www.asc-csa.gc.ca/eng/youth-educators/digital-games-and-activities.asp) (CSA) | Read, nothing taken | Its RADARSAT and OSIRIS-REx games ("look at the data, then choose") work the way our telemetry decisions already do. We copied nothing from them |

## What changed in the game, resource by resource

### 1. Design and Develop Science Missions (NASA, 2025)
Webinar slides from NASA's Small Spacecraft Systems Virtual Institute (26 March 2025, 25 slides): how a science mission goes from a need to requirements, design, verification and operations, across four segments.

- **The four segments** (launch, space, ground, user) open the review board, user first, because the slides say to "begin with the end in mind". `src/studio/model/maturity.ts` (`segments`), `src/studio/ui/screens.tsx`
- **"Start from the user"** is the first point in the brief's "How real teams do it". `src/studio/ui/screens.tsx`
- **Review names** from the NASA Systems Engineering Handbook it links to: the flight readiness review before launch, the critical event readiness review before orbit insertion, the post-launch assessment review at the end of commissioning, and the design reviews named on the review board. `src/studio/model/events.ts`, `src/studio/ui/screens.tsx`
- **Risk class** A to D by planned lifetime, from NPR 8705.4B (linked from the slides), shown on the review board. `src/studio/model/maturity.ts` (`riskClass`)
- **Glossary**: NASA's phases from Pre-Phase A to F with their reviews, "design spends about 15% of the money but locks in about 75%", and the technology readiness rule (TRL 6 to start a project, heritage hardware in a new place drops to TRL 5). `src/studio/model/glossary.ts`
- **PUNCH**, one of the slides' example missions, is one of the "real missions like yours". `src/studio/model/realMissions.ts`

Links inside it that we followed:

| Source | Used? |
|---|---|
| [NASA Systems Engineering Handbook](https://www.nasa.gov/wp-content/uploads/2018/09/nasa_systems_engineering_handbook_0.pdf) (SP-2016-6105 Rev 2) | Yes: phases, reviews, TRL, the 15%/75% lesson, "margins are allocated early and used up" |
| [Concept of Operations outline](https://www.nasa.gov/reference/appendix-s-concept-of-operations-annotated-outline/) (Handbook Appendix S) | Read. Nominal and off-nominal scenarios are already how the flight works |
| NPR 7123.1D, Systems Engineering Processes and Requirements | Read: reviews need "adequate margins" (no numbers) |
| NPR 7120.5F, Space Flight Program and Project Management | Partly read. Not used: we could not check its cost-confidence figures in the full text |
| NPR 7120.8A | Not relevant (research and technology programmes) |
| NPR 8705.4B, Risk Classification for NASA Payloads | Yes: the risk class |
| [Systems Engineering Curriculum, introduction](https://ntrs.nasa.gov/citations/20210021839) | Read. Its student activities follow the same loop as the game |
| [Game Changing: SLS and Science Mission Design](https://ntrs.nasa.gov/api/citations/20130013034/downloads/20130013034.pdf) (2013) | Read. Not used |
| [PUNCH](https://science.nasa.gov/mission/punch/) | Yes: a real mission like yours |
| PILOT magnetosphere mission design (Advanced Space) | Read. Not used |
| [BioNutrients](https://www.nasa.gov/general/what-is-bionutrients/) | Read. The slides' worked example; not used |
| NASA Glenn COMPASS lab | Read. A concurrent design team like the ones we cite |
| Stanford AA 118N course page | Could not open (needs a Stanford login) |

### 2. GMAT, the General Mission Analysis Tool (NASA)
NASA's open-source mission design tool (Apache 2.0). It runs on a desktop, so the game cannot run it, but it now uses GMAT's numbers.

- **Constants**: Earth, Moon and Mars gravity (μ), equatorial radius and rotation are GMAT's defaults; J2 comes from the gravity models GMAT loads (Earth JGM-2, Moon LP165P, Mars Mars-50C). Before, we used WGS-84 and NASA fact-sheet values; the numbers barely moved, but they now match the tool engineers use. `src/studio/model/types.ts`
- **Geostationary radius** 42 164.169 km, the target of GMAT's Hohmann-transfer tutorial. `src/studio/model/types.ts`, `orbit.ts`, `access.ts`
- **Drag coefficient** 2.2, GMAT's default spacecraft value, which the game already used. `src/studio/model/analyze.ts`
- Not taken: GMAT's solar flux (it lists both 1358 and 1367 W/m²). We keep the modern 1361 W/m².

Links we followed: GMAT R2025a and [R2018a](https://software.nasa.gov/software/GSC-18094-1) catalog pages, the [SourceForge project](https://sourceforge.net/projects/gmat/) (licence), the GMAT wiki, the GMAT R2015a User Guide (the only one online), GMAT's source files with the default constants and the gravity files (used), the 2007 script Quick Tables (skimmed, not used), and NASA's [Space Mission Design Tools](https://www.nasa.gov/smallsat-institute/space-mission-design-tools) page with 27 tools (read; they are desktop tools, so none is used in the game).

### 3. Concept Maturity Levels (JPL)
Wessen, Borden, Ziemer and Kwok, *Space mission concept development using concept maturity levels* (JPL, 2013), on JPL's Dataverse under CC0.

- **Concept maturity on the review board**: CML 1 "cocktail napkin", 2 "initial feasibility", 3 "trade space" and 4 "point design", each with a checklist. As in the paper, every item is green, yellow or red, and a level counts when 80% of its items are green. Saving and comparing designs in the hangar is what unlocks the trade space, because the paper found that teams who skip it end up with less science. `src/studio/model/maturity.ts`, `src/studio/ui/screens.tsx`
- **JPL's point-design margins** (the paper's CML 4 checklist): 35% mass growth allowance and margin, 35% power, 35% energy, 3 dB link margin (6 dB for short proximity links). They are items of the checklist, and each gauge now says where its range comes from. The power gauge's "just right" band became 10–50% and the mass band 5–40%, so that JPL's 35% sits inside them. `src/studio/model/analyze.ts`, `src/studio/ui/controls.tsx`
- **"Parts arrive heavier"**: a new event while the spacecraft is built. If the mass margin covers the growth, nothing happens; if not, the team lightens the design (two months and money) or loads less propellant. That is why the margin exists. `src/studio/model/events.ts`
- **Glossary**: concept maturity level, trade study, growth allowance.

### 4. Mission Design Lab (NASA Goddard)
Goddard's concurrent design lab: study types from Office Hours to a 6-day Point Design study, and 16 engineering disciplines.

- The brief now says Goddard's lab seats 16 disciplines and our five desks share them. `src/studio/ui/screens.tsx`
- The review board says Goddard only starts a point design (CML 4) once the checklist passes. `src/studio/ui/screens.tsx`

Links we followed: the Integrated Design Center and Instrument Design Lab pages (read), the DOME commercial spacecraft database page (internal to NASA, not used), the Mission Planning Lab page (404).

### 5. NASA Mission Viz
Web-based mission visualisation demos and tutorials from NASA's Marshall center.

- **The orbit view** on the Mission desk shows the orbit to scale, seen from above, with the spacecraft going round it. It is drawn with the equations of Mission Viz's elliptical-orbit tutorial: the planet at one focus of the ellipse, x = a(cos E − e), y = b·sin E, and Kepler's equation solved by Newton's method, so the spacecraft races past the low point and crawls at the high one. It also follows the vision paper's ideas of sped-up time and a trajectory view. Every mission has one: low Earth orbits, GEO, the Moon's orbits and its L2 relay loop, Mars orbits, and the crewed figure of eight around the Moon. `src/studio/ui/OrbitView.tsx`
- The Mission Viz repository has no licence file, so we used its equations and ideas, not its code.

Links we followed: the GitHub repository, the three-part tutorial series and its PDFs, the elliptical orbit design tutorial, the three.js and R orreries (their planet elements and propagator), the 2015 vision paper, the Inner Solar System page, and NASA/TM-20210000030 (skimmed).

### 6. A Learning Game About Telescopes (NASA Webb)
"Build It Yourself: Telescope": pick science goals, wavelengths, instruments and optics, launch, then see the real telescopes your design resembles.

- **Real missions like yours** at the end of the report: the two or three real missions closest to your design (same place, kind of orbit, size, job), with what they did and a link. It knows Landsat 9, Sentinel-2, GhanaSat-1, PUNCH, ANGOSAT-2, the Lunar Reconnaissance Orbiter, CAPSTONE, Queqiao, the Mars Reconnaissance Orbiter, MAVEN, MarCO, Artemis I and II and Apollo 8. `src/studio/model/realMissions.ts`, `src/studio/ui/Report.tsx`
- The game already had what the Webb game does well: choices explained before you pick them, a launch animation, and levels that open up more options.

Links we followed: the game itself, its full transcript PDF, the three "satellite data results" PDFs, Webb for Educators, and the Scope It Out game page.

### 7. CubeSat 101 (NASA CubeSat Launch Initiative, 2017)
NASA's guide for first-time CubeSat teams, from the idea to operations. We used more of it than any other resource.

- **CubeSat mass limits** from the CubeSat Design Specification Rev 14.1 that it links to: 12 kg for a 6U, 24 kg for a 12U. `src/studio/model/catalog.ts`
- **Schedules**: 9 months at the fastest, 18–24 months typically. Cited on the CubeSat platforms and in the schedule gauge. `catalog.ts`, `analyze.ts`
- **Reserve**: at least 10%, even for a CubeSat. The thin-reserve warning, the budget gauge and the maturity checklist use it. `analyze.ts`, `maturity.ts`
- **Ground tests**: vibration as NASA's launch rules for CubeSats ask (two minutes per axis, 3 dB above the launcher's predicted levels: a protoflight test), the thermal-vacuum bake-out (70 °C for at least 3 hours), deployments released by the real timers and burn wires, and the "day in the life" test that CubeSat 101 makes mandatory, after which the software is frozen. "Mission rehearsal" is now called the day-in-the-life test. `src/studio/model/tests.ts`
- **The burn-wire flaw**: on a CubeSat, the vibration test can now find the burn wire that lets an antenna spring open, one of the guide's classic failures. `tests.ts`
- **The licences step**: early in the build the Communications Lead files the radio licence (frequencies coordinated through the ITU; the US FCC wants at least 90 days), the Earth-imaging licence for missions with cameras (NOAA takes about 120 days in the US) and the orbital debris assessment. A satellite that would stay in orbit too long without an engine is refused until it gets a drag sail, which costs two months. `src/studio/model/events.ts`, `simulate.ts`
- **After launch**: a CubeSat is switched off until it leaves its dispenser, keeps everything folded for 30 minutes and stays silent for 45. After a rideshare, tracking data take two days to a week and working out which object is yours can take weeks. `events.ts`
- **CubeSat radios**: data rates from NASA's Small Spacecraft State of the Art report, which we read alongside the guide, and a warning above 5 W, the most CubeSat radios transmit. `catalog.ts`, `analyze.ts`
- **Solar panels and batteries**: the State of the Art figures (panels 40–75 W/kg, batteries 110–250 Wh/kg). Triple-junction panels got heavier (3.0 kg/m²) to land inside that range. `catalog.ts`
- **Propulsion on CubeSats**: the specification allows it only behind three independent safety switches. `analyze.ts`
- **Glossary**: protoflight test, day-in-the-life test, licences, orbital debris assessment.

Links inside it that we followed, and the NASA report we read alongside it:

| Source | Used? |
|---|---|
| [CubeSat Design Specification Rev 14.1](https://www.cubesat.org/s/CDS-REV14_1-2022-02-09.pdf) (Cal Poly, 2022) | Yes: masses, deployment timers, propulsion rule |
| [LSP-REQ-317.01](https://www.nasa.gov/pdf/627972main_LSP-REQ-317_01A.pdf), NASA's launch rules for CubeSats | Yes: vibration and bake-out levels |
| [FCC Public Notice DA 13-445](https://docs.fcc.gov/public/attachments/DA-13-445A1.pdf) (small satellite licensing) | Yes: 90 days |
| [NASA Small Spacecraft State of the Art](https://www.nasa.gov/smallsat-institute/sst-soa/): power and communications chapters | Yes: panels, batteries, radios |
| NASA spectrum policy page | Read. No numbers |
| NASA Debris Assessment Software page | Could not open (redirects) |
| space-track.org, IARU, ITU, NOAA and US law pages | Not opened (login, or no numbers the game needs) |

### 8. Visualize a Space Mission Using Virtual Reality (Space Apps 2023)
A past challenge: show a mission's concept, orbital trajectories and timeline in a web page on free hosting, with beginner to advanced options.

- The orbit view (row 5) and the flight log cover its trajectory and timeline ideas. The game is a web page on free hosting (Vercel and Render), as it asks.
- Its resource links: [NASA Eyes](https://eyes.nasa.gov/) (read; separate apps, not used), the NASA Software Catalog entry for web mission visualisation (read), GMAT 2018 and NASA's Space Mission Design Tools (row 2), Web WorldWind (read; a second 3D engine, not used), the Mission Viz pages (row 5), ESA's pykep orbit plots (the page is gone; its plotting docs are Python only, not used), and two CSA pages about virtual reality (read, not used).

### 9. Digital Games and Activities (Canadian Space Agency)
CSA's games, e-books, quizzes and activities. We read the RADARSAT Constellation Mission game (find dry fields, flood routes and Arctic ice routes), the OSIRIS-REx game (choose a sample site on Bennu by accessibility, safety, sample and science), Tomatosphere, Mission: Astronaut, Exploring Earth, the e-books, quizzes, printables, puzzle and the list of classroom activities (including Lunar Resupply Mission and the Lunar Rover Research Challenge).

- Nothing was copied. Their "look at the data, then choose" pattern is how our telemetry decisions already work. We did not check the terms for reusing CSA code or pictures, so we used none.
- Not opened: Mission: Astronaut's app (needs a sign-up), Tomatosphere (needs a Minecraft Education licence), Objective: Moon (the page would not load without a browser).

## For the project page

> NASA data and resources used: Design and Develop Science Missions (NASA, 2025) and the NASA Systems Engineering Handbook (mission segments, phases, reviews); NASA GMAT (physical constants); JPL's Concept Maturity Levels paper (maturity checklist and point-design margins); NASA Goddard's Mission Design Lab (concurrent design disciplines); NASA Mission Viz (orbit equations for the orbit view); NASA's Webb "Build It Yourself: Telescope" game (real missions like yours); NASA CubeSat 101 with the CubeSat Design Specification, NASA's launch rules for CubeSats (LSP-REQ-317.01), the FCC small satellite notice and NASA's Small Spacecraft State of the Art report (CubeSat limits, tests, licences, radios, power); NPR 8705.4B (risk classes). Also used: Landsat 8 and 9 cloud cover over Angola (NASA and USGS, read through the Microsoft Planetary Computer: 13,482 scenes, 2021 to 2025) for how often a camera sees the ground, month by month; NASA's Blue Marble and Deep Star Maps images, Orion, SLS, Artemis I and II, and other sources listed in REFERENCES.md. Space agency partner resources: the CSA's Digital Games and Activities were reviewed; nothing from them is used.

The full list of every source the game uses, inside and outside the challenge, is in [REFERENCES.md](REFERENCES.md).
