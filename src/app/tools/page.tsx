import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { ToolsHub } from "@/components/tools/tools-hub";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Engineering Tools & Calculators Suite | UET GPT",
  description:
    "Official engineering tools for UET Taxila: Real-time Merit Calculator, GPA & CGPA Simulator, 5-Year Closing Merit Archive, and Scholarship Screener.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/tools",
  },
  openGraph: {
    title: "Engineering Tools & Calculators Suite | UET GPT",
    description:
      "Official engineering tools for UET Taxila: Real-time Merit Calculator, GPA & CGPA Simulator, 5-Year Closing Merit Archive, and Scholarship Screener.",
    url: "https://uet-gpt.vercel.app/tools",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Engineering Tools & Calculators Suite | UET GPT",
    description:
      "Official engineering tools for UET Taxila: Real-time Merit Calculator, GPA & CGPA Simulator, 5-Year Closing Merit Archive, and Scholarship Screener.",
  },
};

const toolsFaqs = [
  {
    question: "What is the official merit aggregate formula at UET Taxila?",
    answer:
      "UET Taxila calculates merit aggregate as: 33% ECAT score + 50% Intermediate (HSSC/FSc) marks + 17% Matriculation (SSC) marks. For A-Level and DAE candidates, IBCC equivalence is utilized.",
  },
  {
    question: "How is SGPA and CGPA calculated at UET Taxila?",
    answer:
      "UET Taxila operates on a 4.00 semester GPA system where Course Grade Points are multiplied by Credit Hours, summed, and divided by total registered credits (excluding non-credit courses).",
  },
  {
    question:
      "Where can I view historical merit cutoffs for Computer Science and Software Engineering?",
    answer:
      "The 5-Year Closing Merit Archive tab above provides official 2021-2025 round-by-round merit list closing percentiles for Category A (Subsidized) and Category S (Self-Finance).",
  },
];

export default function ToolsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: toolsFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Engineering Tools", item: "/tools" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-[#07080a] text-white">
        {/* Header */}
        <section className="relative border-b border-white/10 bg-gradient-to-b from-[#d9b451]/10 via-[#07080a] to-[#07080a] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-[#d9b451]">
                Unified Suite
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Engineering Tools &amp; Calculators
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#a1a1aa] sm:text-base">
                Everything you need for admissions, academic grade planning, historical closing
                merit research, and financial aid matching in one integrated suite.
              </p>
            </div>
          </div>
        </section>

        {/* Tools Section */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-12 text-center text-sm font-mono text-[#a1a1aa]">
                  Loading engineering tools suite...
                </div>
              }
            >
              <ToolsHub />
            </Suspense>
          </div>
        </section>

        {/* FAQs */}
        <section className="border-t border-white/10 bg-[#0c0d10]/60 py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              Frequently Asked Questions About Tools
            </h2>
            <div className="mt-6 space-y-4">
              {toolsFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-white/10 bg-[#07080a] p-6"
                >
                  <h3 className="text-sm font-semibold text-white">{faq.question}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
