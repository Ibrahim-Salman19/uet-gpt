import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET GPT: Free AI Assistant for UET Taxila Students",
  description:
    "UET GPT is the free open-source AI assistant for UET Taxila. Ask questions about admissions, ECAT, merit formula, fee structures, and campus life.",
  alternates: {
    canonical: `${siteUrl}/uet-gpt`,
  },
  openGraph: {
    title: "UET GPT: Free AI Assistant for UET Taxila Students",
    description:
      "UET GPT is the free open-source AI assistant for UET Taxila students. Ask about admissions, ECAT, merit, fees, and campus life.",
    url: `${siteUrl}/uet-gpt`,
    type: "website",
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
    title: "UET GPT: Free AI Assistant for UET Taxila Students",
    description: "Free AI chatbot for UET Taxila — admissions, ECAT, merit, fees, and campus life.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "What is UET GPT?",
    a: "UET GPT is the AI guide to UET Taxila - an open-source chatbot built for the students, faculty, and prospective applicants of the University of Engineering and Technology, Taxila (UET Taxila) in Pakistan. It answers questions about admissions, ECAT, merit, fee structures, departments, faculty, hostels, transport, scholarships, and campus life using Retrieval-Augmented Generation over official university data. It is a student-built project and is not affiliated with, endorsed by, or operated by the official UET Taxila or the University of Engineering and Technology.",
  },
  {
    q: "Is UET GPT affiliated with the official UET Taxila or the University of Engineering and Technology?",
    a: 'No. UET GPT is an independent, open-source project created by students. It is not affiliated with, officially connected to, or endorsed by the University of Engineering and Technology, Taxila, or any campus of the University of Engineering and Technology. The name "UET GPT" refers to this community-built guide, and it should not be confused with official university websites, portals, or announcements.',
  },
  {
    q: "How does UET GPT work?",
    a: "UET GPT uses Retrieval-Augmented Generation (RAG). When you ask a question, it retrieves the most relevant passages from a curated knowledge base built from official UET Taxila sources - including admissions policies, fee schedules, department pages, and notices - and then generates a clear, sourced answer grounded in that retrieved content. This keeps answers accurate and reduces hallucination compared with a general-purpose model answering from memory.",
  },
  {
    q: "What can I ask UET GPT?",
    a: "You can ask about undergraduate and graduate admissions at UET Taxila, the ECAT entry test, how merit is calculated, BS and MS fee breakdowns, the 14 departments and six faculties, research areas, hostel allotment, transport routes, scholarships, the central library, and student societies and campus life. If a detail is not present in the official sources, UET GPT will tell you rather than guess.",
  },
  {
    q: "Where can I find the UET GPT source code?",
    a: "UET GPT is open source and free to use. The live app is available at https://uet-gpt.vercel.app, where you can ask anything about UET Taxila admissions, fees, programs, and campus life.",
  },
  {
    q: "Is UET GPT free to use?",
    a: "Yes. UET GPT is free for all UET Taxila students, faculty, and prospective applicants. It is a community resource maintained by volunteers and released as open-source software under its repository license.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
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

export default function UetGptPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET GPT", url: `${siteUrl}/uet-gpt` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        <PublicNav />

        <main id="main-content" className="flex-1">
          {/* Hero Section */}
          <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET GPT
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] mt-2">
                The AI Guide to UET Taxila
              </span>
            </h1>
            <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8 font-sans leading-relaxed">
              UET GPT is an open-source AI chatbot built for the students, faculty, and prospective
              applicants of the University of Engineering and Technology, Taxila. Ask anything about
              UET Taxila and get clear, sourced answers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="w-full sm:w-auto px-6 py-3.5 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all text-xs font-mono tracking-wider uppercase shadow-[0_4px_12px_rgba(202,138,4,0.2)]"
              >
                Ask UET GPT
              </Link>
              <Link
                href="/uet-taxila"
                className="w-full sm:w-auto px-6 py-3.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 active:scale-[0.98] transition-all text-xs font-mono tracking-wider uppercase"
              >
                Guide to UET Taxila
              </Link>
            </div>
          </section>

          {/* Intro Section */}
          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--text-primary)]">
              What is UET GPT?
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[10px]">
              A student-built assistant that turns official UET Taxila information into instant,
              conversational answers
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  The AI guide to UET Taxila
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  UET GPT is an AI chatbot designed specifically for the University of Engineering
                  and Technology, Taxila (UET Taxila), a public engineering university in Taxila,
                  Punjab, Pakistan. Unlike a general-purpose assistant, UET GPT is focused entirely
                  on UET Taxila: its admissions, academics, fees, campus services, and student life.
                  Whether you are a first-year student trying to understand your fee voucher or a
                  prospective applicant comparing engineering disciplines, UET GPT gives you a
                  single place to ask.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  Built for students, not by the university
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  UET GPT is an independent, community project created by students who wanted
                  faster, clearer access to UET Taxila information. It is not affiliated with,
                  endorsed by, or operated by the official University of Engineering and Technology,
                  Taxila. It is offered as a helpful companion that points you to the right official
                  sources - never a replacement for them.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  Grounded, not guessing
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  The goal of UET GPT is accurate, trustworthy answers. Instead of generating
                  replies purely from a model&apos;s memory, UET GPT grounds its responses in
                  retrieved official documents, so you can rely on what it tells you about
                  deadlines, eligibility, and procedures.
                </p>
              </div>
            </div>
          </section>

          {/* Working Section */}
          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--text-primary)]">
              How UET GPT Works
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[10px]">
              Retrieval-Augmented Generation over official UET Taxila data
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  1. Curated knowledge from official sources
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  UET GPT builds its knowledge base from official UET Taxila material - admissions
                  policies, ECAT and merit guidance, fee schedules, department and faculty pages,
                  notices, and campus service information. Content is structured and indexed so the
                  right passage can be found quickly.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  2. Retrieval-Augmented Generation (RAG)
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  When you ask a question, UET GPT first retrieves the most relevant passages from
                  its knowledge base, then generates a response based only on that retrieved
                  context. This retrieval step is what keeps answers tied to official UET Taxila
                  data and reduces hallucination.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  3. Clear, conversational answers
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  The result is a plain-language answer you can act on - and when a detail is not
                  covered by the official sources, UET GPT is designed to say so rather than invent
                  an answer. That honesty is central to how UET GPT is meant to be used.
                </p>
              </div>
            </div>
          </section>

          {/* Features Grid */}
          <section className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-10 tracking-tight text-[var(--text-primary)]">
              Key Features of UET GPT
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Admissions & ECAT",
                  desc: "Ask about UET Taxila ECAT, eligibility, merit lists, schedules, and seat allocation in plain language.",
                },
                {
                  title: "Fee Structure",
                  desc: "Understand BS and MS fee breakdowns, hostel charges, and dues - grounded in official UET Taxila records.",
                },
                {
                  title: "Departments & Faculty",
                  desc: "Explore UET Taxila's 14 departments and six faculties, research areas, and program details before you choose.",
                },
                {
                  title: "Campus Life",
                  desc: "Find hostel allotment, transport routes, scholarships, the central library, and student societies at UET Taxila.",
                },
                {
                  title: "Grounded Answers",
                  desc: "UET GPT uses Retrieval-Augmented Generation over official UET Taxila documents, so replies stay accurate.",
                },
                {
                  title: "Open Source",
                  desc: "UET GPT is open-source and free for everyone - ask anything about UET Taxila.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-card)]/50 transition-all duration-300"
                >
                  <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                    {f.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] font-sans leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* FAQ Accordion Section */}
          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-8 tracking-tight text-[var(--text-primary)]">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map((faq) => (
                <details
                  key={faq.q}
                  className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 [&_summary::-webkit-details-marker]:hidden transition-all"
                >
                  <summary className="flex items-center justify-between font-medium text-sm cursor-pointer text-[var(--text-primary)] select-none">
                    <span>{faq.q}</span>
                    <span className="text-[var(--text-secondary)] transition-transform group-open:rotate-180 font-mono text-xs">
                      ▼
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)]/30 pt-3">
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
