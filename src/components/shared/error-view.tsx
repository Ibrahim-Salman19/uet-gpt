"use client";

import { useEffect } from "react";

interface ErrorViewProps {
  label: string;
  heading: string;
  message: string;
  error: Error & { digest?: string };
  reset: () => void;
}

export function ErrorView({ label, heading, message, error, reset }: ErrorViewProps) {
  useEffect(() => {
    console.error(`${label}:`, error);
  }, [label, error]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
        <svg
          className="w-8 h-8 text-red-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">{heading}</h2>
        <p className="text-sm text-zinc-400 mt-2 max-w-md">{error.message || message}</p>
        {error.digest && (
          <p className="text-xs text-zinc-600 mt-1 font-mono">Error ID: {error.digest}</p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-6 py-2.5 bg-[var(--accent)] hover:opacity-90 text-[var(--accent-fg)] rounded-xl text-sm font-medium transition-all active:scale-95 cursor-pointer"
      >
        Try Again
      </button>
    </div>
  );
}
