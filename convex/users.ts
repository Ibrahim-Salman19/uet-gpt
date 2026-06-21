import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { userValidator } from "./users/validator";

function getInitialRole(email: string): "admin" | "user" {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  return bootstrapEmail && email === bootstrapEmail ? "admin" : "user";
}

export const getOrCreate = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    if (identity.subject !== args.clerkId) {
      throw new ConvexError("Unauthorized: clerkId mismatch");
    }
    const email = identity.email;
    if (!email) {
      throw new ConvexError("Email is required in Clerk identity");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      if (!existing.isActive) {
        throw new ConvexError("Your account has been deactivated.");
      }
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: email,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    const finalRole = getInitialRole(email);

    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      email: email,
      ...(args.imageUrl && { imageUrl: args.imageUrl }),
      role: finalRole,
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
      .unique()) as typeof userValidator.type;
  },
});

export const deactivateUser = mutation({
  args: {
    clerkId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    if (identity.subject !== args.clerkId) {
      throw new ConvexError("Unauthorized: clerkId mismatch");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!existing) {
      return null;
    }

    await ctx.db.patch(existing._id, {
      isActive: false,
      name: "Deleted User",
      email: "",
      imageUrl: undefined,
    });
  },
});

export const updatePreferences = mutation({
  args: {
    theme: v.optional(v.string()),
    language: v.optional(v.string()),
    fontSize: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) {
      throw new ConvexError("User not found");
    }

    const currentPrefs = user.preferences ?? {};
    await ctx.db.patch(user._id, {
      preferences: {
        ...currentPrefs,
        ...args,
      },
    });
  },
});

export const upsertFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      // Webhook only syncs identity fields — role is never touched here
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        lastLoginAt: Date.now(),
      });
    } else {
      const role = getInitialRole(args.email);

      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: args.name,
        email: args.email,
        ...(args.imageUrl && { imageUrl: args.imageUrl }),
        role,
        isActive: true,
        lastLoginAt: Date.now(),
      });
    }
  },
});

export const deleteFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        isActive: false,
        name: "Deleted User",
        email: "",
        imageUrl: undefined,
      });
    }
  },
});

const ROLE_HIERARCHY: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };

export const getByClerkIdInternal = internalQuery({
  args: { clerkId: v.string() },
  returns: v.union(v.null(), userValidator),
  handler: async (ctx, args) => {
    return (await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique()) as typeof userValidator.type;
  },
});

export const updateUserRole = mutation({
  args: {
    clerkId: v.string(),
    role: v.union(v.literal("user"), v.literal("admin"), v.literal("superadmin")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await requireAdmin(ctx);

    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!targetUser) {
      throw new ConvexError("User not found");
    }

    const callerLevel = ROLE_HIERARCHY[caller.role] ?? 0;
    const targetAssignedLevel = ROLE_HIERARCHY[args.role] ?? 0;
    if (targetAssignedLevel > callerLevel) {
      throw new ConvexError("Cannot assign a role above your own");
    }

    const targetCurrentLevel = ROLE_HIERARCHY[targetUser.role] ?? 0;
    if (targetCurrentLevel >= callerLevel) {
      throw new ConvexError("Cannot modify a user with a role equal to or above your own");
    }

    await ctx.db.patch(targetUser._id, {
      role: args.role,
    });
  },
});
