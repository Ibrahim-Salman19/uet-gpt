"use client";

import { useConvex } from "convex/react";
import * as React from "react";

export const CONVEX_CONNECTION_EVENT = "uetgpt:convex-connection";

export interface ConvexConnectionDetail {
  connected: boolean;
  hasEverConnected: boolean;
  connectionCount?: number;
  retries?: number;
  changedAt: number;
}

const INITIAL_CONNECTION_DETAIL: ConvexConnectionDetail = Object.freeze({
  connected: false,
  hasEverConnected: false,
  changedAt: 0,
});
let latestConnectionDetail = INITIAL_CONNECTION_DETAIL;
const connectionStoreListeners = new Set<() => void>();

function subscribeConnectionStore(listener: () => void): () => void {
  connectionStoreListeners.add(listener);
  return () => connectionStoreListeners.delete(listener);
}

function getConnectionSnapshot(): ConvexConnectionDetail {
  return latestConnectionDetail;
}

export function useConvexConnectionSnapshot(): ConvexConnectionDetail {
  return React.useSyncExternalStore(
    subscribeConnectionStore,
    getConnectionSnapshot,
    () => INITIAL_CONNECTION_DETAIL,
  );
}

function publishConnectionState(detail: ConvexConnectionDetail): void {
  const root = document.documentElement;
  root.dataset.convexConnection = detail.connected
    ? "connected"
    : detail.hasEverConnected
      ? "reconnecting"
      : "connecting";

  latestConnectionDetail = detail;
  for (const listener of connectionStoreListeners) listener();

  window.dispatchEvent(
    new CustomEvent<ConvexConnectionDetail>(CONVEX_CONNECTION_EVENT, { detail }),
  );
}

/**
 * Bridges Convex's connection state into a small DOM event so diagnostics and
 * status UI can observe it without creating additional Convex subscriptions.
 *
 * `subscribeToConnectionState` is currently documented as unstable, so this
 * component intentionally consumes only a small, optional subset of fields.
 */
export function ConvexConnectionMonitor() {
  const convex = useConvex();

  React.useEffect(() => {
    let previousConnected: boolean | null = null;
    let previousSignature = "";

    const handleState = (state: ReturnType<typeof convex.connectionState>, force = false) => {
      const detail: ConvexConnectionDetail = {
        connected: state.isWebSocketConnected,
        hasEverConnected: state.hasEverConnected,
        connectionCount:
          typeof state.connectionCount === "number" ? state.connectionCount : undefined,
        retries: typeof state.connectionRetries === "number" ? state.connectionRetries : undefined,
        changedAt: Date.now(),
      };

      const signature = `${detail.connected}:${detail.hasEverConnected}:${detail.connectionCount ?? ""}:${detail.retries ?? ""}`;
      if (!force && signature === previousSignature) return;
      previousSignature = signature;
      publishConnectionState(detail);

      if (process.env.NODE_ENV === "development" && previousConnected !== detail.connected) {
        console.debug("[Convex] connection transition", detail);
      }
      previousConnected = detail.connected;
    };

    const unsubscribe = convex.subscribeToConnectionState((state) => handleState(state));
    const republishCurrentState = () => handleState(convex.connectionState(), true);

    handleState(convex.connectionState(), true);
    window.addEventListener("online", republishCurrentState);
    window.addEventListener("offline", republishCurrentState);

    return () => {
      unsubscribe();
      window.removeEventListener("online", republishCurrentState);
      window.removeEventListener("offline", republishCurrentState);
    };
  }, [convex]);

  return null;
}
