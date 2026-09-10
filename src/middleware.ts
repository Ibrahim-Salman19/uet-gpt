import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/opengraph-image(.*)",
  "/twitter-image(.*)",
  "/icon(.*)",
  "/uet(.*)",
  "/uet-taxila(.*)",
  "/uet-gpt(.*)",
  "/learn(.*)",
  "/academics(.*)",
  "/admissions(.*)",
  "/campus-life(.*)",
  "/tools(.*)",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  "/llms-full.txt",
  "/press-kit.md",
  "/pricing.md",
  "/favicon.ico",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/unauthorized",
  "/api/webhooks(.*)",
  "/api/health",
  "/api/cron(.*)",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (
    process.env.PLAYWRIGHT_TEST === "true" ||
    (process.env.NODE_ENV === "development" &&
      req.nextUrl?.searchParams?.get("mock_auth") === "true")
  ) {
    return NextResponse.next();
  }

  // Proactive developer diagnostics for localhost
  if (process.env.NODE_ENV === "development" && req.nextUrl.hostname === "127.0.0.1") {
    console.warn(
      "\x1b[33m[Clerk WARNING] Accessing the application via 127.0.0.1 can cause infinite redirect loops because Clerk session cookies are bound to localhost. Please use http://localhost:3000 instead.\x1b[0m",
    );
  }

  // Always allow search engine crawlers and AI bots for SEO / GEO indexing
  const userAgent = req.headers.get("user-agent") || "";
  const isSearchBot =
    /bot|crawler|spider|google|bing|perplexity|gptbot|claudebot|chatgpt|anthropic|cohere|slurp|duckduckbot|baiduspider|yandex|facebookexternalhit|twitterbot|linkedinbot|oai-searchbot|google-extended|googleother|meta-externalagent|meta-externalfetcher|applebot|bytespider|ccbot|amazonbot|petalbot|youbot|diffbot/i.test(
      userAgent,
    );

  if (isSearchBot) {
    return NextResponse.next();
  }

  const isPublic = isPublicRoute(req);
  const isAdmin = isAdminRoute(req);
  const authObj = !isPublic || isAdmin ? await auth() : null;

  if (!isPublic) {
    if (!authObj?.userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }

  // Edge-level admin role check - prevents non-admins from loading admin pages
  if (isAdmin) {
    const sessionClaims = authObj?.sessionClaims;

    // Diagnostic: JWT template not configured → sessionClaims.metadata is undefined
    if (sessionClaims && typeof sessionClaims.metadata === "undefined") {
      console.warn(
        "[RBAC] Clerk JWT template not configured. " +
          'Add { "metadata": "{{user.public_metadata}}" } in Clerk Dashboard → Sessions → Customize session token',
      );
    }

    const metadata = sessionClaims?.metadata as Record<string, unknown> | undefined;
    const role = metadata?.role;
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.redirect(new URL("/", req.url));
    }

    const isActive = metadata?.isActive as boolean | undefined;
    if (isActive === false) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }
}, {
  // uet-gpt.vercel.app is a shared Vercel subdomain - we don't own its DNS
  // zone, so the CNAME-based custom-domain approach Clerk's dashboard
  // defaulted to (clerk.uet-gpt.vercel.app) can never get a valid cert.
  // Proxy the Frontend API through our own verified domain instead
  // (matcher already had "/__clerk/(.*)" wired in below).
  frontendApiProxy: {
    enabled: true,
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|txt|xml|md)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
    // Clerk Frontend API proxy routes
    "/__clerk/(.*)",
  ],
};
