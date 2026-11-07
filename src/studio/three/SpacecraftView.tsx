/**
 * The spacecraft as designed, in 3D (docs/03 §3): the platform's box in gold foil, solar wings sized from the
 * array area (or cells on the body), the antenna, each instrument as its own shape on the Earth-facing side,
 * and the engine on top. Real sizes in metres, scaled to fit the view; drag to turn it, hover for names.
 */
import { OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PLATFORMS, PROPULSION } from '../model/catalog';
import type { StudioDesign } from '../model/design';
import { INSTRUMENTS, type Instrument, type InstrumentId } from '../model/instruments';

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
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#bcd4ff', '#1b3a6b', 0.5]} />
      <directionalLight position={[5, 6, 4]} intensity={2.4} />
    </>
  );
}

let cellCanvas: HTMLCanvasElement | null = null;
/** Blue cells with silver bus bars, repeated `u × v` times over a panel. */
function cellTexture(u: number, v: number): THREE.Texture {
  if (!cellCanvas) {
    cellCanvas = document.createElement('canvas');
    cellCanvas.width = cellCanvas.height = 128;
    const g = cellCanvas.getContext('2d')!;
    g.fillStyle = '#0c1c48';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgba(150, 180, 240, 0.28)';
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

const FOIL = { color: '#d9a62e', metalness: 0.85, roughness: 0.32 } as const;
const WHITE = { color: '#e9edf2', metalness: 0.1, roughness: 0.55 } as const;
const DARK = { color: '#1d2027', metalness: 0.4, roughness: 0.5 } as const;

function Part({ name, onHover, children }: { name: string; onHover: (n: string | null) => void; children: ReactNode }) {
  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); onHover(name); }}
      onPointerOut={(e) => { e.stopPropagation(); onHover(null); }}
    >
      {children}
    </group>
  );
}

/** A parabolic dish of diameter `D`, opening toward +Y. */
function Dish({ D, color = WHITE.color }: { D: number; color?: string }) {
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
        <meshStandardMaterial color={color} metalness={0.15} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.4 * D * 0.9, 0]}>
        <coneGeometry args={[D * 0.05, D * 0.12, 12]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
    </group>
  );
}

function Wing({ side, area, h, w, tracking, onHover }: { side: 1 | -1; area: number; h: number; w: number; tracking: boolean; onHover: (n: string | null) => void }) {
  const ph = Math.min(h * 0.95, 2.4, Math.sqrt(area));
  const len = area / ph;
  const gap = Math.max(0.04, 0.12 * ph);
  const n = Math.max(1, Math.round(len / Math.max(ph, 0.15)));
  const seg = len / n;
  const x0 = side * (w / 2 + gap);
  return (
    <Part name={`Solar wing (${area.toFixed(area < 1 ? 2 : 1)} m²${tracking ? ', sun-tracking' : ''})`} onHover={onHover}>
      <mesh position={[side * (w / 2 + gap / 2), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[ph * 0.025, ph * 0.025, gap, 8]} />
        <meshStandardMaterial {...DARK} />
      </mesh>
      {tracking && (
        <mesh position={[side * (w / 2 + gap * 0.25), 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[ph * 0.08, ph * 0.08, gap * 0.5, 16]} />
          <meshStandardMaterial {...WHITE} />
        </mesh>
      )}
      <group rotation={[tracking ? -0.35 : 0, 0, 0]} position={[0, 0, 0]}>
        {Array.from({ length: n }, (_, k) => (
          <mesh key={k} position={[x0 + side * (k + 0.5) * seg, 0, 0]}>
            <boxGeometry args={[seg * 0.97, ph, Math.max(0.006, ph * 0.015)]} />
            <meshStandardMaterial map={cellTexture(Math.round(seg / 0.12), Math.round(ph / 0.12))} metalness={0.35} roughness={0.35} />
          </mesh>
        ))}
      </group>
    </Part>
  );
}

function InstrumentShape({ i, id, x, y, w, h, d, onHover, index }: { i: Instrument; id: InstrumentId; x: number; y: number; w: number; h: number; d: number; onHover: (n: string | null) => void; index: number }) {
  const s = Math.cbrt(i.massKg);
  const mat = <meshStandardMaterial color={i.color} metalness={0.3} roughness={0.45} />;
  let body: ReactNode;
  if (i.kind === 'sar') {
    const L = Math.min(4.5, Math.max(0.5, 0.75 * s)), W = Math.min(0.8, Math.max(0.25, 0.12 * s));
    body = (
      <mesh position={[0, y - 0.06, 0]}>
        <boxGeometry args={[L, 0.05, W]} />
        {mat}
      </mesh>
    );
  } else if (i.kind === 'transponder') {
    const D = i.commsBand === 'Ka' ? 1.6 : 2.2;
    const sideZ = index % 2 ? -1 : 1;
    body = (
      <group position={[0, -h * 0.15, sideZ * (d / 2 + 0.25 + D / 2)]} rotation={[sideZ * 2.2, 0, 0]}>
        <Dish D={D} color="#f2f4f7" />
      </group>
    );
  } else if (i.kind === 'relay') {
    const D = i.proxDishM ?? 1;
    body = (
      <group position={[x, y - 0.12, 0]} rotation={[Math.PI, 0, 0]}>
        <Dish D={D} color="#f6f1e3" />
      </group>
    );
  } else if (id === 'sharad') {
    body = (
      <mesh position={[0, y - 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.012, 0.012, 10, 6]} />
        {mat}
      </mesh>
    );
  } else if (i.kind === 'receiver') {
    const L = id === 'lfr' ? 5 : 0.5;
    body = (
      <group position={[x, y, 0]}>
        {[0, 1, 2].slice(0, id === 'lfr' ? 3 : 1).map((k) => (
          // each whip hinges at the body and splays outward
          <group key={k} rotation={[0.5 * Math.cos((k * 2 * Math.PI) / 3), 0, 0.5 * Math.sin((k * 2 * Math.PI) / 3)]}>
            <mesh position={[0, -L / 2, 0]}>
              <cylinderGeometry args={[0.008, 0.008, L, 6]} />
              {mat}
            </mesh>
          </group>
        ))}
      </group>
    );
  } else if (i.kind === 'field') {
    const L = Math.min(2, Math.max(0.6, 2 * w));
    body = (
      <group>
        <mesh position={[-(w / 2 + L / 2), h * 0.35, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, L, 6]} />
          <meshStandardMaterial {...DARK} />
        </mesh>
        <mesh position={[-(w / 2 + L), h * 0.35, 0]}>
          <boxGeometry args={[0.08, 0.08, 0.08]} />
          {mat}
        </mesh>
      </group>
    );
  } else {
    // telescopes and spectrometers: a barrel looking down, with a dark lens
    const r = Math.min(0.45, Math.max(0.03, 0.045 * s));
    const len = 2.2 * r;
    body = (
      <group position={[x, y - len / 2, 0]}>
        <mesh>
          <cylinderGeometry args={[r, r * 1.05, len, 24]} />
          {mat}
        </mesh>
        <mesh position={[0, -len / 2 - 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r * 0.82, 24]} />
          <meshStandardMaterial color="#07090d" metalness={0.9} roughness={0.08} />
        </mesh>
      </group>
    );
  }
  return <Part name={i.name} onHover={onHover}>{body}</Part>;
}

function Model({ d, onHover }: { d: StudioDesign; onHover: (n: string | null) => void }) {
  const p = PLATFORMS[d.platform];
  const [w, depth, h] = p.size;
  const ins = d.instruments.map((id) => ({ id, i: INSTRUMENTS[id] }));
  const wings = d.mount !== 'body' && d.arrayM2 > 0;
  const prop = PROPULSION[d.propulsion];
  // fit the whole thing (wings, dishes, booms) into the view
  const extent = useMemo(() => {
    let e = Math.max(w, h, depth) * 0.75;
    if (wings) {
      const A2 = d.arrayM2 / 2;
      const ph = Math.min(h * 0.95, 2.4, Math.sqrt(A2));
      e = Math.max(e, w / 2 + Math.max(0.04, 0.12 * ph) + A2 / ph);
    }
    if (d.antenna === 'dish') e = Math.max(e, depth / 2 + 0.25 * d.dishM + d.dishM / 2);
    for (const { id, i } of ins) {
      if (i.kind === 'sar') e = Math.max(e, Math.min(4.5, 0.75 * Math.cbrt(i.massKg)) / 2);
      if (i.kind === 'transponder') e = Math.max(e, depth / 2 + 2.6);
      if (i.kind === 'relay') e = Math.max(e, h / 2 + (i.proxDishM ?? 1) * 0.6);
      if (id === 'sharad') e = Math.max(e, 5);
      if (id === 'lfr') e = Math.max(e, h / 2 + 5);
    }
    return e;
  }, [w, h, depth, wings, d.arrayM2, d.antenna, d.dishM, ins]);
  const k = 1.9 / extent;
  const bottom = -h / 2;
  const slots = ins.filter(({ i }) => i.kind === 'imager' || i.kind === 'spectrometer' || i.kind === 'relay' || i.kind === 'receiver');
  const slotX = (n: number) => (slots.length > 1 ? (n / (slots.length - 1) - 0.5) * w * 0.7 : 0);
  const bodyCells = d.mount === 'body' ? Math.min(h * 0.9, d.arrayM2 / 2 / (w * 0.9)) : 0;
  const nozzle = Math.min(0.45, 0.12 + 0.3 * Math.sqrt(prop.thrustN / 450));
  return (
    <group scale={k}>
      <Part name={`${p.name}: ${w.toFixed(2)} × ${depth.toFixed(2)} × ${h.toFixed(2)} m`} onHover={onHover}>
        <mesh>
          <boxGeometry args={[w, h, depth]} />
          <meshStandardMaterial {...FOIL} />
        </mesh>
      </Part>
      {bodyCells > 0 && [1, -1].map((s) => (
        <Part key={s} name={`Body-mounted cells (${d.arrayM2.toFixed(2)} m²)`} onHover={onHover}>
          <mesh position={[0, 0, s * (depth / 2 + 0.002)]} rotation={[0, s < 0 ? Math.PI : 0, 0]}>
            <planeGeometry args={[w * 0.9, bodyCells]} />
            <meshStandardMaterial map={cellTexture(Math.round((w * 0.9) / 0.08), Math.round(bodyCells / 0.08))} metalness={0.35} roughness={0.35} />
          </mesh>
        </Part>
      ))}
      {wings && ([1, -1] as const).map((s) => <Wing key={s} side={s} area={d.arrayM2 / 2} h={h} w={w} tracking={d.mount === 'tracking'} onHover={onHover} />)}
      {d.antenna === 'dish' ? (
        <Part name={`${d.band}-band dish, ${d.dishM.toFixed(2)} m`} onHover={onHover}>
          <mesh position={[0, h * 0.15, depth / 2 + 0.125 * d.dishM]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.02 * Math.max(1, d.dishM), 0.02 * Math.max(1, d.dishM), 0.25 * d.dishM, 8]} />
            <meshStandardMaterial {...DARK} />
          </mesh>
          <group position={[0, h * 0.15, depth / 2 + 0.25 * d.dishM]} rotation={[Math.PI / 2, 0, 0]}>
            <Dish D={d.dishM} />
          </group>
        </Part>
      ) : (
        <Part name={`${d.band}-band ${d.antenna === 'patch' ? 'patch antenna' : 'shaped-beam antenna'}`} onHover={onHover}>
          <mesh position={[w * 0.32, bottom - (d.antenna === 'helix' ? 0.06 : 0.005), depth * 0.32]}>
            {d.antenna === 'helix' ? <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} /> : <boxGeometry args={[Math.min(0.1, w * 0.4), 0.01, Math.min(0.1, depth * 0.4)]} />}
            <meshStandardMaterial {...WHITE} />
          </mesh>
        </Part>
      )}
      {ins.map(({ id, i }, n) => (
        <InstrumentShape key={id} id={id} i={i} index={n} x={slotX(slots.findIndex((x) => x.id === id))} y={bottom} w={w} h={h} d={depth} onHover={onHover} />
      ))}
      {prop.isp > 0 && (
        <Part name={prop.name} onHover={onHover}>
          {d.propulsion === 'biprop' ? (
            <mesh position={[0, h / 2 + nozzle / 2, 0]} rotation={[Math.PI, 0, 0]}>
              <cylinderGeometry args={[nozzle * 0.12, nozzle * 0.42, nozzle, 24, 1, true]} />
              <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
            </mesh>
          ) : d.propulsion === 'electric' ? (
            [-1, 1].map((s) => (
              <mesh key={s} position={[s * w * 0.2, h / 2 + 0.02, 0]}>
                <cylinderGeometry args={[Math.min(0.08, w * 0.15), Math.min(0.08, w * 0.15), 0.04, 24]} />
                <meshStandardMaterial color="#4e8cff" emissive="#3a7bff" emissiveIntensity={1.5} />
              </mesh>
            ))
          ) : (
            [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => (
              <mesh key={`${sx}${sz}`} position={[sx * w * 0.4, h / 2 + 0.02, sz * depth * 0.4]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[d.propulsion === 'coldGas' ? 0.006 : Math.min(0.025, w * 0.05), d.propulsion === 'coldGas' ? 0.015 : Math.min(0.06, w * 0.12), 12, 1, true]} />
                <meshStandardMaterial color="#9aa3ad" metalness={0.9} roughness={0.3} side={THREE.DoubleSide} />
              </mesh>
            ))
          )}
        </Part>
      )}
    </group>
  );
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

export function SpacecraftView({ d }: { d: StudioDesign }) {
  const [hover, setHover] = useState<string | null>(null);
  const p = PLATFORMS[d.platform];
  const wingSpan = d.mount !== 'body' ? (() => {
    const A2 = d.arrayM2 / 2;
    const ph = Math.min(p.size[2] * 0.95, 2.4, Math.sqrt(A2));
    return p.size[0] + 2 * (Math.max(0.04, 0.12 * ph) + A2 / ph);
  })() : p.size[0];
  return (
    <div className="st-craft">
      <IfWebGl>
        <Canvas camera={{ position: [4.2, 2.3, 4.8], fov: 38 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <Lighting />
          <Model d={d} onHover={setHover} />
          <OrbitControls enablePan={false} autoRotate={!REDUCED_MOTION} autoRotateSpeed={0.7} minDistance={3} maxDistance={12} />
        </Canvas>
      </IfWebGl>
      <div className="st-craft-caption">
        <b>{hover ?? d.name}</b>
        <span>Body {p.size[0].toFixed(2)} × {p.size[1].toFixed(2)} × {p.size[2].toFixed(2)} m · span {wingSpan.toFixed(1)} m · drag to turn, hover a part</span>
      </div>
    </div>
  );
}
