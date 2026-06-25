/**
 * Helpers for reading the user role from Clerk JWT session claims.
 *
 * Configure a Clerk JWT template that maps user.publicMetadata.role
 * to the "metadata.role" claim so the middleware can enforce admin
 * authorization at the edge without a Convex round-trip.
 *
 * JWT template claim mapping:
 *   - "metadata": { "role": "{{user.publicMetadata.role}}" }
 *
 * The claim shape is typed globally via `CustomJwtSessionClaims`
 * (see src/types/globals.d.ts).
 *
 * SECURITY NOTE: the role read here is only as trustworthy as the JWT
 * template and is ADVISORY. It is safe for UX gating and for selecting a
 * rate-limit tier, but it MUST NOT be the sole authority for privileged
 * operations — a stale token (e.g. after a demotion) keeps the old role
 * until it expires. All privileged operations must be re-checked against
 * the authoritative Convex users table (see convex/auth.ts).
 *
 * @see https://clerk.com/docs/backend-requests/making/custom-session-token
 */
import { isAdminRole as canonicalIsAdminRole, type Role } from "@/lib/permissions";

const KNOWN_ROLES: readonly Role[] = ["user", "admin", "superadmin"];

function isRole(value: unknown): value is Role {
  return typeof value === "string" && (KNOWN_ROLES as readonly string[]).includes(value);
}

/**
 * Check if a user role is an admin-level role.
 * Re-exported from src/lib/permissions.ts (canonical source).
 */
export const isAdminRole = canonicalIsAdminRole;

/**
 * Extract the user role from Clerk session claims.
 *
 * Returns undefined if no valid role claim is present (JWT template not
 * configured, or the claim is an unexpected shape such as a JSON string).
 * The value is validated at runtime against the known {@link Role} literals
 * so unexpected shapes fail closed rather than leaking through an unchecked
 * cast.
 */
export function getRoleFromClaims(
  sessionClaims: CustomJwtSessionClaims | Record<string, unknown> | null | undefined,
): Role | undefined {
  if (!sessionClaims || typeof sessionClaims !== "object") return undefined;
  const metadata = (sessionClaims as { metadata?: unknown }).metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const role = (metadata as { role?: unknown }).role;
  return isRole(role) ? role : undefined;
}
