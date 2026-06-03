import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { isAdmin, requireAdmin } from "../auth";

export const getSettings = query({
  args: { section: v.optional(v.string()) },
  handler: async (ctx, { section }) => {
    const admin = await isAdmin(ctx);
    if (!admin) return [];

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
    const user = await requireAdmin(ctx);

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
    await requireAdmin(ctx);

    const all = await ctx.db.query("appSettings").take(1000);
    for (const setting of all) {
      await ctx.db.delete(setting._id);
    }
  },
});
