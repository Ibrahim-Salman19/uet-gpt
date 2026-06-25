import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: false,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    // Replay sample rates above have no effect unless the replay integration
    // is registered.
    integrations: [Sentry.replayIntegration()],
    environment: process.env.NODE_ENV || "development",
  });
} else {
  console.warn(
    "[Sentry] SENTRY_DSN not configured. Error monitoring is disabled. Set SENTRY_DSN in your environment to enable.",
  );
}

// Instruments client-side navigations (App Router) so route changes are traced.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
