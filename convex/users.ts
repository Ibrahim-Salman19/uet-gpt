import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { userValidator } from "./users/validator";

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

    // First-admin bootstrap: auto-promote user matching ADMIN_BOOTSTRAP_EMAIL
    const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
    const finalRole = bootstrapEmail && email === bootstrapEmail ? "admin" : "user";

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
    role: v.optional(v.union(v.literal("user"), v.literal("admin"), v.literal("superadmin"))),
  },
  handler: async (ctx, args) => {
    const validRoles = ["user", "admin", "superadmin"] as const;
    const role = args.role && validRoles.includes(args.role) ? args.role : "user";

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      const patch: Partial<{
        name: string;
        email: string;
        imageUrl: string;
        role: typeof role;
        lastLoginAt: number;
      }> = {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        lastLoginAt: Date.now(),
      };

      const oldRole = existing.role;
      // Only update role if explicitly provided (prevents overwriting with default)
      if (args.role && validRoles.includes(args.role)) {
        patch.role = args.role;
      }

      await ctx.db.patch(existing._id, patch);

      // Audit log for role changes
      const newRole = patch.role ?? oldRole;
      if (newRole !== oldRole) {
        await ctx.db.insert("adminAuditLog", {
          userId: existing._id,
          action: "role.change",
          target: existing.clerkId,
          details: {
            oldValue: oldRole,
            newValue: newRole,
          },
          createdAt: Date.now(),
        });
      }
    } else {
      // First-admin bootstrap: applied only on creation, not on subsequent webhook events.
      // Bootstrap users who are deliberately demoted to "user" stay demoted.
      const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
      const finalRole = bootstrapEmail && args.email === bootstrapEmail ? "admin" : role;

      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: args.name,
        email: args.email,
        ...(args.imageUrl && { imageUrl: args.imageUrl }),
        role: finalRole,
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
