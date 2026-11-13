# RIWA Space Journey: design

How the game is designed and what is built. Written for teammates and judges who want more than the README.

> **14 November 2026: the rework.** The spacecraft now starts as an empty assembly stand and is built part by part; the team plans a test campaign and runs each test itself; launch day, commissioning (unfold, first signal, the braking burn, first light) and problems in orbit are hands-on steps, the problems shown as telemetry with one hidden cause; a sixth mission flies a crew around the Moon; a Guided level points at every click; team roles are shared out on a who-does-what grid; resources show a sweet spot (too little, just right, more than needed); and the screens were rebuilt (desk rail, folding panels, space backdrop, sound, launch show, saved designs). Sections 3, 6 and 11 describe it; the rest of this document still holds.

## 1. What the challenge asks for (our reading, in our own words)

Sources, all read in full on 2026-11-01:
- the Space Apps challenge page (Details tab);
- the author's 61-second introduction video (YouTube `_hl-36j6C54`, auto-captions);
- the partner page.

The Resources tab says the data sets arrive on **Friday 13 November**, the day before the hackathon.

**Who it is for.** The challenge is rated *Intermediate* and *Beginner/Youth*. The players are students who rarely get to
try a whole mission end to end. The game has to work for someone who knows little about space and still be
honest for someone who knows a lot.

**The core loop it describes:**
1. Pick a mission objective.
2. Set the requirements.
3. Design the spacecraft.
4. Pick the science instruments.
5. Choose the launch vehicle and the orbit.
6. Manage budget, mass, power, communications, data and mission lifetime.
7. Simulate the mission.
8. See how it went, change the design, and simulate again.

**Consequences.**
- Every major decision should visibly push on the rest of the design. A better instrument brings more
  science, but also more mass, power, data and cost.
- There is rarely one right answer. Different mixes of spacecraft, instruments, orbit and launcher should be
  able to reach the same goal.
- The constraints should be realistic: budget, mass, power, communications capacity and lifetime.

**Spacecraft.**
- Components: structure, power, batteries, communications, onboard computer, attitude control and instruments.
- Simpler or more advanced parts, depending on the difficulty.
- Each instrument has its own mass, power, cost, data rate and science value.

**Orbit and launch.**
- Several orbits, each explained plainly: what it means for coverage, chances to observe, communications and lifetime.
- Launchers that differ in capacity, cost and the orbits they reach.
- A check that the spacecraft's mass and the chosen orbit fit the chosen launcher.

**Resources.** A clear display of six resources: mass, power, budget, data, communications, and time (both
development and operating lifetime). The challenge also suggests saying which of them matter most for each mission.

**Team play.**
- Solo, or up to four people on the same mission.
- Roles: mission planning, spacecraft, science, communications and resources.
- Decisions made together, with moments where players must negotiate between competing priorities.
- The result should depend on how well the team coordinates.

**Evaluation.**
- Feedback on how the mission performed.
- Rewards for good engineering, efficient use of resources, collaboration, and meeting the objectives.

**Learning.**
- Plain language throughout.
- Concepts such as orbital altitude, payload capacity, power use, data rate and communications are introduced through play.
- Short explanations, tutorials and visual cues.
- Above all, explain *why* a choice helps or hurts, not only whether it was right.

**Named optional extras:**
- several scenarios and random events;
- difficulty levels;
- simple or realistic models;
- a spacecraft visualization;
- live resource dashboards;
- leaderboards;
- end-of-mission reports;
- save, share and compare;
- co-op for four, and competing teams;
- a sandbox;
- a post-mission analysis.

**From the video:**
- The author is GGPEN, Angola's national space programme office.
- They want a game that teaches the fundamentals of designing, managing and simulating a mission.
- It should use the many data sets they are providing.
- It should be fun and very interactive.

**About the author.** GGPEN operates ANGOSAT-2, hosts the SADC regional satellite programme, has signed the
Artemis Accords, and uses Earth-observation data for Angola's development. Angola-focused scenarios fit the
audience well.

## 2. Decisions

1. **A mission takes minutes and can be repeated.** The challenge asks players to change a design and fly it again,
   so a full loop has to be short.
2. **Team play on one screen or over a network.** Role switching on one screen; on a network, each player joins the
   same room from their own device.
3. **Missions:**
   - a tutorial;
   - Angola Earth observation;
   - ANGOSAT-style geostationary communications;
   - a lunar far-side relay;
   - a Mars science orbiter.

   Sandbox is a difficulty level, so it works with any of them.

## 3. The game loop

| # | Screen | What the team does | Teaches |
|---|---|---|---|
| 1 | Mission select | Pick a scenario (six), a difficulty (Guided, Cadet, Engineer, Expert, Sandbox), and solo / one screen / online, with a who-does-what grid | Mission types |
| 2 | Brief | Read the customer's need; pick a primary objective (plus optional secondaries); set each requirement to *threshold* or *goal* | Objectives drive requirements |
| 3 | Design desks | Build from an empty stand. Mission (objectives, orbit or trajectory, launcher, **test campaign**, schedule) · Spacecraft (structure or capsule, arrays, battery, computer, attitude control, propulsion, escape system, heat shield) · Payload (instruments; crew and life support) · Comms (band, antenna, transmitter, storage, ground stations) · Resources (allocations, reserve, approvals). Each desk opens from a rail; each part is a section that opens with a click and shows whether it is chosen | Each subsystem and its trade-offs; concurrent design (JPL Team X, ESA CDF) |
| 4 | Review and GO/NO-GO poll | Predicted requirement checks, launcher fit, margins; every role calls GO or NO-GO | Design review culture |
| 5 | Build and fly | Build → run each planned test (a flaw it finds: fix or fly) → launch day (weather go/no-go, the launch show) → commissioning (unfold, first signal, braking burn, first light) → operations or the crewed flight, with events and anomalies to diagnose from telemetry | Phase D and E: test as you fly, operations, risk |
| 6 | Report | Score, requirement verification, charts, *why it worked or failed*, three suggestions | Cause and effect |
| 7 | Iterate | Back to the desks with the report beside them; compare runs; save and share | Design is iterative |

A **resource dashboard** with all six resources is always on screen while designing and while simulating. Each
resource shows its value, its limit, its margin, a status that does not rely on colour alone, and a *why?* link.
The dashboard marks the two or three resources that matter most for the chosen mission, as the challenge suggests.

## 4. Scenarios (data-driven)

Each scenario is a data file containing:
- the customer and the brief;
- the objectives, each with its requirements (threshold and goal);
- the target regions and the ground stations;
- the allowed orbits, launchers, platforms and instruments;
- the budget, the deadline and the critical resources.

When GGPEN's data sets arrive on 13 November, they drop into these files: regions, stations, catalogs and
reference missions.

| Scenario | Customer and goal | Key trade-offs |
|---|---|---|
| **Tutorial: First Light** | A 12U CubeSat that photographs Angola | One concept per step; Cadet only |
| **Angola from Above** (EO) | Angola's national space office (inspired by GGPEN): agriculture and drought, floods and disasters, coast and oil spills, land cover, cities | Resolution vs swath vs revisit vs data; SSO vs low-inclination orbit; a ground station in Luanda vs a polar one; optical vs SAR (clouds, night, power) |
| **Connecting Angola** (GEO comms) | ANGOSAT-style broadcast and broadband for Angola and SADC | C vs Ku vs Ka band (throughput vs tropical rain fade); chemical vs electric orbit raising (mass vs months); power for transponders; 15-year lifetime vs station-keeping fuel |
| **Far Side Relay** (lunar) | Link landers on the lunar far side to Earth | L2 halo vs elliptical frozen orbit vs low orbit (coverage vs Δv vs range); antenna size over 450 000 km |
| **Red Planet Orbiter** (science) | Map Mars minerals, climate, subsurface ice | 26-month launch windows (a schedule slip costs two years); propulsive capture vs aerobraking; data return over 0.5–2.5 AU; solar power at 1.5 AU |

## 5. Design decisions and models

The models are simple, but every formula is real. Numbers carry a source note; estimates are flagged. REFERENCES.md lists the sources.

**Orbits:**
- Kepler period.
- Sun-synchronous inclination from J2.
- Eclipse fraction from the beta angle.
- Drag lifetime from an exponential atmosphere and the ballistic coefficient (also the 25-year disposal rule).
- Radiation dose by region.
- Coverage and revisit by sampling the ground track with J2 node drift against a grid of the target region (sunlit passes only for optical).
- Ground-station contacts by elevation mask.
- GEO visibility.
- Lunar and Mars geometry.

**Power:**
- Array area × cell efficiency × solar flux (scaled by 1/r²) × pointing factor × end-of-life degradation.
- Orbit-average load.
- Battery depth of discharge in eclipse, and cycle life.

**Comms:**
- Link budget: transmitter power, antenna gain, free-space loss, station G/T, required Eb/N0, and a band cap.
- The rate is computed at each sample's real range.
- Rain fade by band for the tropics.

**Data:**
- Generated: instrument rate × observing time.
- Delivered: contact minutes × rate.
- Storage between contacts; overflow is data lost.

**Mass:**
- Components, plus structure scaled with the platform, harness, and propellant from the rocket equation over the Δv budget.
- A growth margin by component maturity.
- Checked against the platform limit and the launcher's capacity to the chosen orbit.

**Cost:** hardware, integration and test, launch, ground stations and operations per year of life, and the
management reserve.

**Time:**
- Development time from the slowest component, plus integration and test. Mars windows must be met.
- Lifetime: the smallest of drag decay, propellant, battery cycles, radiation and planned operations.

**Difficulty:**
- *Cadet:* fewer, simpler parts; a coach; no random failures.
- *Engineer:* the full catalog; random events.
- *Expert:* tighter budget, advanced options (cell type, tracking arrays, redundancy, compression, agile pointing), more events.
- *Sandbox* removes all limits.

## 6. Simulation and random events

The run is seeded, and the same seed and design always replay identically. Since 14 November the flight has hands-on **steps** (an action with one button, owned by a role) besides **decisions**; the model is in `model/simulate.ts` and the events in `model/events.ts`.

**Hidden flaws and the test campaign.** Each build hides flaws drawn from the seed through their own sequence (`model/tests.ts`): structure, thermal, deployment, radio compatibility, software, and for a crew the abort system and life support. Each planned test is a step its owner runs; it finds the flaw of its kind (fix it for weeks and money, or fly with it). A flaw nobody tested for, or one waived, shows up after launch: a bracket breaks during ascent, a wing sticks, the ground cannot read the spacecraft, the battery runs hot, the computer keeps restarting, the CO₂ scrubber fades. Guided, Cadet and Sandbox builds hide no flaws.

**Anomalies.** Two or three per flight on Engineer and above, scheduled from the seed. Each shows three or four telemetry channels; one hidden cause explains them all. The matching fix costs a day, a wrong guess costs days and leaves a scar (a tenth of the array, a damaged wheel, a slower link), and "safe mode and investigate" takes a week but always works.

**A crewed flight** counts flight days: checkout in high Earth orbit, a go/no-go for the Moon (judged on the telemetry of the day), the flyby or the burns into and out of lunar orbit, supplies, radiation (cosmic rays every day, a solar storm once), crew anomalies (CO₂, a cabin leak, the toilet) and a splashdown that weather can delay. A heat shield built for low orbit, an escape system that fails or supplies that run out lose the crew, and then nothing else counts.

The older description follows.

**Phases:**
1. Development (schedule slips, test findings).
2. Launch (the launcher's reliability).
3. Commissioning (deployment risks).
4. Operations, in daily steps: imaging, contacts, battery state of charge, storage, degradation and failures.
5. The end of the mission.

**Events:**
- solar storm;
- a reaction wheel failing;
- debris avoidance;
- a ground-station outage;
- an instrument going degraded;
- a launch delay;
- a customer adding an urgent request (for example a flood in Angola).

An event pauses the run and offers two or three options with honest trade-offs. In a team game the roles vote.

## 7. Team play

**Roles:**
- *Mission Director:* objectives, orbit, launcher, schedule.
- *Spacecraft Engineer:* structure, power, battery, computer, attitude control, propulsion.
- *Science Lead:* instruments, observation plan.
- *Communications Lead:* band, antenna, transmitter, storage, ground stations.
- *Resource Manager:* allocations, reserve, approvals.

One player can hold several roles. Solo means one player holds all five.

**Negotiation:**
- The Resource Manager splits mass, power and money among the desks.
- Going over an allocation needs a *change request*, which the other roles approve or reject.
- Each role has a private bonus goal (science value, margins, data delivered, money left), so priorities really compete.
- Launch needs a unanimous GO poll.

**Collaboration score:** requests resolved, a unanimous GO, the quality of event votes, and balanced contributions.

**As built (5D):**
- **Roles:** split by player count. 1 player holds all five. With 2: P1 Director + Resources + Comms, P2 Spacecraft + Science. With 3: P1 Director + Resources, P2 Spacecraft, P3 Science + Comms. With 4: P1 Director + Resources, then one desk each. On a network, roles are taken in the lobby.
- **Desk locks:** a desk is locked to its owner. The shared design is edited only as field patches, so desks never overwrite each other.
- **Allocations:** the Resource Manager splits mass, power and development money among the Spacecraft, Science and Comms desks. A first proposal is the current use plus 10%. Approving a change request raises that desk's allocation.
- **Private goals:**
  - Director: two requirements at goal level, reached.
  - Spacecraft: mass margin ≥ 15%, power margin ≥ 20%.
  - Science: ≥ 90% of the primary objective's value, with two useful instruments.
  - Comms: < 1% data lost, ≥ 3 dB link margin.
  - Resources: ≥ 10% of the budget left.
- **GO poll:** any design change resets the poll. The Director may launch without a unanimous GO, at a teamwork cost.
- **Flight decisions:** voted. The most votes wins; a tie goes to the Director. The Director's screen decides when the last vote arrives.
- **Teamwork, 0–1:**
  - unanimous GO, 0.2;
  - allocations set, 0.1;
  - requests answered, 0.15;
  - every player made at least 3 design changes, 0.2;
  - private goals reached, 0.35.

  It makes up 40 of the 100 decision points.
- **Playing on a network:** one laptop runs `npm run lan` and picks "Host a network room". Teammates on the same Wi-Fi open the link shown in the lobby. The same server can run on a public host. The room server is `server/rooms.mjs`, with no dependencies:
  - `GET /api/room/:code/events` streams the room's operations as Server-Sent Events;
  - `POST /api/room/:code/op` adds an operation;
  - `GET /api/rooms` is the network leaderboard;
  - `GET /api/info` returns the host's LAN addresses.

  Nothing is applied until the room has ordered it, so every screen replays the same log. Same seed plus same votes gives the same mission and the same report on every screen; this was verified with two browsers. Rooms live in memory, so a server restart ends them, and the players are told.

**Multiplayer modes:**
- *Same screen:* switch the active role (hot-seat).
- *Network:* players open the host's link, join a room code and claim roles. The server keeps an ordered log of
  operations; every client applies the same log through the same reducer, so all screens agree.
- *Competitive:* several rooms on one server play the same mission, and a shared leaderboard ranks them.

## 8. Scoring and the report

**Score out of 1000:**
- *Mission success*, 400: requirements met, with goal-level credit, and lifetime reached.
- *Science or service value*, 300: value actually delivered.
- *Efficiency*, 200: money left, healthy margins neither too thin nor wasteful, on schedule.
- *Teamwork and decisions*, 100: in solo play, the event decisions only.

Ranks run from Bronze to Platinum. There is a local leaderboard per scenario and difficulty, plus the network leaderboard.

**The report contains:**
- the summary and score breakdown;
- a requirement verification matrix, each line with a plain-language *why*;
- charts of the run (battery, storage, data delivered, money);
- the event timeline with the team's decisions;
- what worked, what limited the mission and what to try next;
- a comparison with the session's other flights.

It is printable.

**Save, share and compare:** designs are saved in the browser or shared as a link (`#design=…`). "Fly again (same
luck)" replays the same random events, the fair way to test a change.

## 9. Teaching

Every control has a short "what is this?" and a "why it matters here" written for a 14-year-old. Changes post
cause-and-effect notes to a feed, for example: *the SAR added 400 W in imaging; in eclipse the battery now drops
to 38 % (limit 30 %)*.

The tutorial walks through one concept per step. A glossary covers: altitude, period, sun-synchronous orbit,
eclipse, Δv, payload capacity, ground resolution, swath, revisit, data rate, link budget, contact, margin, TRL,
and redundancy.

Accessibility:
- keyboard operable;
- status shown by icon and text, not colour alone;
- scalable text;
- reduced motion.

## 10. Architecture

```
src/studio/model/   pure TypeScript, tested with Vitest: catalogs, missions, regions, orbit, coverage and link
                    models, the consequence engine, the mission run, scoring, team rules, coach and glossary
src/studio/ui/      React: mission select, brief, desks, dashboard, review and poll, flight, report, team, help
src/studio/three/   React Three Fiber: the spacecraft, built from the design
src/studio/net/     the room client (Server-Sent Events plus POST)
server/             the game's own server: the built files and the rooms
```

## 11. Since 14 November: guide, gauges, sound

- **Guided level** (`ui/help.tsx`): the coach's steps (`model/coach.ts`) also name the section of the desk to open; the guide draws a light on the exact button (desk, section, then the suggested card) and marks a choice from the mission's reference design as "Suggested". No AI: the same checks the coach runs.
- **Sweet spots** (`gaugeOf` in `model/analyze.ts`): mass, power, budget, data, comms and time each get a gauge from too little to just right to more than needed, with why each end is a problem.
- **The change you just made** (`state.ts` → `focus`): the part a change touched lights up in 3D and the camera flies to it; parts inside the body show through an x-ray.
- **Sound** (`ui/sound.ts`): Web Audio tones and noise, no files; every button taps, cards bolt on, tests shake and hiss, the launch rumbles, alarms sound for anomalies. One switch mutes it.
- **Team roles**: a who-does-what grid on the setup screen and in the lobby; roles are shared out as players join until someone picks by hand; on one screen, opening a desk or reaching a step hands the controls to its owner. Online rooms can live on Render while the game is served from Vercel (`VITE_ROOMS_URL`, CORS on `/api`).
- **Hangar** (`ui/Hangar.tsx`): saved designs for the mission, open, delete, compare two or three side by side.
