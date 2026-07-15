import { type SentryBuildOptions, withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: ".",
    resolveAlias: {
      "convex/_generated/api": "./convex/_generated/api",
      "convex/_generated/server": "./convex/_generated/server",
      "convex/_generated/dataModel": "./convex/_generated/dataModel",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.convex.cloud" },
      { protocol: "https", hostname: "img.clerk.com" },
    ],
  },
  webpack(config) {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      "convex/_generated/api": path.resolve("./convex/_generated/api"),
      "convex/_generated/server": path.resolve("./convex/_generated/server"),
      "convex/_generated/dataModel": path.resolve("./convex/_generated/dataModel"),
    };
    return config;
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== "production";
    // 'unsafe-eval' is only ever needed by dev tooling (React Refresh / HMR).
    // It is dropped entirely in production. 'unsafe-inline' for script-src is
    // still required until a nonce/'strict-dynamic' policy is wired through the
    // middleware (see cross_cutting: src/middleware.ts) because Next.js emits
    // inline bootstrap scripts; it is therefore left in place but flagged.
    const scriptSrc = [
      "script-src 'self' https://clerk.browser.systems *.clerk.accounts.dev https://challenges.cloudflare.com 'unsafe-inline'",
      isDev ? " 'unsafe-eval'" : "",
    ].join("");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(self), camera=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              scriptSrc,
              "worker-src 'self' blob:",
              "connect-src 'self' *.convex.cloud wss://*.convex.cloud https://clerk.browser.systems *.clerk.accounts.dev",
              "img-src 'self' data: blob: https://img.clerk.com https://*.convex.cloud",
              "style-src 'self' 'unsafe-inline'",
              "object-src 'none'",
              "frame-src 'self' https://challenges.cloudflare.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

const sentryOptions: SentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // CI-only secret; without it source-map upload silently no-ops in CI.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: false,
    // Upload source maps to Sentry but delete them from the client bundle so
    // readable .map files are never served publicly (CVE-2025-55183 exposure).
    deleteSourcemapsAfterUpload: true,
  },
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default process.env.SENTRY_DSN ? withSentryConfig(nextConfig, sentryOptions) : nextConfig;
