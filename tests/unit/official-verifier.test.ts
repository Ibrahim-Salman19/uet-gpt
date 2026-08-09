import { describe, expect, it } from "vitest";
import { isOfficialUrlAllowed } from "../../convex/verification/officialSourceVerifier";

describe("Official Source Host Validator", () => {
  it("allows valid uet.edu.pk URLs", () => {
    expect(isOfficialUrlAllowed("https://uettaxila.edu.pk/admissions/fees.asp")).toBe(true);
    expect(isOfficialUrlAllowed("https://subdomain.uet.edu.pk/notice.html")).toBe(true);
  });

  it("rejects non-official external URLs (SSRF protection)", () => {
    expect(isOfficialUrlAllowed("https://evil.com/fake-uet-fees")).toBe(false);
    expect(isOfficialUrlAllowed("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isOfficialUrlAllowed("javascript:alert(1)")).toBe(false);
    expect(isOfficialUrlAllowed("file:///etc/passwd")).toBe(false);
  });
});
