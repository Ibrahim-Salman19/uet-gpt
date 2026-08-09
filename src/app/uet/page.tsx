import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Guide: Admissions, Fees & Departments",
  description:
    "Complete guide to UET Taxila — admissions, ECAT entry test, merit formula, fee structures, departments, and campus life. Ask UET GPT for instant answers.",
  alternates: {
    canonical: `${siteUrl}/uet`,
  },
  openGraph: {
    title: "UET Taxila Guide: Admissions, Fees & Departments | UET GPT",
    description:
      "Complete guide to UET Taxila — admissions, ECAT entry test, merit formula, fee structures, departments, and campus life.",
    url: `${siteUrl}/uet`,
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
    title: "UET Taxila Guide: Admissions, Fees & Departments | UET GPT",
    description: "Complete guide to UET Taxila — admissions, ECAT, merit, fees, and departments.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "What does UET stand for?",
    a: "UET stands for University of Engineering and Technology. In Pakistan, UET Taxila (University of Engineering and Technology, Taxila) is a top public engineering university located in Taxila, Punjab.",
  },
  {
    q: "What is UET GPT?",
    a: "UET GPT is the open-source AI assistant for UET (University of Engineering and Technology) Taxila. It uses Retrieval-Augmented Generation (RAG) to provide instant, citation-backed answers about UET Taxila admissions, fee structures, departments, and campus life.",
  },
  {
    q: "How to check UET Taxila admission requirements and fee structure?",
    a: "You can ask UET GPT directly or visit our dedicated guides for UET Taxila Admissions and Fee Structure for complete details grounded in official university prospectuses.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function UetPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7]">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET", url: `${siteUrl}/uet` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main id="main-content" className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">UET</span>
        </nav>

        <header className="mb-12 border-b border-[#27272a] pb-8">
          <span className="inline-block rounded-full bg-[#18181b] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#38bdf8] border border-[#27272a] mb-4">
            Official Keyword Hub
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">
            UET (University of Engineering & Technology)
          </h1>
          <p className="text-lg text-[#a1a1aa] leading-relaxed">
            Welcome to the complete guide for <strong className="text-white">UET</strong>{" "}
            (University of Engineering and Technology, Taxila) powered by{" "}
            <strong className="text-white">UET GPT</strong> — the open-source AI assistant.
          </p>
        </header>

        <section className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/uet-taxila"
            className="group block rounded-xl border border-[#27272a] bg-[#09090b] p-6 transition-all hover:border-[#38bdf8]/50 hover:bg-[#18181b]"
          >
            <h2 className="text-xl font-semibold text-white group-hover:text-[#38bdf8] mb-2">
              UET Taxila Guide →
            </h2>
            <p className="text-sm text-[#a1a1aa]">
              Comprehensive overview of UET Taxila history, campuses, 14 departments, and faculties.
            </p>
          </Link>

          <Link
            href="/uet-gpt"
            className="group block rounded-xl border border-[#27272a] bg-[#09090b] p-6 transition-all hover:border-[#38bdf8]/50 hover:bg-[#18181b]"
          >
            <h2 className="text-xl font-semibold text-white group-hover:text-[#38bdf8] mb-2">
              About UET GPT →
            </h2>
            <p className="text-sm text-[#a1a1aa]">
              Learn how the RAG-powered AI chatbot helps students find instant answers with
              citations.
            </p>
          </Link>

          <Link
            href="/uet-taxila/admissions"
            className="group block rounded-xl border border-[#27272a] bg-[#09090b] p-6 transition-all hover:border-[#38bdf8]/50 hover:bg-[#18181b]"
          >
            <h2 className="text-xl font-semibold text-white group-hover:text-[#38bdf8] mb-2">
              Admissions & ECAT →
            </h2>
            <p className="text-sm text-[#a1a1aa]">
              Eligibility, ECAT entry test formula, aggregate calculation, and key application
              dates.
            </p>
          </Link>
        </section>

        <section className="mb-12 border-t border-[#27272a] pt-8">
          <h2 className="text-2xl font-bold text-white mb-6">Ask UET GPT Anything About UET</h2>
          <div className="rounded-xl border border-[#27272a] bg-[#09090b] p-6 text-center">
            <p className="text-base text-[#a1a1aa] mb-6">
              Get instant, citation-backed answers to your questions about UET Taxila fees, merit
              lists, hostelling, transport, and departments.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center justify-center rounded-lg bg-[#38bdf8] px-6 py-3 text-sm font-semibold text-black hover:bg-[#0284c7] transition-colors"
            >
              Start Free Chat with UET GPT
            </Link>
          </div>
        </section>

        <section className="mb-12 border-t border-[#27272a] pt-8">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((faq) => (
              <div key={faq.q} className="rounded-lg border border-[#27272a] bg-[#09090b] p-5">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
