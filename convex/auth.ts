import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type Permission =
  | "chat:send"
  | "doc:read"
  | "crawl:trigger"
  | "crawl:list"
  | "doc:delete"
  | "settings:manage"
  | "users:manage"
  | "emergency:stop";

// CANONICAL permission matrix - server-side source of truth.
// Client-side mirror at src/lib/permissions.ts must be kept in sync.
// When adding permissions, update both files.
type Role = "user" | "admin" | "superadmin";

/** Compile-time exhaustiveness guard: errors if the role union grows without
 * a matching ROLE_PERMISSIONS entry. */
function assertNever(value: never): never {
  throw new ConvexError(`Unhandled role: ${String(value)}`);
}

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: ["chat:send", "doc:read"],
  admin: [
    "chat:send",
    "doc:read",
    "crawl:trigger",
    "crawl:list",
    "doc:delete",
    "settings:manage",
    "users:manage",
  ],
  superadmin: [
    "chat:send",
    "doc:read",
    "crawl:trigger",
    "crawl:list",
    "doc:delete",
    "settings:manage",
    "users:manage",
    "emergency:stop",
  ],
};

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

export async function isAuthenticated(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const { identity, user } = await findUser(ctx);
  return identity !== null && user?.isActive === true;
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  const { user } = await findUser(ctx);
  return Boolean(user?.isActive) && (user?.role === "admin" || user?.role === "superadmin");
}

export async function requireAuth(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { identity, user } = await findUser(ctx);
  if (!identity) throw new ConvexError("Authentication required");
  if (!user) throw new ConvexError("User not found");
  if (!user.isActive) throw new ConvexError("User account is deactivated");
  return user;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const { identity, user } = await findUser(ctx);
  if (!identity) throw new ConvexError("Authentication required");
  if (!user || !user.isActive || (user.role !== "admin" && user.role !== "superadmin")) {
    throw new ConvexError("Admin access required");
  }
  return user;
}

export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  permission: Permission,
): Promise<Doc<"users">> {
  const { identity, user } = await findUser(ctx);
  if (!identity) throw new ConvexError("Authentication required");
  if (!user) throw new ConvexError("User not found");
  if (!user.isActive) throw new ConvexError("User account is deactivated");

  const role = user.role as Role;
  const userPerms = ROLE_PERMISSIONS[role];
  // Fail closed on an unrecognized role (e.g. after a future schema change):
  // assertNever throws so callers never get silent allow-through.
  if (!userPerms) {
    assertNever(role as never);
  }
  if (!userPerms.includes(permission)) {
    throw new ConvexError(`Insufficient permissions: requires "${permission}"`);
  }
  return user;
}
