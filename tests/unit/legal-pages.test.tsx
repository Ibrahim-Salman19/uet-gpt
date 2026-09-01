import { describe, expect, it } from "vitest";
import { metadata as aboutMeta } from "@/app/about/page";
import { metadata as contactMeta } from "@/app/contact/page";
import { metadata as privacyMeta } from "@/app/privacy/page";
import { metadata as termsMeta } from "@/app/terms/page";

describe("Legal and Trust Pages Metadata", () => {
  it("has valid metadata for privacy policy", () => {
    expect(privacyMeta.title).toContain("Privacy Policy");
    expect(privacyMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/privacy");
  });

  it("has valid metadata for terms of service", () => {
    expect(termsMeta.title).toContain("Terms of Service");
    expect(termsMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/terms");
  });

  it("has valid metadata for about page", () => {
    expect(aboutMeta.title).toContain("About UET GPT");
    expect(aboutMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/about");
  });

  it("has valid metadata for contact page", () => {
    expect(contactMeta.title).toContain("Contact");
    expect(contactMeta.alternates?.canonical).toBe("https://uet-gpt.vercel.app/contact");
  });
});
