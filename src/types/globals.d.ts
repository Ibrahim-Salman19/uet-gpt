import type { Role } from "@/lib/permissions";

/**
 * Global augmentation of Clerk's session-claim type.
 *
 * Clerk types `auth().sessionClaims` against the global `CustomJwtSessionClaims`
 * interface. Declaring it here makes the role claim strongly typed so reads no
 * longer need unchecked `as` casts.
 *
 * IMPORTANT: this shape must match the Clerk JWT template configured in the
 * Dashboard, e.g.:
 *   "metadata": { "role": "{{user.publicMetadata.role}}" }
 *
 * @see https://clerk.com/docs/backend-requests/making/custom-session-token
 */
declare global {
  interface CustomJwtSessionClaims {
    /** Custom metadata injected via the Clerk JWT template. */
    metadata?: {
      /** User role mirrored from publicMetadata.role. */
      role?: Role;
    };
  }
}
