import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";

export const getSettings = query({
  args: { section: v.optional(v.string()) },
  handler: async (ctx, { section }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) return [];

    const builder = section
      ? ctx.db.query("appSettings").withIndex("by_section", (q) => q.eq("section", section))
      : ctx.db.query("appSettings");
    return await builder.collect();
  },
});

export const upsertSetting = mutation({
  args: {
    key: v.string(),
    value: v.union(v.string(), v.number(), v.boolean()),
    section: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError("Admin access required");
    }

    const existing = await ctx.db
      .query("appSettings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
        updatedBy: user._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: args.key,
        value: args.value,
        section: args.section,
        updatedAt: Date.now(),
        updatedBy: user._id,
      });
    }
  },
});

export const resetSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Authentication required");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
      throw new ConvexError("Admin access required");
    }

    const all = await ctx.db.query("appSettings").collect();
    for (const setting of all) {
      await ctx.db.delete(setting._id);
    }
  },
});
