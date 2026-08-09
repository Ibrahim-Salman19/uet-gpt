"use client";

import * as React from "react";
import * as THREE from "three";
import { usePreferences } from "@/components/preferences-provider";

const DESKTOP_PARTICLE_COUNT = 220;
const COMPACT_PARTICLE_COUNT = 96;
const DESKTOP_MAX_DPR = 1.25;
const COMPACT_MAX_DPR = 1;
const WEBGL_STATS_EVENT = "uetgpt:webgl-stats";

const QUALITY_PRESETS = [
  { particleRatio: 1, dprScale: 1, fps: 30 },
  { particleRatio: 0.7, dprScale: 0.85, fps: 30 },
  { particleRatio: 0.45, dprScale: 0.7, fps: 24 },
] as const;

type QualityLevel = 0 | 1 | 2;
type Uniform<T> = { value: T };

type ParticleUniforms = {
  uTime: Uniform<number>;
  uPointer: Uniform<THREE.Vector2>;
  uPixelRatio: Uniform<number>;
  uColor: Uniform<THREE.Color>;
  uOpacity: Uniform<number>;
};

type ParticleField = {
  geometry: THREE.BufferGeometry;
  material: THREE.ShaderMaterial;
  points: THREE.Points;
  uniforms: ParticleUniforms;
  maxParticleCount: number;
};

interface NetworkInformationLike {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

interface NavigatorDeviceHints extends Navigator {
  deviceMemory?: number;
  connection?: NetworkInformationLike;
}

interface WebGLStatsDetail {
  active: boolean;
  particles?: number;
  quality?: number;
  fpsCap?: number;
  dpr?: number;
}

function publishStats(canvas: HTMLCanvasElement, detail: WebGLStatsDetail): void {
  canvas.dataset.particles = detail.particles ? String(detail.particles) : "";
  canvas.dataset.quality = detail.quality !== undefined ? String(detail.quality) : "";
  canvas.dataset.fpsCap = detail.fpsCap ? String(detail.fpsCap) : "";
  canvas.dataset.dpr = detail.dpr ? detail.dpr.toFixed(2) : "";
  window.dispatchEvent(new CustomEvent<WebGLStatsDetail>(WEBGL_STATS_EVENT, { detail }));
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function createParticleField(compact: boolean): ParticleField {
  const maxParticleCount = compact ? COMPACT_PARTICLE_COUNT : DESKTOP_PARTICLE_COUNT;
  const positions = new Float32Array(maxParticleCount * 3);
  const velocities = new Float32Array(maxParticleCount * 3);
  const phases = new Float32Array(maxParticleCount);
  const sizes = new Float32Array(maxParticleCount);
  const random = createSeededRandom(compact ? 0x7f4a7c15 : 0x9e3779b9);

  for (let index = 0; index < maxParticleCount; index += 1) {
    const offset = index * 3;
    positions[offset] = (random() - 0.5) * 15;
    positions[offset + 1] = (random() - 0.5) * 15;
    positions[offset + 2] = (random() - 0.5) * 10;

    velocities[offset] = (random() - 0.5) * 0.08;
    velocities[offset + 1] = (random() - 0.5) * 0.08;
    velocities[offset + 2] = (random() - 0.5) * 0.055;

    phases[index] = random() * Math.PI * 2;
    sizes[index] = 0.75 + random() * 0.65;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aVelocity", new THREE.BufferAttribute(velocities, 3));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setDrawRange(0, maxParticleCount);

  const uniforms: ParticleUniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2() },
    uPixelRatio: { value: 1 },
    uColor: { value: new THREE.Color(0x818cf8) },
    uOpacity: { value: 0.12 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform vec2 uPointer;
      uniform float uPixelRatio;

      attribute vec3 aVelocity;
      attribute float aPhase;
      attribute float aSize;

      varying float vAlpha;

      float wrapAxis(float value, float halfExtent) {
        return mod(value + halfExtent, halfExtent * 2.0) - halfExtent;
      }

      void main() {
        vec3 animatedPosition = position + aVelocity * uTime;
        animatedPosition.x = wrapAxis(animatedPosition.x, 7.5);
        animatedPosition.y = wrapAxis(animatedPosition.y, 7.5);
        animatedPosition.z = wrapAxis(animatedPosition.z, 5.0);

        animatedPosition.x += cos(uTime * 0.12 + aPhase) * 0.035;
        animatedPosition.y += sin(uTime * 0.18 + aPhase) * 0.06;
        animatedPosition.xy += uPointer * vec2(0.10, -0.08);

        vec4 viewPosition = modelViewMatrix * vec4(animatedPosition, 1.0);
        float perspectiveScale = 10.0 / max(1.0, -viewPosition.z);
        gl_PointSize = clamp(
          2.0 * aSize * uPixelRatio * perspectiveScale,
          1.0,
          4.5 * uPixelRatio
        );
        gl_Position = projectionMatrix * viewPosition;
        vAlpha = 0.72 + 0.28 * sin(aPhase + uTime * 0.35);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vAlpha;

      void main() {
        float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
        float softCircle = 1.0 - smoothstep(0.20, 0.50, distanceToCenter);
        float alpha = uOpacity * vAlpha * softCircle;
        if (alpha <= 0.003) discard;
        gl_FragColor = vec4(uColor, alpha);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -1;

  return { geometry, material, points, uniforms, maxParticleCount };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useSaveDataPreference(): boolean {
  const [saveData, setSaveData] = React.useState(true);

  React.useEffect(() => {
    const connection = (navigator as NavigatorDeviceHints).connection;
    const update = () => setSaveData(Boolean(connection?.saveData));
    update();
    connection?.addEventListener?.("change", update);
    return () => connection?.removeEventListener?.("change", update);
  }, []);

  return saveData;
}

function useWebGLScene(
  containerRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
  onUnavailable: () => void,
): void {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const canvas = document.createElement("canvas");
    canvas.dataset.webglBackdrop = "true";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });
    container.appendChild(canvas);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "low-power",
        precision: "mediump",
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        failIfMajorPerformanceCaveat: true,
      });
    } catch (error) {
      publishStats(canvas, { active: false });
      if (process.env.NODE_ENV !== "production") {
        console.warn("WebGL backdrop could not be initialized", error);
      }
      canvas.remove();
      onUnavailable();
      return;
    }

    renderer.setClearColor(0x000000, 0);
    renderer.sortObjects = false;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const compactQuery = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const finePointerQuery = window.matchMedia("(pointer: fine)");
    const compact = compactQuery.matches;
    const maxDpr = compact ? COMPACT_MAX_DPR : DESKTOP_MAX_DPR;
    const deviceHints = navigator as NavigatorDeviceHints;
    const lowEndDevice =
      (typeof deviceHints.deviceMemory === "number" && deviceHints.deviceMemory <= 4) ||
      (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 10;
    const field = createParticleField(compact);
    scene.add(field.points);

    const pointerTarget = new THREE.Vector2();
    const pointerCurrent = new THREE.Vector2();
    let bounds = container.getBoundingClientRect();
    let disposed = false;
    let contextLost = false;
    let renderFailed = false;
    let animationRunning = false;
    let qualityLevel: QualityLevel = lowEndDevice ? 1 : 0;
    let activeTimeSeconds = 0;
    let lastRenderTimeMs = 0;
    let slowFrameScore = 0;
    let goodFrameScore = 0;
    let renderWidth = 0;
    let renderHeight = 0;
    let renderDpr = 0;
    let activeParticles = field.maxParticleCount;
    let themeFrame: number | null = null;
    let dprCheckCounter = 0;
    let intervalEmaMs = 1_000 / QUALITY_PRESETS[qualityLevel].fps;
    let renderCostEmaMs = 0;

    const preset = () => QUALITY_PRESETS[qualityLevel];
    const resolveDpr = () =>
      Math.max(
        0.75,
        Math.min(Math.max(1, window.devicePixelRatio || 1), maxDpr) * preset().dprScale,
      );

    const updateTheme = () => {
      themeFrame = null;
      const styles = getComputedStyle(document.documentElement);
      const color = styles.getPropertyValue("--accent-300").trim() || "#818cf8";
      const opacityText = styles.getPropertyValue("--webgl-backdrop-opacity").trim();
      const opacity = Number.parseFloat(opacityText);
      try {
        field.uniforms.uColor.value.set(color);
      } catch {
        field.uniforms.uColor.value.set(0x818cf8);
      }
      field.uniforms.uOpacity.value = Number.isFinite(opacity)
        ? THREE.MathUtils.clamp(opacity, 0, 0.4)
        : 0.12;
    };

    const scheduleThemeUpdate = () => {
      if (themeFrame === null) themeFrame = requestAnimationFrame(updateTheme);
    };

    const publishCurrentStats = (active = true) => {
      publishStats(canvas, {
        active,
        particles: active ? activeParticles : undefined,
        quality: active ? qualityLevel : undefined,
        fpsCap: active ? preset().fps : undefined,
        dpr: active ? renderDpr : undefined,
      });
    };

    const failRendering = (error: unknown) => {
      if (renderFailed) return;
      renderFailed = true;
      stopAnimation();
      publishCurrentStats(false);
      if (process.env.NODE_ENV !== "production") console.warn("WebGL rendering stopped", error);
      onUnavailable();
    };

    const renderOnce = () => {
      if (
        disposed ||
        contextLost ||
        renderFailed ||
        document.hidden ||
        renderWidth <= 0 ||
        renderHeight <= 0
      ) {
        return;
      }
      field.uniforms.uPointer.value.copy(pointerCurrent);
      try {
        renderer.render(scene, camera);
      } catch (error) {
        failRendering(error);
      }
    };

    const resizeRenderer = (force = false) => {
      bounds = container.getBoundingClientRect();
      const width = Math.max(0, Math.round(bounds.width));
      const height = Math.max(0, Math.round(bounds.height));
      if (width === 0 || height === 0) return;

      const pixelRatio = resolveDpr();
      if (
        !force &&
        width === renderWidth &&
        height === renderHeight &&
        Math.abs(pixelRatio - renderDpr) < 0.001
      ) {
        return;
      }

      renderWidth = width;
      renderHeight = height;
      renderDpr = pixelRatio;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setDrawingBufferSize(width, height, pixelRatio);
      field.uniforms.uPixelRatio.value = pixelRatio;
      renderOnce();
      if (!renderFailed) publishCurrentStats();
    };

    const applyQuality = () => {
      activeParticles = Math.max(1, Math.round(field.maxParticleCount * preset().particleRatio));
      field.geometry.setDrawRange(0, activeParticles);
      slowFrameScore = 0;
      goodFrameScore = 0;
      resizeRenderer(true);
    };

    const adaptQuality = (
      renderIntervalMs: number,
      targetIntervalMs: number,
      renderCostMs: number,
    ) => {
      intervalEmaMs += (renderIntervalMs - intervalEmaMs) * 0.08;
      renderCostEmaMs += (renderCostMs - renderCostEmaMs) * 0.1;

      const underPressure =
        intervalEmaMs > targetIntervalMs * 1.42 || renderCostEmaMs > targetIntervalMs * 0.35;
      const comfortable =
        intervalEmaMs < targetIntervalMs * 1.18 && renderCostEmaMs < targetIntervalMs * 0.2;

      if (underPressure) {
        slowFrameScore += 1;
        goodFrameScore = 0;
      } else {
        slowFrameScore = Math.max(0, slowFrameScore - 1);
        goodFrameScore = comfortable ? goodFrameScore + 1 : 0;
      }

      if (slowFrameScore >= 36 && qualityLevel < 2) {
        qualityLevel = (qualityLevel + 1) as QualityLevel;
        intervalEmaMs = 1_000 / preset().fps;
        renderCostEmaMs = 0;
        applyQuality();
      } else if (goodFrameScore >= 720 && qualityLevel > 0) {
        qualityLevel = (qualityLevel - 1) as QualityLevel;
        intervalEmaMs = 1_000 / preset().fps;
        renderCostEmaMs = 0;
        applyQuality();
      }
    };

    const animate = (timeMs: number) => {
      if (disposed || contextLost || document.hidden) return;

      const targetIntervalMs = 1_000 / preset().fps;
      const intervalMs = timeMs - lastRenderTimeMs;
      if (intervalMs < targetIntervalMs) return;

      lastRenderTimeMs = timeMs - (intervalMs % targetIntervalMs);
      const deltaSeconds = Math.min(intervalMs, 100) / 1_000;
      activeTimeSeconds += deltaSeconds;

      const smoothing = 1 - Math.exp(-7 * deltaSeconds);
      pointerCurrent.lerp(pointerTarget, smoothing);
      field.uniforms.uTime.value = activeTimeSeconds;
      field.uniforms.uPointer.value.copy(pointerCurrent);
      field.points.rotation.y = activeTimeSeconds * 0.01 + pointerCurrent.x * 0.14;
      field.points.rotation.x = activeTimeSeconds * 0.005 - pointerCurrent.y * 0.12;

      const renderStartedAt = performance.now();
      try {
        renderer.render(scene, camera);
      } catch (error) {
        failRendering(error);
        return;
      }
      const renderCostMs = performance.now() - renderStartedAt;

      adaptQuality(intervalMs, targetIntervalMs, renderCostMs);
      dprCheckCounter += 1;
      if (dprCheckCounter >= 120) {
        dprCheckCounter = 0;
        resizeRenderer();
      }
    };

    const startAnimation = () => {
      if (animationRunning || disposed || contextLost || renderFailed || document.hidden) return;
      lastRenderTimeMs = performance.now();
      renderer.setAnimationLoop(animate);
      animationRunning = true;
    };

    function stopAnimation() {
      if (!animationRunning) return;
      renderer.setAnimationLoop(null);
      animationRunning = false;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!finePointerQuery.matches || renderWidth <= 0 || renderHeight <= 0) return;
      pointerTarget.set(
        THREE.MathUtils.clamp(((event.clientX - bounds.left) / renderWidth) * 2 - 1, -1, 1),
        THREE.MathUtils.clamp(((event.clientY - bounds.top) / renderHeight) * 2 - 1, -1, 1),
      );
    };
    const resetPointer = () => pointerTarget.set(0, 0);
    const handleVisibility = () => {
      if (document.hidden) stopAnimation();
      else {
        resizeRenderer(true);
        startAnimation();
      }
    };
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      stopAnimation();
      container.style.background =
        "radial-gradient(ellipse at 50% 42%, color-mix(in oklch, var(--accent) 3%, transparent), transparent 68%)";
      publishCurrentStats(false);
    };
    const handleContextRestored = () => {
      contextLost = false;
      renderFailed = false;
      container.style.background = "";
      updateTheme();
      applyQuality();
      startAnimation();
    };
    const handleResize = () => resizeRenderer();
    const handlePageHide = () => stopAnimation();
    const handlePageShow = () => {
      resizeRenderer(true);
      startAnimation();
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => resizeRenderer());
    const themeObserver =
      typeof MutationObserver === "undefined" ? null : new MutationObserver(scheduleThemeUpdate);
    resizeObserver?.observe(container);
    themeObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-accent-theme"],
    });

    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("blur", resetPointer);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    updateTheme();
    applyQuality();
    startAnimation();

    return () => {
      disposed = true;
      stopAnimation();
      if (themeFrame !== null) cancelAnimationFrame(themeFrame);
      resizeObserver?.disconnect();
      themeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("blur", resetPointer);
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);

      scene.remove(field.points);
      field.geometry.dispose();
      field.material.dispose();
      renderer.dispose();
      publishStats(canvas, { active: false });
      canvas.remove();
    };
  }, [containerRef, enabled, onUnavailable]);
}

export function WebGLBackdrop() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const { webglEnabled, preferencesHydrated } = usePreferences();
  const reducedMotion = useReducedMotion();
  const saveData = useSaveDataPreference();
  const [unavailable, setUnavailable] = React.useState(false);
  const markUnavailable = React.useCallback(() => setUnavailable(true), []);
  const enabled =
    preferencesHydrated && webglEnabled && !reducedMotion && !saveData && !unavailable;

  React.useEffect(() => {
    if (!webglEnabled) setUnavailable(false);
  }, [webglEnabled]);

  useWebGLScene(containerRef, enabled, markUnavailable);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{
        contain: "strict",
        background: unavailable
          ? "radial-gradient(ellipse at 50% 42%, color-mix(in oklch, var(--accent) 3%, transparent), transparent 68%)"
          : undefined,
      }}
      aria-hidden="true"
    />
  );
}
