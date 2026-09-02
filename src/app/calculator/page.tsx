import type { Metadata } from "next";
import Link from "next/link";
import { MeritCalculator } from "@/components/calculator/merit-calculator";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Merit Calculator 2026: ECAT Aggregate",
  description:
    "Calculate your UET Taxila aggregate with the official merit formula: 33% ECAT, 50% HSSC, 17% SSC. Check department closing merits & eligibility.",
  alternates: {
    canonical: `${siteUrl}/calculator`,
  },
  openGraph: {
    title: "UET Taxila Merit Calculator 2026: ECAT Aggregate",
    description:
      "Calculate your UET Taxila aggregate with the official merit formula: 33% ECAT, 50% HSSC, 17% SSC. Check department closing merits & eligibility.",
    url: `${siteUrl}/calculator`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Merit Calculator 2026",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Merit Calculator 2026: ECAT Aggregate",
    description:
      "Calculate your UET Taxila admission aggregate with ECAT, HSSC, and SSC marks in real-time.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "How is UET Taxila merit calculated in 2026?",
    a: "UET Taxila calculates admission merit using a 3-part weighted formula: 33% ECAT entry test score, 50% HSSC/FSc marks, and 17% SSC/Matric marks. The formula is: Aggregate % = (ECAT Marks/400 * 33) + (HSSC Marks/Total * 50) + (SSC Marks/Total * 17).",
  },
  {
    q: "What is the minimum eligibility for engineering programs at UET Taxila?",
    a: "Applicants to BSc Engineering programs must have at least 60% unadjusted marks in F.Sc Pre-Engineering or equivalent, plus a valid ECAT score. For BS Computer Science, BS Mathematics, and BS Physics, the minimum threshold is 50%.",
  },
  {
    q: "How many bonus marks are awarded for Hifz-e-Quran or NCC?",
    a: "A credit of 20 marks is added to the highest-qualification component (HSSC or DAE) of the merit formula for memorization of the Holy Quran (Hifz-e-Quran) or NCC training. This credit counts towards merit aggregate, not basic eligibility.",
  },
  {
    q: "Can DAE diploma holders use this merit calculator?",
    a: "Yes. DAE holders enter their cumulative 1st and 2nd year marks in the HSSC field, which accounts for 50% of the aggregate score.",
  },
];

export default function CalculatorPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/calculator#faq`,
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteUrl}/calculator#app`,
    name: "UET Taxila Merit Calculator",
    url: `${siteUrl}/calculator`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "PKR",
    },
    description:
      "Free interactive calculator to compute UET Taxila admission aggregate using ECAT, HSSC, and SSC marks.",
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Merit Calculator", url: `${siteUrl}/calculator` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema definitions
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema definitions
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 w-full"
      >
        {/* Breadcrumb Navigation */}
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Merit Calculator</span>
        </nav>

        {/* Page Header */}
        <header className="mb-10 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Official 2026 Prospectus Formula
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Merit Calculator 2026
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            Compute your undergraduate admission aggregate in real-time according to Chapter 5 of
            the official UET Taxila Prospectus (<strong>33% ECAT + 50% HSSC + 17% SSC</strong>).
          </p>
        </header>

        {/* Interactive Calculator Section */}
        <section aria-label="Calculator Tool" className="mb-16">
          <MeritCalculator />
        </section>

        {/* Educational Explanatory Section */}
        <section className="mb-16 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            How UET Taxila Admission Aggregate is Calculated
          </h2>
          <div className="space-y-4 text-sm text-[#a1a1aa] leading-relaxed">
            <p>
              According to Chapter 5, Section 5.1 of the UET Taxila Undergraduate Prospectus,
              undergraduate admission merit across all engineering and computing disciplines is
              determined by the weighted formula:
            </p>
            <div className="rounded-xl bg-[#14151a] p-4 font-mono text-xs sm:text-sm text-[#d9b451] border border-white/5 overflow-x-auto">
              Aggregate % = [33 &times; (ECAT / 400)] + [50 &times; ((HSSC + Bonus) / Total)] + [17
              &times; (SSC / Total)]
            </div>
            <ul className="list-disc pl-5 space-y-2 pt-2">
              <li>
                <strong className="text-white">ECAT Component (33%):</strong> Measures performance
                in the Engineering College Admission Test conducted by UET Lahore.
              </li>
              <li>
                <strong className="text-white">HSSC / F.Sc Component (50%):</strong> Uses Part-1 or
                total marks obtained in intermediate examination.
              </li>
              <li>
                <strong className="text-white">SSC / Matric Component (17%):</strong> Accounts for
                secondary school certificate board marks.
              </li>
              <li>
                <strong className="text-white">Bonus Marks:</strong> 20 marks are added to the HSSC
                component for verified Hifz-e-Quran or NCC candidates.
              </li>
            </ul>
          </div>
        </section>

        {/* Quick Navigation Links */}
        <section className="mb-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/uet-taxila/admissions"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Admissions Guide 2026 &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Eligibility, required documents, and merit list schedules.
            </p>
          </Link>
          <Link
            href="/uet-taxila/fee-structure"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Fee Structure Breakdown &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Tuition, hostel charges, and semester payment plans.
            </p>
          </Link>
          <Link
            href="/scholarships"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Scholarships &amp; Aid &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              HEC Need-Based, Ehsaas, and alumni financial aid programs.
            </p>
          </Link>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
                <dt className="text-base font-semibold text-white mb-2">{item.q}</dt>
                <dd className="text-sm text-[#a1a1aa] leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
