import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors thrown in React Server Components, route handlers, and the
// proxy/middleware so they are reported to Sentry (required by @sentry/nextjs >= 8.28).
export const onRequestError = Sentry.captureRequestError;
