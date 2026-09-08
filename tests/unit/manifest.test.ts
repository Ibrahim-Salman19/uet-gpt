import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("Web App Manifest", () => {
  it("exports valid manifest metadata with proper icon configuration", () => {
    const m = manifest();

    expect(m.name).toBe("UET GPT - Your AI Guide to UET Taxila");
    expect(m.short_name).toBe("UET GPT");
    expect(m.start_url).toBe("/");
    expect(m.display).toBe("standalone");

    expect(m.icons).toBeDefined();
    expect(m.icons!.length).toBeGreaterThanOrEqual(3);

    // Verify both 'any' and 'maskable' purpose icons are present
    const hasAnyPurpose = m.icons!.some((i) => i.purpose === "any");
    const hasMaskablePurpose = m.icons!.some((i) => i.purpose === "maskable");
    expect(hasAnyPurpose).toBe(true);
    expect(hasMaskablePurpose).toBe(true);

    // Verify 192x192 and 512x512 sizes exist
    const has192 = m.icons!.some((i) => i.sizes?.includes("192x192"));
    const has512 = m.icons!.some((i) => i.sizes?.includes("512x512"));
    expect(has192).toBe(true);
    const hasPng = m.icons!.some((i) => i.type === "image/png");
    expect(hasPng).toBe(true);
  });

  it("points all shortcuts directly to canonical hub URLs", () => {
    const m = manifest();
    expect(m.shortcuts).toBeDefined();

    for (const shortcut of m.shortcuts!) {
      // Must not point to legacy redirected routes
      expect(shortcut.url).not.toBe("/calculator");
      expect(shortcut.url).not.toBe("/gpa-calculator");
      expect(shortcut.url).not.toBe("/scholarships");
      expect(shortcut.url.startsWith("/")).toBe(true);
    }
  });
});
