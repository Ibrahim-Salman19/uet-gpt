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

import { ConvexError } from "convex/values";
import { MutationCtx } from "./_generated/server";

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
): Promise<{ exceeded: boolean; current: number }> {
  const now = Date.now();
  const windowStart = now - WINDOW_MS; // anything older is outside the window

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
  const globalCheck = await checkWindow(ctx, "global", tokenEstimate, GLOBAL_TOKEN_LIMIT);
  if (globalCheck.exceeded) {
    throw new ConvexError(
      `System is temporarily busy (global token limit reached). Please try again in a minute.`,
    );
  }
}
