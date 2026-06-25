import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireAuth } from "../auth";
import { documentValidator } from "./validator";

export const get = query({
  args: { documentId: v.id("documents") },
  returns: v.union(documentValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.documentId);
  },
});

export const getByUrl = query({
  args: { url: v.string() },
  returns: v.union(documentValidator, v.null()),
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db
      .query("documents")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
  },
});
