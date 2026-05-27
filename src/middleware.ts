import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getRoleFromClaims, isAdminRole } from "@/lib/clerk-claims";

// ── Route matchers ──────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  "/",
  "/unauthorized",
  "/api/webhooks(.*)",
  "/api/health",
  "/api/cron(.*)",
]);

const isAuthRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

const isAdminRoute = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);

const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/explore(.*)",
  "/settings(.*)",
  "/api/chat(.*)",
  "/api/threads(.*)",
  "/api/messages(.*)",
  "/api/feedback(.*)",
]);

// ── Middleware ───────────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req) => {
  if (process.env.PLAYWRIGHT_TEST === "true") {
    return;
  }
  const { sessionClaims, userId } = await auth();

  // 1. Auth routes (sign-in / sign-up) — redirect to /chat if already signed in
  if (isAuthRoute(req)) {
    if (userId) {
      return NextResponse.redirect(new URL("/chat", req.url));
    }
    return;
  }

  // 2. Public routes — no auth required
  if (isPublicRoute(req)) {
    return;
  }

  // 3. Admin routes — require authentication + admin/superadmin role
  if (isAdminRoute(req)) {
    // Must be authenticated first
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    // Check role from Clerk JWT session claims (custom JWT template)
    const role = getRoleFromClaims(sessionClaims as unknown as Record<string, unknown> | null);

    if (role && !isAdminRole(role)) {
      // JWT template has a role claim but user is not admin — deny immediately
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // If no role claim exists (JWT template not configured), protect for auth
    // and let the client-side AuthGuard component enforce the role gate via Convex
    await auth.protect();
    return;
  }

  // 4. Protected routes — require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
    return;
  }

  // 5. Fallback for any unmatched route — require authentication
  await auth.protect();
});

// ── Config ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    "/__clerk/(.*)",
  ],
};
