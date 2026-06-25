import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Lightweight heartbeat query for WebSocket keepalive.
 * Runs every 25s from client to prevent proxy/NAT idle timeouts.
 * Returns minimal payload to minimize bandwidth.
 */
export const heartbeat = query({
  args: {},
  returns: v.object({
    ok: v.boolean(),
    timestamp: v.number(),
    version: v.string(),
  }),
  handler: async () => ({
    ok: true,
    timestamp: Date.now(),
    version: "1.0.0",
  }),
});

/**
 * Health check for monitoring/load balancers.
 * Verifies Convex backend is responsive.
 *
 * Intentionally unauthenticated: a liveness probe must be callable by an
 * unauthenticated LB/monitor and reveals nothing sensitive (only a static
 * status string and the current server time).
 */
export const healthCheck = query({
  args: {},
  returns: v.object({
    status: v.string(),
    timestamp: v.number(),
    uptime: v.number(),
  }),
  handler: async () => {
    return {
      status: "healthy",
      timestamp: Date.now(),
      uptime: 0,
    };
  },
});
