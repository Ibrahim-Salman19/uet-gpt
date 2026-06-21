import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

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
    action: v.string(),
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
      action: args.action as any,
      target: args.target,
      details: args.details,
      createdAt: Date.now(),
    });
  },
});

export const countDocumentsByStatus = internalQuery({
  args: { status: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const pageResult = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
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

export const getStaleDocumentCount = internalQuery({
  args: { now: v.number() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const threshold = args.now - 30 * 24 * 60 * 60 * 1000;
    const seen = new Set<string>();

    let cursorFlag: string | null = null;
    let doneFlag = false;
    while (!doneFlag) {
      const page = await ctx.db
        .query("documents")
        .withIndex("by_status", (q) => q.eq("status", "stale"))
        .paginate({ numItems: 1000, cursor: cursorFlag });
      for (const d of page.page) {
        seen.add(d._id);
      }
      cursorFlag = page.continueCursor;
      doneFlag = page.isDone;
    }

    let cursorAge: string | null = null;
    let doneAge = false;
    while (!doneAge) {
      const page = await ctx.db
        .query("documents")
        .withIndex("by_tier_and_crawled", (q) =>
          q.eq("freshnessTier", "low").lte("crawledAt", threshold),
        )
        .paginate({ numItems: 1000, cursor: cursorAge });
      for (const d of page.page) {
        seen.add(d._id);
      }
      cursorAge = page.continueCursor;
      doneAge = page.isDone;
    }

    return seen.size;
  },
});
