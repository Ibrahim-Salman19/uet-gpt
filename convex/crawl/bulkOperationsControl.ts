import { ConvexError, v } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, internalQuery } from "../_generated/server";

const CONTROL_KEY = "global";

/**
 * Durable, server-side kill switch for expensive crawl/embedding operations
 * (August 2026 incident remediation - resource-safety mandate section 40:
 * "kill switch must not depend only on process memory"). Backed by the
 * bulkOperationsControl table (see schema.ts for the "absence means enabled"
 * reasoning), not in-memory state, so it survives process restarts and is
 * visible to every function that checks it, not just the one that set it.
 *
 * Call sites (resource-safety mandate section 10: "before crawl scheduling,
 * before embedding enqueue, before external embedding call, before
 * retry/re-enqueue"):
 *   - crawl/trigger.ts's trigger, crawl/workflow.ts's kickoffDailyCrawl
 *   - crawl/mutations.ts's assertEmbeddingBacklogHasRoom (shared by
 *     enqueueNewChunks and enqueueDocumentChunks)
 *   - crawl/actions.ts's embedSingleChunk, immediately before the Gemini call
 *   - crawl/mutations.ts's retryDeadLetterQueue
 */
export async function isBulkOperationsEnabled(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const row = await ctx.db
    .query("bulkOperationsControl")
    .withIndex("by_key", (q) => q.eq("key", CONTROL_KEY))
    .unique();
  return row?.enabled ?? true;
}

export async function assertBulkOperationsEnabled(ctx: QueryCtx | MutationCtx): Promise<void> {
  if (!(await isBulkOperationsEnabled(ctx))) {
    throw new ConvexError(
      "Bulk crawl/embedding operations are currently disabled (emergency stop engaged). " +
        "An admin must explicitly resume before this can proceed.",
    );
  }
}

// internalQuery wrapper so internalActions (which have no ctx.db of their
// own, e.g. crawl/actions.ts's embedSingleChunk) can check the switch via
// ctx.runQuery before making the external Gemini call.
export const checkBulkOperationsEnabled = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => isBulkOperationsEnabled(ctx),
});

// internalMutation: only reachable from other server-side code (the
// admin-gated public mutations in emergencyStop.ts), never directly by a
// client - mirrors the internal-only discipline already used elsewhere in
// crawl/ for administrative/operational (not retrieval-semantic) mutations.
export const setBulkOperationsEnabled = internalMutation({
  args: {
    enabled: v.boolean(),
    reason: v.optional(v.string()),
    updatedBy: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("bulkOperationsControl")
      .withIndex("by_key", (q) => q.eq("key", CONTROL_KEY))
      .unique();
    const patch = {
      enabled: args.enabled,
      updatedAt: Date.now(),
      reason: args.reason,
      updatedBy: args.updatedBy,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("bulkOperationsControl", { key: CONTROL_KEY, ...patch });
    }
    return null;
  },
});
