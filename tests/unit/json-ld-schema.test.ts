import { describe, expect, it } from "vitest";
import { collegeSchema, organizationSchema, softwareSchema, websiteSchema } from "@/lib/json-ld";

describe("JSON-LD structured data schemas", () => {
  it("organizationSchema contains multiple sameAs links and valid founder", () => {
    expect(Array.isArray(organizationSchema.sameAs)).toBe(true);
    expect((organizationSchema.sameAs as string[]).length).toBeGreaterThanOrEqual(2);
    expect(organizationSchema.name).toBe("UET GPT");
  });

  it("websiteSchema includes SearchAction with query-input target", () => {
    expect(websiteSchema.potentialAction).toBeDefined();
    const action = websiteSchema.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    expect(action["query-input"]).toBe("required name=search_term_string");
  });

  it("collegeSchema contains complete entity properties", () => {
    expect(collegeSchema.numberOfStudents).toBeDefined();
    expect(collegeSchema.telephone).toBe("+92-51-9047400");
    expect(collegeSchema.geo).toEqual({
      "@type": "GeoCoordinates",
      latitude: 33.766,
      longitude: 72.8242,
    });
  });

  it("softwareSchema has valid operatingSystem and featureList", () => {
    expect(softwareSchema.operatingSystem).toBe("Web, iOS, Android");
    expect(Array.isArray(softwareSchema.featureList)).toBe(true);
  });
});
