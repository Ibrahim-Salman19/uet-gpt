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
} as const;

/**
 * Check if a role has a specific permission.
 * Roles are hierarchical: superadmin includes all admin permissions, admin includes all user permissions.
 */
export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  const validRole = role as Role;
  if (!(validRole in ROLE_PERMISSIONS)) return false;
  return ROLE_PERMISSIONS[validRole].includes(permission);
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
  const validRole = role as Role;
  if (!(validRole in ROLE_PERMISSIONS)) return [];
  return ROLE_PERMISSIONS[validRole];
}
