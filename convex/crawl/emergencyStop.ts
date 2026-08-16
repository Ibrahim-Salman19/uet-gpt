import { ConvexError, v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalMutation } from "../_generated/server";
import {
  CRAWL_WORKPOOL_MAX_PARALLELISM,
  EMBEDDING_WORKPOOL_MAX_PARALLELISM,
  crawlPool,
  embeddingPool,
} from "./workpools";

// Emergency stop for the free-tier resource-limit incident documented in
// docs/rag-store-evaluation/fresh-corpus-crawl-2026-08/. The local Python
// crawler process was killed, but the embeddingPool Workpool (convex/crawl/
// workpools.ts) runs server-side and keeps retrying its already-queued jobs
// independent of that process - confirmed still active via `npx convex logs`
// (embedSingleChunk hitting the same exhausted Gemini free-tier daily embed
// quota) well after the local process exited. cancelAll only cancels PENDING
// work; anything already running is allowed to finish but will not retry.
// internalMutation, not a public mutation: this is operational/administrative
// (stopping runaway resource consumption), not a change to retrieval
// semantics, and follows the same internal-only security discipline as
// lifecycleTest.ts / evalRetrieval.ts. Only reachable via the admin-gated
// emergencyStopBulkOperations action below (or another server-side caller).
export const cancelPendingEmbeddingWork = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await embeddingPool.cancelAll(ctx);
    await crawlPool.cancelAll(ctx);
    return null;
  },
});

// Canonical admin authorization for actions (matches rag/testing.ts's
// requireAdminAuth): derive the role from the DB record of the authenticated
// user, not an untyped JWT claim. Fails closed, enforces isActive, and
// returns the actor's id for audit attribution.
async function requireAdminAuth(ctx: ActionCtx): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }
  const user = await ctx.runQuery(internal.users.getByClerkIdInternal, {
    clerkId: identity.subject,
  });
  if (!user || !user.isActive || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new ConvexError("Admin access required");
  }
  return user._id;
}

/**
 * The one real, wired emergency-stop entrypoint (August 2026 incident
 * remediation - resource-safety mandate sections 9/19/20/21). Admin-gated,
 * addresses BOTH crawlPool and embeddingPool, and does not just cancel
 * pending work - it also stops workers from starting anything new
 * (maxParallelism: 0, durable - not process memory) and stops the PRODUCER
 * from admitting replacement work (the bulkOperationsControl kill switch),
 * since either alone is insufficient (mandate section 39).
 *
 * Correct semantics, honestly reported rather than claimed as instant:
 *   pending work    -> canceled (self-paginating; see cancelAll's component
 *                       implementation, which reschedules itself until the
 *                       whole queue is covered - one call here is enough
 *                       regardless of queue depth)
 *   running work    -> allowed to finish, will NOT retry
 *   the producer    -> disabled (assertBulkOperationsEnabled call sites)
 *   workers         -> maxParallelism 0, cannot start anything new even from
 *                       already-pending-but-not-yet-cancelled work
 */
export const emergencyStopBulkOperations = action({
  args: { reason: v.optional(v.string()) },
  returns: v.object({
    pendingCanceled: v.boolean(),
    runningJobsMayStillBeFinishing: v.boolean(),
    producerDisabled: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args) => {
    const actorUserId = await requireAdminAuth(ctx);

    // Order matters: disable the producer FIRST. Every enqueue call site
    // (assertEmbeddingBacklogHasRoom, trigger.ts, workflow.ts,
    // retryDeadLetterQueue, reembedPendingBatch) checks this before ever
    // calling embeddingPool/crawlPool's enqueue methods - and each enqueue
    // call resends this pool's configured maxParallelism to the component
    // (see workpools.ts's Workpool constructor options), which would
    // silently undo the maxParallelism:0 below if a concurrent enqueue
    // slipped in between the two steps.
    await ctx.runMutation(internal.crawl.bulkOperationsControl.setBulkOperationsEnabled, {
      enabled: false,
      reason: args.reason ?? "Manual emergency stop",
      updatedBy: actorUserId,
    });

    await ctx.runMutation(components.embeddingWorkpool.config.update, { maxParallelism: 0 });
    await ctx.runMutation(components.crawlWorkpool.config.update, { maxParallelism: 0 });

    await ctx.runMutation(internal.crawl.emergencyStop.cancelPendingEmbeddingWork, {});

    // Mark in-flight application state (documents/crawlJobs) so the UI
    // reflects the stop, reusing the existing bounded/paginated/audited driver.
    await ctx.runAction(internal.emergencyStop.stopAll, { actorUserId });

    return {
      pendingCanceled: true,
      runningJobsMayStillBeFinishing: true,
      producerDisabled: true,
      message:
        "Pending work canceled and the producer is disabled. Work already RUNNING when this " +
        "was called may still finish (it will not retry). Verify pending/running counts reach " +
        "zero before considering this fully drained - see " +
        "docs/runbooks/resource-safety-incident-response.md.",
    };
  },
});

export const auditResumeBulkOperations = internalMutation({
  args: { actorUserId: v.id("users"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("adminAuditLog", {
      userId: args.actorUserId,
      action: "bulk_operations.resume",
      target: "bulk_operations",
      details: { reason: args.reason ?? "Manual resume" },
      createdAt: Date.now(),
    });
    return null;
  },
});

/**
 * Deliberately separate from the stop action, not a generic toggle - resume
 * is meant to be a distinct, intentional decision an operator makes only
 * after verifying it is safe (resource-safety mandate section 19: "ONLY
 * THEN RESUME"), not a side effect of some other call. Restores both pools'
 * maxParallelism to their normal configured values (workpools.ts) and
 * re-enables the producer-side kill switch.
 */
export const resumeBulkOperations = action({
  args: { reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actorUserId = await requireAdminAuth(ctx);

    await ctx.runMutation(components.embeddingWorkpool.config.update, {
      maxParallelism: EMBEDDING_WORKPOOL_MAX_PARALLELISM,
    });
    await ctx.runMutation(components.crawlWorkpool.config.update, {
      maxParallelism: CRAWL_WORKPOOL_MAX_PARALLELISM,
    });
    await ctx.runMutation(internal.crawl.bulkOperationsControl.setBulkOperationsEnabled, {
      enabled: true,
      reason: args.reason ?? "Manual resume",
      updatedBy: actorUserId,
    });
    await ctx.runMutation(internal.crawl.emergencyStop.auditResumeBulkOperations, {
      actorUserId,
      reason: args.reason,
    });
    return null;
  },
});
