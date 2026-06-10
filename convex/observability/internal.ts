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
      .collect();
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
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    const superadmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superadmin"))
      .collect();
    return [...admins, ...superadmins].map((u) => ({
      _id: u._id,
      clerkId: u.clerkId,
    }));
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
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    const superadmins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "superadmin"))
      .collect();
    const allAdmins = [...admins, ...superadmins];
    const userId = allAdmins.length > 0 ? allAdmins[0]!._id : undefined;
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
    const docs = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", args.status as any))
      .take(100000);
    return docs.length;
  },
});

export const countAllDocuments = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const docs = await ctx.db.query("documents").take(100000);
    return docs.length;
  },
});

export const getStaleDocumentCount = internalQuery({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const staleByFlag = await ctx.db
      .query("documents")
      .withIndex("by_status", (q) => q.eq("status", "stale"))
      .take(100000);

    const staleByAge = await ctx.db
      .query("documents")
      .withIndex("by_tier_and_crawled", (q) =>
        q.eq("freshnessTier", "low").lte("crawledAt", threshold),
      )
      .take(100000);

    const seen = new Set<string>();
    for (const d of staleByFlag) seen.add(d._id);
    for (const d of staleByAge) seen.add(d._id);
    return seen.size;
  },
});
