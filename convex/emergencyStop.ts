import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";
// Note: Internal-only functions — no auth check needed.
// Callers (cron/admin mutations) must guard access before invoking.
// See: requirePermission(ctx, "emergency:stop") on external entry points.

export const stopBatch = internalMutation({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .take(500);
    for (const d of docs) {
      await ctx.db.patch(d._id, { status: "failed" });
    }

    const jobs = await ctx.db
      .query("crawlJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .take(500);
    for (const j of jobs) {
      await ctx.db.patch(j._id, { status: "cancelled" });
    }

    // Audit log for emergency stop
    if (docs.length > 0 || jobs.length > 0) {
      const adminUser = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "superadmin"))
        .first();
      if (adminUser) {
        await ctx.db.insert("adminAuditLog", {
          userId: adminUser._id,
          action: "crawl.stop",
          target: "emergency_stop",
          details: {
            reason: `Emergency stop: ${docs.length} documents failed, ${jobs.length} jobs cancelled`,
          },
          createdAt: Date.now(),
        });
      }
    }

    return docs.length === 500 || jobs.length === 500;
  },
});

export const stopAll = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    let hasMore = true;
    while (hasMore) {
      hasMore = await ctx.runMutation(internal.emergencyStop.stopBatch);
    }
    console.log("Emergency stop complete.");
  },
});

export default stopAll;
