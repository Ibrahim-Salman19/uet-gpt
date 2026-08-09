"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import * as React from "react";
import { useConvexConnectionSnapshot } from "@/components/ConvexConnectionMonitor";
import { useUserData } from "@/hooks/use-user-data";
import { copyToClipboard } from "@/lib/utils";

const INITIAL_WAIT_MS = 20_000;
const OFFLINE_WAIT_MS = 2_500;

function useOnlineHint(): boolean {
  const [online, setOnline] = React.useState(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

export function ConvexReconnectBanner() {
  const connection = useConvexConnectionSnapshot();

  if (connection.connected || !connection.hasEverConnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] text-xs font-semibold text-black shadow-lg backdrop-blur-sm"
    >
      <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-black opacity-50 motion-reduce:animate-none" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-black" />
      </span>
      Live updates are reconnecting. Keep this page open while the connection recovers.
    </div>
  );
}

function LoadingScreen({ step }: { step: number }) {
  const loadingTexts = [
    "AUTH // RESOLVING IDENTITY…",
    "CONVEX // ESTABLISHING REALTIME CONNECTION…",
    "PROFILE // SYNCHRONIZING USER DATA…",
    "WORKSPACE // PREPARING CHAT SERVICES…",
  ];

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center bg-[var(--ks-lacquer-black,#070708)] text-zinc-100"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading UETGPT services.</span>
      <div
        aria-hidden="true"
        className="relative flex w-full max-w-sm flex-col items-center gap-12 p-8"
      >
        <div className="relative flex h-28 w-28 items-center justify-center" aria-hidden="true">
          <svg
            className="absolute h-full w-full animate-[spin_12s_linear_infinite] motion-reduce:animate-none"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="var(--ks-rule)"
              strokeWidth="0.5"
              strokeDasharray="4 8"
            />
          </svg>
          <svg
            className="absolute h-[80%] w-[80%] animate-[spin_8s_linear_infinite_reverse] motion-reduce:animate-none"
            viewBox="0 0 100 100"
          >
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="var(--ks-kinpaku-gold)"
              strokeWidth="0.75"
              strokeDasharray="40 10 15 10"
              className="opacity-70"
            />
          </svg>
          <div className="absolute flex h-8 w-8 rotate-45 items-center justify-center border border-[var(--ks-kinpaku-gold)] bg-[var(--ks-lacquer-deep)] shadow-[0_0_20px_oklch(84%_0.19_80.46_/_0.15)]">
            <span className="absolute h-1.5 w-1.5 animate-ping bg-[var(--ks-verdigris-patina)] motion-reduce:animate-none" />
            <span className="h-1 w-1 rounded-full bg-[var(--ks-champagne)]" />
          </div>
        </div>

        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="select-none font-mono text-[9px] uppercase tracking-[0.3em] text-[var(--ks-kinpaku-gold)]">
              UETGPT // SECURE BOOT
            </span>
            <span className="h-4 select-none font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--ks-text-muted)]">
              {loadingTexts[step]}
            </span>
          </div>
          <div
            className="relative mt-2 h-px w-48 overflow-hidden bg-[var(--ks-rule)]"
            aria-hidden="true"
          >
            <span className="absolute inset-y-0 left-0 w-1/3 animate-progress bg-[var(--ks-kinpaku-gold)] motion-reduce:animate-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  value,
  state,
}: {
  label: string;
  value: string;
  state: "ok" | "wait" | "error";
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-zinc-800 py-2 last:border-none">
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={
          state === "ok"
            ? "text-emerald-400"
            : state === "error"
              ? "text-red-400"
              : "text-amber-400"
        }
      >
        {value}
      </dd>
    </div>
  );
}

export function ConvexReadyGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: clerkLoaded, user } = useUser();
  const { isLoading: convexAuthLoading, isAuthenticated } = useConvexAuth();
  const { convexUser, isConvexLoaded } = useUserData();
  const connection = useConvexConnectionSnapshot();
  const onlineHint = useOnlineHint();
  const [timedOut, setTimedOut] = React.useState(false);
  const [waitGeneration, setWaitGeneration] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const copyResetRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const ready =
    clerkLoaded && !convexAuthLoading && (!user || (isConvexLoaded && convexUser !== null));

  React.useEffect(() => {
    if (ready) {
      setTimedOut(false);
      return;
    }
    const timeout = setTimeout(
      () => setTimedOut(true),
      onlineHint ? INITIAL_WAIT_MS : OFFLINE_WAIT_MS,
    );
    return () => clearTimeout(timeout);
  }, [ready, waitGeneration, onlineHint]);

  const previousOnlineRef = React.useRef(onlineHint);
  React.useEffect(() => {
    const wasOnline = previousOnlineRef.current;
    previousOnlineRef.current = onlineHint;
    if (!wasOnline && onlineHint && !ready) {
      setTimedOut(false);
      setWaitGeneration((generation) => generation + 1);
    }
  }, [onlineHint, ready]);

  const [loadingStep, setLoadingStep] = React.useState(0);
  React.useEffect(() => {
    if (ready || timedOut) return;
    const interval = setInterval(() => setLoadingStep((step) => (step + 1) % 4), 1_600);
    return () => clearInterval(interval);
  }, [ready, timedOut]);

  React.useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) clearTimeout(copyResetRef.current);
    };
  }, []);

  if (ready) return <>{children}</>;
  if (!timedOut) return <LoadingScreen step={loadingStep} />;

  const deploymentHost = (() => {
    try {
      return process.env.NEXT_PUBLIC_CONVEX_URL
        ? new URL(process.env.NEXT_PUBLIC_CONVEX_URL).host
        : "not configured";
    } catch {
      return "invalid URL";
    }
  })();

  const copyDiagnostics = async () => {
    const report = [
      "UETGPT connection report",
      `Time: ${new Date().toISOString()}`,
      `Browser online hint: ${onlineHint}`,
      `Clerk loaded: ${clerkLoaded}`,
      `Convex auth loading: ${convexAuthLoading}`,
      `Convex authenticated: ${isAuthenticated}`,
      `Convex WebSocket connected: ${connection.connected}`,
      `Convex ever connected: ${connection.hasEverConnected}`,
      `Convex retries: ${typeof connection.retries === "number" ? connection.retries : "unavailable"}`,
      `User query loaded: ${isConvexLoaded}`,
      `User document present: ${convexUser != null}`,
      `Deployment host: ${deploymentHost}`,
    ].join("\n");

    if (await copyToClipboard(report)) {
      setCopied(true);
      if (copyResetRef.current !== null) clearTimeout(copyResetRef.current);
      copyResetRef.current = setTimeout(() => setCopied(false), 2_000);
    }
  };

  const headline = !onlineHint
    ? "Your browser reports that the device is offline"
    : !connection.connected
      ? "The realtime connection is taking longer than expected"
      : "Account synchronization is taking longer than expected";

  return (
    <main className="flex h-full w-full items-center justify-center overflow-y-auto bg-[var(--surface-0)] px-4 py-8">
      <div className="w-full max-w-lg space-y-4">
        <section
          role="alert"
          className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-5 text-center"
        >
          <div
            className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-amber-700/50 bg-amber-900/30 text-lg font-bold text-amber-300"
            aria-hidden="true"
          >
            !
          </div>
          <h1 className="text-base font-bold tracking-tight text-amber-200">{headline}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            UETGPT is waiting for Clerk authentication and the required Convex user data. The
            WebSocket state below helps identify where initialization is delayed.
          </p>
        </section>

        <section className="rounded-xl border border-zinc-700/50 bg-zinc-900/60 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
            Safe troubleshooting
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-zinc-400">
            <li>Confirm that another website loads on this connection.</li>
            <li>
              Try a different trusted network if your current firewall or proxy blocks WebSockets.
            </li>
            <li>Reload once. If the problem persists, copy the technical report for support.</li>
          </ol>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            The browser’s online flag is only a hint; the WebSocket state below is the more relevant
            application signal.
          </p>
        </section>

        <details className="overflow-hidden rounded-xl border border-zinc-800/60">
          <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 font-mono text-xs text-zinc-500 hover:text-zinc-300">
            <span>Technical details</span>
            <span aria-hidden="true">▾</span>
          </summary>
          <dl className="border-t border-zinc-800 px-4 py-2 font-mono text-[10px]">
            <StatusRow
              label="Browser network hint"
              value={onlineHint ? "ONLINE" : "OFFLINE"}
              state={onlineHint ? "ok" : "error"}
            />
            <StatusRow
              label="Clerk"
              value={clerkLoaded ? "LOADED" : "LOADING"}
              state={clerkLoaded ? "ok" : "wait"}
            />
            <StatusRow
              label="Convex auth"
              value={
                convexAuthLoading ? "LOADING" : isAuthenticated ? "AUTHENTICATED" : "ANONYMOUS"
              }
              state={convexAuthLoading ? "wait" : "ok"}
            />
            <StatusRow
              label="Convex WebSocket"
              value={connection.connected ? "CONNECTED" : "DISCONNECTED"}
              state={connection.connected ? "ok" : "error"}
            />
            <StatusRow
              label="User record"
              value={
                !user
                  ? "NOT REQUIRED"
                  : convexUser
                    ? "READY"
                    : isConvexLoaded
                      ? "MISSING"
                      : "LOADING"
              }
              state={!user || convexUser ? "ok" : isConvexLoaded ? "error" : "wait"}
            />
            <StatusRow
              label="Deployment"
              value={deploymentHost}
              state={
                deploymentHost === "not configured" || deploymentHost === "invalid URL"
                  ? "error"
                  : "ok"
              }
            />
          </dl>
        </details>

        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-emerald-700/60 bg-emerald-900/30 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              setTimedOut(false);
              setWaitGeneration((generation) => generation + 1);
            }}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-300 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Keep waiting
          </button>
          <button
            type="button"
            onClick={() => void copyDiagnostics()}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 font-mono text-xs text-zinc-400 transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            {copied ? "Copied" : "Copy report"}
          </button>
        </div>
      </div>
    </main>
  );
}
