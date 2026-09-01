import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Terms of Service - UET GPT",
  description:
    "Terms of Service for UET GPT. Information on acceptable use, academic disclaimers, open-source licensing, and liability limitations.",
  alternates: { canonical: `${siteUrl}/terms` },
  openGraph: {
    title: "Terms of Service - UET GPT",
    description: "Acceptable use and disclaimers for UET GPT.",
    url: `${siteUrl}/terms`,
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Terms of Service", url: `${siteUrl}/terms` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>{" "}
            / <span>Terms of Service</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">Terms of Service</h1>
          <p className="text-sm text-[#a1a1aa] mb-8">Last Updated: September 1, 2026</p>
          <div className="space-y-8 text-sm text-[#d4d4d8] leading-relaxed font-light">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Informational Disclaimer</h2>
              <p>
                UET GPT is an independent, open-source AI guide. It provides retrieval-grounded
                guidance based on official university records, but official administrative decisions
                must always be verified directly with UET Taxila authorities.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Acceptable Use</h2>
              <p>
                Users agree not to exploit the platform for malicious crawling, denial of service,
                prompt injection attacks, or abusive automation.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
