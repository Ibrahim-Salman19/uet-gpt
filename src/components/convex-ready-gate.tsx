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

  // Happy path
  if (isReady) return <>{children}</>;

  // Timed out — show retry UI instead of infinite blank
  if (timedOut) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 9v4M12 17h.01M5.07 19H19a2 2 0 001.75-2.96l-6.93-12a2 2 0 00-3.5 0l-6.93 12A2 2 0 005.07 19z" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-100">Taking longer than expected</h2>
          <p className="text-sm text-zinc-400 mt-2 max-w-md">
            Unable to connect to the server. Check your internet connection and try again.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all active:scale-95 cursor-pointer"
        >
          Reload Page
        </button>
      </div>
    );
  }

  // Still loading — show branded loading screen
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
        </div>
        <div className="absolute -inset-2 rounded-3xl border border-[var(--accent)]/5 animate-ping animate-duration-1000" />
      </div>
      <p className="text-xs text-zinc-500 font-mono tracking-wider animate-pulse">CONNECTING…</p>
    </div>
  );
}
