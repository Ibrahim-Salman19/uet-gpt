/**
 * rateLimit.ts — TASK-S02: Native Convex sliding-window rate limiter.
 *
 * Limits:
 *   Per-user:  10 messages per minute (sliding 60s window)
 *   Global:    100,000 tokens per minute across all users
 *
 * Design: Pure Convex — no external Redis. Each limit is a single row in the
 * `rateLimits` table keyed by userId or "global". The row stores the window
 * start time and the count for that window. All reads and writes happen inside
 * the caller's mutation transaction, so they are atomic — no double-counting.
 *
 * Usage (inside a mutation):
 *   import { enforceRateLimit } from "./rateLimit";
 *   await enforceRateLimit(ctx, userId, estimatedTokens);
 */

import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query, internalMutation } from "./_generated/server";

// ── Constants ────────────────────────────────────────────────────────────────

/** Per-user message rate limit: max messages per window */
const PER_USER_MSG_LIMIT = 10;

/** Global token rate limit: max tokens across all users per window */
const GLOBAL_TOKEN_LIMIT = 100_000;

/** Sliding window duration in milliseconds (1 minute) */
const WINDOW_MS = 60 * 1000;

// ── Core rate-limit helper ────────────────────────────────────────────────────

/**
 * Reads the current sliding window for `key`, increments by `amount`,
 * and returns `true` if the resulting count would EXCEED `limit`.
 *
 * Side-effect: upserts the rateLimits row — caller must be inside a mutation.
 */
async function checkWindow(
  ctx: MutationCtx,
  key: string,
  amount: number,
  limit: number,
  userIdForSharding?: string
): Promise<{ exceeded: boolean; current: number }> {
  const now = Date.now();
  const windowStart = now - WINDOW_MS; // anything older is outside the window

  if (key === "global") {
    let totalCount = 0;
    const SHARD_COUNT = 10;
    const shards = await Promise.all(
      Array.from({ length: SHARD_COUNT }).map((_, i) =>
        ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", `global_${i}`)).unique()
      )
    );

    for (const shard of shards) {
      if (shard && shard.windowStart >= windowStart) {
        totalCount += shard.count;
      }
    }

    if (totalCount + amount > limit) {
      return { exceeded: true, current: totalCount };
    }

    // Hash userId to pick a shard deterministically
    const shardIndex = userIdForSharding 
      ? Array.from(userIdForSharding).reduce((acc, char) => acc + char.charCodeAt(0), 0) % SHARD_COUNT
      : 0;
      
    const shardKey = `global_${shardIndex}`;
    const shardToUpdate = shards[shardIndex];

    if (!shardToUpdate || shardToUpdate.windowStart < windowStart) {
      if (shardToUpdate) {
        await ctx.db.patch(shardToUpdate._id, { windowStart: now, count: amount });
      } else {
        await ctx.db.insert("rateLimits", { key: shardKey, windowStart: now, count: amount });
      }
    } else {
      await ctx.db.patch(shardToUpdate._id, { count: shardToUpdate.count + amount });
    }

    return { exceeded: false, current: totalCount + amount };
  }

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (!existing || existing.windowStart < windowStart) {
    // Window expired (or first request) — start a fresh window
    if (existing) {
      await ctx.db.patch(existing._id, { windowStart: now, count: amount });
    } else {
      await ctx.db.insert("rateLimits", { key, windowStart: now, count: amount });
    }
    return { exceeded: false, current: amount };
  }

  // Window is still active — check before writing
  const projected = existing.count + amount;
  if (projected > limit) {
    return { exceeded: true, current: existing.count };
  }

  await ctx.db.patch(existing._id, { count: projected });
  return { exceeded: false, current: projected };
}

// ── Public enforcer ───────────────────────────────────────────────────────────

/**
 * Enforces per-user message rate limit AND global token budget.
 * Throws ConvexError if either limit is exceeded.
 *
 * @param ctx          Mutation context (must be inside a Convex mutation)
 * @param userId       Clerk user subject ID (from ctx.auth.getUserIdentity())
 * @param tokenEstimate Estimated tokens for this request (default 1000 if unknown)
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  userId: string,
  tokenEstimate = 1_000,
): Promise<void> {
  // 1. Per-user message rate limit (count = 1 message per call)
  const userCheck = await checkWindow(ctx, userId, 1, PER_USER_MSG_LIMIT);
  if (userCheck.exceeded) {
    throw new ConvexError(
      `Rate limit exceeded: You can send at most ${PER_USER_MSG_LIMIT} messages per minute. ` +
        `Current window: ${userCheck.current}/${PER_USER_MSG_LIMIT}. Please wait a moment.`,
    );
  }

  // 2. Global token budget (shared across all users)
  const globalCheck = await checkWindow(ctx, "global", tokenEstimate, GLOBAL_TOKEN_LIMIT, userId);
  if (globalCheck.exceeded) {
    throw new ConvexError(
      `System is temporarily busy (global token limit reached). Please try again in a minute.`,
    );
  }
}

/**
 * Check current rate limit status for a user (read-only, no side effects).
 * Returns the current window count and limit for both user and global windows.
 */
export const checkRateLimit = mutation({
  args: {},
  returns: v.object({
    user: v.object({ current: v.number(), limit: v.number() }),
    global: v.object({ current: v.number(), limit: v.number() }),
  }),
  handler: async (ctx: MutationCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return {
        user: { current: 0, limit: PER_USER_MSG_LIMIT },
        global: { current: 0, limit: GLOBAL_TOKEN_LIMIT },
      };
    }

    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    const userRow = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", identity.subject))
      .first();

    const globalShards = await Promise.all(
      Array.from({ length: 10 }).map((_, i) =>
        ctx.db.query("rateLimits").withIndex("by_key", (q) => q.eq("key", `global_${i}`)).first()
      )
    );

    const userCount =
      userRow && userRow.windowStart >= windowStart ? userRow.count : 0;
      
    let globalCount = 0;
    for (const shard of globalShards) {
      if (shard && shard.windowStart >= windowStart) {
        globalCount += shard.count;
      }
    }

    return {
      user: { current: userCount, limit: PER_USER_MSG_LIMIT },
      global: { current: globalCount, limit: GLOBAL_TOKEN_LIMIT },
    };
  },
});

export const clearStaleRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const windowStart = Date.now() - WINDOW_MS;
    // We could use an index on windowStart, but without it we scan. 
    // Since rate limits are frequently overwritten, stale ones are only for inactive users.
    const staleRows = await ctx.db.query("rateLimits")
      .filter((q) => q.lt(q.field("windowStart"), windowStart))
      .take(100);
      
    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }
  }
});
