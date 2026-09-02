import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";
import { LEARN_TERMS } from "@/lib/learn-terms";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Glossary - Learn Key Terms - UET GPT",
  description:
    "The UET GPT glossary explains key UET Taxila terms: ECAT, merit formula, eligibility criteria, hostel allotment, scholarships, and fee structures in detail.",
  alternates: {
    canonical: `${siteUrl}/learn`,
  },
  openGraph: {
    title: "UET Taxila Glossary - Learn Key Terms - UET GPT",
    description:
      "Understand UET Taxila admissions jargon: ECAT, merit formula, eligibility, hostel allotment, scholarships, and fees - all explained and source-cited by UET GPT.",
    url: `${siteUrl}/learn`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Glossary — UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Glossary - Learn Key Terms - UET GPT",
    description:
      "Understand UET Taxila admissions jargon: ECAT, merit formula, eligibility, hostel allotment, scholarships, and fees.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const collectionSchema = {
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name: "UET Taxila Glossary",
  description:
    "Key UET Taxila terms explained: ECAT, merit formula, eligibility criteria, hostel allotment, scholarships, and fee structure.",
  url: `${siteUrl}/learn`,
  dateModified: SCHEMA_DATE_MODIFIED,
  publisher: {
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "UET GPT",
  },
  mainEntity: {
    "@type": "ItemList",
    itemListElement: LEARN_TERMS.map((t, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: t.title,
      url: `${siteUrl}/learn/${t.slug}`,
    })),
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

      <div className="flex min-h-screen flex-col bg-[#07080a] text-[#edf0ec]">
        <PublicNav />

        <main id="main-content" className="flex-1">
          {/* Hero */}
          <section className="px-6 pt-24 pb-12 max-w-3xl mx-auto text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-[#d9b451] mb-6">
              Taxila Knowledge Base
            </span>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET Taxila <span className="text-[#d9b451]">Glossary</span>
            </h1>
            <p className="text-base sm:text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8 leading-relaxed">
              Key terms every UET Taxila applicant and student should know — explained clearly and
              sourced from the official undergraduate prospectus and statutory rules.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d9b451] text-[#07080a] font-bold hover:bg-[#f0d178] transition-colors text-xs font-mono uppercase tracking-wider shadow-md shadow-[#d9b451]/10"
            >
              <span>Ask UET GPT Anything</span>
              <span>&rarr;</span>
            </Link>
          </section>

          {/* Term cards */}
          <section className="px-6 pb-20 max-w-3xl mx-auto">
            <div className="space-y-4">
              {LEARN_TERMS.map((term) => (
                <Link
                  key={term.slug}
                  href={`/learn/${term.slug}`}
                  className="block p-6 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 hover:bg-white/[0.02] transition-all group"
                >
                  <h2 className="font-bold text-base mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                    {term.title}
                  </h2>
                  <p className="text-sm text-[#a1a1aa] line-clamp-2 leading-relaxed">
                    {term.lead.slice(0, 140)}...
                  </p>
                  <span className="mt-3 inline-block text-xs font-mono text-[#d9b451] font-semibold">
                    Read detailed breakdown &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* 4 Core Pillars Links */}
          <section className="px-6 py-12 max-w-3xl mx-auto border-t border-white/10">
            <h3 className="text-xs font-mono uppercase tracking-widest text-[#d9b451] font-bold mb-4">
              Explore 4 Core University Pillars
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/tools"
                className="p-4 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-[10px] font-mono text-[#d9b451] uppercase font-bold">
                  Pillar 01
                </div>
                <h4 className="text-sm font-bold text-white mt-1">Engineering Tools Suite</h4>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Merit calculator, GPA simulator, and 5-yr archive.
                </p>
              </Link>
              <Link
                href="/academics"
                className="p-4 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-[10px] font-mono text-[#d9b451] uppercase font-bold">
                  Pillar 02
                </div>
                <h4 className="text-sm font-bold text-white mt-1">Academics &amp; Syllabi</h4>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  14 accredited degree roadmaps and academic calendar.
                </p>
              </Link>
              <Link
                href="/admissions"
                className="p-4 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-[10px] font-mono text-[#d9b451] uppercase font-bold">
                  Pillar 03
                </div>
                <h4 className="text-sm font-bold text-white mt-1">Admissions, Aid &amp; Fees</h4>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Eligibility criteria, ECAT blueprint, and fee simulator.
                </p>
              </Link>
              <Link
                href="/campus-life"
                className="p-4 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-[10px] font-mono text-[#d9b451] uppercase font-bold">
                  Pillar 04
                </div>
                <h4 className="text-sm font-bold text-white mt-1">Campus Life &amp; Facilities</h4>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  5 residential halls, 25+ bus routes, and societies.
                </p>
              </Link>
            </div>
          </section>

          {/* CTA */}
          <section className="px-6 py-16 max-w-3xl mx-auto text-center border-t border-white/10">
            <h2 className="text-xl font-bold mb-3 text-white">Can&apos;t find your answer?</h2>
            <p className="text-sm text-[#a1a1aa] mb-6 leading-relaxed max-w-xl mx-auto">
              UET GPT answers any question about UET Taxila — admissions, programs, fees, campus
              life, scholarships — using official university documents. Free for every student and
              applicant.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d9b451] text-[#07080a] font-bold hover:bg-[#f0d178] transition-colors text-xs font-mono uppercase tracking-wider"
            >
              <span>Ask UET GPT Assistant</span>
              <span>&rarr;</span>
            </Link>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
