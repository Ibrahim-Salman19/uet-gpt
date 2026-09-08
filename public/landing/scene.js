import * as THREE from 'three';
import { buildMedallion } from './medallion.js';

const canvas = document.getElementById('bg');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const scene = new THREE.Scene();
const CAM_Z = 3;
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(0, 0, CAM_Z);

/* Studio environment: a dark room with one bright overhead band, so the
   gold reflects something instead of going flat. */
{
  const c = document.createElement('canvas');
  c.width = 32; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.00, '#f6f2e8');
  grad.addColorStop(0.22, '#b8b3a4');
  grad.addColorStop(0.50, '#4a4c48');
  grad.addColorStop(0.78, '#1a1d1c');
  grad.addColorStop(1.00, '#0a0c0b');
  g.fillStyle = grad; g.fillRect(0, 0, 32, 256);
  g.fillStyle = '#fffaf0'; g.fillRect(0, 18, 32, 20);
  const eq = new THREE.CanvasTexture(c);
  eq.mapping = THREE.EquirectangularReflectionMapping;
  eq.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(eq).texture;
  pmrem.dispose(); eq.dispose();
}

scene.add(new THREE.HemisphereLight(0xdfe7e0, 0x0a0f0c, 0.5));
const key = new THREE.DirectionalLight(0xfff6e2, 3.0);
key.position.set(2.4, 3.0, 3.2);
scene.add(key);
const fill = new THREE.DirectionalLight(0x9fc7d8, 0.9);
fill.position.set(-3.2, -1.2, 2.0);
scene.add(fill);
const back = new THREE.DirectionalLight(0xffd98a, 2.2);
back.position.set(-1.8, 1.4, -3.0);
scene.add(back);

/* rig (screen placement + cursor parallax) → pivot (choreographed attitude) → coin.
   Object is modelled Ø100 mm; scale to unit radius. */
const rig = new THREE.Group();
const pivot = new THREE.Group();
const coin = await buildMedallion(THREE, '/landing/logo.png');
coin.scale.setScalar(20);
pivot.add(coin);
rig.add(pivot);
scene.add(rig);

/* ── scroll choreography ─────────────────────────────────────────────
   One keyframe per section, authored in screen space so placement is exact
   at any viewport:
     x, y  centre position in NDC (-1 … +1: left/bottom to right/top)
     s     coin diameter as a fraction of viewport height
     z     depth offset from the text plane (negative = further away)
     rx/ry/rz  attitude in radians

   ry runs 0 → 2π across the page: the whole scroll is exactly one
   revolution of the medallion, face-on at the first and last stop. */
const KEYS = [
  { sel: '#s-hero',     x:  0.00, y:  0.44, z:  0.00, s: 0.34, rx:  0.05, ry: 0.0000, rz:  0.00 },
  { sel: '#s-overview', x:  0.66, y:  0.22, z: -0.35, s: 0.46, rx:  0.16, ry: 0.9500, rz: -0.07 },
  { sel: '#s-domains',  x:  0.22, y:  0.46, z: -0.80, s: 0.34, rx:  0.52, ry: 2.1000, rz:  0.05 },
  { sel: '#s-preview',  x:  0.00, y: -0.04, z: -0.15, s: 0.52, rx:  1.44, ry: 3.2000, rz:  0.00 },
  { sel: '#s-faq',      x:  0.60, y:  0.20, z: -0.55, s: 0.32, rx:  0.22, ry: 5.6000, rz:  0.09 },
  { sel: '#s-cta',      x:  0.00, y:  0.52, z:  0.05, s: 0.26, rx:  0.04, ry: 6.2832, rz:  0.00 },
];

const PROPS = ['x', 'y', 'z', 's', 'rx', 'ry', 'rz'];
const HALF_TAN = Math.tan((32 * Math.PI / 180) / 2);
let stops = [], aspect = 1;

function measure() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  aspect = w / h;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();

  const navH = document.querySelector('nav')?.getBoundingClientRect().height || 0;
  const navNdc = 2 * navH / h;   // nav depth in NDC units, measured from the top edge
  const narrow = w < 900;
  stops = KEYS.map(k => {
    const el = document.querySelector(k.sel);
    if (!el) return null;
    const box = el.getBoundingClientRect();
    // section centre aligned to viewport centre
    const at = box.top + scrollY + box.height / 2 - h / 2;
    const s = k.s * (narrow ? 0.70 : 1);
    // projected vertical half-extent of the tilted disc, in NDC units
    const half = s * Math.abs(Math.cos(k.rx)) + 0.09 * s * Math.abs(Math.sin(k.rx));
    // keep the seal clear of the nav's backdrop-filter, and on screen
    const y = Math.min(
      Math.max(k.y * (narrow ? 0.92 : 1), -1 + 0.05 + half),
      1 - navNdc - 0.05 - half
    );
    return {
      at,
      x: k.x * (narrow ? 0.26 : 1),
      y, z: k.z, s,
      rx: k.rx, ry: k.ry, rz: k.rz,
    };
  }).filter(Boolean).sort((a, b) => a.at - b.at);

  // finite-difference tangents (non-uniform Catmull–Rom) → C1-continuous
  // motion, so the coin glides through each stop instead of halting at it.
  for (let i = 0; i < stops.length; i++) {
    const p = stops[i - 1] || stops[i], n = stops[i + 1] || stops[i];
    const span = n.at - p.at;
    stops[i].m = {};
    for (const q of PROPS) stops[i].m[q] = span > 0 ? (n[q] - p[q]) / span : 0;
  }
}

const out = {};
function sample(y) {
  if (!stops.length) return null;
  if (y <= stops[0].at) return stops[0];
  const last = stops[stops.length - 1];
  if (y >= last.at) return last;

  let i = 0;
  while (i < stops.length - 2 && y > stops[i + 1].at) i++;
  const a = stops[i], b = stops[i + 1];
  const dx = b.at - a.at;
  const t = dx > 0 ? (y - a.at) / dx : 0;
  const t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  for (const q of PROPS) {
    out[q] = h00 * a[q] + h10 * dx * a.m[q] + h01 * b[q] + h11 * dx * b.m[q];
  }
  return out;
}

/* screen-space keyframe → world units at the coin's actual depth, so an
   x of 0.66 really lands two-thirds of the way to the right edge. */
function place(k) {
  const halfH = (CAM_Z - k.z) * HALF_TAN;
  rig.position.set(k.x * halfH * aspect, k.y * halfH, k.z);
  rig.scale.setScalar(k.s * halfH); // s = diameter / viewport height
}

measure();
addEventListener('resize', measure);
addEventListener('load', measure);
addEventListener('orientationchange', () => setTimeout(measure, 120));
document.fonts?.ready.then(measure);
// layout that changes height must re-anchor the stops, or the coin desyncs
for (const d of document.querySelectorAll('details')) d.addEventListener('toggle', measure);
let lastH = 0;
new ResizeObserver(es => {
  const h = Math.round(es[0].contentRect.height);
  if (Math.abs(h - lastH) > 2) { lastH = h; measure(); }
}).observe(document.querySelector('.wrap'));

let mx = 0, my = 0, tmx = 0, tmy = 0;
addEventListener('pointermove', e => {
  tmx = (e.clientX / innerWidth - 0.5) * 0.26;
  tmy = (e.clientY / innerHeight - 0.5) * 0.20;
}, { passive: true });

const cur = {};
let primed = false, sy = scrollY, lastT = performance.now();
const t0 = lastT;
const easeOut = t => 1 - Math.pow(1 - t, 3);

function frame() {
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  const t = (now - t0) / 1000;

  // one smoothing stage only: chase the scroll position, then read the
  // curve exactly. At rest the coin sits precisely on its keyframe.
  const d = scrollY - sy;
  sy = Math.abs(d) < 0.4 || !primed ? scrollY : sy + d * (1 - Math.exp(-dt / 0.085));

  const k = sample(sy);
  if (k) { for (const q of PROPS) cur[q] = k[q]; }
  if (!primed) { primed = true; }

  // entrance: settles in over the first beat, then never touches it again
  const intro = reduced ? 1 : easeOut(Math.min(t / 1.5, 1));
  canvas.style.opacity = intro.toFixed(3);

  mx += (tmx - mx) * (1 - Math.exp(-dt / 0.34));
  my += (tmy - my) * (1 - Math.exp(-dt / 0.34));

  place({
    x: cur.x, y: cur.y, z: cur.z,
    s: cur.s * (0.80 + 0.20 * intro),
  });
  rig.position.y += reduced ? 0 : Math.sin(t * 0.55) * 0.010;
  rig.rotation.x = my;
  rig.rotation.y = mx;

  pivot.rotation.x = cur.rx;
  pivot.rotation.z = cur.rz;
  pivot.rotation.y = cur.ry - (1 - intro) * 0.85 + (reduced ? 0 : Math.sin(t * 0.31) * 0.030);

  renderer.render(scene, camera);
  reveal();
}

let lastTick = 0;
renderer.setAnimationLoop(() => { lastTick = performance.now(); frame(); });
// Embedded / hidden contexts throttle requestAnimationFrame; a timer keeps the
// scene and the reveals alive there, and idles whenever rAF is healthy.
setInterval(() => { if (performance.now() - lastTick > 220) frame(); }, 40);
addEventListener('scroll', () => { if (performance.now() - lastTick > 220) frame(); }, { passive: true });

/* reveal-on-scroll (scroll-driven: works in every embedding context) */
let rises = [...document.querySelectorAll('[data-rise]')];
function reveal() {
  if (!rises.length) return;
  const h = innerHeight;
  rises = rises.filter(el => {
    // anything at or above the trigger line reveals, so jumping to an anchor
    // or restoring scroll position never leaves a section blank
    if (el.getBoundingClientRect().top < h * 0.93) { el.dataset.in = '1'; return false; }
    return true;
  });
}
addEventListener('scroll', reveal, { passive: true });
addEventListener('resize', reveal);
reveal();
requestAnimationFrame(reveal);

/* thin scroll rule */
const bar = document.getElementById('bar');
function progress() {
  const max = document.documentElement.scrollHeight - innerHeight;
  bar.style.transform = `scaleX(${max > 0 ? Math.min(scrollY / max, 1) : 0})`;
}
addEventListener('scroll', progress, { passive: true });
addEventListener('resize', progress);
progress();

window.__dbg = { frame, measure, place, sample, pivot, rig, coin, scene, camera, renderer, stops: () => stops, cur };
document.documentElement.dataset.ready = '1';
