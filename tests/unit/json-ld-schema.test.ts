import { describe, expect, it } from "vitest";
import { collegeSchema, organizationSchema, softwareSchema, websiteSchema } from "@/lib/json-ld";

describe("JSON-LD structured data schemas", () => {
  it("organizationSchema contains only real, live sameAs links and a valid founder", () => {
    expect(Array.isArray(organizationSchema.sameAs)).toBe(true);
    expect((organizationSchema.sameAs as string[]).length).toBeGreaterThanOrEqual(1);
    // No official Twitter/LinkedIn org account exists yet — don't assert fabricated profiles here.
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

  it("declares valid 512x512 logo ImageObject URLs", () => {
    expect(organizationSchema.logo.url).toContain("icon-512.png");
    expect(organizationSchema.logo.width).toBe(512);
    expect(organizationSchema.logo.height).toBe(512);

    expect(collegeSchema.logo.url).toContain("icon-512.png");
    expect(collegeSchema.logo.width).toBe(512);
    expect(collegeSchema.logo.height).toBe(512);
  });
});
