import type { MetadataRoute } from "next";
import { getAllComparisonSlugs } from "@/lib/comparisons-data";
import { LEARN_TERMS_DATE_MODIFIED, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { getAllSlugs } from "@/lib/learn-terms";
import { getAllProgramSlugs } from "@/lib/programs-data";

export const revalidate = 3600; // Hourly ISR cache revalidation

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const learnSlugs = getAllSlugs();
  const staticLastModified = new Date(SCHEMA_DATE_MODIFIED);
  const learnLastModified = new Date(LEARN_TERMS_DATE_MODIFIED);

  return [
    {
      url: SITE_URL,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/tools`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/academics`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/admissions`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${SITE_URL}/campus-life`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/uet`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/uet-taxila`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/uet-taxila/programs`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/uet-taxila/ecat-guide`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${SITE_URL}/uet-taxila/bus-routes`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/uet-taxila/hostels`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/uet-taxila/academic-calendar`,
      lastModified: staticLastModified,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${SITE_URL}/uet-taxila/closing-merit`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/uet-gpt`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/learn`,
      lastModified: learnLastModified,
      changeFrequency: "monthly",
      priority: 0.75,
    },
    ...learnSlugs.map((slug) => ({
      url: `${SITE_URL}/learn/${slug}`,
      lastModified: learnLastModified,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...getAllProgramSlugs().map((slug) => ({
      url: `${SITE_URL}/uet-taxila/programs/${slug}`,
      lastModified: staticLastModified,
      changeFrequency: "monthly" as const,
      priority: 0.85,
    })),
    ...getAllComparisonSlugs().map((slug) => ({
      url: `${SITE_URL}/uet-taxila/compare/${slug}`,
      lastModified: staticLastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: `${SITE_URL}/about`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: staticLastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: staticLastModified,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: staticLastModified,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
