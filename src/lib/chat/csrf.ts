import { type NextRequest, NextResponse } from "next/server";

/**
 * Build the CSRF allowlist from server-configured origins ONLY. We deliberately
 * do NOT derive trust from the request's own Host / X-Forwarded-* headers,
 * because those are client-controllable and would make the Origin/Referer
 * check self-referential (an attacker-supplied Host would auto-authorize the
 * matching Origin). Multi-host deployments should set CSRF_ALLOWED_ORIGINS
 * (comma-separated) in addition to NEXT_PUBLIC_APP_URL.
 */
function getAllowedOrigins(): string[] {
  const configured = [
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.CSRF_ALLOWED_ORIGINS?.split(",") ?? []),
  ];
  const allowed = configured
    .map((url) => url?.trim())
    .filter((url): url is string => !!url)
    .map((url) => url.replace(/\/$/, ""));
  if (process.env.NODE_ENV === "development") {
    allowed.push("http://localhost:3000");
  }
  return allowed;
}

function checkOrigin(origin: string | null, allowed: string[]): NextResponse | null {
  if (origin && !allowed.includes(origin)) {
    return new NextResponse("Forbidden: CSRF check failed (origin)", { status: 403 });
  }
  return null;
}

function checkReferer(referer: string | null, allowed: string[]): NextResponse | null {
  if (!referer) return null;
  try {
    const refererUrl = new URL(referer);
    if (!allowed.includes(refererUrl.origin)) {
      return new NextResponse("Forbidden: CSRF check failed (referer)", { status: 403 });
    }
  } catch {
    return new NextResponse("Forbidden: Invalid referer", { status: 400 });
  }
  return null;
}

export function checkCsrf(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const secFetchSite = req.headers.get("sec-fetch-site");
  const allowed = getAllowedOrigins();

  // Fast path: modern browsers send Sec-Fetch-Site on every navigation/fetch.
  // A same-origin request is unambiguously trusted regardless of Origin/Referer.
  if (secFetchSite === "same-origin" || secFetchSite === "none") {
    return null;
  }
  // Reject cross-site signals for state-changing POST requests. same-site is allowed
  // to proceed to the Origin/Referer checks to respect multi-subdomain configurations.
  if (secFetchSite === "cross-site") {
    return new NextResponse("Forbidden: CSRF check failed (sec-fetch-site)", { status: 403 });
  }

  // Fallback for clients without Sec-Fetch-Site: require a verified same-origin
  // signal via Origin or Referer. Treat the both-missing case as a deny.
  if (!origin && !referer) {
    return new NextResponse("Forbidden: CSRF check failed (missing origin/referer)", {
      status: 403,
    });
  }

  return checkOrigin(origin, allowed) ?? checkReferer(referer, allowed);
}
