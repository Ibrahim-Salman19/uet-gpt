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

    // Coalesce pointer updates into a single pending rAF so rapid mousemove
    // events don't queue many gradient repaints per frame.
    let frameId: number | null = null;
    let lastX = 0;
    let lastY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        frameId = null;
        glow.style.background = `radial-gradient(circle 600px at ${lastX}px ${lastY}px, color-mix(in oklch, var(--accent) 8%, transparent), transparent 70%)`;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [glowEnabled]);

  if (!glowEnabled) return null;

  return (
    <div
      ref={glowRef}
      id="ambient-glow"
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 opacity-0"
      style={{
        background:
          "radial-gradient(circle 600px at 50% 50%, color-mix(in oklch, var(--accent) 4%, transparent), transparent 70%)",
      }}
      aria-hidden="true"
    />
  );
}
