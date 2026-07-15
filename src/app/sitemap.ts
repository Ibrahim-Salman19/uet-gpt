import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  // Only list publicly indexable, content-rich, canonical URLs. The app routes
  // (/chat, /explore, /settings) are auth-gated client-rendered shells with no
  // crawlable content, and the auth pages are thin — all excluded to avoid
  // thin-content / soft-404 signals.
  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/uet-taxila`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
