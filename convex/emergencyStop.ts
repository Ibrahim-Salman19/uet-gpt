import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
// Note: Internal-only functions - no auth check needed.
// Callers (cron/admin mutations) must guard access before invoking.
// See: requirePermission(ctx, "emergency:stop") on external entry points.

export const stopBatch = internalMutation({
  args: {
    shouldLog: v.optional(v.boolean()),
    // Id of the user who triggered the emergency stop, threaded through from the
    // authorized entry point (requirePermission("emergency:stop")). When set, the
    // audit row is attributed to the real actor instead of an arbitrary admin.
    actorUserId: v.optional(v.id("users")),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(100);
    const jobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(100);
    await Promise.all([
      ...docs.map((d) => ctx.db.patch(d._id, { status: "failed" })),
      ...jobs.map((j) => ctx.db.patch(j._id, { status: "cancelled" })),
    ]);

    // Audit log for emergency stop
    if ((docs.length > 0 || jobs.length > 0) && (args.shouldLog ?? true)) {
      // Prefer the real actor; fall back to a superadmin/admin only when the
      // caller did not supply one (legacy server-to-server invocation).
      let auditUserId = args.actorUserId ?? null;
      if (!auditUserId) {
        let adminUser = await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "superadmin"))
          .first();
        if (!adminUser) {
          adminUser = await ctx.db
            .query("users")
            .withIndex("by_role", (q) => q.eq("role", "admin"))
            .first();
        }
        auditUserId = adminUser?._id ?? null;
      }
      if (auditUserId) {
        await ctx.db.insert("adminAuditLog", {
          userId: auditUserId,
          action: "crawl.stop",
          target: "emergency_stop",
          details: {
            reason: `Emergency stop: ${docs.length} documents failed, ${jobs.length} jobs cancelled`,
          },
          createdAt: Date.now(),
        });
      }
    }

    return docs.length === 100 || jobs.length === 100;
  },
});

export const stopAll = internalAction({
  args: {
    isFirstRun: v.optional(v.boolean()),
    actorUserId: v.optional(v.id("users")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const isFirst = args.isFirstRun ?? true;
    const hasMore = await ctx.runMutation(internal.emergencyStop.stopBatch, {
      shouldLog: isFirst,
      actorUserId: args.actorUserId,
    });
    if (hasMore) {
      await ctx.scheduler.runAfter(0, internal.emergencyStop.stopAll, {
        isFirstRun: false,
        actorUserId: args.actorUserId,
      });
    } else {
      console.log("Emergency stop complete.");
    }
  },
});

export default stopAll;
