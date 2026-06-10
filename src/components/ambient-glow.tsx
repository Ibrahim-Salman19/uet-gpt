"use client";

import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";

export function AmbientGlow() {
  const glowRef = React.useRef<HTMLDivElement | null>(null);
  const { glowEnabled } = usePreferences();

  React.useEffect(() => {
    if (!glowEnabled) return;

    const glow = glowRef.current;
    if (!glow) return;

    // Initially fade in
    glow.style.opacity = "0.08";

    const handleMouseMove = (e: MouseEvent) => {
      requestAnimationFrame(() => {
        if (glow) {
          glow.style.background = `radial-gradient(circle 600px at ${e.clientX}px ${e.clientY}px, var(--accent) / 0.08, transparent 70%)`;
        }
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [glowEnabled]);

  if (!glowEnabled) return null;

  return (
    <div
      ref={glowRef}
      id="ambient-glow"
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 opacity-0"
      style={{
        background: "radial-gradient(circle 600px at 50% 50%, var(--accent) / 0.04, transparent 70%)",
      }}
      aria-hidden="true"
    />
  );
}
