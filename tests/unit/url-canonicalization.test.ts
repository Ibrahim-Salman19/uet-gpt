import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "../../convex/crawl/chunking";
import { isOfficialUrlAllowed } from "../../convex/verification/officialSourceVerifier";

describe("URL Canonicalization & SSRF Safety", () => {
  it("removes URL fragment identifiers", () => {
    expect(canonicalizeUrl("https://uet.edu.pk/admissions#fees")).toBe("https://uet.edu.pk/admissions");
  });

  it("lowercases scheme and host name", () => {
    expect(canonicalizeUrl("HTTPS://UET.EDU.PK/Admissions")).toMatch(/^https:\/\/uet\.edu\.pk/);
  });

  it("blocks SSRF: metadata service 169.254.169.254", () => {
    expect(isOfficialUrlAllowed("http://169.254.169.254/latest/meta-data/")).toBe(false);
  });

  it("blocks SSRF: localhost 127.0.0.1", () => {
    expect(isOfficialUrlAllowed("http://127.0.0.1/admin")).toBe(false);
  });

  it("blocks SSRF: IPv6 loopback [::1]", () => {
    expect(isOfficialUrlAllowed("http://[::1]/")).toBe(false);
  });

  it("blocks userinfo host confusion (@ attack)", () => {
    expect(isOfficialUrlAllowed("https://uet.edu.pk@evil.example.com/path")).toBe(false);
  });

  it("blocks subdomain suffix attack", () => {
    expect(isOfficialUrlAllowed("https://uet.edu.pk.evil.example.com/path")).toBe(false);
  });

  it("blocks unsafe schemes (javascript:, file:, data:)", () => {
    expect(isOfficialUrlAllowed("javascript:alert(1)")).toBe(false);
    expect(isOfficialUrlAllowed("file:///etc/passwd")).toBe(false);
    expect(isOfficialUrlAllowed("data:text/html,<h1>test</h1>")).toBe(false);
  });

  it("allows valid official UET URLs", () => {
    expect(isOfficialUrlAllowed("https://uet.edu.pk/admissions/fees")).toBe(true);
  });
});
