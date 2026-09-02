import type { Metadata } from "next";
import Link from "next/link";
import { MedallionCanvas } from "@/components/landing/medallion-canvas";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";

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

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="relative min-h-screen bg-[#07080a] text-[#edf0ec] selection:bg-[#d9b451] selection:text-[#07080a] overflow-x-hidden font-sans">
        <MedallionCanvas />

        {/* Global Navigation Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-[#07080a]/80 border-b border-white/10">
          <Link href="/" className="flex items-baseline gap-2 font-mono text-sm tracking-wide">
            <span className="font-bold text-white text-base">UET</span>
            <span className="text-[#d9b451] font-semibold">GPT</span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest pl-1">
              AI Guide
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-xs font-mono tracking-wider uppercase">
            <Link
              href="/calculator"
              className="text-[#d9b451] hover:text-[#f0d178] transition-colors font-semibold"
            >
              Calculator
            </Link>
            <Link
              href="/uet-taxila"
              className="hidden sm:inline-block text-white/70 hover:text-white transition-colors"
            >
              UET Taxila
            </Link>
            <Link
              href="/learn"
              className="hidden sm:inline-block text-white/70 hover:text-white transition-colors"
            >
              Glossary
            </Link>
            <Link
              href="/about"
              className="hidden md:inline-block text-white/70 hover:text-white transition-colors"
            >
              About
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 rounded border border-[#d9b451] text-[#d9b451] hover:bg-[#d9b451] hover:text-[#07080a] transition-all font-semibold"
            >
              Start Chat
            </Link>
          </nav>
        </header>

        <main id="main-content" className="relative z-10">
          {/* Hero Section - Text decoupled with immediate opacity: 1 */}
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
              structures, 14 departments, and campus life — powered by official university
              documents.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="w-full sm:w-auto px-8 py-4 rounded bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-all text-sm font-mono tracking-wider uppercase shadow-lg shadow-[#d9b451]/10 min-h-[44px] flex items-center justify-center"
              >
                Ask UET GPT Anything &rarr;
              </Link>
              <Link
                href="/calculator"
                className="w-full sm:w-auto px-8 py-4 rounded border border-[#d9b451]/40 text-[#d9b451] hover:bg-[#d9b451]/10 transition-all text-sm font-mono tracking-wider uppercase min-h-[44px] flex items-center justify-center"
              >
                Calculate Aggregate
              </Link>
              <Link
                href="/uet-taxila"
                className="w-full sm:w-auto px-8 py-4 rounded border border-white/20 text-white/80 hover:text-white hover:border-white/40 transition-all text-sm font-mono tracking-wider uppercase min-h-[44px] flex items-center justify-center"
              >
                Explore UET Taxila
              </Link>
            </div>
          </section>

          {/* Quick Hub Navigation Cards */}
          <section className="px-6 py-16 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/calculator"
                className="p-6 rounded border border-[#d9b451]/30 bg-[#d9b451]/5 hover:border-[#d9b451] hover:bg-[#d9b451]/10 transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">01 / TOOL</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  Merit Calculator
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Instant aggregate computation: 33% ECAT, 50% HSSC, 17% SSC with live eligibility.
                </p>
              </Link>

              <Link
                href="/uet-taxila/admissions"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">02 / ADMISSIONS</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  ECAT &amp; Merit Guide
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Eligibility criteria (60%/50%), merit aggregate formula, and application steps.
                </p>
              </Link>

              <Link
                href="/uet-taxila/fee-structure"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">03 / FINANCES</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  Fee Structure 2026
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  Subsidized vs partial-subsidized tuition, hostel fees, and refund policy.
                </p>
              </Link>

              <Link
                href="/uet-taxila/programs"
                className="p-6 rounded border border-white/10 bg-white/[0.02] hover:border-[#d9b451]/50 hover:bg-white/[0.04] transition-all group"
              >
                <div className="text-xs font-mono text-[#d9b451] mb-2">04 / ACADEMICS</div>
                <h2 className="text-lg font-normal mb-2 text-white group-hover:text-[#d9b451] transition-colors">
                  Programs &amp; Departments
                </h2>
                <p className="text-xs text-white/60 leading-relaxed">
                  14 departments across 6 faculties from undergraduate BS to PhD.
                </p>
              </Link>
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

        {/* Global Footer */}
        <footer className="border-t border-white/10 px-6 py-12 bg-[#07080a] text-xs font-mono text-white/50">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <p>&copy; {new Date().getFullYear()} UET GPT Community. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-6">
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <Link href="/calculator" className="hover:text-white transition-colors">
                Calculator
              </Link>
              <Link href="/uet-taxila" className="hover:text-white transition-colors">
                UET Taxila
              </Link>
              <Link href="/learn" className="hover:text-white transition-colors">
                Glossary
              </Link>
              <Link href="/uet-gpt" className="hover:text-white transition-colors">
                About UET GPT
              </Link>
              <Link href="/about" className="hover:text-white transition-colors">
                About
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
