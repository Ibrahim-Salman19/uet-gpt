"use client";

import { useEffect, useRef } from "react";
import type * as ThreeType from "three";

type NumericProp = "x" | "y" | "z" | "s" | "rx" | "ry" | "rz";
type TransformState = Record<NumericProp, number>;

interface KeyframeDef {
  sel: string;
  uX: number; // Container-normalized X [-1: left edge, 0: center, +1: right edge]
  y: number; // Screen-normalized Y [-1: bottom, 0: center, +1: top]
  z: number; // Frustum depth
  s: number; // Scale fraction of viewport height
  rx: number;
  ry: number;
  rz: number;
}

interface ComputedStop extends TransformState {
  at: number;
  m: Record<NumericProp, number>;
}

const KEYFRAMES: KeyframeDef[] = [
  { sel: "#hero", uX: 0.52, y: 0.05, z: 0.0, s: 0.44, rx: 0.05, ry: 0.0, rz: 0.0 },
  { sel: "#stats", uX: 0.7, y: 0.2, z: -0.35, s: 0.4, rx: 0.16, ry: 1.2, rz: -0.05 },
  { sel: "#pillars", uX: -0.65, y: 0.12, z: -0.4, s: 0.38, rx: 0.28, ry: Math.PI, rz: 0.04 },
  { sel: "#faq", uX: 0.64, y: 0.16, z: -0.45, s: 0.32, rx: 0.22, ry: 5.2, rz: 0.06 },
  { sel: "footer", uX: 0.0, y: 0.34, z: 0.0, s: 0.34, rx: 0.04, ry: Math.PI * 2, rz: 0.0 },
];

const PROPS: NumericProp[] = ["x", "y", "z", "s", "rx", "ry", "rz"];
const CAM_Z = 3.0;
const FOV_DEG = 32;
const HALF_TAN = Math.tan((FOV_DEG * Math.PI) / 360);
const CONTAINER_MAX_W = 1152; // max-w-6xl

export function MedallionCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Check WebGL availability safely
    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
      if (!gl) return;
    } catch {
      return;
    }

    let animId: number;
    let renderer: ThreeType.WebGLRenderer | null = null;
    let pmremTexture: ThreeType.Texture | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const cleanupFns: Array<() => void> = [];

    import("three")
      .then(async (THREE) => {
        if (!isMounted || !canvasRef.current) return;

        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: true,
          powerPreference: "low-power",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(FOV_DEG, 1, 0.1, 100);
        camera.position.set(0, 0, CAM_Z);

        // Studio environment reflection gradient map
        const envCanvas = document.createElement("canvas");
        envCanvas.width = 32;
        envCanvas.height = 256;
        const g = envCanvas.getContext("2d");
        if (g) {
          const grad = g.createLinearGradient(0, 0, 0, 256);
          grad.addColorStop(0.0, "#f6f2e8");
          grad.addColorStop(0.22, "#b8b3a4");
          grad.addColorStop(0.5, "#4a4c48");
          grad.addColorStop(0.78, "#1a1d1c");
          grad.addColorStop(1.0, "#0a0c0b");
          g.fillStyle = grad;
          g.fillRect(0, 0, 32, 256);
          g.fillStyle = "#fffaf0";
          g.fillRect(0, 18, 32, 20);
          const eq = new THREE.CanvasTexture(envCanvas);
          eq.mapping = THREE.EquirectangularReflectionMapping;
          eq.colorSpace = THREE.SRGBColorSpace;
          const pmrem = new THREE.PMREMGenerator(renderer);
          pmremTexture = pmrem.fromEquirectangular(eq).texture;
          scene.environment = pmremTexture;
          pmrem.dispose();
          eq.dispose();
        }

        scene.add(new THREE.HemisphereLight(0xdfe7e0, 0x0a0f0c, 0.5));
        const keyLight = new THREE.DirectionalLight(0xfff6e2, 3.0);
        keyLight.position.set(2.4, 3.0, 3.2);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0x9fc7d8, 0.9);
        fillLight.position.set(-3.2, -1.2, 2.0);
        scene.add(fillLight);
        const backLight = new THREE.DirectionalLight(0xffd98a, 2.2);
        backLight.position.set(-1.8, 1.4, -3.0);
        scene.add(backLight);

        // Struck Gold Medallion with UET Seal
        const R = 0.05;
        const T = 0.011;
        const FACE = R * 0.9;
        const FIELD_Z = T / 2 - 0.0009;

        const textureLoader = new THREE.TextureLoader();
        const seal = await textureLoader.loadAsync("/landing/logo.png").catch(() => null);

        if (!isMounted) {
          seal?.dispose();
          return;
        }

        if (seal) {
          seal.colorSpace = THREE.SRGBColorSpace;
          seal.anisotropy = 8;
          seal.repeat.set(1.07, 1.07);
          seal.offset.set(-0.035, -0.035);
        }

        const gold = new THREE.MeshStandardMaterial({
          name: "gold",
          color: 0xe6c266,
          roughness: 0.26,
          metalness: 0.92,
          envMapIntensity: 1.5,
        });
        const goldDark = new THREE.MeshStandardMaterial({
          name: "gold_patina",
          color: 0xb0872f,
          roughness: 0.38,
          metalness: 0.9,
          envMapIntensity: 1.2,
        });
        const enamelFront = new THREE.MeshPhysicalMaterial({
          name: "seal_front",
          map: seal,
          roughness: 0.5,
          metalness: 0.0,
          envMapIntensity: 0.45,
          clearcoat: 0.4,
          clearcoatRoughness: 0.18,
        });
        const enamelBack = new THREE.MeshPhysicalMaterial({
          name: "seal_back",
          map: seal,
          roughness: 0.5,
          metalness: 0.0,
          envMapIntensity: 0.45,
          clearcoat: 0.4,
          clearcoatRoughness: 0.18,
        });

        const coin = new THREE.Group();
        coin.name = "uetgpt_medallion";

        const V = (r: number, y: number) => new THREE.Vector2(r, y);
        const half = [
          V(0, FIELD_Z),
          V(FACE + 0.0012, FIELD_Z),
          V(FACE + 0.003, T / 2),
          V(R - 0.0022, T / 2),
          V(R - 0.0004, T / 2 - 0.0018),
          V(R, T / 2 - 0.003),
        ];
        const profile = [...half.map((p) => V(p.x, -p.y)).reverse(), ...half];
        const blankGeo = new THREE.LatheGeometry(profile, 160);
        const blank = new THREE.Mesh(blankGeo, gold);
        blank.name = "blank";
        blank.rotation.x = Math.PI / 2;
        coin.add(blank);

        const TICKS = 144;
        const fluteGeo = new THREE.BoxGeometry(0.0013, T * 0.72, 0.0015);
        const flutes = new THREE.InstancedMesh(fluteGeo, goldDark, TICKS);
        flutes.name = "milled_edge";
        flutes.frustumCulled = false;
        const m = new THREE.Matrix4();
        for (let i = 0; i < TICKS; i++) {
          const a = (i / TICKS) * Math.PI * 2;
          m.makeRotationFromEuler(new THREE.Euler(0, a, 0));
          m.setPosition(Math.sin(a) * (R - 0.0006), 0, Math.cos(a) * (R - 0.0006));
          flutes.setMatrixAt(i, m);
        }
        flutes.rotation.x = Math.PI / 2;
        coin.add(flutes);

        const circleGeo = new THREE.CircleGeometry(FACE, 160);
        const torusGeo = new THREE.TorusGeometry(FACE + 0.0008, 0.0007, 16, 160);

        for (const side of [1, -1]) {
          const tag = side > 0 ? "front" : "back";
          const disc = new THREE.Mesh(circleGeo, side > 0 ? enamelFront : enamelBack);
          disc.name = `seal_${tag}`;
          disc.position.z = side * (FIELD_Z + 0.0004);
          if (side < 0) disc.rotation.y = Math.PI;
          coin.add(disc);

          const ring = new THREE.Mesh(torusGeo, gold);
          ring.name = `bezel_inner_${tag}`;
          ring.position.z = side * (FIELD_Z + 0.0004);
          coin.add(ring);
        }

        const rig = new THREE.Group();
        const pivot = new THREE.Group();
        coin.scale.setScalar(20);
        pivot.add(coin);
        rig.add(pivot);
        scene.add(rig);

        // Scroll Choreography Setup
        let stops: ComputedStop[] = [];
        let aspect = 1;

        function measure() {
          if (!renderer) return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          renderer.setSize(w, h, false);
          aspect = w / h;
          camera.aspect = aspect;
          camera.updateProjectionMatrix();

          const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);

          // Continuous container-relative horizontal scaling
          const padding = 48; // px-6 equivalent
          const effectiveContainerW = Math.min(w - padding, CONTAINER_MAX_W);
          const responsiveBlend = Math.min(Math.max((w - 520) / (960 - 520), 0), 1);
          const isNarrow = w < 640;
          const isDesktop = w >= 1024;

          const rawStops: ComputedStop[] = KEYFRAMES.map((k, idx) => {
            const el = document.querySelector(k.sel);
            let at = 0;

            if (idx === 0) {
              at = 0; // Guaranteed start at page top
            } else if (idx === KEYFRAMES.length - 1) {
              at = maxScroll; // Guaranteed arrival at document bottom
            } else if (el) {
              const box = el.getBoundingClientRect();
              at = box.top + window.scrollY + box.height / 2 - h / 2;
            } else {
              at = (idx / (KEYFRAMES.length - 1)) * maxScroll;
            }

            // Adapt Hero position: Desktop sits in right column, Mobile sits centered at top
            let uX = k.uX;
            let targetY = k.y;
            let baseScale = k.s;

            if (idx === 0) {
              if (isDesktop) {
                uX = 0.52;
                targetY = 0.05;
                baseScale = 0.44;
              } else {
                uX = 0.0;
                targetY = 0.38;
                baseScale = 0.32;
              }
            }

            // Container-anchored NDC X coordinate
            const pixelX = uX * (effectiveContainerW / 2) * responsiveBlend;
            const ndcX = (2 * pixelX) / w;

            // Scale & clamp vertical NDC to ensure seal stays comfortably on screen
            const s = baseScale * (isNarrow ? 0.65 : 1);
            const halfExtent = s * Math.abs(Math.cos(k.rx)) + 0.09 * s * Math.abs(Math.sin(k.rx));
            const y = Math.min(
              Math.max(targetY * (isNarrow ? 0.9 : 1), -1 + 0.05 + halfExtent),
              1 - 0.12 - halfExtent, // Keep clear of navbar
            );

            return {
              at,
              x: ndcX,
              y,
              z: k.z,
              s,
              rx: k.rx,
              ry: k.ry,
              rz: k.rz,
              m: { x: 0, y: 0, z: 0, s: 0, rx: 0, ry: 0, rz: 0 },
            };
          });

          // Sort and enforce strict monotonicity
          rawStops.sort((a, b) => a.at - b.at);
          const firstRaw = rawStops[0];
          const lastRaw = rawStops[rawStops.length - 1];
          if (firstRaw) firstRaw.at = 0;
          if (lastRaw) lastRaw.at = maxScroll;

          const minInterval = 120;
          for (let i = 1; i < rawStops.length - 1; i++) {
            const stop = rawStops[i];
            const prevStop = rawStops[i - 1];
            if (!stop || !prevStop) continue;
            stop.at = Math.max(stop.at, prevStop.at + minInterval);
            stop.at = Math.min(stop.at, maxScroll - minInterval * (rawStops.length - 1 - i));
          }

          stops = rawStops;

          // Fritsch-Carlson Monotone Cubic Spline Tangents (PCHIP)
          for (const q of PROPS) {
            const n = stops.length;
            if (n < 2) continue;
            const deltas: number[] = new Array(n - 1).fill(0);
            for (let i = 0; i < n - 1; i++) {
              const cur = stops[i];
              const nxt = stops[i + 1];
              if (!cur || !nxt) continue;
              const dx = nxt.at - cur.at;
              deltas[i] = dx > 0 ? (nxt[q] - cur[q]) / dx : 0;
            }

            const firstStop = stops[0];
            const lastStop = stops[n - 1];
            if (firstStop) firstStop.m[q] = deltas[0] ?? 0;
            if (lastStop) lastStop.m[q] = deltas[n - 2] ?? 0;

            for (let i = 1; i < n - 1; i++) {
              const stop = stops[i];
              if (!stop) continue;
              const dPrev = deltas[i - 1] ?? 0;
              const dCur = deltas[i] ?? 0;
              if (dPrev * dCur <= 0) {
                // Local extremum: flatten tangent to guarantee zero overshoot
                stop.m[q] = 0;
              } else {
                // Harmonic mean for shape-preserving continuity
                stop.m[q] = (2 * dPrev * dCur) / (dPrev + dCur);
              }
            }
          }
        }

        const outValues: TransformState = {
          x: 0,
          y: 0.05,
          z: 0,
          s: 0.44,
          rx: 0.05,
          ry: 0,
          rz: 0,
        };

        function sample(yPos: number): TransformState {
          if (!stops.length) return outValues;
          const first = stops[0];
          if (!first) return outValues;
          if (yPos <= first.at) return first;
          const last = stops[stops.length - 1];
          if (!last) return outValues;
          if (yPos >= last.at) return last;

          let i = 0;
          while (i < stops.length - 2) {
            const nextStop = stops[i + 1];
            if (nextStop && yPos > nextStop.at) {
              i++;
            } else {
              break;
            }
          }

          const a = stops[i];
          const b = stops[i + 1];
          if (!a || !b) return last;
          const dx = b.at - a.at;
          const t = dx > 0 ? (yPos - a.at) / dx : 0;
          const t2 = t * t;
          const t3 = t2 * t;

          const h00 = 2 * t3 - 3 * t2 + 1;
          const h10 = t3 - 2 * t2 + t;
          const h01 = -2 * t3 + 3 * t2;
          const h11 = t3 - t2;

          for (const q of PROPS) {
            outValues[q] = h00 * a[q] + h10 * dx * a.m[q] + h01 * b[q] + h11 * dx * b.m[q];
          }
          return outValues;
        }

        function place(k: { x: number; y: number; z: number; s: number }) {
          const halfH = (CAM_Z - k.z) * HALF_TAN;
          rig.position.set(k.x * halfH * aspect, k.y * halfH, k.z);
          rig.scale.setScalar(k.s * halfH);
        }

        measure();

        // Safe relayout handling
        document.fonts?.ready.then(() => measure());
        window.addEventListener("load", measure);
        window.addEventListener("resize", measure);
        cleanupFns.push(() => {
          window.removeEventListener("load", measure);
          window.removeEventListener("resize", measure);
        });

        // ResizeObserver to detect layout expansion without layout thrashing
        const mainEl = document.querySelector("main") || document.body;
        let lastHeight = 0;
        resizeObserver = new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          const h = Math.round(entry.contentRect.height);
          if (Math.abs(h - lastHeight) > 4) {
            lastHeight = h;
            measure();
          }
        });
        resizeObserver.observe(mainEl);

        // Mouse Parallax
        let mx = 0;
        let my = 0;
        let tmx = 0;
        let tmy = 0;
        const handlePointerMove = (e: PointerEvent) => {
          tmx = (e.clientX / window.innerWidth - 0.5) * 0.22;
          tmy = (e.clientY / window.innerHeight - 0.5) * 0.16;
        };
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        cleanupFns.push(() => window.removeEventListener("pointermove", handlePointerMove));

        const cur: TransformState = {
          x: 0,
          y: 0.05,
          z: 0,
          s: 0.44,
          rx: 0.05,
          ry: 0,
          rz: 0,
        };
        let primed = false;
        let sy = window.scrollY;
        let lastT = performance.now();
        const t0 = lastT;
        const easeOut = (t: number) => 1 - (1 - t) ** 3;

        function frame() {
          if (!renderer) return;
          const now = performance.now();
          const dt = Math.min((now - lastT) / 1000, 0.05);
          lastT = now;
          const t = (now - t0) / 1000;

          // Asymptotically chase scroll position
          const d = window.scrollY - sy;
          sy = Math.abs(d) < 0.4 || !primed ? window.scrollY : sy + d * (1 - Math.exp(-dt / 0.085));

          const sampled = sample(sy);
          for (const q of PROPS) cur[q] = sampled[q];
          if (!primed) primed = true;

          const intro = reduced ? 1 : easeOut(Math.min(t / 1.4, 1));
          if (canvas) {
            canvas.style.opacity = (intro * 0.92).toFixed(3);
          }

          mx += (tmx - mx) * (1 - Math.exp(-dt / 0.34));
          my += (tmy - my) * (1 - Math.exp(-dt / 0.34));

          place({
            x: cur.x,
            y: cur.y,
            z: cur.z,
            s: cur.s * (0.82 + 0.18 * intro),
          });

          // Floating bobbing motion
          rig.position.y += reduced ? 0 : Math.sin(t * 0.55) * 0.008;

          // Parallax applied to rig
          rig.rotation.x = my;
          rig.rotation.y = mx;

          // Choreographed attitude applied to pivot
          pivot.rotation.x = cur.rx;
          pivot.rotation.z = cur.rz;
          pivot.rotation.y =
            cur.ry - (1 - intro) * 0.6 + (reduced ? 0 : Math.sin(t * 0.31) * 0.025);

          renderer.render(scene, camera);
          animId = requestAnimationFrame(frame);
        }

        animId = requestAnimationFrame(frame);

        cleanupFns.push(() => {
          cancelAnimationFrame(animId);
          resizeObserver?.disconnect();
          blankGeo.dispose();
          fluteGeo.dispose();
          circleGeo.dispose();
          torusGeo.dispose();
          gold.dispose();
          goldDark.dispose();
          enamelFront.dispose();
          enamelBack.dispose();
          seal?.dispose();
          pmremTexture?.dispose();
          renderer?.dispose();
        });
      })
      .catch((err) => {
        console.warn("[MedallionCanvas] Failed to initialize 3D canvas:", err);
      });

    return () => {
      isMounted = false;
      cleanupFns.forEach((fn) => {
        fn();
      });
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-0"
    />
  );
}
