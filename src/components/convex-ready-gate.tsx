"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useEffect, useState } from "react";

const TIMEOUT_MS = 10_000; // 10 seconds

export function ConvexReadyGate({ children }: { children: React.ReactNode }) {
  const { isLoaded: isClerkLoaded } = useUser();
  const { isLoading: isConvexLoading } = useConvexAuth();
  const [timedOut, setTimedOut] = useState(false);

  const isReady = isClerkLoaded && !isConvexLoading;

  useEffect(() => {
    if (isReady) return;
    const timer = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isReady]);

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
    "SYS // ESTABLISHING HANDSHAKE...",
    "AUTH // RESOLVING CLERK IDENTITY...",
    "CONVEX // SYNCHRONIZING REALTIME ENGINE...",
    "RAG // INITIALIZING VECTOR WORKSPACE...",
  ];

  // Timed out — show retry UI instead of infinite blank
  if (timedOut) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center bg-[#070708]">
        <div className="relative p-8 max-w-md w-full border border-[oklch(58%_0.15_35_/_0.2)] bg-[var(--surface-1)] rounded-[2px] shadow-2xl">
          {/* Vermilion alert node */}
          <div className="mx-auto w-10 h-10 border border-[oklch(58%_0.15_35)] bg-[oklch(58%_0.15_35_/_0.08)] flex items-center justify-center rounded-[2px] mb-4">
            <span className="font-mono text-sm text-[oklch(58%_0.15_35)] font-bold">!</span>
          </div>

          <h2 className="text-xs font-mono tracking-[0.25em] text-[var(--ks-champagne)] uppercase">
            TIMEOUT // CONNECTION FAILURE
          </h2>
          <p className="text-xs text-[var(--ks-text-muted)] mt-3 leading-relaxed font-sans">
            The database connection handshake timed out. Check your network or verify the database
            status and try again.
          </p>

          <div className="mt-6 flex justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 border border-[var(--ks-rule-strong)] hover:bg-[oklch(84%_0.19_80.46_/_0.08)] active:scale-[0.98] text-[var(--ks-kinpaku-gold)] font-mono text-[10px] tracking-widest rounded-[2px] transition-all cursor-pointer"
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
