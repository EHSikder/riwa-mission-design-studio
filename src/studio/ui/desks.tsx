/**
 * The five desks of the studio, one per role (docs/03 §7). Each edits only its own part of the design and shows
 * the numbers that part drives. Every part is a section that opens with a click and shows, while closed,
 * whether it is chosen yet: the spacecraft starts as an empty assembly stand and the desks read like a checklist.
 * Cadet and Guided hide the advanced options; Expert and Sandbox show them all.
 */
import type { JSX } from 'react';
import {
  ADCS, ANTENNAS, ARRAY_MOUNTS, BANDS, CELLS, COMPUTERS, LAUNCHERS, ORBIT_TYPES, PLATFORMS, PROPULSION, STATIONS, STORAGE_STEPS_GBIT,
  type AdcsId, type AntennaId, type ArrayMountId, type BandId, type CellId, type ComputerId, type LauncherId, type OrbitTypeId,
  type PlatformId, type PropulsionId, type StationId,
} from '../model/catalog';
import type { Analysis } from '../model/analyze';
import { ABORTS, CREW_TRIPS, ECLSS, SHELTERS, SHIELDS, habNeedM3, type AbortId, type CrewChoice, type CrewOrbitId, type EclssId, type ShelterId, type ShieldId, type SuitId } from '../model/crew';
import { DIFFICULTY, type Level, type StudioDesign } from '../model/design';
import { INSTRUMENTS, imagerAt, instrumentRateMbps, type InstrumentId } from '../model/instruments';
import type { Requirement } from '../model/scenarios';
import { TESTS, applicableTests, type TestId } from '../model/tests';
import { ROLES, type RoleId } from '../model/types';
import { Cards, GaugeBar, Info, Lines, Range, Section, Seg, StatusBadge, Toggle, fmt, type SectionState } from './controls';
import { GroundTrack } from './GroundTrack';
import { useSuggest } from './help';
import { AllocationsPanel } from './team';

export interface DeskProps {
  a: Analysis;
  edit: (change: (d: StudioDesign) => void) => void;
}

const cmp = (r: Requirement) => (r.better === 'lower' ? '≤' : '≥');
const ltanLabel = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}${h === 6 || h === 18 ? ' (dawn–dusk)' : ''}`;
const stars = (v: number) => (v >= 0.9 ? '★★★' : v >= 0.6 ? '★★' : v >= 0.3 ? '★' : '');
const chosen = (yes: boolean, fail = false): SectionState => (!yes ? 'todo' : fail ? 'fail' : 'done');
const failsOn = (a: Analysis, re: RegExp) => a.issues.some((i) => i.level === 'fail' && re.test(i.text));
const NO_PLATFORM = <p className="st-empty">Pick the structure first (Spacecraft desk, Platform): it decides how much this part may weigh and how big it can be.</p>;

export function DeskHeader({ role }: { role: RoleId }) {
  return (
    <div className="st-desk-head">
      <span className={`st-role-dot ${role}`} aria-hidden />
      <div>
        <b>{ROLES[role].name}</b>
        <span>{ROLES[role].explain}</span>
      </div>
    </div>
  );
}

/** The sizing that real engineers do first: just enough, plus a margin. */
export const sizeArrays = (a: Analysis) => Math.min(a.power.maxArrayM2, Math.max(0.05, Math.ceil(((a.power.requiredW * 1.15) / Math.max(1e-6, a.power.perM2W * a.power.ageing)) * 20) / 20));
export const sizeBattery = (a: Analysis) => Math.max(10, Math.ceil((a.power.batteryNeedWh * 1.1) / 10) * 10);

// -------------------------------------------------------------------- mission
export function ObjectivesPicker({ a, edit }: DeskProps) {
  const s = a.scenario, d = a.design;
  return (
    <>
      <Cards
        columns={1}
        value={d.primary}
        onPick={(v) => edit((x) => { x.primary = v; x.secondary = x.secondary.filter((o) => o !== v); })}
        options={s.objectives.map((o) => ({ value: o.id, title: o.name, tag: d.primary === o.id ? 'Primary' : undefined, lines: [o.explain] }))}
      />
      {s.maxSecondary > 0 && (
        <>
          <p className="st-sub">Secondary objectives (up to {s.maxSecondary}): extra value if the same spacecraft can also serve them.</p>
          <Cards
            multi
            columns={2}
            value={d.secondary}
            onPick={(v) => edit((x) => {
              x.secondary = x.secondary.includes(v) ? x.secondary.filter((o) => o !== v) : [...x.secondary, v].slice(-s.maxSecondary);
            })}
            options={s.objectives.filter((o) => o.id !== d.primary).map((o) => ({ value: o.id, title: o.name }))}
          />
        </>
      )}
    </>
  );
}

export function MetBadge({ met, level }: { met: 'goal' | 'threshold' | 'fail'; level: Level }) {
  if (met === 'goal') return <StatusBadge status="good" label="Goal met" />;
  if (met === 'threshold') return <StatusBadge status={level === 'goal' ? 'warn' : 'good'} label="Threshold met" />;
  return <StatusBadge status="fail" label="Not met" />;
}

export function RequirementsTable({ a, edit, readOnly, hidePrediction }: DeskProps & { readOnly?: boolean; hidePrediction?: boolean }) {
  return (
    <div className="st-reqs">
      {a.requirements.map((r) => (
        <div key={r.req.id} className={`st-req ${r.met}`}>
          <div className="st-req-head">
            <span>{r.objective ? `${r.objective.name}: ` : ''}{r.req.label}</span>
            <Info text={hidePrediction ? r.req.explain : <>{r.req.explain}<br /><br /><b>Prediction:</b> {r.why}</>} />
          </div>
          <div className="st-req-row">
            {readOnly ? (
              <span className="st-req-target">{r.level === 'goal' ? 'Goal' : 'Threshold'} {cmp(r.req)} {r.level === 'goal' ? r.req.goal : r.req.threshold} {r.req.unit}</span>
            ) : (
              <Seg
                label={r.req.label}
                value={r.level}
                onPick={(v) => edit((x) => { x.levels = { ...x.levels, [r.req.id]: v }; })}
                options={[
                  { value: 'threshold' as Level, label: `Must ${cmp(r.req)} ${r.req.threshold}` },
                  { value: 'goal' as Level, label: `Goal ${cmp(r.req)} ${r.req.goal}` },
                ]}
              />
            )}
            {!hidePrediction && (
              <>
                <span className="st-req-pred">{r.display}</span>
                <MetBadge met={r.met} level={r.level} />
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function OrbitFacts({ a }: { a: Analysis }) {
  const o = a.orbit;
  if (a.crew) {
    return (
      <div className="st-facts">
        <div><span>Whole flight</span><b>{a.crew.days} days</b></div>
        <div><span>At the Moon</span><b>{a.crew.moonDays} day{a.crew.moonDays === 1 ? '' : 's'}</b></div>
        <div><span>Engine burns</span><b>{a.dv.totalMs.toFixed(0)} m/s</b></div>
      </div>
    );
  }
  const period = o.periodMin < 180 ? `${o.periodMin.toFixed(0)} min` : o.periodMin < 2880 ? `${(o.periodMin / 60).toFixed(1)} h` : `${(o.periodMin / 1440).toFixed(1)} days`;
  const far = o.earthRangeM[1];
  return (
    <div className="st-facts">
      <div><span>One orbit</span><b>{period}</b></div>
      <div><span>Tilt</span><b>{o.incDeg.toFixed(1)}°</b></div>
      <div><span>Longest shadow</span><b>{o.eclipseMin > 0 ? `${o.eclipseMin.toFixed(0)} min` : 'none'}</b></div>
      <div><span>Radiation</span><b>{o.radKradPerYear.toFixed(1)} krad/yr</b></div>
      <div><span>Δv to get there and stay</span><b>{a.dv.totalMs.toFixed(0)} m/s</b></div>
      <div><span>{far ? 'Farthest from Earth' : 'Sunlight'}</span><b>{far ? (far > 1e10 ? `${(far / 1.496e11).toFixed(2)} AU` : `${(far / 1e3).toLocaleString('en-US', { maximumFractionDigits: 0 })} km`) : `${(o.sunFactor * 100).toFixed(0)}%`}</b></div>
    </div>
  );
}

/** The ground tests (NASA's Phase D): what each one checks, what it costs, and what flies unnoticed without it. */
function TestCampaign({ a, edit }: DeskProps) {
  const d = a.design;
  const sug = useSuggest();
  const tests = applicableTests(d);
  const ait = a.cost.lines.find((l) => l.name === 'Assembly and integration')?.value ?? 0;
  const hardware = Math.max(0, a.cost.developmentM - a.tests.costM - ait);
  const all = tests.every((t) => d.tests.includes(t));
  return (
    <>
      <p className="st-sub">Nobody can fix a spacecraft once it is in orbit. Each test costs weeks and money, and finds one kind of hidden flaw before launch. A flaw nobody tested for flies with the spacecraft. You run every planned test yourself in the Build phase.</p>
      <Cards
        multi
        columns={1}
        value={d.tests}
        suggest={sug ? tests : undefined}
        onPick={(t: TestId) => edit((x) => { x.tests = x.tests.includes(t) ? x.tests.filter((y) => y !== t) : [...x.tests, t]; })}
        options={tests.map((t) => ({
          value: t,
          title: TESTS[t].name,
          tag: `${TESTS[t].weeks} wk`,
          lines: [TESTS[t].explain, `Catches: ${TESTS[t].catches}`, `${TESTS[t].weeks} week${TESTS[t].weeks === 1 ? '' : 's'} · ${fmt.m(TESTS[t].costShare * hardware)} · run by the ${ROLES[TESTS[t].role].name}`],
        }))}
      />
      {!all && (
        <button type="button" className="st-link" data-suggest={sug ? '1' : undefined} data-sfx="add" onClick={() => edit((x) => { x.tests = [...tests]; })}>
          Plan the full campaign (every test)
        </button>
      )}
      <div className="st-facts two">
        <div><span>Test campaign</span><b>{a.tests.planned.length} of {tests.length} tests</b></div>
        <div><span>Adds</span><b>{a.tests.weeks} weeks · {fmt.m(a.tests.costM)}</b></div>
      </div>
    </>
  );
}

export function MissionDesk({ a, edit }: DeskProps) {
  const s = a.scenario, d = a.design;
  const sug = useSuggest();
  const ot = ORBIT_TYPES[d.orbit.type];
  const met = a.requirements.filter((r) => r.met !== 'fail').length;
  const lv = LAUNCHERS[d.launcher];
  return (
    <>
      <DeskHeader role="director" />
      <Section id="objectives" title="Objectives" state="done" right={s.objectives.find((o) => o.id === d.primary)?.name} info="What the customer pays for. The primary objective decides the requirements; secondary ones add value if the same spacecraft can serve them.">
        <ObjectivesPicker a={a} edit={edit} />
      </Section>
      <Section id="requirements" title="Requirements" state={met === a.requirements.length ? 'done' : 'warn'} right={`${met} of ${a.requirements.length} met`} info={<>For each requirement the customer gives a <b>threshold</b> (the least they accept) and a <b>goal</b> (what they would love). Aiming for the goal scores more if you reach it, and costs you if you do not.</>}>
        <RequirementsTable a={a} edit={edit} />
      </Section>
      <Section id="orbit" title={a.crew ? 'Trajectory' : 'Orbit'} state="done" right={ot.short} info={a.crew ? 'Where the crew goes and how long they stay. Longer at the Moon means more science, but more air, food, water, radiation and propellant.' : 'Where the spacecraft flies decides what it can see, how often, how long it lives, how much power and fuel it needs and how well it can talk home.'}>
        <Cards
          columns={s.orbitTypes.length >= 3 && !a.crew ? 3 : 2}
          value={d.orbit.type}
          suggest={sug?.orbit.type}
          onPick={(v: OrbitTypeId) => edit((x) => {
            x.orbit.type = v;
            const t = ORBIT_TYPES[v];
            if (t.altKm) x.orbit.altKm = Math.min(t.altKm[1], Math.max(t.altKm[0], x.orbit.altKm));
            const trip = CREW_TRIPS[v as CrewOrbitId];
            if (trip) x.plannedYears = trip.days / 365.25;
          })}
          options={s.orbitTypes.map((id) => ({ value: id, title: ORBIT_TYPES[id].name, lines: [ORBIT_TYPES[id].explain] }))}
        />
        <div className="st-goodbad">
          <div><b>Good for</b> {ot.goodFor}</div>
          <div><b>Bad for</b> {ot.badFor}</div>
        </div>
        {ot.altKm && (
          <Range
            label={d.orbit.type === 'marsHigh' ? 'Low point' : 'Altitude'}
            value={d.orbit.altKm}
            min={ot.altKm[0]}
            max={ot.altKm[1]}
            step={5}
            format={(v) => `${v.toFixed(0)} km`}
            onCommit={(v) => edit((x) => { x.orbit.altKm = v; })}
            info="Lower: sharper pictures and stronger radio links, but each pass is shorter, the camera sees a narrower strip and air drag pulls the orbit down sooner."
          />
        )}
        {ot.incDeg && (
          <Range
            label="Tilt (inclination)"
            value={d.orbit.incDeg}
            min={ot.incDeg[0]}
            max={ot.incDeg[1]}
            step={1}
            format={(v) => `${v.toFixed(0)}°`}
            onCommit={(v) => edit((x) => { x.orbit.incDeg = v; })}
            info="The orbit's tilt to the equator: the ground track reaches this latitude north and south. Angola lies between 4° and 18° south, so a tilt of ~20° passes over it far more often than a polar orbit."
          />
        )}
        {ot.ltanH && (
          <div className="st-field">
            <span className="st-field-label">Local time of the orbit <Info text="The local time at which the satellite crosses the equator. Late morning (10:30) gives good light with fewer afternoon clouds. Dawn–dusk orbits (06:00/18:00) ride the day–night line: almost never in shadow, ideal for power-hungry radar." /></span>
            <Seg value={d.orbit.ltanH} label="Local time" options={ot.ltanH.map((h) => ({ value: h, label: ltanLabel(h) }))} onPick={(v) => edit((x) => { x.orbit.ltanH = v; })} />
          </div>
        )}
        {ot.lonDeg && (
          <Range
            label="Slot over the equator"
            value={d.orbit.lonDeg}
            min={ot.lonDeg[0]}
            max={ot.lonDeg[1]}
            step={1}
            format={(v) => `${Math.abs(v).toFixed(0)}° ${v >= 0 ? 'E' : 'W'}`}
            onCommit={(v) => edit((x) => { x.orbit.lonDeg = v; })}
            info="The longitude the satellite hangs above. Close to your customers' longitude puts it high in their sky, above buildings and hills."
          />
        )}
        {d.orbit.type === 'halo' && (
          <div className="st-field">
            <span className="st-field-label">Transfer to the halo <Info text="A fast transfer swings past the Moon and arrives in about 25 days, but needs a bigger braking burn. A low-energy transfer loops far from Earth for ~100 days and needs very little propellant." /></span>
            <Seg value={d.orbit.transfer} label="Transfer" options={[{ value: 'direct', label: 'Fast (≈25 days)' }, { value: 'lowEnergy', label: 'Low-energy (≈100 days)' }]} onPick={(v) => edit((x) => { x.orbit.transfer = v; })} />
          </div>
        )}
        {d.orbit.type === 'marsLow' && (
          <div className="st-field">
            <span className="st-field-label">Getting into orbit <Info text="Braking with the engine takes ~2 km/s of Δv: a tonne of propellant. Aerobraking captures into a long ellipse (~0.9 km/s), then dips through the top of the atmosphere hundreds of times over ~6 months to shrink the orbit." /></span>
            <Seg value={d.orbit.capture} label="Capture" options={[{ value: 'propulsive', label: 'Brake with the engine' }, { value: 'aerobrake', label: 'Aerobrake (+6 months)' }]} onPick={(v) => edit((x) => { x.orbit.capture = v; })} />
          </div>
        )}
        <OrbitFacts a={a} />
      </Section>
      {a.scenario.body === 'earth' && (
        <Section id="map" title={d.orbit.type === 'geo' ? 'Who can see the satellite' : 'One day of ground track'} info={d.orbit.type === 'geo' ? 'The shaded area sees the slot more than 20° above the horizon.' : 'Where the satellite passes in 24 hours, with each instrument\'s swath, your target regions and your ground stations (their circles show where they can hear the satellite).'}>
          <GroundTrack a={a} />
        </Section>
      )}
      <Section id="launcher" title="Launcher" state={chosen(d.launcher !== 'none', d.launcher !== 'none' && !a.launch.ok)} right={d.launcher === 'none' ? 'not chosen' : lv.name} info="Each rocket lifts a different mass to each destination, at a different price and track record. The spacecraft (with its propellant) must fit.">
        <Cards
          columns={2}
          value={d.launcher}
          suggest={sug?.launcher}
          onPick={(v: LauncherId) => edit((x) => { x.launcher = v; })}
          options={a.launch.options.map((o) => {
            const l = LAUNCHERS[o.id];
            return {
              value: o.id,
              title: l.name,
              tag: o.why.length ? '✕' : '✓',
              lines: [l.explain, o.cap ? `Lifts ${fmt.kg(o.cap)} here · ${fmt.m(o.price)}` : 'Cannot reach this orbit', `${(l.reliability * 100).toFixed(0)}% success record${l.crewRated ? ' · certified for crews' : ''}`],
              note: o.why[0],
            };
          })}
        />
      </Section>
      <Section id="tests" title="Test campaign" state={a.tests.planned.length ? (a.tests.skipped.length ? 'warn' : 'done') : 'todo'} right={a.tests.planned.length ? `${a.tests.planned.length} tests · ${a.tests.weeks} weeks` : 'none planned'} info="NASA calls it Phase D: assembly, integration and test. Real teams test as they fly: shake it like the rocket will, bake it in vacuum, unfold every hinge, plug the radio into the real ground station and rehearse the mission.">
        <TestCampaign a={a} edit={edit} />
      </Section>
      {!a.crew && (
        <Section id="length" title="Mission length" state="done" right={`${d.plannedYears.toFixed(1)} years`} info="Years of operations you plan and pay for. The spacecraft must also survive that long: battery wear, radiation, propellant and orbit decay all count down.">
          <Range label="Planned operations" value={d.plannedYears} min={1} max={d.orbit.type === 'geo' ? 20 : 10} step={0.5} format={(v) => `${v.toFixed(1)} years`} onCommit={(v) => edit((x) => { x.plannedYears = v; })} />
        </Section>
      )}
    </>
  );
}

// -------------------------------------------------------------------- spacecraft
export function SpacecraftDesk({ a, edit }: DeskProps) {
  const s = a.scenario, d = a.design;
  const sug = useSuggest();
  const adv = DIFFICULTY[a.difficulty].advanced;
  const simple = a.difficulty === 'cadet' || a.difficulty === 'guided';
  const p = PLATFORMS[d.platform];
  const hasBody = d.platform !== 'none';
  const crew = d.crew;
  const setCrew = (c: Partial<CrewChoice>) => edit((x) => { x.crew = { ...x.crew!, ...c }; });
  return (
    <>
      <DeskHeader role="spacecraft" />
      <Section id="platform" title={crew ? 'Capsule' : 'Platform (structure)'} state={chosen(hasBody)} right={hasBody ? p.short : 'empty stand'} info="The spacecraft's body: how much it can carry, how many instruments fit, how big its wings and dish can be. Everything else bolts to it.">
        <Cards
          columns={2}
          value={d.platform}
          suggest={sug?.platform}
          onPick={(v: PlatformId) => edit((x) => { x.platform = v; })}
          options={s.platforms.map((id) => {
            const q = PLATFORMS[id];
            return { value: id, title: q.name, lines: [q.explain, q.crew ? `${q.crew.seats} seats · ${q.crew.habM3} m³ to live in` : `${q.slots} instrument slots · ${fmt.kg(q.maxPayloadKg)} payload`, `${fmt.m(q.costM)} · ${q.devMonths} months to build`] };
          })}
        />
      </Section>
      <Section id="arrays" title="Solar arrays" state={chosen(d.arrayM2 > 0, a.power.marginPct < 0)} right={d.arrayM2 > 0 ? `${d.arrayM2.toFixed(d.arrayM2 < 1 ? 2 : 1)} m² · ${fmt.w(a.power.eolW)}` : 'none yet'} info="Sunlight → electricity. More area means more power, but more mass, cost and drag. Cells slowly wear out, so size for the end of the mission, plus a modest margin.">
        {!hasBody && NO_PLATFORM}
        <div className="st-field">
          <span className="st-field-label">How they are mounted <Info text={ARRAY_MOUNTS[d.mount].explain} /></span>
          <Seg
            label="Mounting"
            value={d.mount}
            suggest={sug?.mount}
            onPick={(v: ArrayMountId) => edit((x) => { x.mount = v; })}
            options={(['body', 'deployed', 'tracking'] as ArrayMountId[]).filter((m) => !simple || m !== 'tracking' || !!crew).map((m) => ({ value: m, label: ARRAY_MOUNTS[m].name }))}
          />
        </div>
        {adv && (
          <div className="st-field">
            <span className="st-field-label">Solar cells <Info text={CELLS[d.cells].explain} /></span>
            <Seg label="Cells" value={d.cells} onPick={(v: CellId) => edit((x) => { x.cells = v; })} options={(['si', 'gaas3j'] as CellId[]).map((c) => ({ value: c, label: CELLS[c].name }))} />
          </div>
        )}
        {d.arrayM2 <= 0 ? (
          <div className="st-empty-act">
            <p>No arrays yet: the spacecraft needs <b>{fmt.w(a.power.requiredW)}</b> (with recharging the battery).</p>
            <button type="button" className="st-primary" disabled={!hasBody} data-suggest={sug ? '1' : undefined} data-sfx="add" onClick={() => edit((x) => { x.arrayM2 = sizeArrays(a); })}>Add solar arrays, sized for me</button>
          </div>
        ) : (
          <>
            <Range
              label="Array area"
              value={d.arrayM2}
              min={0.05}
              max={Math.max(0.1, a.power.maxArrayM2)}
              log
              step={0.05}
              format={(v) => `${v.toFixed(v < 1 ? 2 : 1)} m²`}
              onCommit={(v) => edit((x) => { x.arrayM2 = v; })}
              extra={
                <button type="button" className="st-link" data-suggest={sug && a.resources.power.gauge?.zone !== 'right' ? '1' : undefined} onClick={() => edit((x) => { x.arrayM2 = sizeArrays(a); })}>
                  Size it for me (just enough + 15%)
                </button>
              }
            />
            {a.resources.power.gauge && <GaugeBar g={a.resources.power.gauge} open />}
            <div className="st-facts two">
              <div><span>In full sun, new</span><b>{fmt.w(a.power.bolW)}</b></div>
              <div><span>Needed (with recharging)</span><b>{fmt.w(a.power.requiredW)}</b></div>
            </div>
          </>
        )}
      </Section>
      <Section id="battery" title="Battery" state={chosen(d.batteryWh > 0, a.power.dod > 1)} right={d.batteryWh > 0 ? `${fmt.wh(d.batteryWh)} · ${(a.power.dod * 100).toFixed(0)}% per shadow` : 'none yet'} info="Carries the spacecraft through every shadow. The deeper each eclipse drains it, the sooner it wears out: thousands of eclipses a year in low orbit.">
        {d.batteryWh <= 0 ? (
          <div className="st-empty-act">
            <p>No battery yet: the first shadow would switch everything off.</p>
            <button type="button" className="st-primary" disabled={!hasBody} data-suggest={sug ? '1' : undefined} data-sfx="add" onClick={() => edit((x) => { x.batteryWh = sizeBattery(a); })}>Add a battery, sized for me</button>
          </div>
        ) : (
          <>
            <Range
              label="Capacity"
              value={d.batteryWh}
              min={10}
              max={30_000}
              log
              step={5}
              format={fmt.wh}
              onCommit={(v) => edit((x) => { x.batteryWh = v; })}
              extra={<button type="button" className="st-link" onClick={() => edit((x) => { x.batteryWh = sizeBattery(a); })}>Size it for me</button>}
            />
            <div className="st-facts two">
              <div><span>Energy used per eclipse</span><b>{fmt.wh(a.power.eclipseWh)}</b></div>
              <div><span>Lasts</span><b>{Number.isFinite(a.power.batteryLifeYears) ? `${a.power.batteryLifeYears.toFixed(1)} years` : 'no eclipses'}</b></div>
            </div>
          </>
        )}
      </Section>
      <Section id="computer" title="Onboard computer" state={chosen(d.computer !== 'none', failsOn(a, /spare/i))} right={d.computer === 'none' ? 'none yet' : `${COMPUTERS[d.computer].name}${d.redundant ? ' + spare' : ''}`} info="Runs everything. Radiation flips bits and slowly kills electronics: the harsher the orbit and the longer the mission, the tougher the computer must be.">
        <Cards
          columns={2}
          value={d.computer}
          suggest={sug?.computer}
          onPick={(v: ComputerId) => edit((x) => { x.computer = v; })}
          options={(Object.keys(COMPUTERS) as ComputerId[]).filter((c) => c !== 'none' && (!simple || c !== 'edge')).map((c) => ({
            value: c, title: COMPUTERS[c].name, lines: [COMPUTERS[c].explain, `${fmt.m(COMPUTERS[c].costM)} · survives ${COMPUTERS[c].toleranceKrad} krad`],
          }))}
        />
        {(adv || crew) && <Toggle label="Carry a spare computer (redundancy)" value={d.redundant} suggest={sug?.redundant} onChange={(v) => edit((x) => { x.redundant = v; })} info="A second computer takes over if the first one fails: more mass and cost, far less risk of losing the mission. A crewed ship must have one." />}
      </Section>
      <Section id="adcs" title="Attitude control (pointing)" state={chosen(d.adcs !== 'none')} right={d.adcs === 'none' ? 'none yet' : ADCS[d.adcs].name} info="Keeps the spacecraft pointed: cameras at the ground, antennas at Earth, wings at the Sun.">
        <Cards
          columns={2}
          value={d.adcs}
          suggest={sug?.adcs}
          onPick={(v: AdcsId) => edit((x) => { x.adcs = v; })}
          options={(Object.keys(ADCS) as AdcsId[]).filter((c) => c !== 'none' && (!simple || c !== 'agile')).map((c) => ({
            value: c, title: ADCS[c].name, lines: [ADCS[c].explain, `points to ±${ADCS[c].accuracyDeg}°${ADCS[c].offNadirDeg ? `, looks ${ADCS[c].offNadirDeg}° sideways` : ''}`],
          }))}
        />
      </Section>
      <Section id="propulsion" title="Propulsion" state={failsOn(a, /no engine|Electric thrusters are far too gentle/i) ? 'fail' : 'done'} right={`${PROPULSION[d.propulsion].name}${a.mass.propellantKg > 0 ? ` · ${fmt.kg(a.mass.propellantKg)}` : ''}`} info="An engine and propellant to reach, hold and finally leave the operating orbit. The rocket equation: every m/s costs a little more propellant than the last.">
        <Cards
          columns={2}
          value={d.propulsion}
          suggest={sug?.propulsion}
          onPick={(v: PropulsionId) => edit((x) => { x.propulsion = v; })}
          options={(Object.keys(PROPULSION) as PropulsionId[]).map((c) => ({
            value: c, title: PROPULSION[c].name, lines: [PROPULSION[c].explain, PROPULSION[c].isp ? `Isp ${PROPULSION[c].isp} s · ${fmt.m(PROPULSION[c].costM)}` : 'no Δv'],
          }))}
        />
        {a.dv.lines.length > 0 && <Lines lines={a.dv.lines} format={(v) => `${v.toFixed(0)} m/s`} total={{ name: 'Total Δv', value: a.dv.totalMs }} />}
        {(adv || crew) && (
          <Range label="Extra propellant" value={d.propellantMarginPct} min={0} max={50} step={1} format={(v) => `+${v.toFixed(0)}%`} onCommit={(v) => edit((x) => { x.propellantMarginPct = v; })} info="Propellant beyond the budget: a margin for surprises, or a longer life. For a crew it is the way home." />
        )}
      </Section>
      {crew && (
        <>
          <Section id="escape" title="Launch escape system" state={crew.abort === 'none' ? 'todo' : 'done'} right={ABORTS[crew.abort].name} info="If the rocket fails, a crew needs a way off it within a second. Every crewed rocket since the 1960s has carried one.">
            <Cards
              columns={1}
              value={crew.abort}
              suggest={sug?.crew?.abort}
              onPick={(v: AbortId) => setCrew({ abort: v })}
              options={(Object.keys(ABORTS) as AbortId[]).map((k) => ({ value: k, title: ABORTS[k].name, lines: [ABORTS[k].explain, k === 'none' ? 'no mass, no cost' : `${ABORTS[k].massKg ? fmt.kg(ABORTS[k].massKg) : 'thrown away on the way up'} · ${fmt.m(ABORTS[k].costM)} · saves the crew ${(ABORTS[k].saves * 100).toFixed(0)}% of the time`] }))}
            />
          </Section>
          <Section id="shield" title="Heat shield" state={crew.shield === 'lunar' ? 'done' : 'todo'} right={SHIELDS[crew.shield].name} info="The return from the Moon hits the air at 11 km/s, 40% faster than from low orbit, and heating grows with about the cube of the speed.">
            <Cards
              columns={1}
              value={crew.shield}
              suggest={sug?.crew?.shield}
              onPick={(v: ShieldId) => setCrew({ shield: v })}
              options={(Object.keys(SHIELDS) as ShieldId[]).map((k) => ({ value: k, title: SHIELDS[k].name, lines: [SHIELDS[k].explain, `${SHIELDS[k].massShare ? `+${(SHIELDS[k].massShare * 100).toFixed(0)}% of the capsule's mass · ` : ''}${fmt.m(SHIELDS[k].costM)} · good to ${SHIELDS[k].maxEntryKms} km/s`] }))}
            />
          </Section>
        </>
      )}
      {hasBody && <p className="st-sub">Structure: {p.name}, up to {fmt.kg(p.maxMassKg)} at launch.</p>}
    </>
  );
}

// -------------------------------------------------------------------- payload
function CrewSystems({ a, edit }: DeskProps) {
  const d = a.design, c = d.crew!, plan = a.crew;
  const sug = useSuggest();
  const seats = PLATFORMS[d.platform].crew?.seats ?? 4;
  const set = (x: Partial<CrewChoice>) => edit((y) => { y.crew = { ...y.crew!, ...x }; });
  const trip = CREW_TRIPS[d.orbit.type as CrewOrbitId];
  return (
    <>
      <div className="st-field">
        <span className="st-field-label">Astronauts <Info text="Each person needs about 7 kg of air, water and food a day, a seat, a suit and room to live." /></span>
        <Seg label="Crew size" value={c.size} suggest={sug?.crew?.size} onPick={(v) => set({ size: v })} options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n}`, disabled: d.platform !== 'none' && n > seats }))} />
      </div>
      <span className="st-field-label">Life support <Info text="Takes away the carbon dioxide the crew breathes out and gives back oxygen, water and a comfortable cabin." /></span>
      <Cards columns={1} value={c.eclss} suggest={sug?.crew?.eclss} onPick={(v: EclssId) => set({ eclss: v })}
        options={(Object.keys(ECLSS) as EclssId[]).map((k) => ({ value: k, title: ECLSS[k].name, lines: [ECLSS[k].explain, `${fmt.kg(ECLSS[k].hardwareKg)} + ${ECLSS[k].kgPerCrewDay} kg per person per day · ${fmt.m(ECLSS[k].costM)} · ${ECLSS[k].devMonths} months`] }))} />
      <Range label="Spare days of air, water and food" value={c.marginDays} min={0} max={10} step={1} format={(v) => `${v.toFixed(0)} days`} onCommit={(v) => set({ marginDays: v })} info="If the splashdown is delayed or something leaks, these are the days the crew lives on." />
      <span className="st-field-label">Storm shelter <Info text="Beyond Earth's magnetic field a solar storm can deliver months of radiation in hours. Mass between the crew and the Sun is the only protection." /></span>
      <Cards columns={1} value={c.shelter} suggest={sug?.crew?.shelter} onPick={(v: ShelterId) => set({ shelter: v })}
        options={(Object.keys(SHELTERS) as ShelterId[]).map((k) => ({ value: k, title: SHELTERS[k].name, lines: [SHELTERS[k].explain, `${fmt.kg(SHELTERS[k].massKg)} · ${fmt.m(SHELTERS[k].costM)} · a big storm gives ${SHELTERS[k].stormMsv} mSv`] }))} />
      <div className="st-field">
        <span className="st-field-label">Suits <Info text="Launch-and-entry suits keep the crew alive if the cabin leaks. Spacewalk suits and an airlock let them go outside, at a high price in mass." /></span>
        <Seg label="Suits" value={c.suits} onPick={(v: SuitId) => set({ suits: v })} options={[{ value: 'iva' as SuitId, label: 'Launch and entry suits' }, { value: 'eva' as SuitId, label: '+ spacewalk suits' }]} />
      </div>
      {plan && trip && (
        <div className="st-facts">
          <div><span>Room each</span><b>{(plan.cabinM3 / Math.max(1, plan.size)).toFixed(1)} / {habNeedM3(trip.days).toFixed(1)} m³</b></div>
          <div><span>Supplies</span><b>{plan.supplyDays} days</b></div>
          <div><span>Planning dose</span><b>{plan.doseMsv.toFixed(0)} mSv</b></div>
        </div>
      )}
    </>
  );
}

export function PayloadDesk({ a, edit }: DeskProps) {
  const s = a.scenario, d = a.design;
  const sug = useSuggest();
  const p = PLATFORMS[d.platform];
  const objectives = [d.primary, ...d.secondary].map((id) => s.objectives.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);
  const alt = a.orbit.imagingAltKm;
  const useful = (id: InstrumentId) => objectives.some((o) => (o.value[id] ?? 0) >= 0.5);
  return (
    <>
      <DeskHeader role="science" />
      {d.platform !== 'none' && (
        <div className="st-meters">
          <span className={d.instruments.length > p.slots ? 'bad' : ''}>Slots {d.instruments.length} / {p.slots}</span>
          <span className={a.mass.payloadKg > p.maxPayloadKg ? 'bad' : ''}>Payload {fmt.kg(a.mass.payloadKg)} / {fmt.kg(p.maxPayloadKg)}</span>
        </div>
      )}
      {d.crew && (
        <Section id="crew" title="Crew and life support" state={a.issues.some((i) => i.level === 'fail' && i.role === 'science' && /astronaut|m³|seat/i.test(i.text)) ? 'fail' : 'done'} right={`${d.crew.size} crew · ${ECLSS[d.crew.eclss].name.toLowerCase()}`} info="With people on board, keeping them alive is the first requirement: air, water, food, room, and protection from radiation.">
          <CrewSystems a={a} edit={edit} />
        </Section>
      )}
      <Section id="instruments" title={d.crew ? 'Experiments and cargo' : 'Instruments'} state={d.instruments.some(useful) ? 'done' : 'todo'} right={d.instruments.length ? d.instruments.map((i) => INSTRUMENTS[i].short).join(', ') : 'none yet'} info="What each one is worth for your objectives (★), and what it costs the rest of the spacecraft: mass, power, money, time to build and data to send home.">
        <Cards
          multi
          columns={1}
          value={d.instruments}
          suggest={sug?.instruments}
          onPick={(id: InstrumentId) => edit((x) => { x.instruments = x.instruments.includes(id) ? x.instruments.filter((i) => i !== id) : [...x.instruments, id]; })}
          options={s.instruments.map((id) => {
            const i = INSTRUMENTS[id];
            const im = imagerAt(i, alt);
            const rate = instrumentRateMbps(i, a.orbit.body, alt);
            const good = objectives.map((o) => (o.value[id] ? `${o.name} ${stars(o.value[id]!)}` : '')).filter(Boolean).join(' · ');
            const what = i.throughputGbps
              ? `${i.throughputGbps} Gbps of capacity, ${i.commsBand}-band`
              : i.proxDishM
                ? `${i.proxDishM} m dish listening to landers on ${i.proxBand}-band`
                : id === 'o2o'
                  ? '80 Mbps on a laser beam, when the sky is clear'
                  : im
                    ? `${im.gsdM < 10 ? im.gsdM.toFixed(1) : im.gsdM.toFixed(0)} m pixels, ${im.swathKm.toFixed(0)} km wide from ${alt.toLocaleString('en-US')} km · ${fmt.mbps(rate)} while imaging`
                    : `${fmt.mbps(rate)} of data while working`;
            return {
              value: id,
              title: i.name,
              tag: `TRL ${i.trl}`,
              lines: [i.explain, what, `${fmt.kg(i.massKg)} · ${fmt.w(i.powerW)} · ${fmt.m(i.costM)} · ${i.devMonths + (i.trl < 7 ? 6 : 0)} months`],
              note: good ? `Useful for ${good}` : objectives.length ? 'Not useful for your objectives' : undefined,
            };
          })}
        />
      </Section>
      {a.data.instruments.some((u) => u.gbitPerDay > 0) && (
        <Section id="data" title="Data each instrument makes" right={`${a.data.generatedGbitDay.toFixed(1)} Gbit/day`} info="Instruments only work over your targets (Earth) or as much as the link can carry home (deep space).">
          <Lines lines={a.data.instruments.map((u) => ({ name: `${u.name} (${(u.duty * 100).toFixed(u.duty < 0.01 ? 2 : 1)}% of the time)`, value: u.gbitPerDay }))} format={(v) => `${v.toFixed(1)} Gbit/day`} />
        </Section>
      )}
    </>
  );
}

// -------------------------------------------------------------------- comms
export function CommsDesk({ a, edit }: DeskProps) {
  const s = a.scenario, d = a.design;
  const sug = useSuggest();
  const p = PLATFORMS[d.platform];
  const deep = s.body !== 'earth';
  const stations = d.stations.map((id) => STATIONS[id].short).join(' + ');
  return (
    <>
      <DeskHeader role="comms" />
      <Section id="band" title="Radio band" state="done" right={`${d.band}-band`} info={BANDS[d.band].explain}>
        <Seg label="Band" value={d.band} suggest={sug?.band} onPick={(v: BandId) => edit((x) => { x.band = v; if (v === 'UHF' && x.antenna === 'dish') x.antenna = 'patch'; })} options={(Object.keys(BANDS) as BandId[]).map((b) => ({ value: b, label: b }))} />
        <p className="st-sub">{BANDS[d.band].name}: up to {fmt.mbps(BANDS[d.band].capMbps)} with the best radios.</p>
      </Section>
      <Section id="antenna" title="Antenna" state={chosen(d.antenna !== 'none')} right={d.antenna === 'none' ? 'none yet' : d.antenna === 'dish' ? `${d.dishM.toFixed(2)} m dish` : ANTENNAS[d.antenna].name} info={ANTENNAS[d.antenna].explain}>
        <Cards
          columns={3}
          value={d.antenna}
          suggest={sug?.antenna}
          onPick={(v: AntennaId) => edit((x) => { x.antenna = v; })}
          options={(Object.keys(ANTENNAS) as AntennaId[]).filter((k) => k !== 'none').map((k) => ({ value: k, title: ANTENNAS[k].name, disabled: k === 'dish' && d.band === 'UHF' }))}
        />
        {d.antenna === 'dish' && (
          <Range label="Dish diameter" value={d.dishM} min={0.2} max={Math.max(0.3, p.maxDishM)} step={0.05} format={(v) => `${v.toFixed(2)} m`} onCommit={(v) => edit((x) => { x.dishM = v; })} info="Twice the diameter, four times the signal, but the beam gets twice as narrow: harder to keep on Earth." />
        )}
        {a.resources.comms.gauge && <GaugeBar g={a.resources.comms.gauge} open />}
      </Section>
      <Section id="tx" title="Transmitter" state="done" right={`${d.txW.toFixed(d.txW < 10 ? 1 : 0)} W`} info="Radio power in watts. Doubling it doubles the data rate (when the link is limited by distance), and doubles the electricity it eats while transmitting.">
        <Range label="Radiated power" value={d.txW} min={0.5} max={200} log step={0.5} format={(v) => `${v.toFixed(v < 10 ? 1 : 0)} W`} onCommit={(v) => edit((x) => { x.txW = v; })} />
      </Section>
      <Section id="storage" title="Onboard storage" state={chosen(d.storageGbit > 0)} right={d.storageGbit > 0 ? (d.storageGbit >= 1024 ? `${d.storageGbit / 1024} Tbit` : `${d.storageGbit} Gbit`) : 'none yet'} info="Holds the data between contacts with the ground. Too little and data is overwritten before it can be sent.">
        <Seg label="Storage" value={d.storageGbit} suggest={sug?.storageGbit} onPick={(v) => edit((x) => { x.storageGbit = v; })} options={STORAGE_STEPS_GBIT.map((g) => ({ value: g as number, label: g >= 1024 ? `${g / 1024} Tbit` : `${g} Gbit` }))} />
        <p className="st-sub">Needed between contacts: {fmt.gbit(a.data.storageNeedGbit)}.</p>
      </Section>
      <Section id="stations" title={deep ? 'Deep-space antennas' : 'Ground stations'} state={chosen(d.stations.length > 0)} right={stations || 'nobody listening'} info={deep ? 'Only giant dishes can hear a spacecraft at the Moon or Mars. You rent their time by the hour.' : 'Each station hears the satellite only while it passes overhead, a few minutes at a time. More stations, more contact time, more yearly fees.'}>
        <Cards
          multi={!deep}
          columns={2}
          value={deep ? (d.stations[0] ?? ('' as StationId)) : d.stations}
          suggest={sug?.stations}
          onPick={(v: StationId) => edit((x) => {
            if (deep) x.stations = [v];
            else x.stations = x.stations.includes(v) ? x.stations.filter((q) => q !== v) : [...x.stations, v];
          })}
          options={s.stations.map((id) => {
            const st = STATIONS[id];
            const ok = st.gt[d.band] !== undefined;
            return {
              value: id,
              title: st.name,
              tag: ok ? undefined : `no ${d.band}`,
              lines: [st.explain, st.costPerHourM ? `${fmt.m(st.costPerHourM * 1000).replace('M', 'k')} per hour` : `${fmt.m(st.costPerYearM ?? 0)} a year`],
            };
          })}
        />
        {deep && (
          <Range label="Antenna time bought" value={d.trackHoursPerDay} min={1} max={24} step={1} format={(v) => `${v.toFixed(0)} h a day`} onCommit={(v) => edit((x) => { x.trackHoursPerDay = v; })} info="Hours a day a ground antenna listens. Each hour costs money; every hour without one, the spacecraft talks to no one." />
        )}
      </Section>
      {d.antenna !== 'none' && d.stations.length > 0 && (
        <div className="st-facts">
          <div><span>Data rate (typical)</span><b>{fmt.mbps(a.comms.rateMbps)}</b></div>
          <div><span>At the farthest</span><b>{fmt.mbps(a.comms.worstMbps)}</b></div>
          <div><span>Contact a day</span><b>{a.comms.contactMinPerDay >= 1440 ? 'always' : `${a.comms.contactMinPerDay.toFixed(0)} min`}</b></div>
          <div><span>Data sent a day</span><b>{fmt.gbit(a.data.capacityGbitDay)}</b></div>
          <div><span>Distance</span><b>{a.comms.rangeKm > 1e6 ? `${(a.comms.rangeKm / 1.496e8).toFixed(2)} AU` : `${a.comms.rangeKm.toLocaleString('en-US', { maximumFractionDigits: 0 })} km`}</b></div>
          <div><span>Signal delay</span><b>{a.comms.lightTimeS > 60 ? `${(a.comms.lightTimeS / 60).toFixed(1)} min` : `${a.comms.lightTimeS.toFixed(2)} s`}</b></div>
        </div>
      )}
    </>
  );
}

// -------------------------------------------------------------------- resources
export function ResourcesDesk({ a, edit }: DeskProps) {
  const d = a.design;
  return (
    <>
      <DeskHeader role="resources" />
      <AllocationsPanel a={a} />
      <Section id="budget" title="The budget" state={a.cost.totalM > a.cost.budgetM ? 'fail' : 'done'} right={`${fmt.m(a.cost.totalM)} of ${Number.isFinite(a.cost.budgetM) ? fmt.m(a.cost.budgetM) : 'unlimited'}`} info="Every dollar of the mission: building it, testing it, launching it and running it. The reserve covers surprises; what is left at the end counts as savings.">
        {a.resources.budget.gauge && <GaugeBar g={a.resources.budget.gauge} open />}
        <Lines lines={a.cost.lines} format={fmt.m} total={{ name: 'Total', value: a.cost.totalM }} />
      </Section>
      <Section id="reserve" title="Reserve and insurance" state={d.reservePct < 10 ? 'warn' : 'done'} right={`${d.reservePct.toFixed(0)}% reserve${d.insurance ? ' · insured' : ''}`} info="Real projects keep 15–30% of the development cost in reserve: parts arrive late, tests find problems. Insurance pays back if the launch or the first year fails.">
        <Range label="Management reserve" value={d.reservePct} min={0} max={40} step={1} format={(v) => `${v.toFixed(0)}% (${fmt.m((v / 100) * a.cost.developmentM)})`} onCommit={(v) => edit((x) => { x.reservePct = v; })} />
        <Toggle label="Insure the launch and first year (8% of value)" value={d.insurance} onChange={(v) => edit((x) => { x.insurance = v; })} />
      </Section>
      <Section id="masslines" title="Mass" right={fmt.kg(a.mass.wetKg)} info="Everything the rocket lifts. Growth allowance is extra weight new designs always gain before they fly.">
        {a.resources.mass.gauge && <GaugeBar g={a.resources.mass.gauge} open />}
        <Lines lines={a.mass.lines} format={fmt.kg} total={{ name: `Total (limit ${fmt.kg(a.mass.limitKg)})`, value: a.mass.wetKg }} />
      </Section>
      <Section id="powerlines" title="Power" right={`${fmt.w(a.power.loadW)} average`} info="What the spacecraft uses on average. Instruments and the transmitter only count for the share of the time they work.">
        <Lines lines={a.power.lines} format={fmt.w} total={{ name: 'Average load', value: a.power.loadW }} />
      </Section>
      {!a.crew && (
        <Section id="lifetime" title="Lifetime" right={`${a.time.lifetimeYears.toFixed(1)} years`} info="Whatever runs out first ends the mission.">
          <Lines lines={a.time.limits} format={(v) => (v > 99 ? '> 99 years' : `${v.toFixed(1)} years`)} />
        </Section>
      )}
    </>
  );
}

export const DESKS: Record<RoleId, (p: DeskProps) => JSX.Element> = {
  director: MissionDesk,
  spacecraft: SpacecraftDesk,
  science: PayloadDesk,
  comms: CommsDesk,
  resources: ResourcesDesk,
};

/** Where each item of the build list is chosen: desk and section. */
export const BUILD_AT: Record<string, [RoleId, string]> = {
  structure: ['spacecraft', 'platform'], power: ['spacecraft', 'arrays'], battery: ['spacecraft', 'battery'], computer: ['spacecraft', 'computer'],
  pointing: ['spacecraft', 'adcs'], engine: ['spacecraft', 'propulsion'], escape: ['spacecraft', 'escape'], shield: ['spacecraft', 'shield'],
  payload: ['science', 'instruments'], radio: ['comms', 'antenna'], station: ['comms', 'stations'], launcher: ['director', 'launcher'], tests: ['director', 'tests'],
};
