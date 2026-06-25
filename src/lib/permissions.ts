/**
 * Client-side permission matrix — mirror of convex/auth.ts (canonical source).
 * Keep in sync with convex/auth.ts when adding/modifying permissions.
 *
 * Roles: user → admin → superadmin (hierarchical — higher roles include lower permissions)
 *
 * Usage:
 *   import { hasPermission } from "@/lib/permissions";
 *   if (!hasPermission(user.role, "crawl:trigger")) {
 *     throw new ConvexError("Insufficient permissions");
 *   }
 *
 * Server-side source of truth: convex/auth.ts
 * This file is a derived copy for client/server-action use.
 */

export type Role = "user" | "admin" | "superadmin";

export type Permission =
  | "chat:send"
  | "doc:read"
  | "crawl:trigger"
  | "crawl:list"
  | "doc:delete"
  | "settings:manage"
  | "users:manage"
  | "emergency:stop";

// Permissions granted *additionally* at each level. Roles are composed
// hierarchically below so higher roles always include lower-role permissions
// by construction — the lists cannot drift relative to each other.
//
// NOTE: this must stay in sync with the canonical matrix in convex/auth.ts
// across the trust boundary. See the CI diff test recommendation in the audit.
const USER_PERMISSIONS: readonly Permission[] = ["chat:send", "doc:read"];
const ADMIN_EXTRA: readonly Permission[] = [
  "crawl:trigger",
  "crawl:list",
  "doc:delete",
  "settings:manage",
  "users:manage",
];
const SUPERADMIN_EXTRA: readonly Permission[] = ["emergency:stop"];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  user: USER_PERMISSIONS,
  admin: [...USER_PERMISSIONS, ...ADMIN_EXTRA],
  superadmin: [...USER_PERMISSIONS, ...ADMIN_EXTRA, ...SUPERADMIN_EXTRA],
} as const;

/**
 * Type guard for the known {@link Role} literals.
 */
function isRole(role: unknown): role is Role {
  return typeof role === "string" && role in ROLE_PERMISSIONS;
}

/**
 * Check if a role has a specific permission.
 * Roles are hierarchical: superadmin includes all admin permissions, admin includes all user permissions.
 */
export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Check if a role is an admin-level role.
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "superadmin";
}

/**
 * Get all permissions for a role.
 */
export function getPermissionsForRole(role: string | undefined | null): readonly Permission[] {
  if (!isRole(role)) return [];
  return ROLE_PERMISSIONS[role];
}
