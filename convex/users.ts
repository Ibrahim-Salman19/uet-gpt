import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { userValidator } from "./users/validator";

export const getOrCreate = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    secret: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    let isAuthorized = false;

    // 1. Check if called from trusted Clerk Webhook with the correct shared secret
    if (args.secret && process.env.WEBHOOK_SECRET && args.secret === process.env.WEBHOOK_SECRET) {
      isAuthorized = true;
    } else {
      // 2. Fallback to standard frontend user identity authentication
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new ConvexError("Authentication required");
      }
      if (identity.subject !== args.clerkId) {
        throw new ConvexError("Unauthorized: clerkId mismatch");
      }
      isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new ConvexError("Unauthorized");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: args.email,
      ...(args.imageUrl && { imageUrl: args.imageUrl }),
      role: "user",
      isActive: true,
      lastLoginAt: Date.now(),
    });
    return id;
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  returns: v.union(v.null(), userValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    if (identity.subject !== args.clerkId) {
      const caller = await ctx.db
        .query("users")
        .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
        .unique();
      if (!caller || (caller.role !== "admin" && caller.role !== "superadmin")) {
        return null;
      }
    }

    return (await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique()) as unknown as typeof userValidator.type;
  },
});
