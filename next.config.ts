import { withSentryConfig, type SentryBuildOptions } from "@sentry/nextjs";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
  async redirects() {
    return [{ source: "/", destination: "/chat", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(), microphone=(self), camera=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' https://clerk.browser.systems 'unsafe-inline' 'unsafe-eval'",
              "connect-src 'self' *.convex.cloud wss://*.convex.cloud https://clerk.browser.systems",
              "img-src 'self' data: blob: https://img.clerk.com https://*.convex.cloud",
              "style-src 'self' 'unsafe-inline'",
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
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: {
    disable: false,
  },
  disableLogger: true,
  automaticVercelMonitors: true,
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
