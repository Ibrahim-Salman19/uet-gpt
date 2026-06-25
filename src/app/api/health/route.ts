// fallow-ignore-file security-sink
import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Constant-time comparison of a bearer header against the expected value.
 * Equal-length-checks first (still running a same-length comparison on
 * mismatch) so neither the secret's bytes nor its length leak via timing.
 */
function timingSafeBearerMatch(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  if (a.length !== b.length) {
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

interface ServiceStatus {
  status: "ok" | "error" | "not_configured";
  latency?: number;
  error?: string;
}

interface HealthResponse {
  status: "ok" | "degraded" | "error";
  timestamp: number;
  uptime: number;
  version: string;
  services: Record<string, ServiceStatus>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function checkService(
  _name: string,
  checkFn: () => Promise<boolean>,
  configRequired?: boolean,
): Promise<ServiceStatus> {
  const start = performance.now();
  try {
    const isAvailable = await checkFn();
    const latency = Math.round(performance.now() - start);

    if (!isAvailable) {
      return {
        status: configRequired ? "not_configured" : "error",
        latency,
        error: configRequired ? "Not configured (optional)" : "Service unavailable",
      };
    }

    return { status: "ok", latency };
  } catch (error) {
    const latency = Math.round(performance.now() - start);
    return {
      status: "error",
      latency,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !timingSafeBearerMatch(authHeader, cronSecret)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Start all checks in parallel
  const checks: Record<string, Promise<ServiceStatus>> = {
    convex: checkService(
      "Convex",
      async () => {
        const url = process.env.NEXT_PUBLIC_CONVEX_URL;
        if (!url) return false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch(`${url}/health`, {
            signal: controller.signal,
          });
          return res.ok;
        } finally {
          clearTimeout(timeout);
        }
      },
      true,
    ),
    groq: checkService(
      "Groq",
      async () => {
        if (!process.env.GROQ_API_KEY) return false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch("https://api.groq.com/openai/v1/models", {
            headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
            signal: controller.signal,
          });
          return res.ok;
        } finally {
          clearTimeout(timeout);
        }
      },
      true,
    ),
    gemini: checkService(
      "Gemini",
      async () => {
        if (!process.env.GEMINI_API_KEY) return false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
            headers: { "x-goog-api-key": process.env.GEMINI_API_KEY },
            signal: controller.signal,
          });
          return res.ok;
        } finally {
          clearTimeout(timeout);
        }
      },
      true,
    ),
    cerebras: checkService(
      "Cerebras",
      async () => {
        if (!process.env.CEREBRAS_API_KEY) return false;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        try {
          const res = await fetch("https://api.cerebras.ai/v1/models", {
            headers: { Authorization: `Bearer ${process.env.CEREBRAS_API_KEY}` },
            signal: controller.signal,
          });
          return res.ok;
        } finally {
          clearTimeout(timeout);
        }
      },
      true,
    ),
    clerk: checkService(
      "Clerk",
      async () => {
        return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      },
      true,
    ),
  };
  const entries = Object.entries(checks);
  const results = await Promise.all(
    entries.map(async ([key, promise]) => [key, await promise] as const),
  );
  const services: Record<string, ServiceStatus> = Object.fromEntries(results);

  const allOk = Object.values(services).every((s) => s.status === "ok");
  const anyOk = Object.values(services).some((s) => s.status === "ok");

  const response: HealthResponse = {
    status: allOk ? "ok" : anyOk ? "degraded" : "error",
    timestamp: Date.now(),
    uptime: process.uptime(),
    version: "0.1.0",
    services,
  };

  return NextResponse.json(response, {
    status: response.status === "error" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
