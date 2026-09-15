import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CALENDAR_EVENTS } from "@/lib/campus-data";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const title = `UET Taxila Academic Calendar ${CURRENT_ACADEMIC_YEAR}: Key Dates`;
const description = `Official UET Taxila ${CURRENT_ACADEMIC_YEAR} dates for ECAT registration, merit lists, semester start, mid-term and final examinations.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}/uet-taxila/academic-calendar`,
  },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/uet-taxila/academic-calendar`,
    type: "article",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Academic Calendar - UET GPT",
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

const CATEGORY_STYLES: Record<string, string> = {
  admissions: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  exams: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
};

const faqs = [
  {
    q: `When does ECAT ${CURRENT_ACADEMIC_YEAR} registration open at UET Taxila?`,
    a: "ECAT registration typically opens mid-July and closes mid-August. Check the exact current-cycle dates in the table above, which is kept in sync with the interactive academic calendar.",
  },
  {
    q: "When are UET Taxila merit lists announced?",
    a: "The first merit list for Category A (Subsidized) and Category S (Self-Finance) is announced roughly one week after ECAT results, in early September.",
  },
  {
    q: "When do UET Taxila Fall semester classes start?",
    a: "Freshmen orientation and the commencement of regular Fall undergraduate classes take place in late September.",
  },
  {
    q: "When are UET Taxila mid-semester and final exams held?",
    a: "Mid-semester exams are held in the 9th week (typically late November), and comprehensive final examinations are held in the 18th week (typically late January to early February).",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/uet-taxila/academic-calendar#faq`,
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

export default function AcademicCalendarPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "Academic Calendar", url: `${siteUrl}/uet-taxila/academic-calendar` },
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
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <Link href="/uet-taxila" className="hover:text-white transition-colors">
            UET Taxila
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Academic Calendar</span>
        </nav>

        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              Academics
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              Admissions &bull; Classes &bull; Exams
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Academic Calendar {CURRENT_ACADEMIC_YEAR}
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            Official dates for entrance tests, merit admissions clearance, semester starts, and
            examinations at UET Taxila.
          </p>
        </header>

        <section className="mb-14">
          <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#0c0d10]">
            {CALENDAR_EVENTS.map((item) => (
              <div
                key={item.title}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-2 hover:bg-white/[0.01] transition-colors"
              >
                <div className="space-y-1">
                  <span className="font-mono text-xs text-[#d9b451] font-bold uppercase tracking-wider block">
                    {item.date}
                  </span>
                  <h2 className="text-sm font-semibold text-white">{item.title}</h2>
                  <p className="text-xs text-[#a1a1aa]">{item.desc}</p>
                </div>
                <span
                  className={`self-start sm:self-center shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-mono capitalize ${
                    CATEGORY_STYLES[item.category] ?? ""
                  }`}
                >
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/uet-taxila/ecat-guide"
            className="rounded-xl border border-[#d9b451]/30 bg-[#0c0d10] p-5 hover:border-[#d9b451]/60 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              ECAT Preparation Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Get ready for the registration and test dates above.
            </p>
          </Link>
          <Link
            href="/academics?tab=calendar"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Filter by Category &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Use the interactive calendar to filter admissions, classes, or exam dates only.
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
