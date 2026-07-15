"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";

const TIMEOUT_MS = 10_000; // 10 seconds

export function ConvexReadyGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: isClerkLoaded, user } = useUser();
  const { isLoading: isConvexLoading } = useConvexAuth();
  const { convexUser, isConvexLoaded } = useUserData();
  const [timedOut, setTimedOut] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);

  // Ready when Clerk & Convex network are loaded, AND if a Clerk user exists,
  // their Convex user document has been successfully created and synced by UserSync.
  const isReady =
    isClerkLoaded && !isConvexLoading && (!user || (isConvexLoaded && convexUser !== null));

  const checkReachability = async (signal: AbortSignal): Promise<string> => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      return "Convex URL environment variable (NEXT_PUBLIC_CONVEX_URL) is not configured.";
    }
    try {
      await fetch(url, { method: "GET", mode: "no-cors", signal });
      return "DATABASE_REACHABLE";
    } catch (err: any) {
      return err.name === "AbortError" ? "TIMEOUT_ERROR" : "UNREACHABLE_ERROR";
    }
  };

  const runDiagnostics = async () => {
    setDiagnosing(true);
    setNetworkError(null);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 6000);
    const result = await checkReachability(controller.signal);
    clearTimeout(id);
    setNetworkError(result);
    setDiagnosing(false);
  };

  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isReady]);

  useEffect(() => {
    if (!timedOut) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    (async () => {
      setDiagnosing(true);
      setNetworkError(null);
      const result = await checkReachability(controller.signal);
      if (!cancelled) {
        setNetworkError(result);
        setDiagnosing(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [timedOut]);

  // Rotate console loading subtexts for premium technical feel
  const [loadStep, setLoadStep] = useState(0);

  useEffect(() => {
    if (isReady || timedOut) return;
    const interval = setInterval(() => {
      setLoadStep((prev) => (prev + 1) % 4);
    }, 1500);
    return () => clearInterval(interval);
  }, [isReady, timedOut]);

  // Happy path
  if (isReady) return <>{children}</>;

  const loadingTexts = [
    "SYS // ESTABLISHING HANDSHAKE…",
    "AUTH // RESOLVING CLERK IDENTITY…",
    "CONVEX // SYNCHRONIZING REALTIME ENGINE…",
    "RAG // INITIALIZING VECTOR WORKSPACE…",
  ];

  // Timed out — show retry UI instead of infinite blank
  if (timedOut) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center bg-[var(--surface-0)] overflow-y-auto py-10">
        <div className="relative p-6 md:p-8 max-w-md w-full border border-[oklch(58%_0.15_35_/_0.2)] bg-[var(--surface-card)] rounded-[4px] shadow-2xl text-left">
          {/* Vermilion alert node */}
          <div className="mx-auto w-10 h-10 border border-[oklch(58%_0.15_35)] bg-[oklch(58%_0.15_35_/_0.08)] flex items-center justify-center rounded-[2px] mb-4">
            <span className="font-mono text-sm text-[oklch(58%_0.15_35)] font-bold">!</span>
          </div>

          <h2 className="text-xs font-mono tracking-[0.25em] text-[var(--ks-champagne)] uppercase text-center">
            TIMEOUT // CONNECTION FAILURE
          </h2>
          <p className="text-xs text-[var(--ks-text-muted)] mt-3 leading-relaxed font-sans text-center">
            The database connection handshake timed out. Check your network or verify the database
            status.
          </p>

          {/* Diagnostic Log Panel */}
          <div className="mt-5 p-4 border border-zinc-800 bg-zinc-950/80 rounded font-mono text-[10px] space-y-2.5">
            <div className="flex justify-between items-center text-zinc-500 border-b border-zinc-900 pb-1.5">
              <span>DIAGNOSTIC LOG</span>
              <span className="text-[9px] text-zinc-600">v1.40.0</span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Clerk Auth:</span>
              <span className={isClerkLoaded ? "text-emerald-400" : "text-zinc-400"}>
                {isClerkLoaded ? "LOADED" : "PENDING…"}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-zinc-500">Convex Dev Sync:</span>
              <span className={isConvexLoading ? "text-amber-400" : "text-emerald-400"}>
                {isConvexLoading ? "CONNECTING…" : "CONNECTED"}
              </span>
            </div>

            <div className="flex justify-between items-center border-t border-zinc-900 pt-2">
              <span className="text-zinc-500">Server Reachability:</span>
              {diagnosing ? (
                <span className="text-zinc-400 animate-pulse">TESTING…</span>
              ) : networkError === "DATABASE_REACHABLE" ? (
                <span className="text-emerald-400">HOST REACHABLE (TCP/TLS)</span>
              ) : networkError === "TIMEOUT_ERROR" ? (
                <span className="text-[oklch(58%_0.15_35)]">FAILED (TIMEOUT)</span>
              ) : networkError === "UNREACHABLE_ERROR" ? (
                <span className="text-[oklch(58%_0.15_35)]">FAILED (UNREACHABLE)</span>
              ) : (
                <span className="text-zinc-500">{networkError || "UNKNOWN"}</span>
              )}
            </div>

            {/* Diagnostic Message */}
            {!diagnosing && networkError && (
              <div className="text-[9.5px] text-zinc-400 leading-normal pt-2 border-t border-zinc-900 font-sans space-y-1.5">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--ks-kinpaku-gold)] block">
                  RECOMMENDED ACTION:
                </span>
                {networkError === "DATABASE_REACHABLE" && (
                  <p>
                    The host resolved and accepted a TCP/TLS connection (this opaque check cannot
                    confirm an HTTP 200), but the realtime WebSocket (wss://) connection is still
                    failing. This often indicates a local firewall, VPN, or proxy blocking
                    WebSockets. If you are using <strong>127.0.0.1:3000</strong>, try accessing the
                    app via <strong>localhost:3000</strong> to ensure Clerk authentication cookies
                    settle correctly.
                  </p>
                )}
                {networkError === "TIMEOUT_ERROR" && (
                  <p>
                    Connection timed out. This is commonly caused by a broken IPv6 configuration on
                    your Wi-Fi/network interface (resolving the database host to IPv6 addresses that
                    are blackholed). Try disabling IPv6 on your network adapter or switching to a
                    mobile hotspot.
                  </p>
                )}
                {networkError === "UNREACHABLE_ERROR" && (
                  <p>
                    Database host resolved but cannot be reached. Check if your network connection
                    is active or if your router/DNS configuration has issues.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={runDiagnostics}
              disabled={diagnosing}
              className="px-4 py-2 border border-zinc-800 hover:bg-zinc-900 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none text-zinc-400 font-mono text-[9px] tracking-wider rounded-[2px] transition-all cursor-pointer"
            >
              RUN DIAGNOSTICS
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-[var(--ks-rule-strong)] hover:bg-[oklch(84%_0.19_80.46_/_0.08)] active:scale-[0.98] text-[var(--ks-kinpaku-gold)] font-mono text-[9px] tracking-wider rounded-[2px] transition-all cursor-pointer"
            >
              RETRY CONNECTION
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Still loading — show branded loading screen
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--ks-lacquer-black, #070708)] text-zinc-100">
      <div className="relative flex flex-col items-center gap-12 p-8 w-full max-w-sm">
        {/* Central Aperture Rings */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Outer Dashed Orbit */}
          <svg
            className="absolute w-full h-full animate-[spin_12s_linear_infinite]"
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

          {/* Middle Gold Track */}
          <svg
            className="absolute w-[80%] h-[80%] animate-[spin_8s_linear_infinite_reverse]"
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

          {/* Inner Geometric Core */}
          <div className="absolute w-8 h-8 border border-[var(--ks-kinpaku-gold)] rotate-45 flex items-center justify-center transition-all duration-1000 ease-out shadow-[0_0_20px_oklch(84%_0.19_80.46_/_0.15)] bg-[var(--ks-lacquer-deep)]">
            <div className="w-1.5 h-1.5 bg-[var(--ks-verdigris-patina)] animate-ping absolute" />
            <div className="w-1 h-1 bg-[var(--ks-champagne)] rounded-full" />
          </div>
        </div>

        {/* Console Loading Log */}
        <div className="w-full flex flex-col items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="font-mono text-[9px] text-[var(--ks-kinpaku-gold)] tracking-[0.3em] uppercase select-none">
              UETGPT // SECURE BOOT
            </span>
            <span className="text-[10px] text-[var(--ks-text-muted)] font-mono tracking-[0.2em] uppercase h-4 text-center select-none">
              {loadingTexts[loadStep]}
            </span>
          </div>

          {/* Glowing loader bar */}
          <div className="w-48 h-[1px] bg-[var(--ks-rule)] relative overflow-hidden mt-2">
            <div
              className="absolute top-0 bottom-0 left-0 w-1/3 bg-[var(--ks-kinpaku-gold)] animate-progress"
              style={{
                boxShadow: "0 0 8px var(--ks-kinpaku-gold)",
                backgroundImage:
                  "linear-gradient(90deg, transparent, var(--ks-kinpaku-gold), transparent)",
              }}
            />
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ks-verdigris-patina)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--ks-verdigris-patina)]"></span>
            </span>
            <span className="font-mono text-[8px] text-[var(--ks-text-faint)] select-none">
              CONNECTION LIVE
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
