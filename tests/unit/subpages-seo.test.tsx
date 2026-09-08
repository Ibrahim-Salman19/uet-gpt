import { describe, expect, it } from "vitest";
import { metadata as uetMeta } from "@/app/uet/page";
import { metadata as uetGptMeta } from "@/app/uet-gpt/page";
import { metadata as admissionsMeta } from "@/app/admissions/page";
import { metadata as academicsMeta } from "@/app/academics/page";
import { metadata as toolsMeta } from "@/app/tools/page";
import { metadata as campusLifeMeta } from "@/app/campus-life/page";
import { metadata as progMeta } from "@/app/uet-taxila/programs/page";

describe("Subpage Metadata Optimization", () => {
  it("ensures page titles do not exceed 60 characters", () => {
    expect((admissionsMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((academicsMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((toolsMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((campusLifeMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((progMeta.title as string).length).toBeLessThanOrEqual(60);
  });

  it("ensures admissions title includes Admissions", () => {
    expect(admissionsMeta.title).toContain("Admissions");
  });

  it("differentiates /uet title as institutional hub", () => {
    expect(uetMeta.title).toBe("UET: University of Engineering & Technology Guide");
  });

  it("expands /uet-gpt meta description to >= 140 chars", () => {
    expect((uetGptMeta.description as string).length).toBeGreaterThanOrEqual(140);
  });

  it("ensures all core subpage hubs include OpenGraph images", () => {
    expect(admissionsMeta.openGraph?.images).toBeDefined();
    expect(academicsMeta.openGraph?.images).toBeDefined();
    expect(toolsMeta.openGraph?.images).toBeDefined();
    expect(campusLifeMeta.openGraph?.images).toBeDefined();
  });
});
