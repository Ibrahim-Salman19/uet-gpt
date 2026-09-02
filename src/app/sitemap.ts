import type { MetadataRoute } from "next";
import { getAllSlugs } from "@/lib/learn-terms";
import { getAllProgramSlugs } from "@/lib/programs-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const learnSlugs = getAllSlugs();

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/tools`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/academics`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/admissions`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/campus-life`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/uet`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/uet-taxila`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/uet-gpt`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/learn`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...learnSlugs.map((slug) => ({
      url: `${SITE_URL}/learn/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...getAllProgramSlugs().map((slug) => ({
      url: `${SITE_URL}/uet-taxila/programs/${slug}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
