/**
 * Single source of truth for schema freshness and content dates.
 * Eliminates inconsistent hardcoded dates across schemas and page files.
 */

export const CURRENT_ACADEMIC_YEAR = "2026";
export const SCHEMA_DATE_MODIFIED = "2026-09-14";
export const LEARN_TERMS_DATE_MODIFIED = "2026-09-14";
export const SITE_FOUNDING_YEAR = "2025";
export const UET_TAXILA_FOUNDING_YEAR = "1975";

export function getIsoDateString(date: Date = new Date()): string {
  return date.toISOString().split("T")[0] ?? "";
}
