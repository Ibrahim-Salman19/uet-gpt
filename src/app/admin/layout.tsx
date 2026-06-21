import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

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
  const { sessionClaims } = await auth();
  const metadata = (sessionClaims as Record<string, unknown>)?.metadata as
    | Record<string, unknown>
    | undefined;
  const role = metadata?.role;

  if (role !== "admin" && role !== "superadmin") {
    redirect("/");
  }

  return <>{children}</>;
}
