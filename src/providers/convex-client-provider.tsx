"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import * as React from "react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

interface ConvexClientProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that wraps the app with the Convex client.
 * Falls back to rendering children without Convex if URL is not configured.
 */
export function ConvexClientProvider({ children }: ConvexClientProviderProps) {
  const [convexClient] = React.useState<ConvexReactClient | null>(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  });

  if (!convexClient) {
    return <>{children}</>;
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
