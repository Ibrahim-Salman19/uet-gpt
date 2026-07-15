"use client";

import * as React from "react";
import * as THREE from "three";
import { usePreferences } from "@/components/preferences-provider";

function isWebGLSupported(): boolean {
  try {
    const tempCanvas = document.createElement("canvas");
    const gl = tempCanvas.getContext("webgl") || tempCanvas.getContext("experimental-webgl");
    if (!gl) {
      console.warn("WebGL not available, skipping 3D backdrop");
      return false;
    }
    return true;
  } catch (e) {
    console.warn("WebGL detection failed", e);
    return false;
  }
}

function createParticleSystem(isMobile: boolean): {
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
  points: THREE.Points;
  velocities: Float32Array;
  count: number;
} {
  const particleCount = isMobile ? 80 : 200;
  const positions = new Float32Array(particleCount * 3);
  const driftVelocities = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 15;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
    driftVelocities[i * 3] = (Math.random() - 0.5) * 0.002;
    driftVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.002;
    driftVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    size: 0.035,
    color: 0x71717a,
    transparent: true,
    opacity: 0.15,
    blending: THREE.NormalBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);

  return { geometry, material, points, velocities: driftVelocities, count: particleCount };
}

function updateParticlePositions(
  positions: Float32Array,
  velocities: Float32Array,
  count: number,
): void {
  for (let i = 0; i < count; i++) {
    const idxX = i * 3;
    const idxY = i * 3 + 1;
    const idxZ = i * 3 + 2;

    const vx = velocities[idxX];
    const vy = velocities[idxY];
    const vz = velocities[idxZ];
    if (vx === undefined || vy === undefined || vz === undefined) continue;

    const px = positions[idxX];
    const py = positions[idxY];
    const pz = positions[idxZ];
    if (px === undefined || py === undefined || pz === undefined) continue;

    const nx = px + vx;
    const ny = py + vy;
    const nz = pz + vz;

    positions[idxX] = Math.abs(nx) > 7.5 ? -nx : nx;
    positions[idxY] = Math.abs(ny) > 7.5 ? -ny : ny;
    positions[idxZ] = Math.abs(nz) > 5.0 ? -nz : nz;
  }
}

function shouldDegradeAnimation(
  frameTime: number,
  targetFrameMs: number,
  slowFrameCount: number,
): { degraded: boolean; newCount: number } {
  if (frameTime > targetFrameMs) {
    const newCount = slowFrameCount + 1;
    if (newCount > 120) return { degraded: true, newCount };
    return { degraded: false, newCount };
  }
  return { degraded: false, newCount: Math.max(0, slowFrameCount - 1) };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useWebGLScene(
  containerRef: React.RefObject<HTMLDivElement | null>,
  webglEnabled: boolean,
) {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!isWebGLSupported()) return;
    // Respect the OS-level reduced-motion setting: skip the animated backdrop
    // entirely for users who request reduced motion (WCAG 2.3.3).
    if (prefersReducedMotion()) return;

    const canvas = document.createElement("canvas");
    canvas.id = "webgl-canvas";
    canvas.style.position = "absolute";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
      precision: "mediump",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.0 : 1.2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.z = 10;
    scene.add(new THREE.AmbientLight(0xffffff, 0.05));

    const { geometry, material, points, velocities, count } = createParticleSystem(isMobile);
    scene.add(points);

    let frameId: number;
    let mouseX = 0,
      mouseY = 0,
      targetX = 0,
      targetY = 0,
      slowFrameCount = 0;
    const TARGET_FRAME_MS = 1000 / 30;

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
      mouseY = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Once perf has degraded we stop doing the heavy per-frame work but keep the
    // rAF loop alive so the scene can recover / re-render on resize and so the
    // loop never permanently dies.
    let degradedMode = false;

    const animate = () => {
      // Always reschedule first so the loop never stops permanently. Heavy work
      // below is skipped while disabled or after a degradation event.
      frameId = requestAnimationFrame(animate);

      const positionAttr = geometry.getAttribute("position") as THREE.BufferAttribute | undefined;

      // When disabled or degraded, just render the static scene once more and
      // skip the expensive particle update (but keep requesting frames cheaply).
      if (!webglEnabled || degradedMode || !positionAttr) {
        renderer.render(scene, camera);
        return;
      }

      const frameStart = performance.now();
      const elapsed = performance.now() * 0.001;
      const pos = positionAttr.array as Float32Array;

      targetX += (mouseX - targetX) * 0.05;
      targetY += (mouseY - targetY) * 0.05;
      updateParticlePositions(pos, velocities, count);
      positionAttr.needsUpdate = true;
      points.rotation.y = elapsed * 0.01 + targetX * 0.15;
      points.rotation.x = elapsed * 0.005 - targetY * 0.15;
      renderer.render(scene, camera);

      const perfResult = shouldDegradeAnimation(
        performance.now() - frameStart,
        TARGET_FRAME_MS,
        slowFrameCount,
      );
      if (perfResult.degraded) {
        console.warn("WebGL backdrop performance degraded, pausing animation");
        degradedMode = true;
        return;
      }
      slowFrameCount = perfResult.newCount;
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (!webglEnabled) renderer.render(scene, camera);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      try {
        renderer.forceContextLoss();
      } catch (e) {
        // Non-fatal: some drivers throw on forceContextLoss during teardown.
        console.warn("WebGL forceContextLoss failed during cleanup", e);
      }
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [webglEnabled]);
}

export function WebGLBackdrop() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { webglEnabled } = usePreferences();
  useWebGLScene(containerRef, webglEnabled);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 pointer-events-none" aria-hidden="true" />
  );
}
