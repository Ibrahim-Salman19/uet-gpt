"use client";

import { useEffect, useRef } from "react";
import type * as ThreeType from "three";

type NumericProp = "x" | "y" | "z" | "s" | "rx" | "ry" | "rz";
type TransformState = Record<NumericProp, number>;

interface Keyframe {
  sel: string;
  x: number;
  y: number;
  z: number;
  s: number;
  rx: number;
  ry: number;
  rz: number;
}

interface Stop extends Keyframe {
  at: number;
  m: Record<NumericProp, number>;
}

const KEYS: Keyframe[] = [
  { sel: "#hero", x: 0.0, y: 0.44, z: 0.0, s: 0.34, rx: 0.05, ry: 0.0, rz: 0.0 },
  { sel: "#stats", x: 0.64, y: 0.22, z: -0.35, s: 0.44, rx: 0.16, ry: 1.2, rz: -0.07 },
  { sel: "#pillars", x: -0.52, y: 0.16, z: -0.4, s: 0.42, rx: 0.28, ry: Math.PI, rz: 0.05 },
  { sel: "#faq", x: 0.52, y: 0.2, z: -0.5, s: 0.34, rx: 0.22, ry: 5.2, rz: 0.08 },
  { sel: "footer", x: 0.0, y: 0.4, z: 0.0, s: 0.36, rx: 0.04, ry: Math.PI * 2, rz: 0.0 },
];

const PROPS: NumericProp[] = ["x", "y", "z", "s", "rx", "ry", "rz"];
const CAM_Z = 3;
const HALF_TAN = Math.tan((32 * Math.PI) / 360);

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
        const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
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
          scene.environment = pmrem.fromEquirectangular(eq).texture;
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

        // Build Struck Gold Medallion with UET Seal
        const R = 0.05;
        const T = 0.011;
        const FACE = R * 0.9;
        const FIELD_Z = T / 2 - 0.0009;

        const textureLoader = new THREE.TextureLoader();
        const seal = await textureLoader.loadAsync("/landing/logo.png").catch(() => null);

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
        const blank = new THREE.Mesh(new THREE.LatheGeometry(profile, 160), gold);
        blank.name = "blank";
        blank.rotation.x = Math.PI / 2;
        coin.add(blank);

        const TICKS = 144;
        const flutes = new THREE.InstancedMesh(
          new THREE.BoxGeometry(0.0013, T * 0.72, 0.0015),
          goldDark,
          TICKS,
        );
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

        for (const side of [1, -1]) {
          const tag = side > 0 ? "front" : "back";
          const disc = new THREE.Mesh(
            new THREE.CircleGeometry(FACE, 160),
            side > 0 ? enamelFront : enamelBack,
          );
          disc.name = `seal_${tag}`;
          disc.position.z = side * (FIELD_Z + 0.0004);
          if (side < 0) disc.rotation.y = Math.PI;
          coin.add(disc);

          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(FACE + 0.0008, 0.0007, 16, 160),
            gold,
          );
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
        let stops: Stop[] = [];
        let aspect = 1;

        function measure() {
          if (!renderer) return;
          const w = window.innerWidth;
          const h = window.innerHeight;
          renderer.setSize(w, h, false);
          aspect = w / h;
          camera.aspect = aspect;
          camera.updateProjectionMatrix();

          const navEl = document.querySelector("header") || document.querySelector("nav");
          const navH = navEl?.getBoundingClientRect().height || 0;
          const navNdc = (2 * navH) / h;
          const narrow = w < 900;

          const rawStops: Stop[] = KEYS.map((k) => {
            const el = document.querySelector(k.sel);
            if (!el) return null;
            const box = el.getBoundingClientRect();
            const at = box.top + window.scrollY + box.height / 2 - h / 2;
            const s = k.s * (narrow ? 0.65 : 1);
            const halfExtent = s * Math.abs(Math.cos(k.rx)) + 0.09 * s * Math.abs(Math.sin(k.rx));
            const y = Math.min(
              Math.max(k.y * (narrow ? 0.88 : 1), -1 + 0.05 + halfExtent),
              1 - navNdc - 0.05 - halfExtent,
            );
            return {
              ...k,
              at,
              x: k.x * (narrow ? 0.2 : 1),
              y,
              s,
              m: { x: 0, y: 0, z: 0, s: 0, rx: 0, ry: 0, rz: 0 },
            };
          }).filter((s): s is Stop => s !== null);

          if (rawStops.length === 0) {
            // Fallback if no target elements exist
            stops = [
              {
                sel: "#hero",
                at: 0,
                x: 0,
                y: 0.44,
                z: 0,
                s: 0.34,
                rx: 0.05,
                ry: 0,
                rz: 0,
                m: { x: 0, y: 0, z: 0, s: 0, rx: 0, ry: 0, rz: 0 },
              },
            ];
            return;
          }

          rawStops.sort((a, b) => a.at - b.at);
          stops = rawStops;

          // Catmull-Rom tangents for C1 continuous motion
          for (let i = 0; i < stops.length; i++) {
            const curStop = stops[i];
            if (!curStop) continue;
            const p = stops[i - 1] ?? curStop;
            const n = stops[i + 1] ?? curStop;
            const span = n.at - p.at;
            curStop.m = {
              x: span > 0 ? (n.x - p.x) / span : 0,
              y: span > 0 ? (n.y - p.y) / span : 0,
              z: span > 0 ? (n.z - p.z) / span : 0,
              s: span > 0 ? (n.s - p.s) / span : 0,
              rx: span > 0 ? (n.rx - p.rx) / span : 0,
              ry: span > 0 ? (n.ry - p.ry) / span : 0,
              rz: span > 0 ? (n.rz - p.rz) / span : 0,
            };
          }
        }

        const outValues: TransformState = {
          x: 0,
          y: 0,
          z: 0,
          s: 0,
          rx: 0,
          ry: 0,
          rz: 0,
        };

        function sample(yPos: number): TransformState | null {
          if (!stops.length) return null;
          const first = stops[0];
          if (!first) return null;
          if (yPos <= first.at) return first;
          const last = stops[stops.length - 1];
          if (!last) return null;
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
          const tNorm = dx > 0 ? (yPos - a.at) / dx : 0;
          const t2 = tNorm * tNorm;
          const t3 = t2 * tNorm;
          const h00 = 2 * t3 - 3 * t2 + 1;
          const h10 = t3 - 2 * t2 + tNorm;
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

        const handleResize = () => measure();
        window.addEventListener("resize", handleResize);
        cleanupFns.push(() => window.removeEventListener("resize", handleResize));

        // Details toggles on FAQ page expand content and shift positions
        const detailsList = document.querySelectorAll("details");
        detailsList.forEach((d) => {
          d.addEventListener("toggle", measure);
        });
        cleanupFns.push(() => {
          detailsList.forEach((d) => {
            d.removeEventListener("toggle", measure);
          });
        });

        // Mouse Parallax
        let mx = 0;
        let my = 0;
        let tmx = 0;
        let tmy = 0;
        const handlePointerMove = (e: PointerEvent) => {
          tmx = (e.clientX / window.innerWidth - 0.5) * 0.26;
          tmy = (e.clientY / window.innerHeight - 0.5) * 0.2;
        };
        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        cleanupFns.push(() => window.removeEventListener("pointermove", handlePointerMove));

        const cur: TransformState = {
          x: 0,
          y: 0.44,
          z: 0,
          s: 0.34,
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

          const d = window.scrollY - sy;
          sy = Math.abs(d) < 0.4 || !primed ? window.scrollY : sy + d * (1 - Math.exp(-dt / 0.085));

          const sampled = sample(sy);
          if (sampled) {
            for (const q of PROPS) cur[q] = sampled[q];
          }
          if (!primed) primed = true;

          const intro = reduced ? 1 : easeOut(Math.min(t / 1.5, 1));
          if (canvas) {
            canvas.style.opacity = (intro * 0.9).toFixed(3);
          }

          mx += (tmx - mx) * (1 - Math.exp(-dt / 0.34));
          my += (tmy - my) * (1 - Math.exp(-dt / 0.34));

          place({
            x: cur.x,
            y: cur.y,
            z: cur.z,
            s: cur.s * (0.8 + 0.2 * intro),
          });

          rig.position.y += reduced ? 0 : Math.sin(t * 0.55) * 0.01;
          rig.rotation.x = my;
          rig.rotation.y = mx;

          pivot.rotation.x = cur.rx;
          pivot.rotation.z = cur.rz;
          pivot.rotation.y =
            cur.ry - (1 - intro) * 0.85 + (reduced ? 0 : Math.sin(t * 0.31) * 0.03);

          renderer.render(scene, camera);
          animId = requestAnimationFrame(frame);
        }

        animId = requestAnimationFrame(frame);

        cleanupFns.push(() => {
          cancelAnimationFrame(animId);
          blank.geometry.dispose();
          flutes.geometry.dispose();
          gold.dispose();
          goldDark.dispose();
          enamelFront.dispose();
          enamelBack.dispose();
          seal?.dispose();
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
      className="fixed inset-0 w-full h-full pointer-events-none z-0 opacity-0 transition-opacity duration-1000"
    />
  );
}
