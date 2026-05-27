import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function getUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) return null;
  return user._id as Id<"users">;
}

export async function isAuthenticated(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  return identity !== null;
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?.role === "admin" || user?.role === "superadmin";
}
