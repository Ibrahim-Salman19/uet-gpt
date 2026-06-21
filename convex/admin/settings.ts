import { ConvexError, v } from "convex/values";
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
    return await builder.take(200);
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

export const upsertSettingsBatch = mutation({
  args: {
    settings: v.array(
      v.object({
        key: v.string(),
        value: v.union(v.string(), v.number(), v.boolean()),
        section: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireAdmin(ctx);

    const allSettings = await ctx.db.query("appSettings").take(200);
    const existingMap = new Map(allSettings.map((s) => [s.key, s]));

    for (const setting of args.settings) {
      const existing = existingMap.get(setting.key);
      if (existing) {
        await ctx.db.patch(existing._id, {
          value: setting.value,
          updatedAt: Date.now(),
          updatedBy: user._id,
        });
      } else {
        await ctx.db.insert("appSettings", {
          key: setting.key,
          value: setting.value,
          section: setting.section,
          updatedAt: Date.now(),
          updatedBy: user._id,
        });
      }
    }
  },
});

export const resetSettings = mutation({
  args: { confirm: v.boolean() },
  handler: async (ctx, args) => {
    if (!args.confirm) throw new ConvexError("Confirmation required to reset settings.");
    const user = await requireAdmin(ctx);
    if (user.role !== "superadmin") {
      throw new ConvexError("Superadmin access required to reset all settings.");
    }

    let cursor: string | null = null;
    let done = false;
    let totalDeleted = 0;
    while (!done) {
      const page = await ctx.db.query("appSettings").paginate({ numItems: 100, cursor });
      if (page.page.length > 0) {
        await Promise.all(page.page.map((s) => ctx.db.delete(s._id)));
        totalDeleted += page.page.length;
      }
      done = page.isDone;
      cursor = page.continueCursor;
    }
    return { deleted: totalDeleted };
  },
});
