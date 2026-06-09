import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

async function findUser(
  ctx: QueryCtx | MutationCtx,
): Promise<{ identity: { subject: string } | null; user: Doc<"users"> | null }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return { identity: null, user: null };
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return { identity, user };
}

export async function getUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const { user } = await findUser(ctx);
  return user ? (user._id as Id<"users">) : null;
}

export async function isAuthenticated(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  return identity !== null;
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const { user } = await findUser(ctx);
  return user?.role === "admin" || user?.role === "superadmin";
}

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { identity, user } = await findUser(ctx);
  if (!identity) throw new ConvexError("Authentication required");
  if (!user) throw new ConvexError("User not found");
  return user;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { identity, user } = await findUser(ctx);
  if (!identity) throw new ConvexError("Authentication required");
  if (!user || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new ConvexError("Admin access required");
  }
  return user;
}
