import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";
import { LEARN_TERMS } from "@/lib/learn-terms";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Glossary - Learn Key Terms - UET GPT",
  description:
    "The UET GPT glossary explains key UET Taxila terms: ECAT, merit formula, eligibility criteria, hostel allotment, scholarships, and fee structure - grounded in the official 2025 prospectus.",
  alternates: {
    canonical: `${siteUrl}/learn`,
  },
  openGraph: {
    title: "UET Taxila Glossary - Learn Key Terms - UET GPT",
    description:
      "Understand UET Taxila admissions jargon: ECAT, merit formula, eligibility, hostel allotment, scholarships, and fees - all explained and source-cited by UET GPT.",
    url: `${siteUrl}/learn`,
    type: "website",
  },
};

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "UET Taxila Glossary",
  description:
    "Key UET Taxila terms explained: ECAT, merit formula, eligibility criteria, hostel allotment, scholarships, and fee structure.",
  url: `${siteUrl}/learn`,
  dateModified: "2026-07-16",
  publisher: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "UET GPT Team",
  },
};

export default function LearnIndexPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Learn", url: `${siteUrl}/learn` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">
              U
            </div>
            <span className="font-semibold text-base">UET GPT</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET GPT Home
            </Link>
            <Link
              href="/uet-taxila"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET Taxila Hub
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          {/* Hero */}
          <section className="px-6 pt-24 pb-12 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET Taxila{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
                Glossary
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              Key terms every UET Taxila applicant and student should know — explained clearly and
              sourced from the official 2025 undergraduate prospectus.
            </p>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
            >
              Ask UET GPT Anything
            </Link>
          </section>

          {/* Term cards */}
          <section className="px-6 pb-20 max-w-3xl mx-auto">
            <div className="space-y-4">
              {LEARN_TERMS.map((term) => (
                <Link
                  key={term.slug}
                  href={`/learn/${term.slug}`}
                  className="block p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#3f3f46] transition-colors group"
                >
                  <h2 className="font-semibold text-base mb-2 group-hover:text-[#a78bfa] transition-colors">
                    {term.title}
                  </h2>
                  <p className="text-sm text-[#71717a] line-clamp-2">
                    {term.lead.slice(0, 140)}...
                  </p>
                  <span className="mt-3 inline-block text-xs text-[#6366f1] font-medium">
                    Read more &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section className="px-6 py-16 max-w-3xl mx-auto text-center border-t border-[#1a1a1e]">
            <h2 className="text-xl font-semibold mb-3">Can&apos;t find your answer?</h2>
            <p className="text-sm text-[#a1a1aa] mb-6">
              UET GPT answers any question about UET Taxila — admissions, programs, fees, campus
              life, scholarships — using official university documents. Free for every student and
              applicant.
            </p>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
            >
              Ask UET GPT
            </Link>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1a1a1e] px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#a1a1aa]">
              &copy; {new Date().getFullYear()} UET GPT Team. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-[#a1a1aa]">
              <Link href="/" className="hover:text-[#e1e1e2] transition-colors">
                UET GPT Home
              </Link>
              <Link href="/uet-taxila" className="hover:text-[#e1e1e2] transition-colors">
                UET Taxila Hub
              </Link>
              <Link
                href="/uet-taxila/admissions"
                className="hover:text-[#e1e1e2] transition-colors"
              >
                Admissions
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
