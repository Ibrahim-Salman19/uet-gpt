import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
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

    // 1. Check if called from trusted Clerk Webhook with the correct signature secret
    if (
      args.secret &&
      process.env.CLERK_SIGNING_SECRET &&
      args.secret === process.env.CLERK_SIGNING_SECRET
    ) {
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
      await ctx.db.patch(existing._id as Id<"users">, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? (existing.imageUrl as string | undefined),
        lastLoginAt: Date.now(),
      });
      return existing._id as Id<"users">;
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
    return id as Id<"users">;
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex GenericDocument unique return doesn't match validator type
      .unique()) as any;
  },
});
