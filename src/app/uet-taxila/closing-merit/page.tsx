import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";
import { MERIT_ARCHIVE_DATA } from "@/lib/merit-archive-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const title = "UET Taxila Closing Merit 2022-2025: Historical Trends by Discipline";
const description =
  "UET Taxila's Category A and Category S closing merit history (2022-2025) for all 15 undergraduate disciplines, with year-over-year trend direction for each program.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}/uet-taxila/closing-merit`,
  },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/uet-taxila/closing-merit`,
    type: "article",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Closing Merit History - UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [`${siteUrl}/opengraph-image`],
  },
};

const TREND_STYLES: Record<string, string> = {
  rising: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  stable: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  competitive: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
};

const faqs = [
  {
    q: "What was UET Taxila's closing merit for Computer Science in 2025?",
    a: "UET Taxila's BS Computer Science closed at 80.450% aggregate for Category A (Subsidized) and 74.800% for Category S (Self-Finance) in 2025 — see the full table above for every discipline and year.",
  },
  {
    q: "How much has UET Taxila's Computer Science merit risen since 2022?",
    a: 'BS Computer Science\'s Category A closing merit rose from 78.910% in 2022 to 80.450% in 2025 — a steady upward trend, marked "rising" in the table above alongside Software Engineering and Computer Engineering.',
  },
  {
    q: "What is the difference between Category A and Category S closing merit?",
    a: "Category A is the subsidized, lower-tuition quota with a higher closing merit. Category S (Self-Finance) has a lower closing merit but significantly higher tuition. Both are shown for 2025 in the table above.",
  },
  {
    q: "Which UET Taxila disciplines have the most competitive closing merit?",
    a: "Computer Science, Software Engineering, and Computer Engineering consistently close highest and are trending upward. Basic Sciences programs (Mathematics, Physics, Chemistry) close lowest among the 15 disciplines tracked.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/uet-taxila/closing-merit#faq`,
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function ClosingMeritPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "Closing Merit History", url: `${siteUrl}/uet-taxila/closing-merit` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 w-full"
      >
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <Link href="/uet-taxila" className="hover:text-white transition-colors">
            UET Taxila
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Closing Merit History</span>
        </nav>

        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              Admissions Data
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              {MERIT_ARCHIVE_DATA.length} Disciplines &bull; 2022-2025
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Closing Merit History
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            Category A (Subsidized) closing merit from 2022 to 2025, plus 2025 Category S
            (Self-Finance) figures, across all {MERIT_ARCHIVE_DATA.length} UET Taxila undergraduate
            disciplines — with the year-over-year trend for each.
          </p>
        </header>

        <section className="mb-14 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs sm:text-sm text-[#a1a1aa]">
            <thead className="bg-[#07080a] text-[11px] font-mono uppercase text-white">
              <tr>
                <th className="p-3.5">Discipline</th>
                <th className="p-3.5">2022</th>
                <th className="p-3.5">2023</th>
                <th className="p-3.5">2024</th>
                <th className="p-3.5 text-[#d9b451]">2025 (Cat A)</th>
                <th className="p-3.5">2025 (Cat S)</th>
                <th className="p-3.5">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#0c0d10]">
              {MERIT_ARCHIVE_DATA.map((row) => (
                <tr key={row.discipline} className="hover:bg-white/[0.02]">
                  <td className="p-3.5 font-semibold text-white">{row.discipline}</td>
                  <td className="p-3.5">{row.categoryA_2022}</td>
                  <td className="p-3.5">{row.categoryA_2023}</td>
                  <td className="p-3.5">{row.categoryA_2024}</td>
                  <td className="p-3.5 font-bold text-[#d9b451]">{row.categoryA_2025}</td>
                  <td className="p-3.5">{row.categoryS_2025}</td>
                  <td className="p-3.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-mono capitalize ${
                        TREND_STYLES[row.trend] ?? ""
                      }`}
                    >
                      {row.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/tools?tab=archive"
            className="rounded-xl border border-[#d9b451]/30 bg-[#0c0d10] p-5 hover:border-[#d9b451]/60 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Search &amp; Filter by Discipline &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Use the interactive explorer to search or filter engineering vs. sciences.
            </p>
          </Link>
          <Link
            href="/tools?tab=merit"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Calculate Your Aggregate &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              See how your Matric, FSc, and ECAT scores compare to these closing merits.
            </p>
          </Link>
        </section>

        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {faqs.map((f) => (
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
