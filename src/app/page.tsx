import type { Metadata } from "next";
import Link from "next/link";
import { MedallionCanvas } from "@/components/landing/medallion-canvas";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET GPT: AI Guide & Tools for UET Taxila Admissions",
  description:
    "Free, open-source AI guide for UET Taxila: merit calculator, ECAT 2026 aggregates, 14 engineering syllabi, fee simulator, and campus transit guide.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "UET GPT: AI Guide & Tools for UET Taxila Admissions",
    description:
      "Free, open-source AI guide for UET Taxila: merit calculator, ECAT 2026 aggregates, 14 engineering syllabi, fee simulator, and campus transit guide.",
    url: siteUrl,
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET GPT: Independent AI Guide for UET Taxila",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET GPT: AI Guide & Tools for UET Taxila Admissions",
    description:
      "Free, open-source AI guide for UET Taxila: merit calculator, ECAT 2026 aggregates, 14 engineering syllabi, fee simulator, and campus transit guide.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const HOMEPAGE_FAQS = [
  {
    q: "What is UET GPT?",
    a: "UET GPT is an independent, open-source AI assistant for UET Taxila. It combines real-time engineering calculation tools (Merit, SGPA/CGPA, Fees) with Retrieval-Augmented Generation (RAG) across official university documents, prospectuses, departmental syllabi, and statutory regulations.",
  },
  {
    q: "How does the merit calculator work?",
    a: "It calculates admission aggregates using the statutory PEC formula: 33% ECAT score + 50% Intermediate (HSSC/FSc/DAE) + 17% Matriculation (SSC) + 20 marks bonus for Hifz-e-Quran / NCC. It compares your aggregate directly against 5-year closing merit cutoffs across all 14 degree programs.",
  },
  {
    q: "Are the degree programs accredited under the Washington Accord?",
    a: "Yes. All undergraduate engineering programs at UET Taxila are accredited by the Pakistan Engineering Council (PEC) under Level-II (Washington Accord substantial equivalence), granting international degree mobility across signatory nations including the US, UK, Canada, Australia, and Japan.",
  },
  {
    q: "What scholarships and financial aid are available at UET Taxila?",
    a: "Over 35% of undergraduates receive financial sponsorship. Major programs include Punjab Chief Minister Honhaar Scholarship (100% tuition for 4 years), HEC Need-Based Aid (tuition + PKR 6,000/mo stipend), Workers Welfare Fund (100% fees, hostel, transport, books), PEEF, and UETTAA Alumni emergency grants.",
  },
  {
    q: "How many commuter bus routes serve the Twin Cities?",
    a: "The university operates a fleet of 25+ high-capacity buses servicing key routes across Islamabad (Aabpara, Zero Point, Faizabad, I-8, H-8), Rawalpindi (Saddar, Murree Road, 6th Road, Peshawar Road), Wah Cantt, Hassan Abdal, and Attock.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/#faq`,
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: HOMEPAGE_FAQS.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

const QUICK_PROMPTS = [
  { label: "Calculate Merit Aggregate", href: "/tools?tab=merit", badge: "Tool" },
  { label: "ECAT 2026 Blueprint", href: "/admissions?tab=ecat", badge: "Strategy" },
  { label: "14 Degree Syllabi", href: "/academics?tab=programs", badge: "Roadmap" },
  { label: "Fee Simulator & Dues", href: "/admissions?tab=fees", badge: "Calc" },
  { label: "Twin Cities Bus Routes", href: "/campus-life?tab=transport", badge: "Transit" },
  { label: "Honhaar & HEC Aid", href: "/tools?tab=scholarships", badge: "Aid" },
];

const STATS = [
  { value: "14", label: "Accredited Programs", note: "PEC Level-II / Washington Accord" },
  { value: "33/50/17", label: "Merit Equation", note: "ECAT / HSSC / SSC Statutory Split" },
  { value: "25+", label: "Commuter Bus Routes", note: "Twin Cities, Wah & Attock Fleet" },
  { value: "100%", label: "Tuition Aid Schemes", note: "Honhaar, HEC Need-Based & WWF" },
];

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="relative min-h-screen bg-[#07080a] text-[#edf0ec] selection:bg-[#d9b451] selection:text-[#07080a] overflow-x-hidden font-sans flex flex-col">
        <MedallionCanvas />

        <PublicNav />

        <main id="main-content" className="relative z-10 flex-1">
          {/* Asymmetric High-Impact Hero */}
          <section className="px-6 pt-24 pb-16 max-w-6xl mx-auto">
            <div className="flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 text-[#d9b451] text-xs font-mono uppercase tracking-widest mb-6">
                <span className="h-2 w-2 rounded-full bg-[#d9b451] animate-pulse" />
                <span>Independent, Open-Source AI Guide &bull; UET Taxila</span>
              </div>

              <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white mb-6 leading-[1.08] max-w-4xl">
                Engineering Intelligence for{" "}
                <span className="font-serif italic font-normal text-[#d9b451]">UET Taxila</span>
              </h1>

              <p className="text-base sm:text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8 leading-relaxed font-normal">
                Everything you need for undergraduate admissions, PEC Washington Accord degree
                syllabi, real-time aggregate calculation, semester GPA tracking, and campus transit
                , grounded in verified university data.
              </p>

              <p className="text-xs text-[#71717a] mb-8">Last updated: {SCHEMA_DATE_MODIFIED}</p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 w-full sm:w-auto">
                <Link
                  href="/chat"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#d9b451] text-[#07080a] font-bold hover:bg-[#f0d178] transition-all text-sm font-mono tracking-wider uppercase shadow-xl shadow-[#d9b451]/15 min-h-[46px] flex items-center justify-center"
                >
                  Ask UET GPT Anything &rarr;
                </Link>
                <Link
                  href="/tools?tab=merit"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-[#d9b451]/40 text-[#d9b451] hover:bg-[#d9b451]/10 transition-all text-sm font-mono tracking-wider uppercase min-h-[46px] flex items-center justify-center"
                >
                  Calculate Merit Aggregate
                </Link>
                <Link
                  href="/admissions"
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-white/15 text-white hover:border-white/30 transition-all text-sm font-mono tracking-wider uppercase min-h-[46px] flex items-center justify-center"
                >
                  Admissions {CURRENT_ACADEMIC_YEAR}
                </Link>
              </div>

              {/* Interactive Quick-Jump Prompt Chips */}
              <div className="mt-10 w-full max-w-3xl pt-8 border-t border-white/10">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#71717a] block mb-3">
                  Direct Tools &amp; Curriculums:
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <Link
                      key={prompt.label}
                      href={prompt.href}
                      className="group flex items-center gap-2 rounded-lg border border-white/10 bg-[#0c0d10] px-3.5 py-1.5 text-xs font-mono text-zinc-300 hover:border-[#d9b451]/50 hover:bg-[#121318] hover:text-white transition-all"
                    >
                      <span className="text-[9px] uppercase font-bold text-[#d9b451] bg-[#d9b451]/10 px-1.5 py-0.5 rounded">
                        {prompt.badge}
                      </span>
                      <span>{prompt.label}</span>
                      <span className="text-zinc-500 group-hover:text-[#d9b451] group-hover:translate-x-0.5 transition-transform">
                        &rarr;
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Institutional Pedigree Statistics Bar */}
          <section className="px-6 py-12 max-w-6xl mx-auto border-y border-white/10 bg-[#0c0d10]/60">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {STATS.map((stat) => (
                <div key={stat.label} className="space-y-1">
                  <div className="text-3xl sm:text-4xl font-extrabold font-mono text-[#d9b451] tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider">
                    {stat.label}
                  </div>
                  <div className="text-[11px] text-[#a1a1aa] font-mono">{stat.note}</div>
                </div>
              ))}
            </div>
          </section>

          {/* 4 Core Pillars Bento Grid */}
          <section className="px-6 py-20 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-[#d9b451] font-bold">
                  Core Architecture
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 tracking-tight">
                  Four Thematic Power-Hubs
                </h2>
                <p className="text-xs sm:text-sm text-[#a1a1aa] mt-1 max-w-xl">
                  Consolidated architecture designed to eliminate fragmented navigation and provide
                  deep, citation-grounded utility for every student and applicant.
                </p>
              </div>

              <Link
                href="/chat"
                className="inline-flex items-center gap-1.5 text-xs font-mono text-[#d9b451] hover:underline"
              >
                <span>Or ask AI any custom question</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Pillar 1: Tools Suite (7 Cols) */}
              <div className="md:col-span-7 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 flex flex-col justify-between hover:border-[#d9b451]/50 transition-all group">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="font-mono text-xs font-bold text-[#d9b451]">
                      PILLAR 01 &bull; DECISION SUITE
                    </span>
                    <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                      4 Interactive Calculators
                    </span>
                  </div>
                  <Link href="/tools">
                    <h3 className="text-2xl font-bold text-white group-hover:text-[#d9b451] transition-colors mb-2">
                      Engineering Tools &amp; Calculators
                    </h3>
                  </Link>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed mb-6">
                    Real-time merit aggregate calculator with statutory 33/50/17 formula, official
                    4.00 scale SGPA/CGPA simulator with probation warnings, 5-year closing merit
                    cutoffs archive, and scholarship eligibility matcher.
                  </p>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/tools?tab=merit"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Merit Calculator &rarr;
                    </Link>
                    <Link
                      href="/tools?tab=gpa"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      GPA &amp; CGPA Calc &rarr;
                    </Link>
                    <Link
                      href="/tools?tab=archive"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      5-Yr Merit Archive &rarr;
                    </Link>
                    <Link
                      href="/tools?tab=scholarships"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Aid Screener &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Academics (5 Cols) */}
              <div className="md:col-span-5 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 flex flex-col justify-between hover:border-[#d9b451]/50 transition-all group">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="font-mono text-xs font-bold text-[#d9b451]">
                      PILLAR 02 &bull; CURRICULUMS
                    </span>
                    <span className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400">
                      PEC Level-II
                    </span>
                  </div>
                  <Link href="/academics">
                    <h3 className="text-2xl font-bold text-white group-hover:text-[#d9b451] transition-colors mb-2">
                      Academics, Syllabi &amp; Calendar
                    </h3>
                  </Link>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed mb-6">
                    Official 4-year semester roadmaps for all 14 undergraduate programs, course
                    credit allocations, OBE assessment rubrics, and the academic calendar{" "}
                    {CURRENT_ACADEMIC_YEAR}.
                  </p>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/academics?tab=programs"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      14 Curriculums &rarr;
                    </Link>
                    <Link
                      href="/academics?tab=calendar"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Academic Calendar &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Pillar 3: Admissions (5 Cols) */}
              <div className="md:col-span-5 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 flex flex-col justify-between hover:border-[#d9b451]/50 transition-all group">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="font-mono text-xs font-bold text-[#d9b451]">
                      PILLAR 03 &bull; ADMISSIONS
                    </span>
                    <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                      {CURRENT_ACADEMIC_YEAR} Gateway
                    </span>
                  </div>
                  <Link href="/admissions">
                    <h3 className="text-2xl font-bold text-white group-hover:text-[#d9b451] transition-colors mb-2">
                      Admissions, Aid &amp; Fees
                    </h3>
                  </Link>
                  <p className="text-xs text-[#a1a1aa] leading-relaxed mb-6">
                    Statutory eligibility rules (60% engineering vs 50% computing), ECAT 400-mark
                    strategy blueprint, interactive semester fee simulator, and 5-university
                    comparison matrix.
                  </p>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/admissions?tab=overview"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Eligibility Rules &rarr;
                    </Link>
                    <Link
                      href="/admissions?tab=ecat"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      ECAT Blueprint &rarr;
                    </Link>
                    <Link
                      href="/admissions?tab=fees"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Fee Simulator &rarr;
                    </Link>
                  </div>
                </div>
              </div>

              {/* Pillar 4: Campus Life (7 Cols) */}
              <div className="md:col-span-7 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 flex flex-col justify-between hover:border-[#d9b451]/50 transition-all group">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <span className="font-mono text-xs font-bold text-[#d9b451]">
                      PILLAR 04 &bull; STUDENT LIFE
                    </span>
                    <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                      Housing, Transit &amp; Clubs
                    </span>
                  </div>
                  <Link href="/campus-life">
                    <h3 className="text-2xl font-bold text-white group-hover:text-[#d9b451] transition-colors mb-2">
                      Campus Life &amp; Facilities
                    </h3>
                  </Link>
                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed mb-6">
                    Explore 5 on-campus residential halls (Allama Iqbal, Quaid-e-Azam, Sir Syed,
                    Ali, Fatima Jinnah), 25+ commuter bus route timetables across Islamabad and
                    Rawalpindi, 12 registered student chapters, and searchable telephone phonebook.
                  </p>
                </div>
                <div className="border-t border-white/5 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href="/campus-life?tab=hostels"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      5 Hostels &rarr;
                    </Link>
                    <Link
                      href="/campus-life?tab=transport"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Bus Timetables &rarr;
                    </Link>
                    <Link
                      href="/campus-life?tab=societies"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      12 Societies &rarr;
                    </Link>
                    <Link
                      href="/campus-life?tab=directory"
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1 text-xs font-mono text-zinc-300 hover:border-[#d9b451] hover:text-white transition-colors"
                    >
                      Campus Directory &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* FAQ Accordion Section */}
          <section id="faq" className="px-6 py-20 max-w-4xl mx-auto border-t border-white/10">
            <div className="text-center mb-12">
              <div className="text-xs font-mono text-[#d9b451] uppercase tracking-widest mb-2 font-bold">
                Knowledge Base
              </div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">
                Frequently Asked Questions
              </h2>
            </div>
            <div className="space-y-4">
              {HOMEPAGE_FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group p-5 rounded-xl border border-white/10 bg-[#0c0d10] transition-all [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between font-bold text-sm sm:text-base text-white cursor-pointer select-none">
                    <span>{faq.q}</span>
                    <span className="text-[#d9b451] font-mono text-lg group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-xs sm:text-sm text-[#a1a1aa] leading-relaxed border-t border-white/10 pt-4">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
