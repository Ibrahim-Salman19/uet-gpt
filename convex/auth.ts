import type { Id } from "./_generated/dataModel";

export async function getUserId(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  db: {
    query: (table: "users") => {
      withIndex: (
        name: "by_clerkId",
        fn: (q: { eq: (field: "clerkId", value: string) => unknown }) => unknown,
      ) => { unique: () => Promise<{ _id: Id<"users"> } | null> };
    };
  };
}): Promise<Id<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?._id ?? null;
}

export async function isAuthenticated(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
}): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  return identity !== null;
}

export async function isAdmin(ctx: {
  auth: { getUserIdentity: () => Promise<{ subject: string } | null> };
  db: {
    query: (table: "users") => {
      withIndex: (
        name: "by_clerkId",
        fn: (q: { eq: (field: "clerkId", value: string) => unknown }) => unknown,
      ) => { unique: () => Promise<{ _id: Id<"users">; role: string } | null> };
    };
    get: (id: Id<"users">) => Promise<{ role: string } | null>;
  };
}): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
    .unique();
  return user?.role === "admin" || user?.role === "superadmin";
}
