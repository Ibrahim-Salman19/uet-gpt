"use client";

import * as React from "react";
import {
  CONVEX_CONNECTION_EVENT,
  type ConvexConnectionDetail,
} from "@/components/ConvexConnectionMonitor";
import { cn } from "@/lib/utils";

type Status = "hidden" | "offline" | "reconnecting" | "restored";

const RESTORED_MESSAGE_MS = 3_000;

export function ConnectionStatus() {
  const [status, setStatus] = React.useState<Status>("hidden");
  const hadFailureRef = React.useRef(false);
  const restoreTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRestoreTimer = React.useCallback(() => {
    if (restoreTimerRef.current !== null) {
      clearTimeout(restoreTimerRef.current);
      restoreTimerRef.current = null;
    }
  }, []);

  const showRestoredBriefly = React.useCallback(() => {
    clearRestoreTimer();
    setStatus("restored");
    restoreTimerRef.current = setTimeout(() => {
      setStatus("hidden");
      restoreTimerRef.current = null;
      hadFailureRef.current = false;
    }, RESTORED_MESSAGE_MS);
  }, [clearRestoreTimer]);

  React.useEffect(() => {
    const updateBrowserStatus = () => {
      // navigator.onLine is only a hint. We never disable application features
      // from it; it only controls this informational banner.
      if (!navigator.onLine) {
        clearRestoreTimer();
        hadFailureRef.current = true;
        setStatus("offline");
      } else if (hadFailureRef.current) {
        // Wait until every `online` listener has run. The central Convex monitor
        // republishes a fresh `connectionState()` snapshot on the same browser
        // event, so this microtask reads current socket evidence rather than a
        // dataset value left over from before the device went offline.
        clearRestoreTimer();
        setStatus("reconnecting");
        queueMicrotask(() => {
          if (!navigator.onLine || !hadFailureRef.current) return;
          if (document.documentElement.dataset.convexConnection === "connected") {
            showRestoredBriefly();
          }
        });
      }
    };

    const updateConvexStatus = (event: Event) => {
      const detail = (event as CustomEvent<ConvexConnectionDetail>).detail;
      if (!detail) return;

      if (!detail.connected && detail.hasEverConnected) {
        clearRestoreTimer();
        hadFailureRef.current = true;
        setStatus(navigator.onLine ? "reconnecting" : "offline");
      } else if (detail.connected && hadFailureRef.current && navigator.onLine) {
        showRestoredBriefly();
      }
    };

    window.addEventListener("online", updateBrowserStatus);
    window.addEventListener("offline", updateBrowserStatus);
    window.addEventListener(CONVEX_CONNECTION_EVENT, updateConvexStatus);
    updateBrowserStatus();
    if (document.documentElement.dataset.convexConnection === "reconnecting") {
      hadFailureRef.current = true;
      setStatus(navigator.onLine ? "reconnecting" : "offline");
    }

    return () => {
      window.removeEventListener("online", updateBrowserStatus);
      window.removeEventListener("offline", updateBrowserStatus);
      window.removeEventListener(CONVEX_CONNECTION_EVENT, updateConvexStatus);
      clearRestoreTimer();
    };
  }, [clearRestoreTimer, showRestoredBriefly]);

  if (status === "hidden") return null;

  const restored = status === "restored";
  const message =
    status === "offline"
      ? "Your device appears offline. Existing content remains available where cached."
      : status === "reconnecting"
        ? "Reconnecting to the live service. The application will retry automatically."
        : "Connection restored.";

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[9999] border-b px-4 pb-2 pt-[calc(env(safe-area-inset-top)_+_0.5rem)] text-center text-xs font-medium shadow-sm",
        restored
          ? "border-emerald-500/20 bg-emerald-950/95 text-emerald-200"
          : "border-amber-500/20 bg-amber-950/95 text-amber-100",
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {message}
    </div>
  );
}
