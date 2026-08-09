"use client";

import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";

interface NetworkInformationLike {
  saveData?: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

function useCanAnimateAmbientGlow(enabled: boolean): boolean {
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    if (!enabled) {
      setAllowed(false);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(pointer: fine)");
    const connection = (navigator as Navigator & { connection?: NetworkInformationLike })
      .connection;
    const update = () =>
      setAllowed(!reducedMotion.matches && finePointer.matches && !connection?.saveData);

    update();
    reducedMotion.addEventListener("change", update);
    finePointer.addEventListener("change", update);
    connection?.addEventListener?.("change", update);
    return () => {
      reducedMotion.removeEventListener("change", update);
      finePointer.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, [enabled]);

  return allowed;
}

export function AmbientGlow() {
  const glowRef = React.useRef<HTMLDivElement | null>(null);
  const { glowEnabled, preferencesHydrated } = usePreferences();
  const canAnimate = useCanAnimateAmbientGlow(preferencesHydrated && glowEnabled);

  React.useEffect(() => {
    if (!canAnimate) return;

    const glow = glowRef.current;
    if (!glow) return;

    let frameId: number | null = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let running = true;

    const render = () => {
      frameId = null;
      if (!running || document.hidden) return;

      currentX += (targetX - currentX) * 0.16;
      currentY += (targetY - currentY) * 0.16;
      glow.style.transform = `translate3d(${Math.round(currentX)}px, ${Math.round(currentY)}px, 0) translate3d(-50%, -50%, 0)`;

      if (Math.abs(targetX - currentX) > 0.5 || Math.abs(targetY - currentY) > 0.5) {
        frameId = requestAnimationFrame(render);
      }
    };

    const schedule = () => {
      if (frameId === null && !document.hidden) frameId = requestAnimationFrame(render);
    };

    const handlePointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      schedule();
    };

    const handleVisibility = () => {
      if (document.hidden) {
        if (frameId !== null) cancelAnimationFrame(frameId);
        frameId = null;
      } else {
        schedule();
      }
    };

    const handleResize = () => {
      targetX = Math.min(targetX, window.innerWidth);
      targetY = Math.min(targetY, window.innerHeight);
      schedule();
    };

    glow.style.opacity = "1";
    glow.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate3d(-50%, -50%, 0)`;

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      running = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (frameId !== null) cancelAnimationFrame(frameId);
    };
  }, [canAnimate]);

  if (!preferencesHydrated || !glowEnabled || !canAnimate) return null;

  return (
    <div
      ref={glowRef}
      id="ambient-glow"
      className="pointer-events-none fixed left-0 top-0 z-0 h-[min(70rem,110vw)] w-[min(70rem,110vw)] rounded-full opacity-0 transition-opacity duration-700 motion-reduce:hidden"
      style={{
        contain: "strict",
        willChange: "transform",
        background:
          "radial-gradient(circle, color-mix(in oklch, var(--accent) 8%, transparent) 0%, color-mix(in oklch, var(--accent) 3%, transparent) 34%, transparent 70%)",
      }}
      aria-hidden="true"
    />
  );
}
