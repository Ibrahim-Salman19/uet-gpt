import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Terms of Service - UET GPT",
  description:
    "Terms of Service for UET GPT. Information on informational use, student community guidance, and non-affiliation disclaimers with official bodies.",
  alternates: {
    canonical: `${siteUrl}/terms`,
  },
  openGraph: {
    title: "Terms of Service - UET GPT",
    description:
      "Terms of Service for UET GPT. Information on informational use, student community guidance, and non-affiliation disclaimers with official bodies.",
    url: `${siteUrl}/terms`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Terms of Service — UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service - UET GPT",
    description: "Terms of Service and legal disclosures for UET GPT users.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Terms", url: `${siteUrl}/terms` },
        ]}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 w-full"
      >
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Terms of Service</span>
        </nav>

        <header className="mb-12 border-b border-[#27272a] pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">
            Terms of Service
          </h1>
          <p className="text-sm text-[#a1a1aa]">Last Updated: September 1, 2026</p>
        </header>

        <section className="space-y-8 text-base text-[#a1a1aa] leading-relaxed">
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <h2 className="text-xl font-semibold text-white mb-3">1. Informational Purpose</h2>
            <p>
              UET GPT is provided strictly for informational and navigational assistance. While we
              ground all generated responses in official documents, users must verify official
              admission dates, fee receipts, and binding legal decisions through official university
              administration channels.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <h2 className="text-xl font-semibold text-white mb-3">2. Non-Affiliation Disclaimer</h2>
            <p>
              UET GPT is an independent, community-driven initiative. It is not affiliated with,
              endorsed by, or operated by the University of Engineering and Technology, Taxila, or
              any other university body.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <h2 className="text-xl font-semibold text-white mb-3">3. Acceptable Use</h2>
            <p>
              Users agree not to attempt to reverse engineer, disrupt, or flood the API services,
              nor to extract data in violation of privacy or applicable laws.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
