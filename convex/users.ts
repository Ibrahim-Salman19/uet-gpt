import { ConvexError, v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireAdmin } from "./auth";
import { userValidator } from "./users/validator";

function getInitialRole(email: string, emailVerified = true): "admin" | "user" {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  if (!bootstrapEmail || !emailVerified) return "user";
  // Case-insensitive comparison: email addresses are not case-sensitive in the
  // local-part for practical purposes and domains are case-insensitive, so a
  // mismatch like "Admin@x.com" vs "admin@x.com" must not silently skip bootstrap.
  return email.trim().toLowerCase() === bootstrapEmail.trim().toLowerCase() ? "admin" : "user";
}

const MAX_NAME_LENGTH = 256;

// Bound the client-supplied display name. Clerk (the trustworthy source via the
// webhook) populates this too, but the interactive getOrCreate path takes it
// straight from the client, so cap length to avoid storing oversized strings.
function sanitizeName(name: string): string {
  return name.trim().slice(0, MAX_NAME_LENGTH);
}

// Only persist a client-supplied avatar URL if it is a well-formed https URL.
// Anything else (javascript:, data:, http:, malformed) is dropped so it cannot
// become an SSRF/tracking/attribute-injection vector when later rendered.
function sanitizeImageUrl(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  try {
    const parsed = new URL(imageUrl);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
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

    const name = sanitizeName(args.name);
    const imageUrl = sanitizeImageUrl(args.imageUrl);

    if (existing) {
      if (!existing.isActive) {
        throw new ConvexError("Your account has been deactivated.");
      }
      await ctx.db.patch(existing._id, {
        name,
        email: email,
        imageUrl: imageUrl ?? existing.imageUrl,
        lastLoginAt: Date.now(),
      });
      return existing._id;
    }

    // Only honor the bootstrap-admin grant for a verified email to avoid an
    // account-takeover vector via an unverified address matching the bootstrap.
    const finalRole = getInitialRole(email, identity.emailVerified === true);

    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name,
      email: email,
      ...(imageUrl && { imageUrl }),
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
      if (
        !caller ||
        !caller.isActive ||
        (caller.role !== "admin" && caller.role !== "superadmin")
      ) {
        return null;
      }
    }

    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
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
  returns: v.null(),
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

    // Explicit field allowlist: only merge the four permitted preference fields,
    // and only when actually provided, so a partial update never clobbers an
    // existing value with `undefined` and a future-widened args validator cannot
    // leak unintended keys into stored preferences.
    const currentPrefs = user.preferences ?? {};
    const nextPrefs = { ...currentPrefs };
    if (args.theme !== undefined) nextPrefs.theme = args.theme;
    if (args.language !== undefined) nextPrefs.language = args.language;
    if (args.fontSize !== undefined) nextPrefs.fontSize = args.fontSize;
    if (args.model !== undefined) nextPrefs.model = args.model;

    await ctx.db.patch(user._id, {
      preferences: nextPrefs,
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
      // Webhook only syncs identity fields - role is never touched here
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
      // Cascade-delete the user's feedback rows (PII-linked comments) so account
      // deletion does not leave orphaned, indefinitely-retained records (GDPR erasure).
      let isDone = false;
      let cursor: string | null = null;
      while (!isDone) {
        const batch = await ctx.db
          .query("feedback")
          .withIndex("by_userId", (q) => q.eq("userId", existing._id))
          .paginate({ numItems: 200, cursor });
        await Promise.all(batch.page.map((row) => ctx.db.delete(row._id)));
        cursor = batch.continueCursor;
        isDone = batch.isDone;
      }

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
    return await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .unique();
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

    const previousRole = targetUser.role;
    await ctx.db.patch(targetUser._id, {
      role: args.role,
    });

    // Tamper-evident record of privileged role changes (OWASP A09).
    await ctx.db.insert("adminAuditLog", {
      userId: caller._id,
      action: "role.change",
      target: args.clerkId,
      details: {
        oldValue: previousRole,
        newValue: args.role,
      },
      createdAt: Date.now(),
    });
  },
});
