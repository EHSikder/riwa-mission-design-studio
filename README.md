# RIWA Space Journey

We're team **Space Underdogs**, and this is our game for the NASA Space Apps 2026 challenge [Space Mission Design Game](https://www.spaceappschallenge.org/2026/challenges/space-mission-design-game/).

In RIWA Space Journey you build and fly a whole space mission, alone or with up to three friends. You start with an empty assembly stand, and nothing is built for you:

1. Pick what the mission is for and how ambitious you want to be.
2. Build the spacecraft part by part: structure, solar arrays, battery, computer, pointing, engine, instruments, radio.
3. Pick the orbit and the rocket.
4. Keep six things in balance: mass, power, money, data, communications and time.
5. Plan your ground tests, then run them yourself before launch.
6. Watch the launch, unfold the spacecraft, find the first signal.
7. Fly through years of operations. Things will break, and you get the telemetry to figure out why.
8. Read the report, see why it went that way, change the design and fly again.

**Play it:** [add your Vercel link here] · [add your Render link here]

## The missions

| Mission | What you build | What you learn |
|---|---|---|
| **First Light** (tutorial) | A small CubeSat that takes pictures of Angola | One idea per step: payload, pointing, power, battery, data |
| **Angola from Above** | An Earth observation satellite for crops, floods, the coast, forests and cities | Sharp pictures vs wide coverage vs how often you pass over, clouds vs radar, where to put ground stations |
| **Connecting Angola** | A geostationary TV and internet satellite, ANGOSAT style | Power hungry transponders, rain fade, fuel for 15 years |
| **Far Side Relay** | A relay so landers on the far side of the Moon can talk to Earth | Lunar orbits, distance vs data rate, renting deep space antennas |
| **Red Planet Orbiter** | A science orbiter for Mars | Launch windows every 26 months, aerobraking, weak sunlight, long links |
| **Crew Around the Moon** | A capsule (call sign *Palanca*, after Angola's giant sable) that takes astronauts around the Moon and back | Life support, radiation, storm shelters, escape systems, heat shields, and getting everyone home |

The crewed mission is built on Artemis II, which flew four people around the Moon in April 2026. With people on board the first requirement isn't science anymore. It's that the crew comes home.

## Five levels

- **Guided:** for people who know nothing about space. A mission guide lights up the exact button to press next and marks a choice that works. It's not AI, it's the same checks the game always runs, pointed at the screen.
- **Cadet:** more money and time, a coach, no random failures.
- **Engineer:** the real numbers, and things go wrong.
- **Expert:** a tight budget, advanced options, more surprises.
- **Sandbox:** no limits, just try stuff.

## Playing as a team

Five roles (Mission Director, Spacecraft Engineer, Science Lead, Communications Lead, Resource Manager) shared between 1 to 4 players. The game shares them out for you, and you can move any role with one click.

- **On one screen:** everyone around one laptop or a TV. Each desk has an owner, and when you open a desk the controls go to its owner. Steps during the flight go to their owner too.
- **Online, each on their own computer:** open the Render link, choose Team online, share the 4 letter room code. Works from anywhere.
- **Same room, no internet:** one laptop runs `npm run lan` and everyone on the same Wi-Fi opens the address it prints.

The Resource Manager splits mass, power and money between the desks, and going over takes a change request. Every role has a secret goal that pulls against the others, so you have to negotiate. Launch needs a GO from every role, and decisions in flight are voted on.

## What makes it feel real

We looked at how real space teams work and built the game around that.

- **Concurrent design.** NASA JPL's Team X and ESA's Concurrent Design Facility put every subsystem engineer in one room, each at their own station, all working on one shared design. That's what the desks are.
- **Phases and reviews.** NASA runs projects in phases (concept, design, build and test, operations) with a review board at each gate. So the game goes Brief, Design, Review, Build and fly, Report.
- **Test as you fly.** Every build hides a few flaws. A vibration test, a thermal vacuum test, a deployment test, a radio test and a mission rehearsal each find one kind. Skip a test and that flaw flies with you, and shows up after launch.
- **Problems come as telemetry.** When something breaks in orbit you don't get told the answer. You get the readings (currents, temperatures, pressures, what each sensor says) and pick a fix. The right one works within a day, a wrong guess costs days, and "safe mode and investigate" is slow but always works. That's how flight controllers actually do it.
- **Sweet spots, not "more is better".** Every resource gauge shows too little, just right and more than needed. More power than you need sounds fine, but it's extra mass, money and drag that could have bought something useful, so the game tells you that too.

Plus: a 3D spacecraft that grows as you build it (with an x-ray to see inside) and flies the camera to whatever you just changed, a launch show with countdown and sound, sound effects everywhere (you can mute them), a hangar to save designs and compare them side by side, share links, a score out of 1000 with a full report, "fly again with the same luck" so you can test one change fairly, a local leaderboard and a network one.

## Run it yourself

You need Node.js 20.19 or newer and a browser with WebGL2.

```bash
npm install
npm run lan
```

Then open http://localhost:5173. The terminal also shows the address your teammates on the same Wi-Fi can use.

| Command | What it does |
|---|---|
| `npm run lan` | Builds the game and serves it on your computer, with network rooms |
| `npm run dev` | The same game for working on the code, with live reload |
| `npm run build` | Builds the game into `dist/` (works on any static host) |
| `npm start` | Serves an existing build, with network rooms |
| `npm run check` | Type checks the code and runs all the tests |

**Publishing:** Vercel (settings in `vercel.json`) serves the built game as plain files. Render (`render.yaml`) runs the game's own small server, so online rooms work there. If you want the Vercel copy to have online rooms too, set `VITE_ROOMS_URL` to your Render link in Vercel's environment variables and redeploy. The Render server allows that.

## How it works

The models are simple but the formulas are real: Kepler orbits, the sun-synchronous tilt from J2, eclipses from the beta angle, drag decay, coverage from a real ground track, link budgets with tropical rain fade, the rocket equation, launcher capacity, battery wear, life support mass per crew-day, radiation dose. Numbers carry their source in the code and our own estimates are marked in the game. The design is in [docs/03-mission-design-studio.md](docs/03-mission-design-studio.md).

Built with TypeScript, Vite, React, React Three Fiber (three.js), zustand and Vitest. Sound effects are made in the browser with Web Audio, so there are no sound files.

```
src/studio/model/   catalogs, missions, orbits, coverage and links, the consequence engine (analyze.ts),
                    the flight (simulate.ts) and its events (events.ts), tests and flaws, crew systems,
                    scoring, team rules, coach, glossary
src/studio/ui/      the screens: missions, desks, dashboard, flight, launch show, report, team, help, sound
src/studio/three/   the 3D spacecraft, built from the design
src/studio/net/     the room client
server/             the game's own server: the built files and the rooms for network play (no dependencies)
tests/              model, physics, coverage, build, flight, crew, team and server tests
```

### Adding the GGPEN data sets

| Data | Where it goes |
|---|---|
| Regions (Angola, coast, cities) | `src/studio/model/regions.ts` |
| Ground stations, launchers, parts | `src/studio/model/catalog.ts` |
| Instruments | `src/studio/model/instruments.ts` |
| Missions, requirements, reference designs | `src/studio/model/scenarios.ts` |

## Licence, sources and AI use

- **Licence:** Apache License 2.0, see [LICENSE](LICENSE).
- **Sources:** every data source and software package is in [REFERENCES.md](REFERENCES.md).
- **AI use:** the code, tests and documents were written with Claude Code (Anthropic) while we directed it, and the metadata of `index.html` says so too. The sound effects are generated by that code in your browser (tones and noise), they aren't recordings or AI audio. The game has no AI-generated images or video.
- This project isn't endorsed by NASA or GGPEN and doesn't use their insignia.
