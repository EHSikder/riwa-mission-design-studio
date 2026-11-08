# RIWA Mission Design Studio

A browser game for the NASA Space Apps 2026 challenge [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/). Players design, manage and simulate a complete space mission, alone or as a team of up to four:

1. Choose what the mission is for.
2. Design the spacecraft and pick its instruments.
3. Choose the orbit and the rocket.
4. Keep six resources in balance: mass, power, money, data, communications and time.
5. Fly the mission through years of operations and surprises.
6. Read why it worked or failed.
7. Change the design and fly again.

**Play it:** [add your public link here]

## Run it yourself

Needs Node.js 20.19 or newer and a browser with WebGL2.

```bash
npm install
npm run lan
```

Open http://localhost:5173. The terminal also shows the address teammates on the same Wi-Fi can use.

| Command | What it does |
|---|---|
| `npm run lan` | Builds the game and serves it on your computer, with network rooms |
| `npm run dev` | The same game for working on the code, with live reload |
| `npm run build` | Builds the game into `dist/` (works on any static host) |
| `npm start` | Serves an existing build, with network rooms |
| `npm run check` | Type-checks the code and runs all the tests |

To publish it: `npm run build` makes a static site in `dist/` that works on any host (`.github/workflows/pages.yml` does this for GitHub Pages), but network rooms are off there. A Node.js host runs `npm run build`, then `npm start`, and has everything.

## What is in the game

| Mission | Customer and goal | What it teaches |
|---|---|---|
| **First Light** (tutorial) | A 12U CubeSat that photographs Angola | Payload, pointing, power, batteries, data rate: one idea per step |
| **Angola from Above** | Earth observation for Angola: crops, floods, coast and oil spills, forests, cities | Resolution against swath against revisit; clouds and radar; where to put ground stations |
| **Connecting Angola** | An ANGOSAT-style geostationary communications satellite | Power-hungry transponders, rain fade by band, propellant for 15 years, electric orbit raising |
| **Far Side Relay** | A relay linking landers on the far side of the Moon to Earth | Halo, elliptical and low lunar orbits; distance against data rate; renting deep-space antennas |
| **Red Planet Orbiter** | A Mars science orbiter: minerals, climate, buried ice, landing sites | Launch windows every 26 months, aerobraking, long-distance links, solar power at Mars |

- **Difficulty:** Cadet (a coach, no random failures), Engineer (the real numbers), Expert (a tight budget, advanced options), Sandbox (no limits).
- **Team play:** five roles over one to four players, on one screen or across a network. The Resource Manager splits mass, power and money; going over takes a change request. Each role has a secret goal that pulls against the others. Launch needs a GO from every role, and flight decisions are voted on.
- **Live consequences:** a dashboard of the six resources, and a feed that says what each change did and why.
- **Score and report:** out of 1 000, with every requirement as predicted and as flown, what worked, what limited the mission and what to try next. "Fly again (same luck)" replays the same random events.
- **Save and share:** designs are saved in the browser or shared as a link; there is a local leaderboard and, on a network, a leaderboard of every team.
- **Help:** a tutorial, a coach, a searchable glossary, an explanation on every control, larger text, keyboard operation and reduced motion.

## How it works

The models are simple, but every formula is real: Kepler orbits, the sun-synchronous tilt from J2, eclipses from the beta angle, drag decay, coverage sampled from a real ground track, link budgets with tropical rain fade, the rocket equation, launcher capacity to each destination, and battery wear. Numbers carry their source in the code, and estimates are marked in the game. The design is in [docs/03-mission-design-studio.md](docs/03-mission-design-studio.md).

Built with TypeScript, Vite, React, React Three Fiber (three.js), zustand and Vitest.

```
src/studio/model/   the model: catalogs, missions, regions, orbit, coverage and link models, the consequence
                    engine (analyze.ts), the mission run (simulate.ts), scoring, team rules, coach, glossary
src/studio/ui/      the screens: mission select, desks, dashboard, flight, report, team, help
src/studio/three/   the 3D spacecraft, built from the design
src/studio/net/     the room client
server/             the game's own server: the built files and the rooms for network play (no dependencies)
tests/              model, physics, coverage, simulation, team and server tests
```

### Adding the GGPEN data sets

The challenge's data sets are due on 13 November 2026.

| Data | Where it goes |
|---|---|
| Regions (Angola, coast, cities) | `src/studio/model/regions.ts` |
| Ground stations, launchers, parts | `src/studio/model/catalog.ts` |
| Instruments | `src/studio/model/instruments.ts` |
| Missions, requirements, reference designs | `src/studio/model/scenarios.ts` |

## Licence, sources and AI use

- **Licence:** Apache License 2.0, see [LICENSE](LICENSE).
- **Sources:** every data source and software package is listed in [REFERENCES.md](REFERENCES.md).
- **AI use:** the code, tests and documents were written with Claude Code (Anthropic) under the team's direction; the metadata of `index.html` records this too. The game contains no AI-generated images, video or audio.
- This project is not endorsed by NASA or GGPEN and does not use their insignia.
