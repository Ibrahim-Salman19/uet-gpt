import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdmin } from "./auth";

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
    timestamp: 0,
    version: "1.0.0",
  }),
});

/**
 * Health check for monitoring/load balancers.
 * Verifies Convex backend is responsive.
 */
export const healthCheck = query({
  args: {},
  returns: v.object({
    status: v.string(),
    timestamp: v.number(),
    uptime: v.number(),
  }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return {
      status: "healthy",
      timestamp: 0,
      uptime: 0,
    };
  },
});
