import { describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";
import { CookieConsent } from "@/components/cookie-consent";

describe("404 Page & Cookie Consent", () => {
  it("NotFound component is defined and exports properly", () => {
    expect(NotFound).toBeDefined();
  });

  it("CookieConsent component is defined and exports properly", () => {
    expect(CookieConsent).toBeDefined();
  });
});
