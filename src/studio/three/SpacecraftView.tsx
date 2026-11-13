/**
 * The spacecraft as designed, in 3D (docs/03 §3), against the stars and the mission's planet. A satellite is a
 * box in silver foil with solar wings sized from the array area, the antenna, each instrument as its own shape on
 * the Earth-facing side and the engine on top; inside (x-ray) the battery, the computers and the reaction wheels.
 * A crew ship is a capsule on a service module with four wings, an escape tower and a heat shield. Real sizes in
 * metres, scaled to fit. The part a change touched lights up and the camera flies to it. Drag to turn it.
 */
import { Edges, OrbitControls, Stars } from '@react-three/drei';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { PLATFORMS, PROPULSION } from '../model/catalog';
import type { StudioDesign } from '../model/design';
import { INSTRUMENTS, type Instrument, type InstrumentId } from '../model/instruments';
import type { BodyId } from '../model/types';

type Parts = MutableRefObject<Record<string, THREE.Object3D | null>>;
export interface ViewFocus { part: string; at: number }

function Lighting() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => { scene.environment = null; env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return (
    <>
      <ambientLight intensity={0.2} />
      <hemisphereLight args={['#bcd4ff', '#0f1d3d', 0.45]} />
      {/* the Sun */}
      <directionalLight position={[6, 5, 3]} intensity={2.6} />
      <directionalLight position={[-4, -2, -5]} intensity={0.35} color="#60bee8" />
    </>
  );
}

// ---------------------------------------------------------------------------- the sky
/** A grey, cratered surface for the Moon, or a dusty red one for Mars (drawn once, no download). */
function rockTexture(body: 'moon' | 'mars'): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = body === 'moon' ? '#8d929c' : '#9a4e45';
  g.fillRect(0, 0, 512, 256);
  let seed = body === 'moon' ? 7 : 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 900; k++) {
    const x = rnd() * 512, y = rnd() * 256, r = rnd() ** 3 * 18 + 1;
    const light = rnd() > 0.5;
    g.fillStyle = body === 'moon'
      ? (light ? `rgba(220,224,232,${0.05 + rnd() * 0.12})` : `rgba(40,44,52,${0.06 + rnd() * 0.18})`)
      : (light ? `rgba(220,170,150,${0.05 + rnd() * 0.1})` : `rgba(60,20,18,${0.06 + rnd() * 0.16})`);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  if (body === 'mars') { g.fillStyle = 'rgba(240,240,245,0.85)'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 248, 512, 8); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function EarthGlobe() {
  const map = useLoader(THREE.TextureLoader, `${import.meta.env.BASE_URL}assets/textures/earth_day_4k.jpg`);
  map.colorSpace = THREE.SRGBColorSpace;
  return <meshStandardMaterial map={map} roughness={0.9} metalness={0} />;
}

/** The mission's planet, low in the view and far behind the spacecraft, turning slowly. It moves with the camera. */
function Planet({ body }: { body: BodyId }) {
  const ref = useRef<THREE.Mesh>(null);
  const rig = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  useFrame((_, dt) => {
    if (ref.current && !REDUCED_MOTION) ref.current.rotation.y += dt * 0.01;
    if (rig.current) { rig.current.position.copy(camera.position); rig.current.quaternion.copy(camera.quaternion); }
  });
  const tex = useMemo(() => (body === 'earth' ? null : rockTexture(body)), [body]);
  const r = body === 'earth' ? 46 : body === 'moon' ? 34 : 38;
  return (
    <group ref={rig}>
    <group position={[-r * 0.9, -r * 1.05, -150]}>
      <mesh ref={ref} rotation={[0.3, 0, 0.2]}>
        <sphereGeometry args={[r, 64, 48]} />
        {body === 'earth' ? (
          <Suspense fallback={<meshStandardMaterial color="#175195" />}>
            <EarthGlobe />
          </Suspense>
        ) : (
          <meshStandardMaterial map={tex!} roughness={1} />
        )}
      </mesh>
      {/* a thin glow of air (Earth, Mars) */}
      {body !== 'moon' && (
        <mesh scale={1.03}>
          <sphereGeometry args={[r, 48, 32]} />
          <meshBasicMaterial color={body === 'earth' ? '#60bee8' : '#c98a80'} transparent opacity={0.12} side={THREE.BackSide} />
        </mesh>
      )}
    </group>
    </group>
  );
}

/** A holographic assembly stand under the spacecraft while it is being designed. */
function Stand({ empty }: { empty: boolean }) {
  const ring = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ring.current && !REDUCED_MOTION) ring.current.rotation.y += dt * 0.15; });
  return (
    <group position={[0, -1.35, 0]}>
      <group ref={ring}>
        {[1.25, 1.6, 2.0].map((r, k) => (
          <mesh key={r} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[r - 0.012, r, 96, 1, 0, k === 1 ? Math.PI * 1.6 : Math.PI * 2]} />
            <meshBasicMaterial color="#60bee8" transparent opacity={k === 0 ? 0.55 : 0.25} side={THREE.DoubleSide} />
          </mesh>
        ))}
        {Array.from({ length: 12 }, (_, k) => (
          <mesh key={k} rotation={[-Math.PI / 2, 0, (k / 12) * Math.PI * 2]} position={[0, 0, 0]}>
            <planeGeometry args={[0.012, 4]} />
            <meshBasicMaterial color="#60bee8" transparent opacity={0.08} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.22, 64]} />
        <meshBasicMaterial color="#175195" transparent opacity={0.16} />
      </mesh>
      {empty && (
        // the outline of the spacecraft still to be built
        <mesh position={[0, 1.15, 0]}>
          <boxGeometry args={[1.1, 1.1, 1.1]} />
          <meshBasicMaterial color="#60bee8" wireframe transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------- materials and small parts
let cellCanvas: HTMLCanvasElement | null = null;
/** Blue cells with silver bus bars, repeated `u × v` times over a panel. */
function cellTexture(u: number, v: number): THREE.Texture {
  if (!cellCanvas) {
    cellCanvas = document.createElement('canvas');
    cellCanvas.width = cellCanvas.height = 128;
    const g = cellCanvas.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 128, 128);
    grad.addColorStop(0, '#132a6b');
    grad.addColorStop(1, '#0a1838');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(150, 180, 240, 0.3)';
    g.lineWidth = 1;
    for (let i = 8; i < 128; i += 8) { g.beginPath(); g.moveTo(0, i); g.lineTo(128, i); g.stroke(); }
    g.strokeStyle = '#8796b8';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, 125, 125);
  }
  const t = new THREE.CanvasTexture(cellCanvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, u), Math.max(1, v));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Players who ask their system for less motion get a still model (they can still drag it). */
const REDUCED_MOTION = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Silver multi-layer insulation over the bus. */
const FOIL = { color: '#c9d0da', metalness: 0.85, roughness: 0.28 } as const;
const WHITE = { color: '#e9edf2', metalness: 0.1, roughness: 0.55 } as const;
const DARK = { color: '#1d2027', metalness: 0.4, roughness: 0.5 } as const;
const INSIDE = ['battery', 'computer', 'adcs', 'cabin'];

function Part({ id, name, parts, onHover, children }: { id?: string; name: string; parts?: Parts; onHover: (n: string | null) => void; children: ReactNode }) {
  return (
    <group
      ref={(g) => { if (id && parts) parts.current[id] = g; }}
      onPointerOver={(e) => { e.stopPropagation(); onHover(name); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
    >
      {children}
    </group>
  );
}

/** A parabolic dish of diameter `D`, opening toward +Y. */
function Dish({ D }: { D: number }) {
  const pts = useMemo(() => {
    const f = 0.4 * D;
    const out: THREE.Vector2[] = [];
    for (let k = 0; k <= 16; k++) {
      const r = (k / 16) * (D / 2);
      out.push(new THREE.Vector2(r, (r * r) / (4 * f)));
    }
    return out;
  }, [D]);
  return (
    <group>
      <mesh>
        <latheGeometry args={[pts, 40]} />
        <meshStandardMaterial color={WHITE.color} metalness={0.15} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.4 * D * 0.9, 0]}>
        <coneGeometry args={[D * 0.05, D * 0.12, 12]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
    </group>
  );
}

/** One solar wing of `area` m², hinged at `root`, pointing along `dir` (a unit vector in the XZ plane). */
function Wing({ area, h, root, angle, tracking, flat = false }: { area: number; h: number; root: number; angle: number; tracking: boolean; flat?: boolean }) {
  const ph = Math.min(h * 0.95, 2.4, Math.sqrt(area));
  const len = area / ph;
  const gap = Math.max(0.04, 0.12 * ph);
  const n = Math.max(1, Math.round(len / Math.max(ph, 0.15)));
  const seg = len / n;
  return (
    <group rotation={[0, angle, 0]}>
      <mesh position={[root + gap / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[ph * 0.025, ph * 0.025, gap, 8]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {tracking && (
        <mesh position={[root + gap * 0.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[ph * 0.08, ph * 0.08, gap * 0.5, 16]} />
          <meshStandardMaterial {...WHITE} />
        </mesh>
      )}
      <group rotation={[(flat ? Math.PI / 2 - 0.3 : 0) + (tracking && !flat ? -0.35 : 0), 0, 0]}>
        {Array.from({ length: n }, (_, k) => (
          <mesh key={k} position={[root + gap + (k + 0.5) * seg, 0, 0]}>
            <boxGeometry args={[seg * 0.97, ph, Math.max(0.006, ph * 0.015)]} />
            <meshStandardMaterial map={cellTexture(Math.round(seg / 0.12), Math.round(ph / 0.12))} metalness={0.4} roughness={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

const wingLen = (area: number, h: number) => {
  const ph = Math.min(h * 0.95, 2.4, Math.sqrt(area));
  return Math.max(0.04, 0.12 * ph) + area / ph;
};

function InstrumentShape({ i, id, x, y, w, h, d, index }: { i: Instrument; id: InstrumentId; x: number; y: number; w: number; h: number; d: number; index: number }) {
  const s = Math.cbrt(i.massKg);
  const mat = <meshStandardMaterial color="#175195" metalness={0.35} roughness={0.4} />;
  if (i.kind === 'sar') {
    const L = Math.min(4.5, Math.max(0.5, 0.75 * s)), W = Math.min(0.8, Math.max(0.25, 0.12 * s));
    return <mesh position={[0, y - 0.06, 0]}><boxGeometry args={[L, 0.05, W]} />{mat}</mesh>;
  }
  if (i.kind === 'transponder') {
    const D = i.commsBand === 'Ka' ? 1.6 : 2.2;
    const sideZ = index % 2 ? -1 : 1;
    return <group position={[0, -h * 0.15, sideZ * (d / 2 + 0.25 + D / 2)]} rotation={[sideZ * 2.2, 0, 0]}><Dish D={D} /></group>;
  }
  if (i.kind === 'relay') {
    return <group position={[x, y - 0.12, 0]} rotation={[Math.PI, 0, 0]}><Dish D={i.proxDishM ?? 1} /></group>;
  }
  if (id === 'sharad') {
    return <mesh position={[0, y - 0.04, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, 10, 6]} />{mat}</mesh>;
  }
  if (i.kind === 'receiver') {
    const L = id === 'lfr' ? 5 : 0.5;
    return (
      <group position={[x, y, 0]}>
        {[0, 1, 2].slice(0, id === 'lfr' ? 3 : 1).map((k) => (
          <group key={k} rotation={[0.5 * Math.cos((k * 2 * Math.PI) / 3), 0, 0.5 * Math.sin((k * 2 * Math.PI) / 3)]}>
            <mesh position={[0, -L / 2, 0]}><cylinderGeometry args={[0.008, 0.008, L, 6]} />{mat}</mesh>
          </group>
        ))}
      </group>
    );
  }
  if (i.kind === 'field') {
    const L = Math.min(2, Math.max(0.6, 2 * w));
    return (
      <group>
        <mesh position={[-(w / 2 + L / 2), h * 0.35, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.012, 0.012, L, 6]} /><meshStandardMaterial {...DARK} /></mesh>
        <mesh position={[-(w / 2 + L), h * 0.35, 0]}><boxGeometry args={[0.08, 0.08, 0.08]} />{mat}</mesh>
      </group>
    );
  }
  if (i.kind === 'crew') {
    // a crew experiment: a box on the outside, or (laser) a small dome
    const b = Math.min(0.5, 0.1 + 0.05 * s);
    return id === 'o2o'
      ? <mesh position={[x, y - 0.02, 0]}><sphereGeometry args={[b * 0.6, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#e9edf2" metalness={0.6} roughness={0.2} /></mesh>
      : <mesh position={[x, y - b / 2, 0]}><boxGeometry args={[b, b, b]} />{mat}</mesh>;
  }
  // telescopes and spectrometers: a barrel looking down, with a dark lens
  const r = Math.min(0.45, Math.max(0.03, 0.045 * s));
  const len = 2.2 * r;
  return (
    <group position={[x, y - len / 2, 0]}>
      <mesh><cylinderGeometry args={[r, r * 1.05, len, 24]} />{mat}</mesh>
      <mesh position={[0, -len / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[r * 0.82, 24]} /><meshStandardMaterial color="#07090d" metalness={0.9} roughness={0.08} /></mesh>
    </group>
  );
}

/** The engine: one bell (bipropellant), glowing ion thrusters (electric) or four small nozzles. */
function Engine({ d, w, depth, top, scale = 1 }: { d: StudioDesign; w: number; depth: number; top: number; scale?: number }) {
  const prop = PROPULSION[d.propulsion];
  const nozzle = Math.min(0.45, 0.12 + 0.3 * Math.sqrt(prop.thrustN / 450)) * scale;
  if (d.propulsion === 'biprop') {
    return (
      <mesh position={[0, top + Math.sign(top || 1) * nozzle / 2, 0]} rotation={[top >= 0 ? Math.PI : 0, 0, 0]}>
        <cylinderGeometry args={[nozzle * 0.12, nozzle * 0.42, nozzle, 24, 1, true]} />
        <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>
    );
  }
  if (d.propulsion === 'electric') {
    return <>{[-1, 1].map((s) => (
      <mesh key={s} position={[s * w * 0.2, top + 0.02, 0]}>
        <cylinderGeometry args={[Math.min(0.08, w * 0.15), Math.min(0.08, w * 0.15), 0.04, 24]} />
        <meshStandardMaterial color="#4e8cff" emissive="#3a7bff" emissiveIntensity={1.5} />
      </mesh>
    ))}</>;
  }
  return <>{[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => (
    <mesh key={`${sx}${sz}`} position={[sx * w * 0.4, top + 0.02, sz * depth * 0.4]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[d.propulsion === 'coldGas' ? 0.006 : Math.min(0.025, w * 0.05), d.propulsion === 'coldGas' ? 0.015 : Math.min(0.06, w * 0.12), 12, 1, true]} />
      <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
    </mesh>
  ))}</>;
}

/** What is inside the box: battery packs, computers, reaction wheels. Seen through the x-ray. */
function Insides({ d, w, h, depth, parts, onHover }: { d: StudioDesign; w: number; h: number; depth: number; parts: Parts; onHover: (n: string | null) => void }) {
  const u = Math.min(w, depth, h);
  return (
    <>
      {d.batteryWh > 0 && (
        <Part id="battery" parts={parts} name={`Battery (${Math.round(d.batteryWh)} Wh)`} onHover={onHover}>
          <mesh position={[-w * 0.22, -h * 0.22, 0]}>
            <boxGeometry args={[w * 0.32, h * 0.22, depth * 0.5]} />
            <meshStandardMaterial color="#2a3f6b" metalness={0.3} roughness={0.5} />
          </mesh>
        </Part>
      )}
      {d.computer !== 'none' && (
        <Part id="computer" parts={parts} name={d.redundant ? 'Two computers (one spare)' : 'Onboard computer'} onHover={onHover}>
          {(d.redundant ? [-1, 1] : [0]).map((k) => (
            <mesh key={k} position={[w * 0.2, h * 0.12, k * depth * 0.18]}>
              <boxGeometry args={[w * 0.28, h * 0.08, depth * 0.3]} />
              <meshStandardMaterial color="#175195" emissive="#175195" emissiveIntensity={0.25} />
            </mesh>
          ))}
        </Part>
      )}
      {d.adcs !== 'none' && (
        <Part id="adcs" parts={parts} name={d.adcs === 'magnetorquer' ? 'Magnetorquers' : 'Reaction wheels and star tracker'} onHover={onHover}>
          {d.adcs === 'magnetorquer'
            ? [0, 1, 2].map((k) => (
              <mesh key={k} position={[0, -h * 0.05 + k * 0.001, 0]} rotation={[k === 1 ? Math.PI / 2 : 0, 0, k === 0 ? Math.PI / 2 : 0]}>
                <cylinderGeometry args={[u * 0.025, u * 0.025, u * 0.6, 8]} />
                <meshStandardMaterial color="#9aa3ad" metalness={0.8} roughness={0.3} />
              </mesh>
            ))
            : [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.6, 0.6, 0.6]].map(([x, y, z], k) => (
              <mesh key={k} position={[x * u * 0.14, y * u * 0.14 - h * 0.05, z * u * 0.14]} rotation={[z ? Math.PI / 2 : 0, 0, x ? Math.PI / 2 : 0]}>
                <cylinderGeometry args={[u * 0.09, u * 0.09, u * 0.04, 20]} />
                <meshStandardMaterial color="#60bee8" metalness={0.6} roughness={0.3} />
              </mesh>
            ))}
          {(d.adcs === 'wheels' || d.adcs === 'agile') && (
            <mesh position={[w * 0.3, h / 2 + u * 0.06, -depth * 0.3]}>
              <cylinderGeometry args={[u * 0.05, u * 0.04, u * 0.12, 14]} />
              <meshStandardMaterial {...DARK} />
            </mesh>
          )}
        </Part>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------- the models
function Satellite({ d, parts, xray, onHover }: { d: StudioDesign; parts: Parts; xray: boolean; onHover: (n: string | null) => void }) {
  const p = PLATFORMS[d.platform];
  const [w, depth, h] = p.size;
  const ins = d.instruments.map((id) => ({ id, i: INSTRUMENTS[id] }));
  const wings = d.mount !== 'body' && d.arrayM2 > 0;
  const bottom = -h / 2;
  const slots = ins.filter(({ i }) => ['imager', 'spectrometer', 'relay', 'receiver', 'crew'].includes(i.kind));
  const slotX = (n: number) => (slots.length > 1 ? (n / (slots.length - 1) - 0.5) * w * 0.7 : 0);
  const bodyCells = d.mount === 'body' ? Math.min(h * 0.9, d.arrayM2 / 2 / (w * 0.9)) : 0;
  return (
    <>
      <Part id="body" parts={parts} name={`${p.name}: ${w.toFixed(2)} × ${depth.toFixed(2)} × ${h.toFixed(2)} m`} onHover={onHover}>
        <mesh>
          <boxGeometry args={[w, h, depth]} />
          <meshStandardMaterial {...FOIL} transparent opacity={xray ? 0.16 : 1} depthWrite={!xray} />
          <Edges color="#8fa6c8" threshold={20} />
        </mesh>
      </Part>
      <Insides d={d} w={w} h={h} depth={depth} parts={parts} onHover={onHover} />
      <Part id="arrays" parts={parts} name={`Solar ${d.mount === 'body' ? 'cells on the body' : 'wings'} (${d.arrayM2.toFixed(d.arrayM2 < 1 ? 2 : 1)} m²)`} onHover={onHover}>
        {bodyCells > 0 && [1, -1].map((s) => (
          <mesh key={s} position={[0, 0, s * (depth / 2 + 0.002)]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[w * 0.9, bodyCells]} />
            <meshStandardMaterial map={cellTexture(Math.round((w * 0.9) / 0.08), Math.round(bodyCells / 0.08))} metalness={0.35} roughness={0.35} />
          </mesh>
        ))}
        {wings && [0, Math.PI].map((ang) => <Wing key={ang} area={d.arrayM2 / 2} h={h} root={w / 2} angle={ang} tracking={d.mount === 'tracking'} />)}
      </Part>
      {d.antenna !== 'none' && (
        <Part id="antenna" parts={parts} name={d.antenna === 'dish' ? `${d.band}-band dish, ${d.dishM.toFixed(2)} m` : `${d.band}-band ${d.antenna === 'patch' ? 'patch antenna' : 'shaped-beam antenna'}`} onHover={onHover}>
          {d.antenna === 'dish' ? (
            <>
              <mesh position={[0, h * 0.15, depth / 2 + 0.125 * d.dishM]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.02 * Math.max(1, d.dishM), 0.02 * Math.max(1, d.dishM), 0.25 * d.dishM, 8]} />
                <meshStandardMaterial {...DARK} />
              </mesh>
              <group position={[0, h * 0.15, depth / 2 + 0.25 * d.dishM]} rotation={[Math.PI / 2, 0, 0]}><Dish D={d.dishM} /></group>
            </>
          ) : (
            <mesh position={[w * 0.32, bottom - (d.antenna === 'helix' ? 0.06 : 0.005), depth * 0.32]}>
              {d.antenna === 'helix' ? <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} /> : <boxGeometry args={[Math.min(0.1, w * 0.4), 0.01, Math.min(0.1, depth * 0.4)]} />}
              <meshStandardMaterial {...WHITE} />
            </mesh>
          )}
        </Part>
      )}
      <Part id="payload" parts={parts} name={ins.map(({ i }) => i.short).join(', ') || 'Payload'} onHover={onHover}>
        {ins.map(({ id, i }, n) => (
          <InstrumentShape key={id} id={id} i={i} index={n} x={slotX(slots.findIndex((x) => x.id === id))} y={bottom} w={w} h={h} d={depth} />
        ))}
      </Part>
      {PROPULSION[d.propulsion].isp > 0 && (
        <Part id="engine" parts={parts} name={PROPULSION[d.propulsion].name} onHover={onHover}>
          <Engine d={d} w={w} depth={depth} top={h / 2} />
        </Part>
      )}
    </>
  );
}

/** A crew ship: capsule (cone) on a service module (cylinder) with four wings; an escape tower and a habitat if chosen. */
function CrewShip({ d, parts, xray, onHover }: { d: StudioDesign; parts: Parts; xray: boolean; onHover: (n: string | null) => void }) {
  const p = PLATFORMS[d.platform];
  const [D, , H] = p.size;
  const R = D / 2;
  const hab = (p.crew?.habM3 ?? 0) > 15;
  const smH = H * (hab ? 0.3 : 0.42);
  const cmH = H * (hab ? 0.26 : 0.36);
  const y0 = -H / 2;
  const smTop = y0 + smH;
  const cmTop = smTop + cmH;
  const crew = d.crew;
  const ins = d.instruments.map((id) => ({ id, i: INSTRUMENTS[id] }));
  return (
    <>
      <Part id="body" parts={parts} name={`${p.name}`} onHover={onHover}>
        {/* service module */}
        <mesh position={[0, y0 + smH / 2, 0]}>
          <cylinderGeometry args={[R * 0.92, R * 0.92, smH, 48]} />
          <meshStandardMaterial {...FOIL} transparent opacity={xray ? 0.18 : 1} depthWrite={!xray} />
          <Edges color="#8fa6c8" threshold={30} />
        </mesh>
        {/* crew module, heat shield underneath */}
        <mesh position={[0, smTop + cmH / 2, 0]}>
          <cylinderGeometry args={[R * 0.36, R, cmH, 48]} />
          <meshStandardMaterial color="#d9dee6" metalness={0.25} roughness={0.45} transparent opacity={xray ? 0.2 : 1} depthWrite={!xray} />
          <Edges color="#8fa6c8" threshold={30} />
        </mesh>
        {[0.6, 2.2, 3.8, 5.4].map((a) => (
          <mesh key={a} position={[0, smTop + cmH * 0.56, 0]}>
            {/* four windows: short arcs of dark glass on the cone */}
            <cylinderGeometry args={[R * 0.665, R * 0.705, cmH * 0.09, 12, 1, true, a, 0.32]} />
            <meshStandardMaterial color="#05070c" metalness={0.9} roughness={0.08} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[0, cmTop + R * 0.05, 0]}>
          <cylinderGeometry args={[R * 0.22, R * 0.3, R * 0.1, 32]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
        {hab && (
          <mesh position={[0, cmTop + R * 0.1 + H * 0.17, 0]}>
            <cylinderGeometry args={[R * 0.7, R * 0.7, H * 0.34, 40]} />
            <meshStandardMaterial {...WHITE} transparent opacity={xray ? 0.2 : 1} depthWrite={!xray} />
            <Edges color="#8fa6c8" threshold={30} />
          </mesh>
        )}
      </Part>
      {crew && (
        <Part id="cabin" parts={parts} name={`Cabin: ${crew.size} astronaut${crew.size === 1 ? '' : 's'}`} onHover={onHover}>
          {Array.from({ length: crew.size }, (_, k) => (
            <mesh key={k} position={[Math.cos((k / crew.size) * Math.PI * 2) * R * 0.38, smTop + cmH * 0.32, Math.sin((k / crew.size) * Math.PI * 2) * R * 0.38]}>
              <capsuleGeometry args={[R * 0.07, R * 0.16, 6, 12]} />
              <meshStandardMaterial color="#ffffff" emissive="#60bee8" emissiveIntensity={xray ? 0.5 : 0} />
            </mesh>
          ))}
        </Part>
      )}
      <Part id="shield" parts={parts} name={crew?.shield === 'lunar' ? 'Lunar-return heat shield' : 'Low-orbit heat shield'} onHover={onHover}>
        <mesh position={[0, smTop + 0.02, 0]}>
          <cylinderGeometry args={[R * 1.01, R * 1.01, crew?.shield === 'lunar' ? 0.12 : 0.05, 48]} />
          <meshStandardMaterial color="#3a3836" roughness={0.9} />
        </mesh>
      </Part>
      {crew?.abort === 'tower' && (
        <Part id="escape" parts={parts} name="Launch escape tower" onHover={onHover}>
          <mesh position={[0, cmTop + R * 0.6, 0]}><cylinderGeometry args={[R * 0.06, R * 0.06, R * 1.1, 12]} /><meshStandardMaterial {...WHITE} /></mesh>
          <mesh position={[0, cmTop + R * 1.3, 0]}><coneGeometry args={[R * 0.1, R * 0.35, 16]} /><meshStandardMaterial {...WHITE} /></mesh>
        </Part>
      )}
      {crew?.abort === 'pusher' && (
        <Part id="escape" parts={parts} name="Built-in abort engines" onHover={onHover}>
          {[0, 1, 2, 3].map((k) => (
            <mesh key={k} position={[Math.cos(k * Math.PI / 2) * R * 0.86, smTop + cmH * 0.15, Math.sin(k * Math.PI / 2) * R * 0.86]}>
              <boxGeometry args={[R * 0.1, R * 0.1, R * 0.1]} /><meshStandardMaterial {...DARK} />
            </mesh>
          ))}
        </Part>
      )}
      {d.arrayM2 > 0 && (
        <Part id="arrays" parts={parts} name={`Four solar wings (${d.arrayM2.toFixed(0)} m²)`} onHover={onHover}>
          <group position={[0, y0 + smH * 0.35, 0]}>
            {[1, 3, 5, 7].map((k) => <Wing key={k} area={d.arrayM2 / 4} h={Math.min(smH, R)} root={R * 0.92} angle={(k * Math.PI) / 4} tracking={d.mount === 'tracking'} flat />)}
          </group>
        </Part>
      )}
      {d.antenna === 'dish' && (
        <Part id="antenna" parts={parts} name={`${d.band}-band dish, ${d.dishM.toFixed(2)} m`} onHover={onHover}>
          <group position={[R * 0.92 + d.dishM * 0.4, y0 + smH * 0.75, 0]} rotation={[0, 0, -Math.PI / 2]}><Dish D={d.dishM} /></group>
        </Part>
      )}
      <Part id="payload" parts={parts} name={ins.map(({ i }) => i.short).join(', ') || 'Experiments'} onHover={onHover}>
        {ins.map(({ id }, k) => (
          <mesh key={id} position={[Math.cos(2.4 + k * 0.7) * R * 0.95, y0 + smH * 0.55, Math.sin(2.4 + k * 0.7) * R * 0.95]}>
            <boxGeometry args={[R * 0.14, R * 0.14, R * 0.14]} />
            <meshStandardMaterial color="#175195" metalness={0.35} roughness={0.4} />
          </mesh>
        ))}
      </Part>
      {PROPULSION[d.propulsion].isp > 0 && (
        <Part id="engine" parts={parts} name={PROPULSION[d.propulsion].name} onHover={onHover}>
          <Engine d={d} w={D} depth={D} top={-H / 2} scale={3.2} />
        </Part>
      )}
    </>
  );
}

/** How far the model reaches (m), to fit it in the view. */
function extentOf(d: StudioDesign): number {
  const p = PLATFORMS[d.platform];
  const [w, depth, h] = p.size;
  let e = Math.max(w, h, depth) * 0.75;
  if (p.crew) return Math.max(e, w / 2 + (d.arrayM2 > 0 ? wingLen(d.arrayM2 / 4, Math.min(h * 0.42, w / 2)) : 0), h * 0.7);
  if (d.mount !== 'body' && d.arrayM2 > 0) e = Math.max(e, w / 2 + wingLen(d.arrayM2 / 2, h));
  if (d.antenna === 'dish') e = Math.max(e, depth / 2 + 0.25 * d.dishM + d.dishM / 2);
  for (const id of d.instruments) {
    const i = INSTRUMENTS[id];
    if (i.kind === 'sar') e = Math.max(e, Math.min(4.5, 0.75 * Math.cbrt(i.massKg)) / 2);
    if (i.kind === 'transponder') e = Math.max(e, depth / 2 + 2.6);
    if (i.kind === 'relay') e = Math.max(e, h / 2 + (i.proxDishM ?? 1) * 0.6);
    if (id === 'sharad') e = Math.max(e, 5);
    if (id === 'lfr') e = Math.max(e, h / 2 + 5);
  }
  return e;
}

function Model({ d, parts, xray, onHover }: { d: StudioDesign; parts: Parts; xray: boolean; onHover: (n: string | null) => void }) {
  const ref = useRef<THREE.Group>(null);
  // a bare structure is drawn a little smaller than a finished spacecraft, so it does not fill the view
  const k = (d.arrayM2 > 0 || d.instruments.length ? 1.85 : 1.45) / extentOf(d);
  // a part appears with a small pop
  const key = `${d.platform}`;
  const born = useRef(performance.now());
  useEffect(() => { born.current = performance.now(); }, [key]);
  useFrame(() => {
    if (!ref.current) return;
    const t = Math.min(1, (performance.now() - born.current) / 450);
    const s = k * (0.85 + 0.15 * (1 - (1 - t) ** 3));
    ref.current.scale.setScalar(s);
  });
  if (d.platform === 'none') return null;
  return (
    <group ref={ref} scale={k}>
      {PLATFORMS[d.platform].crew ? <CrewShip d={d} parts={parts} xray={xray} onHover={onHover} /> : <Satellite d={d} parts={parts} xray={xray} onHover={onHover} />}
    </group>
  );
}

const ORIGIN = new THREE.Vector3();
/** Lights up the part a change touched and flies the camera to it, then back. */
function FocusRig({ focus, parts }: { focus: ViewFocus | null; parts: Parts }) {
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsImpl | null;
  const camera = useThree((s) => s.camera);
  const helper = useMemo(() => {
    const h = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color('#60bee8'));
    (h.material as THREE.LineBasicMaterial).transparent = true;
    h.visible = false;
    return h;
  }, []);
  const goal = useRef({ target: new THREE.Vector3(), dist: 6.8, until: 0, back: 0, home: 6.8 });
  useEffect(() => {
    if (!focus || !controls) return;
    const g = parts.current[focus.part];
    if (!g) return;
    g.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(g);
    if (box.isEmpty()) return;
    helper.box.copy(box).expandByScalar(0.05);
    const size = box.getSize(new THREE.Vector3()).length();
    const now = performance.now();
    goal.current = {
      target: box.getCenter(new THREE.Vector3()),
      dist: Math.min(6.8, Math.max(INSIDE.includes(focus.part) ? 3.6 : 2.8, size * 2.6)),
      until: now + 3600, back: now + 5200,
      home: now < goal.current.back ? goal.current.home : camera.position.distanceTo(controls.target),
    };
  }, [focus?.at, focus?.part, controls, camera, helper, parts]);
  useFrame((_, dt) => {
    if (!controls) return;
    const now = performance.now();
    const g = goal.current;
    const active = now < g.until;
    helper.visible = active;
    (helper.material as THREE.LineBasicMaterial).opacity = 0.55 + 0.45 * Math.sin(now / 160);
    if (now < g.back) {
      const k = 1 - Math.exp(-dt * 3.2);
      controls.target.lerp(active ? g.target : ORIGIN, k);
      const dir = camera.position.clone().sub(controls.target).normalize();
      const cur = camera.position.distanceTo(controls.target);
      camera.position.copy(controls.target).addScaledVector(dir, cur + ((active ? g.dist : g.home) - cur) * k);
    }
    controls.autoRotate = !active && !REDUCED_MOTION;
    controls.update();
  });
  return <primitive object={helper} />;
}

/** If the browser cannot run WebGL, the 3D view steps aside and the rest of the game goes on. */
class IfWebGl extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="st-craft-none">This browser cannot show the 3D view (WebGL is off or missing). The rest of the game still works.</div>
      : this.props.children;
  }
}

export function SpacecraftView({ d, body, stand = false, focus = null, children }: { d: StudioDesign; body: BodyId; stand?: boolean; focus?: ViewFocus | null; children?: ReactNode }) {
  const [hover, setHover] = useState<string | null>(null);
  const [xrayOn, setXray] = useState(false);
  const parts = useRef<Record<string, THREE.Object3D | null>>({});
  const [now, setNow] = useState(0);
  // an x-ray for a moment when the change was inside the box
  useEffect(() => {
    if (!focus || !INSIDE.includes(focus.part)) return;
    setNow(focus.at);
    const id = setTimeout(() => setNow(0), 3800);
    return () => clearTimeout(id);
  }, [focus?.at, focus?.part]);
  const xray = xrayOn || now > 0;
  const p = PLATFORMS[d.platform];
  const empty = d.platform === 'none';
  const span = empty ? 0 : p.crew
    ? p.size[0] + (d.arrayM2 > 0 ? 2 * wingLen(d.arrayM2 / 4, Math.min(p.size[2] * 0.42, p.size[0] / 2)) : 0)
    : d.mount !== 'body' && d.arrayM2 > 0 ? p.size[0] + 2 * wingLen(d.arrayM2 / 2, p.size[2]) : p.size[0];
  return (
    <div className="st-craft">
      <IfWebGl>
        <Canvas camera={{ position: [4.2, 2.3, 4.8], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <Lighting />
          <Stars radius={70} depth={40} count={2600} factor={3.2} saturation={0} fade speed={REDUCED_MOTION ? 0 : 0.6} />
          <Planet body={body} />
          {stand && <Stand empty={empty} />}
          <Model d={d} parts={parts} xray={xray} onHover={setHover} />
          <OrbitControls makeDefault enablePan={false} autoRotate={!REDUCED_MOTION} autoRotateSpeed={0.6} minDistance={2.2} maxDistance={12} />
          <FocusRig focus={focus} parts={parts} />
        </Canvas>
      </IfWebGl>
      <div className="st-craft-caption">
        <b>{hover ?? (empty ? 'Empty assembly stand' : d.name)}</b>
        <span>{empty ? 'Open the Spacecraft desk and pick a structure: every other part bolts to it.' : `Body ${p.size[0].toFixed(2)} × ${p.size[1].toFixed(2)} × ${p.size[2].toFixed(2)} m · span ${span.toFixed(1)} m · drag to turn`}</span>
      </div>
      {!empty && (
        <button type="button" className={`st-xray ${xray ? 'on' : ''}`} aria-pressed={xrayOn} onClick={() => setXray(!xrayOn)} title="See the parts inside the body">
          X-ray
        </button>
      )}
      {children}
    </div>
  );
}
