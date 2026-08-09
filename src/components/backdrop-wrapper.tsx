"use client";

import nextDynamic from "next/dynamic";
import * as React from "react";
import { ErrorBoundary } from "react-error-boundary";
import { usePreferences } from "@/components/preferences-provider";

interface NetworkInformationLike {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

const WebGLBackdrop = nextDynamic(
  () => import("@/components/webgl-backdrop").then((module) => module.WebGLBackdrop),
  { ssr: false, loading: () => null },
);

function StaticBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          "radial-gradient(ellipse at 50% 42%, color-mix(in oklch, var(--accent) 3%, transparent), transparent 68%)",
      }}
      aria-hidden="true"
    />
  );
}

function useCanAttemptWebGL(enabled: boolean): boolean {
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setAllowed(false);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;

    const update = () => {
      setAllowed(
        typeof window.WebGLRenderingContext !== "undefined" &&
          !reducedMotion.matches &&
          !connection?.saveData,
      );
    };

    update();
    reducedMotion.addEventListener("change", update);
    connection?.addEventListener?.("change", update);
    return () => {
      reducedMotion.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, [enabled]);

  return allowed;
}

export function BackdropWrapper() {
  const { webglEnabled, preferencesHydrated } = usePreferences();
  const canAttemptWebGL = useCanAttemptWebGL(preferencesHydrated && webglEnabled);

  if (!preferencesHydrated || !webglEnabled) return null;
  if (!canAttemptWebGL) return <StaticBackdrop />;

  return (
    <ErrorBoundary
      fallback={<StaticBackdrop />}
      resetKeys={[webglEnabled, canAttemptWebGL]}
      onError={(error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("WebGL backdrop render boundary caught an error", error);
        }
      }}
    >
      <WebGLBackdrop />
    </ErrorBoundary>
  );
}
