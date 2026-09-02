import type { Metadata } from "next";
import Link from "next/link";
import { MeritArchiveExplorer } from "@/components/calculator/merit-archive-explorer";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Closing Merit Archive: 5-Year Historical Trends",
  description: `Official UET Taxila historical closing merits (2021-2025) and ${CURRENT_ACADEMIC_YEAR} cutoff benchmarks for all 14 engineering and computing disciplines across Category A and S.`,
  alternates: {
    canonical: `${siteUrl}/merit-archive`,
  },
  openGraph: {
    title: "UET Taxila Closing Merit Archive: 5-Year Historical Trends",
    description:
      "Explore 5-year historical closing merit cutoffs across all 14 departments at UET Taxila for Subsidized (Category A) and Self-Finance (Category S) seats.",
    url: `${siteUrl}/merit-archive`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Merit Archive",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Closing Merit Archive: 5-Year Trends",
    description: "Historical closing merit cutoffs for all departments at UET Taxila.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "Which department has the highest closing merit at UET Taxila?",
    a: "BS Computer Science holds the highest closing merit at UET Taxila (80.450% on Category A Open Merit in 2025), closely followed by BS Software Engineering (79.820%) and BSc Computer Engineering (76.900%).",
  },
  {
    q: "What is the difference between Category A and Category S closing merits?",
    a: "Category A (Subsidized Open Merit Punjab) is highly competitive with higher cutoff percentages (typically 70%-80%). Category S (Partial Subsidized / Self-Finance All Pakistan) generally closes 5% to 8% lower than Category A because students pay unsubsidized tuition (Rs. 130,000/semester).",
  },
  {
    q: "How does UET Taxila calculate the aggregate for merit lists?",
    a: "The official formula is: 33% ECAT + 50% Intermediate (F.Sc / ICS / DAE) + 17% Matriculation (SSC), plus 20 bonus marks for verified Hafiz-e-Quran candidates.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/merit-archive#faq`,
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function MeritArchivePage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Merit Archive", url: `${siteUrl}/merit-archive` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 w-full"
      >
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Merit Archive</span>
        </nav>

        {/* Header */}
        <header className="mb-12 border-b border-white/10 pb-8 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Admissions Intelligence Archive
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Historical Closing Merit Archive
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            Multi-year historical cutoff aggregates across all 14 undergraduate engineering,
            computing, and basic science disciplines.
          </p>
        </header>

        {/* Interactive Explorer */}
        <section aria-label="Interactive Closing Merit Explorer" className="mb-14">
          <MeritArchiveExplorer />
        </section>

        {/* Analytical Trends Section */}
        <section className="mb-14 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            5-Year Merit Evolution &amp; Insights
          </h2>
          <div className="space-y-4 text-sm sm:text-base text-[#a1a1aa] leading-relaxed">
            <p>
              <strong className="text-white">1. Computing Surge (CS &amp; SE):</strong> Over the
              past five cycles (2021&ndash;2025), closing merits for Computer Science and Software
              Engineering have surged from ~77% to over 80.4%, reflecting intense market demand for
              AI, cloud computing, and software development talent.
            </p>
            <p>
              <strong className="text-white">2. Core Engineering Stability:</strong> Flagship
              programs such as Electrical, Mechanical, and Civil Engineering have stabilized within
              the 71.4% to 74.2% aggregate band on Category A, offering robust, consistent
              admissions avenues for pre-engineering applicants.
            </p>
            <p>
              <strong className="text-white">3. Self-Finance Safety Margin:</strong> Category S
              (Partial Subsidized All Pakistan) consistently provides a 5% to 8% aggregate buffer
              compared to Category A, enabling students from outside Punjab or with borderline
              aggregates to secure admission into top computing disciplines.
            </p>
          </div>
        </section>

        {/* Quick Links to Tools */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Calculate your own aggregate and compare it against historical cutoffs.
            </p>
          </Link>
          <Link
            href="/compare"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Compare Universities &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Compare UET Taxila merit formulas and fees with NUST, FAST, and GIKI.
            </p>
          </Link>
          <Link
            href="/ecat-guide"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              ECAT Strategy Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Prepare for the 400-marks exam to maximize your aggregate score.
            </p>
          </Link>
        </section>

        {/* FAQs */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
                <dt className="text-base font-semibold text-white mb-2">{f.q}</dt>
                <dd className="text-sm text-[#a1a1aa] leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
