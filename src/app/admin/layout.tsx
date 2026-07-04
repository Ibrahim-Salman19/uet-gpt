import { auth } from "@clerk/nextjs/server";
import { api } from "convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";
import { redirect } from "next/navigation";
import { isAdminRole } from "@/lib/permissions";

/**
 * Server Component auth gate for admin routes.
 *
 * Defense-in-depth against CVE-2025-29927 (middleware bypass via
 * x-middleware-subrequest header). This server component runs before
 * any client-side code, ensuring admin access is denied at the
 * server level even if edge middleware is bypassed.
 *
 * The actual admin shell UI (sidebar, nav, etc.) lives in the
 * (admin-shell)/layout.tsx client component below.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims, getToken } = await auth();

  if (!userId) {
    redirect("/");
  }

  // Primary check: Clerk JWT custom claim (no Convex round-trip).
  const metadata = (sessionClaims as Record<string, unknown>)?.metadata as
    | Record<string, unknown>
    | undefined;
  const claimRole = metadata?.role as string | undefined;

  if (claimRole) {
    if (!isAdminRole(claimRole)) {
      redirect("/");
    }
    return <>{children}</>;
  }

  // Fallback: the JWT template ("Customize session token") is not configured,
  // so the role claim is absent. Authorize against the canonical Convex
  // users.role instead of failing closed/open silently. This keeps the page
  // gate working even when the Clerk Dashboard template is missing.
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    // No way to verify role server-side — fail closed.
    redirect("/");
  }

  const convex = new ConvexHttpClient(convexUrl);
  const token = await getToken({ template: "convex" });
  if (token) {
    convex.setAuth(token);
  }

  const convexUser = await convex.query(api.users.getByClerkId, { clerkId: userId });
  const convexRole = convexUser?.role;

  if (!convexRole || !isAdminRole(convexRole)) {
    redirect("/");
  }

  return <>{children}</>;
}
