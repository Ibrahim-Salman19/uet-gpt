export const UET_CRAWL_CONFIG = {
  baseUrl: "https://web.uettaxila.edu.pk",
  seedUrls: [
    "https://web.uettaxila.edu.pk/",
    "https://web.uettaxila.edu.pk/admissions/",
    "https://web.uettaxila.edu.pk/academics/",
    "https://web.uettaxila.edu.pk/departments/",
    "https://web.uettaxila.edu.pk/faculty/",
    "https://web.uettaxila.edu.pk/campus-life/",
    "https://web.uettaxila.edu.pk/research/",
    "https://web.uettaxila.edu.pk/oric/",
    "https://web.uettaxila.edu.pk/qec/",
    "https://web.uettaxila.edu.pk/quality-enhancement-cell/",
    "https://web.uettaxila.edu.pk/examinations/",
    "https://web.uettaxila.edu.pk/careers/",
    "https://web.uettaxila.edu.pk/student-portal/",
    "https://web.uettaxila.edu.pk/transport/",
    "https://web.uettaxila.edu.pk/hostels/",
    "https://web.uettaxila.edu.pk/library/",
    "https://web.uettaxila.edu.pk/scholarships/",
    "https://web.uettaxila.edu.pk/affiliated-colleges/",
    "https://web.uettaxila.edu.pk/contact/",
    "https://web.uettaxila.edu.pk/about/",
    "https://web.uettaxila.edu.pk/administration/",
    "https://web.uettaxila.edu.pk/dic/",
    "https://web.uettaxila.edu.pk/programs/",
  ],
  maxPages: 500,
  maxDepth: 5,
  includePaths: ["https://web.uettaxila.edu.pk/**"],
  excludePaths: [
    "https://web.uettaxila.edu.pk/**/edit",
    "https://web.uettaxila.edu.pk/**/delete",
    "https://web.uettaxila.edu.pk/wp-admin/**",
    "https://web.uettaxila.edu.pk/*.pdf",
    "https://web.uettaxila.edu.pk/*.jpg",
    "https://web.uettaxila.edu.pk/*.png",
    "https://web.uettaxila.edu.pk/*.zip",
    "https://web.uettaxila.edu.pk/student-portal/auth/**",
  ],
  allowExternalLinks: false,
} as const;

export const CACHE_SIMILARITY_THRESHOLD = 0.95;

export const EVAL_ENABLED = false;

export const APP_NAME = "UET GPT";
export const APP_TAGLINE = "Your AI Guide to UET Taxila";
export const APP_DESCRIPTION =
  "An intelligent assistant that answers any question about UET Taxila.";

export const UET_COLORS = {
  navy: "oklch(0.35 0.07 265)",
  navyLight: "oklch(0.55 0.08 265)",
  gold: "oklch(0.68 0.14 75)",
  goldLight: "oklch(0.75 0.12 75)",
} as const;

export const TASTE_BASELINE = {
  designVariance: 8,
  motionIntensity: 6,
  visualDensity: 4,
} as const;

export const SPACING = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
} as const;

export const ELEVATION = {
  sm: "0 1px 2px oklch(0 0 0 / 0.04), 0 1px 1px oklch(0 0 0 / 0.02)",
  md: "0 4px 6px oklch(0 0 0 / 0.04), 0 2px 4px oklch(0 0 0 / 0.03)",
  lg: "0 10px 15px oklch(0 0 0 / 0.05), 0 4px 6px oklch(0 0 0 / 0.03)",
  xl: "0 20px 25px oklch(0 0 0 / 0.06), 0 8px 10px oklch(0 0 0 / 0.03)",
} as const;

export const DURATION = {
  fast: 100,
  normal: 250,
  slow: 400,
  entrance: 600,
} as const;
