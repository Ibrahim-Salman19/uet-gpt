import type { Metadata } from "next";
import Link from "next/link";
import { MedallionCanvas } from "@/components/landing/medallion-canvas";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET GPT: Your AI Guide to UET Taxila",
  description:
    "UET GPT answers questions about UET Taxila: admissions, fees, ECAT, departments, and campus life. Free AI assistant powered by official university data.",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "UET GPT: Your AI Guide to UET Taxila",
    description:
      "UET GPT answers questions about UET Taxila: admissions, fees, ECAT, departments, and campus life. Free AI assistant powered by official university data.",
    url: siteUrl,
    type: "website",
    locale: "en_PK",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET GPT — AI Assistant for UET Taxila",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET GPT: Your AI Guide to UET Taxila",
    description:
      "UET GPT answers questions about UET Taxila: admissions, fees, ECAT, departments, and campus life.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const HOMEPAGE_FAQS = [
  {
    q: "What is UET GPT?",
    a: "UET GPT is an AI-powered assistant that answers questions about UET Taxila: admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more. It uses RAG (Retrieval-Augmented Generation) to provide accurate answers from official university data.",
  },
  {
    q: "Is UET GPT free to use?",
    a: "Yes, UET GPT is completely free for all UET Taxila students, faculty, and prospective applicants.",
  },
  {
    q: "What can I ask UET GPT about?",
    a: "You can ask about UET Taxila admissions, BS and MS fee structures, academic programs and departments, faculty information, hostel accommodation, transport routes, scholarship opportunities, campus facilities, examination schedules, and general university information.",
  },
  {
    q: "How does UET GPT get its information?",
    a: "UET GPT uses Retrieval-Augmented Generation (RAG) to pull information from official UET Taxila documents, including the university prospectus, fee schedules, departmental pages, and admission guidelines. All answers are grounded in verified university data.",
  },
  {
    q: "Does UET GPT work for UET Lahore or other UET campuses?",
    a: "UET GPT is currently focused on UET Taxila (University of Engineering and Technology, Taxila). It has been trained on official UET Taxila data including admissions information, fee structures, academic programs, and campus facilities specific to the Taxila campus.",
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

const PILLARS = [
  {
    id: "01",
    title: "Engineering Tools Suite",
    badge: "4-in-1 Suite",
    href: "/tools",
    desc: "Interactive tools for real-time aggregate calculation, semester GPA simulation, 5-year closing merit cutoffs archive, and financial aid qualification.",
    subLinks: [
      { label: "Merit Calculator", href: "/tools?tab=merit" },
      { label: "GPA & CGPA Calc", href: "/tools?tab=gpa" },
      { label: "5-Yr Closing Merit", href: "/tools?tab=archive" },
      { label: "Scholarship Screener", href: "/tools?tab=scholarships" },
    ],
  },
  {
    id: "02",
    title: "Academics & Syllabi",
    badge: "Washington Accord",
    href: "/academics",
    desc: "14 PEC Level-II accredited undergraduate engineering and computing roadmaps, official course syllabi, semester academic calendar, and OBE assessment rubrics.",
    subLinks: [
      { label: "14 Degree Curriculums", href: "/academics?tab=programs" },
      { label: "Academic Calendar", href: "/academics?tab=calendar" },
      { label: "Past Papers & OBE", href: "/academics?tab=resources" },
      { label: "CS & SE Roadmaps", href: "/uet-taxila/programs" },
    ],
  },
  {
    id: "03",
    title: "Admissions & Aid",
    badge: `${CURRENT_ACADEMIC_YEAR} Gateway`,
    href: "/admissions",
    desc: "Step-by-step admissions walkthrough, ECAT 400-mark preparation strategy, interactive semester fee simulator, and comprehensive financial aid grants.",
    subLinks: [
      { label: "Eligibility & Quotas", href: "/admissions?tab=overview" },
      { label: "ECAT 2026 Strategy", href: "/admissions?tab=ecat" },
      { label: "Fee Simulator", href: "/admissions?tab=fees" },
      { label: "Honhaar & HEC Aid", href: "/admissions?tab=scholarships" },
    ],
  },
  {
    id: "04",
    title: "Campus Life & Transit",
    badge: "Student Guide",
    href: "/campus-life",
    desc: "Everything about life on campus: 5 residential halls and hostel allotments, 25+ point bus route schedules across the Twin Cities, 12 student societies, and directory.",
    subLinks: [
      { label: "Hostels & Residence", href: "/campus-life?tab=hostels" },
      { label: "Bus Route Schedules", href: "/campus-life?tab=transport" },
      { label: "12 Student Societies", href: "/campus-life?tab=societies" },
      { label: "Campus Phonebook", href: "/campus-life?tab=directory" },
    ],
  },
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
          {/* Hero Section */}
          <section className="px-6 pt-24 pb-20 max-w-5xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 text-[#d9b451] text-xs font-mono uppercase tracking-wider mb-6">
              <span>●</span> Official AI Guide to UET Taxila
            </div>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-light tracking-tight mb-6 leading-[1.1]">
              Your AI Guide to <br />
              <span className="font-serif italic font-normal text-[#d9b451]">UET Taxila</span>
            </h1>
            <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
              Get instant, citation-backed answers on admissions, ECAT entry test, 2026 fee
              structures, 14 departments, scholarships, and campus life — powered by official
              university documents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="w-full sm:w-auto px-8 py-4 rounded bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-all text-sm font-mono tracking-wider uppercase shadow-lg shadow-[#d9b451]/10 min-h-[44px] flex items-center justify-center"
              >
                Ask UET GPT Anything &rarr;
              </Link>
              <Link
                href="/tools"
                className="w-full sm:w-auto px-8 py-4 rounded border border-[#d9b451]/40 text-[#d9b451] hover:bg-[#d9b451]/10 transition-all text-sm font-mono tracking-wider uppercase min-h-[44px] flex items-center justify-center"
              >
                Launch Tools Suite
              </Link>
              <Link
                href="/admissions"
                className="w-full sm:w-auto px-8 py-4 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-all text-sm font-mono tracking-wider uppercase min-h-[44px] flex items-center justify-center"
              >
                Admissions {CURRENT_ACADEMIC_YEAR}
              </Link>
            </div>
          </section>

          {/* 4 Core Pillars Architecture Showcase */}
          <section className="px-6 py-16 max-w-6xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-xs font-mono text-[#d9b451] uppercase tracking-widest">
                Platform Architecture
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-light text-white">
                4 Core Engineering Pillars
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {PILLARS.map((pillar) => (
                <div
                  key={pillar.id}
                  className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 flex flex-col justify-between hover:border-[#d9b451]/40 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#d9b451]">
                        {pillar.id} / PILLAR
                      </span>
                      <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                        {pillar.badge}
                      </span>
                    </div>

                    <Link href={pillar.href}>
                      <h3 className="mt-3 text-xl font-bold text-white group-hover:text-[#d9b451] transition-colors">
                        {pillar.title}
                      </h3>
                    </Link>

                    <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">{pillar.desc}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5">
                    <div className="text-[10px] font-mono uppercase text-[#71717a] mb-2">
                      Quick Access:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pillar.subLinks.map((sub) => (
                        <Link
                          key={sub.label}
                          href={sub.href}
                          className="rounded-lg border border-white/10 bg-[#07080a] px-2.5 py-1 text-xs font-mono text-[#a1a1aa] hover:border-[#d9b451] hover:text-white transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Accordion Section */}
          <section id="faq" className="px-6 py-20 max-w-4xl mx-auto border-t border-white/10">
            <div className="text-center mb-12">
              <div className="text-xs font-mono text-[#d9b451] uppercase tracking-widest mb-2">
                FAQ
              </div>
              <h2 className="text-2xl sm:text-3xl font-light">Answers to Common Questions</h2>
            </div>
            <div className="space-y-4">
              {HOMEPAGE_FAQS.map((faq) => (
                <details
                  key={faq.q}
                  className="group p-5 rounded border border-white/10 bg-white/[0.02] transition-all [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex items-center justify-between font-normal text-base cursor-pointer select-none">
                    <span>{faq.q}</span>
                    <span className="text-[#d9b451] font-mono text-sm group-open:rotate-45 transition-transform">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-sm text-white/70 leading-relaxed border-t border-white/10 pt-4 font-light">
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
