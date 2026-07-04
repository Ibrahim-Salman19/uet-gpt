import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// Mirror of the adminAuditLog.action union in schema.ts — keep in sync.
const auditActionValidator = v.union(
  v.literal("user.login"),
  v.literal("user.logout"),
  v.literal("user.create"),
  v.literal("thread.create"),
  v.literal("thread.delete"),
  v.literal("document.create"),
  v.literal("document.delete"),
  v.literal("crawl.start"),
  v.literal("crawl.stop"),
  v.literal("feedback.submit"),
  v.literal("settings.update"),
  v.literal("admin.access"),
  v.literal("metrics.summary"),
  v.literal("metrics.errors"),
  v.literal("metrics.performance"),
  v.literal("staleness.check"),
  v.literal("role.change"),
);

// Mirror of the documents.status union in schema.ts — keep in sync.
const documentStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("indexed"),
  v.literal("failed"),
  v.literal("stale"),
  v.literal("active"),
  v.literal("pending_embed"),
);

export const getSettingsBySection = internalQuery({
  args: { section: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("appSettings"),
      key: v.string(),
      value: v.union(v.string(), v.number(), v.boolean()),
      section: v.string(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("appSettings")
      .withIndex("by_section", (q) => q.eq("section", args.section))
      .take(200);
    return results.map((r) => ({
      _id: r._id,
      key: r.key,
      value: r.value,
      section: r.section,
      updatedAt: r.updatedAt,
    }));
  },
});

export const getAdminUsers = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      clerkId: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    if (admin) return [{ _id: admin._id, clerkId: admin.clerkId }];
    const superadmin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superadmin"))
      .first();
    if (superadmin) return [{ _id: superadmin._id, clerkId: superadmin.clerkId }];
    return [];
  },
});

export const insertAuditLog = internalMutation({
  args: {
    action: auditActionValidator,
    target: v.optional(v.string()),
    details: v.optional(
      v.object({
        oldValue: v.optional(v.string()),
        newValue: v.optional(v.string()),
        reason: v.optional(v.string()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .first();
    const superadmin = admin
      ? null
      : await ctx.db
          .query("users")
          .withIndex("by_role", (q) => q.eq("role", "superadmin"))
          .first();
    const userId = admin?._id ?? superadmin?._id;
    if (!userId) {
      console.warn("[AUDIT] No admin user found to associate audit log entry");
      return;
    }

    await ctx.db.insert("adminAuditLog", {
      userId,
      action: args.action,
      target: args.target,
      details: args.details,
      createdAt: Date.now(),
    });
  },
});

export const countDocumentsByStatus = internalQuery({
  args: { status: documentStatusValidator },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const pageResult = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .paginate({ numItems: 1000, cursor });
      count += pageResult.page.length;
      cursor = pageResult.continueCursor;
      isDone = pageResult.isDone;
    }
    return count;
  },
});

export const countAllDocuments = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let count = 0;
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const pageResult = await ctx.db.query("documents").paginate({ numItems: 1000, cursor });
      count += pageResult.page.length;
      cursor = pageResult.continueCursor;
      isDone = pageResult.isDone;
    }
    return count;
  },
});

export const getStaleAndTotalCount = internalQuery({
  args: { now: v.number() },
  returns: v.object({
    total: v.number(),
    stale: v.number(),
  }),
  handler: async (ctx, args) => {
    const threshold = args.now - 30 * 24 * 60 * 60 * 1000;
    let total = 0;
    let stale = 0;
    let cursor: string | null = null;
    let isDone = false;

    // Single-pass table scan to compute both total and stale document counts.
    // This reduces read amplification and avoids double-reading documents that
    // have both status='stale' and are older than the freshness threshold.
    while (!isDone) {
      const pageResult = await ctx.db.query("documents").paginate({ numItems: 1000, cursor });
      total += pageResult.page.length;
      for (const d of pageResult.page) {
        const isStaleStatus = d.status === "stale";
        const isStaleAge = d.freshnessTier === "low" && d.crawledAt <= threshold;
        if (isStaleStatus || isStaleAge) {
          stale++;
        }
      }
      cursor = pageResult.continueCursor;
      isDone = pageResult.isDone;
    }

    return { total, stale };
  },
});

export const getStaleDocumentCount = internalQuery({
  args: { now: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const res = await getStaleAndTotalCount.handler(ctx, args);
    return res.stale;
  },
});

