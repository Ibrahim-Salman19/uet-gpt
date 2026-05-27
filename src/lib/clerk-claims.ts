/**
 * Custom session claims from Clerk JWT template.
 *
 * Configure a Clerk JWT template that maps user.publicMetadata.role
 * to a claim (e.g., "metadata.role") so the middleware can enforce
 * admin authorization at the edge without a Convex round-trip.
 *
 * JWT template claim mapping suggestion:
 *   - "metadata": { "role": "{{user.publicMetadata.role}}" }
 *
 * @see https://clerk.com/docs/backend-requests/making/custom-session-token
 */
export interface ClerkSessionClaims {
  /** Standard Clerk claim — user identifier */
  sub?: string;
  /** Standard Clerk claim — session identifier */
  sid?: string;
  /** Standard Clerk claim — organization identifier */
  org_id?: string;
  /** Standard Clerk claim — organization role */
  org_role?: string;
  /** Custom metadata injected via JWT template */
  metadata?: {
    /** User role: "user" | "admin" | "superadmin" */
    role?: string;
    /** Additional custom metadata fields */
    [key: string]: unknown;
  };
  /** Allow additional custom top-level claims */
  [key: string]: unknown;
}

/** Admin roles that have access to protected admin routes */
export const ADMIN_ROLES = ["admin", "superadmin"] as const;

/**
 * Check if a user role is an admin-level role.
 */
export function isAdminRole(role: string | undefined | null): boolean {
  return ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number]);
}

/**
 * Extract the user role from Clerk session claims.
 * Returns undefined if no role claim is present (JWT template not configured).
 */
export function getRoleFromClaims(
  sessionClaims: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!sessionClaims) return undefined;
  const metadata = sessionClaims.metadata as Record<string, unknown> | undefined;
  return metadata?.role as string | undefined;
}
