"use client";

import { X } from "lucide-react";
import * as React from "react";
import {
  CONVEX_CONNECTION_EVENT,
  type ConvexConnectionDetail,
} from "@/components/ConvexConnectionMonitor";
import { usePreferences } from "@/components/preferences-provider";

interface NetworkInformationLike {
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  saveData?: boolean;
}

interface PerformanceMemoryLike {
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface WebGLStatsDetail {
  active: boolean;
  particles?: number;
  quality?: number;
  fpsCap?: number;
  dpr?: number;
}

interface TelemetrySnapshot {
  fps: number | null;
  convex: "connected" | "reconnecting" | "connecting" | "unknown";
  onlineHint: boolean;
  effectiveType: string | null;
  rtt: number | null;
  downlink: number | null;
  saveData: boolean;
  heapUsed: number | null;
  heapLimit: number | null;
  uptimeSeconds: number;
  webgl: WebGLStatsDetail | null;
}

const WEBGL_STATS_EVENT = "uetgpt:webgl-stats";

function numberFromDataset(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readSnapshot(previous?: TelemetrySnapshot): TelemetrySnapshot {
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  const memory = (performance as Performance & { memory?: PerformanceMemoryLike }).memory;
  const canvas = document.querySelector<HTMLCanvasElement>("canvas[data-webgl-backdrop='true']");
  const convexDataset = document.documentElement.dataset.convexConnection;

  const webgl = canvas
    ? {
        active: true,
        particles: numberFromDataset(canvas.dataset.particles),
        quality: numberFromDataset(canvas.dataset.quality),
        fpsCap: numberFromDataset(canvas.dataset.fpsCap),
        dpr: numberFromDataset(canvas.dataset.dpr),
      }
    : previous?.webgl?.active === false
      ? previous.webgl
      : null;

  return {
    fps: previous?.fps ?? null,
    convex:
      convexDataset === "connected" ||
      convexDataset === "reconnecting" ||
      convexDataset === "connecting"
        ? convexDataset
        : "unknown",
    onlineHint: navigator.onLine,
    effectiveType: connection?.effectiveType ?? null,
    rtt: typeof connection?.rtt === "number" ? connection.rtt : null,
    downlink: typeof connection?.downlink === "number" ? connection.downlink : null,
    saveData: Boolean(connection?.saveData),
    heapUsed: typeof memory?.usedJSHeapSize === "number" ? memory.usedJSHeapSize : null,
    heapLimit: typeof memory?.jsHeapSizeLimit === "number" ? memory.jsHeapSizeLimit : null,
    uptimeSeconds: Math.max(0, Math.round(performance.now() / 1_000)),
    webgl,
  };
}

function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  const units = ["B", "KB", "MB", "GB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1_024 && unit < units.length - 1) {
    amount /= 1_024;
    unit += 1;
  }
  return `${amount >= 100 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function formatUptime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

function useDiagnosticsTelemetry(active: boolean): TelemetrySnapshot {
  const [snapshot, setSnapshot] = React.useState<TelemetrySnapshot>(() => ({
    fps: null,
    convex: "unknown",
    onlineHint: true,
    effectiveType: null,
    rtt: null,
    downlink: null,
    saveData: false,
    heapUsed: null,
    heapLimit: null,
    uptimeSeconds: 0,
    webgl: null,
  }));

  React.useEffect(() => {
    if (!active) return;

    let animationFrame = 0;
    let frameCount = 0;
    let sampleStartedAt = performance.now();

    const sampleFrames = (now: number) => {
      if (document.hidden) return;
      frameCount += 1;
      const elapsed = now - sampleStartedAt;
      if (elapsed >= 1_000) {
        const measuredFps = Math.round((frameCount * 1_000) / elapsed);
        setSnapshot((current) => ({ ...readSnapshot(current), fps: measuredFps }));
        frameCount = 0;
        sampleStartedAt = now;
      }
      animationFrame = requestAnimationFrame(sampleFrames);
    };

    const handleVisibility = () => {
      cancelAnimationFrame(animationFrame);
      frameCount = 0;
      sampleStartedAt = performance.now();
      if (!document.hidden) animationFrame = requestAnimationFrame(sampleFrames);
    };

    const refresh = () => setSnapshot((current) => readSnapshot(current));
    const handleConvex = (event: Event) => {
      const detail = (event as CustomEvent<ConvexConnectionDetail>).detail;
      if (!detail) return;
      setSnapshot((current) => ({
        ...readSnapshot(current),
        convex: detail.connected
          ? "connected"
          : detail.hasEverConnected
            ? "reconnecting"
            : "connecting",
      }));
    };
    const handleWebGL = (event: Event) => {
      const detail = (event as CustomEvent<WebGLStatsDetail>).detail;
      if (detail) setSnapshot((current) => ({ ...readSnapshot(current), webgl: detail }));
    };

    refresh();
    animationFrame = requestAnimationFrame(sampleFrames);
    const interval = setInterval(refresh, 2_000);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener(CONVEX_CONNECTION_EVENT, handleConvex);
    window.addEventListener(WEBGL_STATS_EVENT, handleWebGL);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrame);
      clearInterval(interval);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener(CONVEX_CONNECTION_EVENT, handleConvex);
      window.removeEventListener(WEBGL_STATS_EVENT, handleWebGL);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [active]);

  return snapshot;
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/60 p-3">
      <dt className="mb-1 text-[9px] uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="font-semibold text-zinc-100">{value}</dd>
      <dd className="mt-1 text-[9px] leading-relaxed text-zinc-500">{detail}</dd>
    </div>
  );
}

export function DiagnosticsPanel({ inputFocused = false }: { inputFocused?: boolean }) {
  const { diagnosticsOpen, setDiagnosticsOpen, webglEnabled } = usePreferences();
  const visible = diagnosticsOpen && !inputFocused;
  const telemetry = useDiagnosticsTelemetry(visible);

  React.useEffect(() => {
    if (!visible) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDiagnosticsOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [visible, setDiagnosticsOpen]);

  if (!visible) return null;

  const graphicsValue = !webglEnabled
    ? "Disabled"
    : telemetry.webgl?.active
      ? "Active"
      : "Static fallback";
  const graphicsDetail = telemetry.webgl?.active
    ? `${telemetry.webgl.particles ?? "?"} particles · quality ${telemetry.webgl.quality ?? "?"} · ${telemetry.webgl.fpsCap ?? "?"} FPS cap`
    : webglEnabled
      ? "No active WebGL canvas; hardware, policy, or accessibility fallback may be in use."
      : "Disabled in preferences.";

  const networkValue = telemetry.onlineHint
    ? telemetry.effectiveType?.toUpperCase() || "Online hint"
    : "Offline hint";
  const networkDetail =
    [
      telemetry.rtt !== null ? `estimated RTT ${telemetry.rtt} ms` : null,
      telemetry.downlink !== null ? `${telemetry.downlink} Mb/s estimate` : null,
      telemetry.saveData ? "data saver enabled" : null,
    ]
      .filter(Boolean)
      .join(" · ") || "Detailed Network Information API metrics are unavailable.";

  return (
    <section
      id="diagnostics-panel"
      role="region"
      aria-label="System diagnostics"
      className="pointer-events-auto absolute inset-x-0 bottom-0 z-[40] rounded-b-2xl border-t border-[var(--surface-4)] bg-[var(--surface-2)]/95 p-5 font-mono shadow-2xl backdrop-blur-xl md:rounded-b-3xl"
    >
      <div className="mb-4 flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
              UETGPT diagnostics
            </h2>
            <p className="mt-0.5 text-[8px] text-zinc-600">
              Live browser observations; unsupported metrics are not estimated.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDiagnosticsOpen(false)}
          className="rounded p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          aria-label="Close diagnostics"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
        <MetricCard
          label="Display loop"
          value={telemetry.fps === null ? "Measuring…" : `${telemetry.fps} FPS`}
          detail="Animation-frame opportunities observed while this panel is open."
        />
        <MetricCard label="Graphics" value={graphicsValue} detail={graphicsDetail} />
        <MetricCard label="Network" value={networkValue} detail={networkDetail} />
        <MetricCard
          label="Session"
          value={formatUptime(telemetry.uptimeSeconds)}
          detail={`Convex: ${telemetry.convex} · JS heap: ${formatBytes(telemetry.heapUsed)}${telemetry.heapLimit ? ` / ${formatBytes(telemetry.heapLimit)}` : ""}`}
        />
      </dl>
    </section>
  );
}
