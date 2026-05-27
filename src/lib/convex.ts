import { ConvexHttpClient } from "convex/browser";
import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
}

export const convexClient = new ConvexReactClient(convexUrl);
export const convexHttpClient = new ConvexHttpClient(convexUrl);
