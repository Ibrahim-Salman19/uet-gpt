"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// global-error.tsx replaces the root layout when an error is thrown during
// rendering of the root layout/template, so it must render its own <html> and
// <body>. Errors that reach here escape every nested error boundary, so we
// report them to Sentry explicitly (nested boundaries are reported by their
// own handlers / Next's instrumentation).
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error("GlobalError:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#0a0a0a",
          backgroundColor: "#ffffff",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem" }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: "0.875rem", color: "#525252", margin: 0 }}>
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#737373",
                fontFamily: "ui-monospace, monospace",
                marginTop: "0.75rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minWidth: "120px",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            color: "#ffffff",
            backgroundColor: "#0a0a0a",
            border: "none",
            borderRadius: "0.5rem",
            cursor: "pointer",
          }}
        >
          Try Again
        </button>
      </body>
    </html>
  );
}
