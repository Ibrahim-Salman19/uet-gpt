"use client";

import { useConvex } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 25_000;
const MISSED_HEARTBEATS_THRESHOLD = 3;

export function ConvexConnectionMonitor() {
  const convex = useConvex();
  const lastHeartbeatRef = useRef<number>(0);
  const missedHeartbeatsRef = useRef<number>(0);
  const sendHeartbeatRef = useRef<() => void>();

  const heartbeat = useQuery(api.health.heartbeat, {});

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

  useEffect(() => {
    if (heartbeat) {
      lastHeartbeatRef.current = heartbeat.timestamp;
      missedHeartbeatsRef.current = 0;
    }
  }, [heartbeat]);

  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const response = await fetch("/api/health/heartbeat", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
        });

        if (response.ok) {
          lastHeartbeatRef.current = Date.now();
          missedHeartbeatsRef.current = 0;
        } else {
          missedHeartbeatsRef.current += 1;
        }
      } catch {
        missedHeartbeatsRef.current += 1;
      }

      if (missedHeartbeatsRef.current >= MISSED_HEARTBEATS_THRESHOLD) {
        console.error("[Convex] Heartbeat failing - connection likely dead", {
          missedCount: missedHeartbeatsRef.current,
          lastSuccessful: lastHeartbeatRef.current
            ? new Date(lastHeartbeatRef.current).toISOString()
            : "never",
        });
      }
    };

    sendHeartbeatRef.current = sendHeartbeat;

    sendHeartbeat();
    const intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [convex]);

  return null;
}
