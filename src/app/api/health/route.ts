// fallow-ignore-file security-sink
import { type NextRequest, NextResponse } from "next/server";

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
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const services: Record<string, ServiceStatus> = {
    convex: await checkService(
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
    groq: await checkService(
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
    gemini: await checkService(
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
    cerebras: await checkService(
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
    clerk: await checkService(
      "Clerk",
      async () => {
        return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
      },
      true,
    ),
  };

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
