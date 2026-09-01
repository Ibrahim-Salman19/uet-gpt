import { describe, expect, it } from "vitest";
import { metadata as uetMeta } from "@/app/uet/page";
import { metadata as uetGptMeta } from "@/app/uet-gpt/page";
import { metadata as admissionsMeta } from "@/app/uet-taxila/admissions/page";
import { metadata as feeMeta } from "@/app/uet-taxila/fee-structure/page";
import { metadata as progMeta } from "@/app/uet-taxila/programs/page";

describe("Subpage Metadata Optimization", () => {
  it("ensures page titles do not exceed 60 characters", () => {
    expect((admissionsMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((feeMeta.title as string).length).toBeLessThanOrEqual(60);
    expect((progMeta.title as string).length).toBeLessThanOrEqual(60);
  });

  it("updates admissions title to 2026", () => {
    expect(admissionsMeta.title).toContain("2026");
  });

  it("differentiates /uet title as institutional hub", () => {
    expect(uetMeta.title).toBe("UET: University of Engineering & Technology Guide");
  });

  it("expands /uet-gpt meta description to >= 140 chars", () => {
    expect((uetGptMeta.description as string).length).toBeGreaterThanOrEqual(140);
  });
});
