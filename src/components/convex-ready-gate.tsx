"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useConvex } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";

// Increased from 10s → 15s to give high-latency Pakistani networks more headroom
// before declaring a failure. Research shows IPv6 blackhole delays range 10–30s.
const TIMEOUT_MS = 15_000;
// Auto-retry countdown shown on the error screen
const RETRY_COUNTDOWN_S = 30;

// ---------------------------------------------------------------------------
// Platform detection helpers (client-only, safe inside "use client")
// ---------------------------------------------------------------------------
function detectPlatform(): "windows" | "mac" | "android" | "ios" | "other" {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac")) return "mac";
  return "other";
}

// ---------------------------------------------------------------------------
// Reconnect banner – shown after initial successful load if WS drops mid-session
// ---------------------------------------------------------------------------
export function ConvexReconnectBanner() {
  const convex = useConvex();
  const [isConnected, setIsConnected] = useState(true);
  const [wasEverConnected, setWasEverConnected] = useState(false);

  useEffect(() => {
    const unsub = convex.subscribeToConnectionState((state) => {
      if (state.isWebSocketConnected) {
        setWasEverConnected(true);
        setIsConnected(true);
      } else if (state.hasEverConnected) {
        setIsConnected(false);
      }
    });
    return unsub;
  }, [convex]);

  // Only show after a prior successful connection was established then lost
  if (isConnected || !wasEverConnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/95 backdrop-blur-sm text-black text-xs font-semibold font-sans shadow-lg"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-black opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-black" />
      </span>
      Reconnecting to server… Your chats are saved.
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="ml-2 underline underline-offset-2 opacity-80 hover:opacity-100 cursor-pointer"
      >
        Reload
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main gate
// ---------------------------------------------------------------------------
export function ConvexReadyGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: isClerkLoaded, user } = useUser();
  const { isLoading: isConvexLoading } = useConvexAuth();
  const { convexUser, isConvexLoaded } = useUserData();
  const [timedOut, setTimedOut] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [countdown, setCountdown] = useState(RETRY_COUNTDOWN_S);
  const [copied, setCopied] = useState(false);
  const platform = useRef<ReturnType<typeof detectPlatform>>("other");

  // Detect platform once on mount (client-only)
  useEffect(() => {
    platform.current = detectPlatform();
  }, []);

  // Ready when Clerk & Convex network are loaded, AND if a Clerk user exists,
  // their Convex user document has been successfully created and synced by UserSync.
  const isReady =
    isClerkLoaded && !isConvexLoading && (!user || (isConvexLoaded && convexUser !== null));

  const checkReachability = useCallback(async (signal: AbortSignal): Promise<string> => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return "ENV_MISSING";
    try {
      await fetch(url, { method: "GET", mode: "no-cors", signal });
      return "DATABASE_REACHABLE";
    } catch (err: unknown) {
      if (err instanceof Error) {
        return err.name === "AbortError" ? "TIMEOUT_ERROR" : "UNREACHABLE_ERROR";
      }
      return "UNREACHABLE_ERROR";
    }
  }, []);

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

  // Fire initial timeout gate
  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isReady]);

  // Auto-run diagnostics when timeout triggers
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
  }, [timedOut, checkReachability]);

  // Auto-retry countdown
  useEffect(() => {
    if (!timedOut) return;
    setCountdown(RETRY_COUNTDOWN_S);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          window.location.reload();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timedOut]);

  // Rotate loading subtexts
  const [loadStep, setLoadStep] = useState(0);
  useEffect(() => {
    if (isReady || timedOut) return;
    const interval = setInterval(() => setLoadStep((p) => (p + 1) % 4), 1500);
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

  // Derive a human-readable cause for students
  const isTimeout = networkError === "TIMEOUT_ERROR";
  const isUnreachable = networkError === "UNREACHABLE_ERROR";
  const isReachableButBlocked = networkError === "DATABASE_REACHABLE";
  const isMobile = platform.current === "android" || platform.current === "ios";

  const copyDiagnostics = () => {
    const text = [
      `UET GPT Diagnostic Report`,
      `Time: ${new Date().toISOString()}`,
      `Platform: ${platform.current}`,
      `Clerk Auth: ${isClerkLoaded ? "LOADED" : "PENDING"}`,
      `Convex Sync: ${isConvexLoading ? "CONNECTING" : "CONNECTED"}`,
      `Server Reachability: ${networkError ?? "UNKNOWN"}`,
      `URL: ${process.env.NEXT_PUBLIC_CONVEX_URL ?? "not set"}`,
    ].join("\n");
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error("Failed to copy diagnostics:", err);
      });
  };

  // -------------------------------------------------------------------------
  // TIMEOUT SCREEN
  // -------------------------------------------------------------------------
  if (timedOut) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--surface-0)] overflow-y-auto py-8 px-4">
        <div className="w-full max-w-lg space-y-4">

          {/* ── Header card ─────────────────────────────────────────── */}
          <div className="border border-red-900/40 bg-red-950/20 rounded-lg p-5 text-center">
            <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
              <span className="text-red-400 text-lg font-bold select-none">!</span>
            </div>
            <h1 className="text-base font-bold text-red-300 tracking-tight">
              Can&apos;t Connect to Server
            </h1>
            <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">
              {isTimeout
                ? "Your network is blocking the connection. This is very common on university Wi-Fi and PTCL in Pakistan."
                : isUnreachable
                  ? "The server cannot be reached. Check your internet connection."
                  : isReachableButBlocked
                    ? "The server is reachable but WebSocket traffic is blocked (firewall or proxy)."
                    : "Diagnosing your connection…"}
            </p>
          </div>

          {/* ── Quickest fix for mobile ──────────────────────────────── */}
          {isMobile && (
            <div className="border border-emerald-800/40 bg-emerald-950/20 rounded-lg p-4">
              <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                ⚡ Fastest Fix (30 seconds)
              </p>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Turn off Wi-Fi and use your <strong className="text-white">mobile data</strong> instead (Jazz, Zong, or Telenor). University Wi-Fi blocks this app&apos;s connection.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-3 w-full py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                I switched — retry now
              </button>
            </div>
          )}

          {/* ── Fix steps (timeout / blocked) ───────────────────────── */}
          {(isTimeout || isReachableButBlocked) && !isMobile && (
            <div className="border border-zinc-700/50 bg-zinc-900/60 rounded-lg p-4 space-y-4">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                How to fix it — pick any option
              </p>

              {/* Option 1: WARP */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold">1</span>
                  <p className="text-sm font-semibold text-white">
                    Install Cloudflare WARP — free, 30 seconds
                  </p>
                </div>
                <p className="text-xs text-zinc-400 ml-7 leading-relaxed">
                  A free app by Cloudflare that routes your connection through a working path. Fixes university Wi-Fi and PTCL IPv6 issues instantly.
                </p>
                <a
                  href="https://one.one.one.one/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-7 inline-flex items-center gap-2 px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors"
                >
                  Download Cloudflare WARP (free)
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div className="border-t border-zinc-800" />

              {/* Option 2: Disable IPv6 on Windows */}
              {platform.current === "windows" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-800 flex items-center justify-center text-white text-[10px] font-bold">2</span>
                    <p className="text-sm font-semibold text-white">
                      Disable IPv6 on Windows
                    </p>
                  </div>
                  <ol className="ml-7 text-xs text-zinc-400 space-y-1.5 list-none">
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">①</span> Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[10px]">Win + R</kbd>, type <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[10px]">ncpa.cpl</kbd>, press Enter</li>
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">②</span> Right-click your Wi-Fi or Ethernet → <strong className="text-zinc-200">Properties</strong></li>
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">③</span> <strong className="text-zinc-200">Uncheck</strong> &ldquo;Internet Protocol Version 6 (TCP/IPv6)&rdquo;</li>
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">④</span> Click <strong className="text-zinc-200">OK</strong> and reload this page</li>
                  </ol>
                </div>
              )}

              {/* Option 2 for Mac */}
              {platform.current === "mac" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-800 flex items-center justify-center text-white text-[10px] font-bold">2</span>
                    <p className="text-sm font-semibold text-white">Disable IPv6 on Mac</p>
                  </div>
                  <ol className="ml-7 text-xs text-zinc-400 space-y-1.5 list-none">
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">①</span> Open <strong className="text-zinc-200">System Settings</strong> → <strong className="text-zinc-200">Network</strong></li>
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">②</span> Select your Wi-Fi → <strong className="text-zinc-200">Details</strong> → <strong className="text-zinc-200">TCP/IP</strong></li>
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">③</span> Set <strong className="text-zinc-200">Configure IPv6</strong> to <strong className="text-zinc-200">Off</strong></li>
                    <li className="flex gap-2"><span className="text-zinc-500 font-mono">④</span> Click OK and reload</li>
                  </ol>
                </div>
              )}

              <div className="border-t border-zinc-800" />

              {/* Option 3: Hotspot */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-white text-[10px] font-bold">3</span>
                  <p className="text-sm font-semibold text-white">Switch to mobile hotspot</p>
                </div>
                <p className="text-xs text-zinc-400 ml-7 leading-relaxed">
                  Turn on your phone&apos;s hotspot (Jazz / Zong / Telenor) and connect your laptop to it. Mobile data bypasses university network restrictions.
                </p>
              </div>
            </div>
          )}

          {/* ── Unreachable (no internet) ────────────────────────────── */}
          {isUnreachable && (
            <div className="border border-zinc-700/50 bg-zinc-900/60 rounded-lg p-4">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Your device cannot reach the internet. Check your Wi-Fi or mobile data connection, then retry.
              </p>
            </div>
          )}

          {/* ── Diagnostic log (collapsible technical panel) ─────────── */}
          <details className="border border-zinc-800/60 rounded-lg overflow-hidden group">
            <summary className="px-4 py-3 text-xs font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 transition-colors select-none flex items-center justify-between">
              <span>Technical details</span>
              <span className="group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-4 pb-4 pt-1 font-mono text-[10px] space-y-2 border-t border-zinc-800">
              <div className="flex justify-between">
                <span className="text-zinc-500">Clerk Auth:</span>
                <span className={isClerkLoaded ? "text-emerald-400" : "text-zinc-400"}>
                  {isClerkLoaded ? "LOADED" : "PENDING…"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Convex Sync:</span>
                <span className={isConvexLoading ? "text-amber-400" : "text-emerald-400"}>
                  {isConvexLoading ? "CONNECTING…" : "CONNECTED"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Server Reachability:</span>
                {diagnosing ? (
                  <span className="text-zinc-400 animate-pulse">TESTING…</span>
                ) : networkError === "DATABASE_REACHABLE" ? (
                  <span className="text-emerald-400">REACHABLE (TCP/TLS)</span>
                ) : networkError === "TIMEOUT_ERROR" ? (
                  <span className="text-red-400">TIMEOUT</span>
                ) : networkError === "UNREACHABLE_ERROR" ? (
                  <span className="text-red-400">UNREACHABLE</span>
                ) : (
                  <span className="text-zinc-500">{networkError ?? "CHECKING…"}</span>
                )}
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Platform:</span>
                <span className="text-zinc-400">{platform.current}</span>
              </div>
            </div>
          </details>

          {/* ── Action buttons ───────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 py-2.5 rounded border border-emerald-700/60 bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300 text-sm font-semibold transition-colors cursor-pointer"
            >
              Retry now ({countdown}s)
            </button>
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={diagnosing}
              className="flex-1 py-2.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-400 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {diagnosing ? "Diagnosing…" : "Re-run diagnostics"}
            </button>
            <button
              type="button"
              onClick={copyDiagnostics}
              title="Copy diagnostic info for support"
              className="sm:w-auto px-4 py-2.5 rounded border border-zinc-700 hover:bg-zinc-800 text-zinc-500 text-xs font-mono transition-colors cursor-pointer"
            >
              {copied ? "Copied!" : "Copy info"}
            </button>
          </div>

          <p className="text-center text-[10px] text-zinc-600">
            The server is healthy — this is a local network issue.
          </p>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // LOADING SCREEN (branded, unchanged)
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--ks-lacquer-black,#070708)] text-zinc-100">
      <div className="relative flex flex-col items-center gap-12 p-8 w-full max-w-sm">
        {/* Central Aperture Rings */}
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* Outer Dashed Orbit */}
          <svg
            className="absolute w-full h-full animate-[spin_12s_linear_infinite]"
            viewBox="0 0 100 100"
            aria-hidden="true"
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
            aria-hidden="true"
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
              {"UETGPT // SECURE BOOT"}
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
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ks-verdigris-patina)] opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--ks-verdigris-patina)]" />
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
