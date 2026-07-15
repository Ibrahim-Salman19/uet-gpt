"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
          color: "oklch(88% 0 0)",
          backgroundColor: "oklch(7% 0.006 95)",
        }}
      >
        <div style={{ maxWidth: "40rem", width: "100%" }}>
          {/* Icon */}
          <div
            style={{
              width: 48,
              height: 48,
              border: "1px solid oklch(58% 0.15 35 / 0.6)",
              background: "oklch(58% 0.15 35 / 0.08)",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 1.25rem",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 18,
                color: "oklch(58% 0.15 35)",
                fontWeight: 700,
              }}
            >
              !
            </span>
          </div>

          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: "0.65rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: "oklch(84% 0.19 80.46)",
              marginBottom: "0.5rem",
            }}
          >
            UETGPT // RUNTIME ERROR
          </p>

          <h2
            style={{
              fontSize: "1.25rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
              color: "oklch(91% 0 0)",
            }}
          >
            Something went wrong
          </h2>

          <p style={{ fontSize: "0.85rem", color: "oklch(72% 0 0)", marginBottom: "1rem" }}>
            An unexpected client-side error occurred:
          </p>

          {/* Actual Error Message and Stack Trace */}
          <div
            style={{
              textAlign: "left",
              padding: "1rem",
              background: "oklch(4% 0.004 95)",
              border: "1px solid oklch(78% 0 0 / 0.15)",
              borderRadius: 8,
              marginBottom: "1.5rem",
              overflowX: "auto",
            }}
          >
            <div
              style={{
                color: "oklch(58% 0.15 35)",
                fontWeight: "bold",
                fontSize: "0.85rem",
                marginBottom: "0.5rem",
              }}
            >
              {error.name}: {error.message}
            </div>
            {error.stack && (
              <pre
                style={{
                  margin: 0,
                  fontSize: "0.7rem",
                  color: "oklch(62% 0 0)",
                  fontFamily: "ui-monospace, monospace",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.4",
                }}
              >
                {error.stack}
              </pre>
            )}
          </div>

          {error.digest && (
            <p
              style={{
                fontSize: "0.7rem",
                color: "oklch(52% 0 0)",
                fontFamily: "ui-monospace, monospace",
                marginTop: "0.75rem",
                padding: "0.4rem 0.75rem",
                background: "oklch(11% 0.006 95)",
                border: "1px solid oklch(78% 0 0 / 0.12)",
                borderRadius: 4,
                display: "inline-block",
                marginBottom: "1rem",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
        </div>

        <div
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: "0.8rem",
              fontWeight: 500,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "oklch(4% 0.004 95)",
              backgroundColor: "oklch(84% 0.19 80.46)",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            style={{
              padding: "0.5rem 1.25rem",
              fontSize: "0.8rem",
              fontWeight: 500,
              fontFamily: "ui-monospace, monospace",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "oklch(72% 0 0)",
              backgroundColor: "transparent",
              border: "1px solid oklch(78% 0 0 / 0.25)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Go Home
          </button>
        </div>
      </body>
    </html>
  );
}
