/**
 * The sky behind the whole game: three layers of stars drifting at different speeds (near ones faster), a slow
 * twinkle, two faint nebulae in the design system's blues, and now and then a shooting star. Drawn on one
 * canvas at about 30 frames a second, paused when the tab is hidden, and still for players who ask for less
 * motion.
 */
import { useEffect, useRef } from 'react';

interface Star { x: number; y: number; r: number; a: number; tw: number; layer: number }

export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, dpr = 1;
    let stars: Star[] = [];
    let shoot: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = c.clientWidth; h = c.clientHeight;
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round((w * h) / 2600);
      stars = Array.from({ length: n }, () => {
        const layer = Math.random() < 0.7 ? 0 : Math.random() < 0.75 ? 1 : 2;
        return { x: Math.random() * w, y: Math.random() * h, r: [0.5, 0.9, 1.4][layer] * (0.7 + Math.random() * 0.6), a: 0.35 + Math.random() * 0.6, tw: Math.random() * Math.PI * 2, layer };
      });
    };
    const nebula = (x: number, y: number, r: number, color: string) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(10,15,38,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, 2 * r, 2 * r);
    };
    let last = performance.now();
    let raf = 0;
    let alive = true;
    const draw = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, w, h);
      nebula(w * 0.82, h * 0.12, Math.max(w, h) * 0.45, 'rgba(55,146,194,0.16)');
      nebula(w * 0.12, h * 0.88, Math.max(w, h) * 0.4, 'rgba(23,81,149,0.2)');
      for (const s of stars) {
        if (!still) {
          s.x -= [1.2, 3, 7][s.layer] * dt;
          if (s.x < -2) { s.x = w + 2; s.y = Math.random() * h; }
          s.tw += dt * (0.8 + s.layer);
        }
        const a = s.a * (0.75 + 0.25 * Math.sin(s.tw));
        g.globalAlpha = a;
        g.fillStyle = s.layer === 2 ? '#dff3ff' : '#ffffff';
        g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
      if (!still) {
        if (!shoot && Math.random() < dt * 0.06) shoot = { x: Math.random() * w * 0.8 + w * 0.2, y: Math.random() * h * 0.4, vx: -(380 + Math.random() * 220), vy: 150 + Math.random() * 80, life: 1 };
        if (shoot) {
          const tail = 0.12;
          const grad = g.createLinearGradient(shoot.x, shoot.y, shoot.x - shoot.vx * tail, shoot.y - shoot.vy * tail);
          grad.addColorStop(0, `rgba(255,255,255,${0.85 * shoot.life})`);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          g.strokeStyle = grad; g.lineWidth = 1.4;
          g.beginPath(); g.moveTo(shoot.x, shoot.y); g.lineTo(shoot.x - shoot.vx * tail, shoot.y - shoot.vy * tail); g.stroke();
          shoot.x += shoot.vx * dt; shoot.y += shoot.vy * dt; shoot.life -= dt * 0.9;
          if (shoot.life <= 0 || shoot.x < -50 || shoot.y > h + 50) shoot = null;
        }
      }
      if (!still) raf = window.setTimeout(() => requestAnimationFrame(draw), 33) as unknown as number;
    };
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(draw);
    return () => { alive = false; window.removeEventListener('resize', resize); clearTimeout(raf); };
  }, []);
  return <canvas ref={ref} className="st-starfield" aria-hidden />;
}
