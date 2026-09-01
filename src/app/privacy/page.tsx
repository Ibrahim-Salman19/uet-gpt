import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Privacy Policy - UET GPT",
  description:
    "Privacy policy for UET GPT. Read how we protect student privacy, handle user inputs, and maintain zero data selling or monetization policies.",
  alternates: {
    canonical: `${siteUrl}/privacy`,
  },
  openGraph: {
    title: "Privacy Policy - UET GPT",
    description:
      "Privacy policy for UET GPT. Read how we protect student privacy, handle user inputs, and maintain zero data selling or monetization policies.",
    url: `${siteUrl}/privacy`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Privacy Policy — UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy - UET GPT",
    description: "Privacy policy and data protection commitments for UET GPT users.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7]">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Privacy", url: `${siteUrl}/privacy` },
        ]}
      />
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Privacy Policy</span>
        </nav>

        <header className="mb-12 border-b border-[#27272a] pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#a1a1aa]">Last Updated: September 1, 2026</p>
        </header>

        <section className="space-y-8 text-base text-[#a1a1aa] leading-relaxed">
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">1. Information We Collect</h2>
            <p>
              UET GPT collects minimal information necessary to provide conversational answers and
              preserve session preferences. When you interact with our service, we process the
              questions you submit, associated search sessions, and standard anonymous telemetry
              (browser type, approximate region) to ensure reliable operation.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              2. How We Use Your Information
            </h2>
            <p>
              Your queries are processed through retrieval models and language models to construct
              accurate answers about UET Taxila. We do not sell, rent, or monetize your personal
              information or conversations.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">3. Cookies &amp; Local Storage</h2>
            <p>
              We use local storage strictly for essential user preferences, such as selected model
              modes, UI preferences, and cookie consent status.
            </p>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-white mb-3">4. Contact Us</h2>
            <p>
              If you have any questions regarding this Privacy Policy, you can reach out via our{" "}
              <Link href="/contact" className="text-[#d9b451] hover:underline">
                Contact Page
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
