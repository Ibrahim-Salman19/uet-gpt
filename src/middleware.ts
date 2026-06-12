import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/unauthorized",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/webhooks/clerk(.*)",
  "/api/webhooks(.*)",
  "/api/health(.*)",
  "/api/cron(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  // Edge-level admin role check — prevents non-admins from loading admin pages
  if (isAdminRoute(req)) {
    const { sessionClaims } = await auth();

    // Diagnostic: JWT template not configured → sessionClaims.metadata is undefined
    if (sessionClaims && typeof sessionClaims.metadata === "undefined") {
      console.warn(
        "[RBAC] Clerk JWT template not configured. " +
        "Add { \"metadata\": \"{{user.public_metadata}}\" } in Clerk Dashboard → Sessions → Customize session token",
      );
    }

    const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined;
    const role = metadata?.role;
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
