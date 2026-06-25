"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center animate-in fade-in zoom-in-95 duration-300">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--destructive)]/10 border border-[var(--destructive)]/20 shadow-sm ring-1 ring-[var(--destructive)]/10">
        <AlertCircle className="h-8 w-8 text-[var(--destructive)]" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          {heading}
        </h2>
        <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">
          {process.env.NODE_ENV === "development" ? error.message || message : message}
        </p>
        {error.digest && (
          <p className="text-xs text-[var(--text-muted)] font-mono bg-[var(--surface-muted)] py-1 px-2 rounded-md inline-block mt-2">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} size="lg" className="mt-2 min-w-[120px]">
        Try Again
      </Button>
    </div>
  );
}
