"use client";

import nextDynamic from "next/dynamic";
import * as React from "react";
import { ErrorBoundary } from "react-error-boundary";

// Lazy-load WebGL to prevent blocking first paint (200KB+ bundle)
const WebGLBackdrop = nextDynamic(
  () => import("@/components/webgl-backdrop").then((mod) => ({ default: mod.WebGLBackdrop })),
  { ssr: false, loading: () => null },
);

function WebGLFallback() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none"
      style={{
        background:
          "radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.03) 0%, transparent 70%)",
      }}
    />
  );
}

export function BackdropWrapper() {
  return (
    <ErrorBoundary fallback={<WebGLFallback />}>
      <WebGLBackdrop />
    </ErrorBoundary>
  );
}
