import { type NextRequest, NextResponse } from "next/server";

function getAllowedOrigins(req: NextRequest): string[] {
  const allowed = [process.env.NEXT_PUBLIC_APP_URL]
    .filter((url): url is string => !!url)
    .map((url) => url.replace(/\/$/, ""));
  if (process.env.NODE_ENV === "development") {
    allowed.push("http://localhost:3000");
  }
  const host = req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    const selfOrigin = `${proto}://${host}`;
    if (!allowed.includes(selfOrigin)) {
      allowed.push(selfOrigin);
    }
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
  const allowed = getAllowedOrigins(req);

  if (!origin && !referer) {
    return new NextResponse("Forbidden: CSRF check failed (missing origin/referer)", {
      status: 403,
    });
  }

  return checkOrigin(origin, allowed) ?? checkReferer(referer, allowed);
}
