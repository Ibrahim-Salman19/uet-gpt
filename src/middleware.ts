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
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' data: https:;
    connect-src 'self' *.convex.cloud wss://*.convex.cloud;
    frame-ancestors 'none';
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  if (process.env.NODE_ENV !== "production" && process.env.PLAYWRIGHT_TEST === "true") {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  }
  const { sessionClaims, userId } = await auth();

  // 1. Auth routes (sign-in / sign-up) — redirect to /chat if already signed in
  if (isAuthRoute(req)) {
    if (userId) {
      const res = NextResponse.redirect(new URL("/chat", req.url));
      res.headers.set("Content-Security-Policy", cspHeader);
      return res;
    }
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  }

  // 2. Public routes — no auth required
  if (isPublicRoute(req)) {
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
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
      const res = NextResponse.redirect(new URL("/unauthorized", req.url));
      res.headers.set("Content-Security-Policy", cspHeader);
      return res;
    }

    // If no role claim exists (JWT template not configured), protect for auth
    // and let the client-side AuthGuard component enforce the role gate via Convex
    await auth.protect();
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  }

  // 4. Protected routes — require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", cspHeader);
    return res;
  }

  // 5. Fallback for any unmatched route — require authentication
  await auth.protect();
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", cspHeader);
  return res;
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
