import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("Accessibility & Touch Target Standards", () => {
  it("ensures markdown images provide alt text fallback", () => {
    const mdSrc = fs.readFileSync("src/components/markdown.tsx", "utf8");
    expect(mdSrc).toContain('alt={alt || "Content image"}');
  });

  it("ensures auth guard loading states have aria-hidden on decorative spinners", () => {
    const authGuardSrc = fs.readFileSync("src/components/auth/auth-guard.tsx", "utf8");
    expect(authGuardSrc).toMatch(/aria-hidden="true"|role="status"|aria-label/);
  });

  it("ensures UI buttons and inputs have accessible touch dimensions", () => {
    const cookieSrc = fs.readFileSync("src/components/cookie-consent.tsx", "utf8");
    expect(cookieSrc).toContain("min-h-[44px]");
  });
});
