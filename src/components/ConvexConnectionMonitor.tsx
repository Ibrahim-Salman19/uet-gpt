"use client";

import { useConvex } from "convex/react";
import { useEffect } from "react";

export function ConvexConnectionMonitor() {
  const convex = useConvex();

  useEffect(() => {
    const unsubscribe = convex.subscribeToConnectionState((state) => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[Convex] Connection state:", {
          connected: state.isWebSocketConnected,
          hasEverConnected: state.hasEverConnected,
          connectionCount: state.connectionCount,
        });
      }

      if (!state.isWebSocketConnected && state.hasEverConnected) {
        console.warn("[Convex] Connection lost - auto-reconnecting", {
          retries: state.connectionRetries,
        });
      }
    });
    return unsubscribe;
  }, [convex]);

  return null;
}
