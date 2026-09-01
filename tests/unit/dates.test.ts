import { describe, expect, it } from "vitest";
import {
  CURRENT_ACADEMIC_YEAR,
  getIsoDateString,
  LEARN_TERMS_DATE_MODIFIED,
  SCHEMA_DATE_MODIFIED,
} from "@/lib/dates";

describe("dates and freshness constants", () => {
  it("exports valid ISO-8601 date strings for schema freshness", () => {
    expect(SCHEMA_DATE_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(LEARN_TERMS_DATE_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(CURRENT_ACADEMIC_YEAR).toBe("2026");
  });

  it("getIsoDateString returns a valid formatted date", () => {
    const formatted = getIsoDateString();
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
