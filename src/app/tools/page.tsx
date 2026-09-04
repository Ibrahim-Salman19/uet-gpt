import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { ToolsHub } from "@/components/tools/tools-hub";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
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
    images: [
      {
        url: "https://uet-gpt.vercel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Engineering Tools & Calculators Suite | UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Engineering Tools & Calculators Suite | UET GPT",
    description:
      "Official engineering tools for UET Taxila: Real-time Merit Calculator, GPA & CGPA Simulator, 5-Year Closing Merit Archive, and Scholarship Screener.",
    images: ["https://uet-gpt.vercel.app/opengraph-image"],
  },
};

const toolsFaqs = [
  {
    question: "What is the official merit aggregate formula at UET Taxila?",
    answer:
      "UET Taxila calculates merit aggregate as: 33% ECAT score + 50% Intermediate (HSSC/FSc) marks + 17% Matriculation (SSC) marks. For A-Level and DAE candidates, IBCC equivalence is utilized. Hafiz-e-Quran and NCC certificate holders receive +20 marks added to their HSSC component.",
  },
  {
    question: "How is SGPA and CGPA calculated at UET Taxila?",
    answer:
      "UET Taxila operates on a 4.00 semester GPA system where Course Grade Points (A=4.0, A-=3.7, B+=3.3, B=3.0, etc.) are multiplied by Credit Hours, summed, and divided by total registered semester credits. A minimum CGPA of 2.00 is required to graduate without probation.",
  },
  {
    question:
      "Where can I view historical merit cutoffs for Computer Science and Software Engineering?",
    answer:
      "The 5-Year Closing Merit Archive tab provides official round-by-round merit list closing percentiles for Category A (Subsidized) and Category S (Self-Finance) spanning 2021 through 2025 across all 14 disciplines.",
  },
  {
    question: "How does the Scholarship Screener match financial aid?",
    answer:
      "The screener matches your intermediate percentage, family income, and domicile against eligibility criteria for Punjab Chief Minister Honhaar Scholarship, HEC Need-Based Aid, Workers Welfare Fund, and PEEF.",
  },
];

export default function ToolsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: SCHEMA_DATE_MODIFIED,
    mainEntity: toolsFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Calculate Your UET Taxila Merit Aggregate",
    description:
      "Step-by-step process to calculate your UET Taxila admission merit aggregate using the statutory PEC formula.",
    dateModified: SCHEMA_DATE_MODIFIED,
    step: [
      {
        "@type": "HowToStep",
        name: "Take 33% of your ECAT score",
        text: "Multiply your ECAT (Engineering College Admission Test) score by 0.33.",
      },
      {
        "@type": "HowToStep",
        name: "Take 50% of your Intermediate percentage",
        text: "Multiply your HSSC / FSc (Pre-Engineering) or equivalent percentage by 0.50.",
      },
      {
        "@type": "HowToStep",
        name: "Take 17% of your Matriculation percentage",
        text: "Multiply your SSC / Matric percentage by 0.17.",
      },
      {
        "@type": "HowToStep",
        name: "Add the Hifz-e-Quran / NCC bonus, if applicable",
        text: "Add 20 bonus marks to the aggregate if you hold a Hifz-e-Quran certificate or NCC certification.",
      },
      {
        "@type": "HowToStep",
        name: "Sum the weighted components",
        text: "Add the weighted ECAT, Intermediate, and Matriculation components (plus any bonus) to get your final merit aggregate.",
      },
      {
        "@type": "HowToStep",
        name: "Compare against closing merit cutoffs",
        text: "Check your aggregate against the 5-Year Closing Merit Archive for your target program to gauge admission likelihood.",
        url: "https://uet-gpt.vercel.app/tools?tab=archive",
      },
    ],
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
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <PublicNav />

      <main
        id="main-content"
        className="min-h-screen bg-[#07080a] text-white selection:bg-[#d9b451] selection:text-[#07080a]"
      >
        {/* Asymmetric High-Contrast Header */}
        <section className="border-b border-white/10 bg-[#0c0d10] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-[#d9b451]">
                  <span>PILLAR 01</span> &bull; <span>ENGINEERING DECISION SUITE</span>
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-none">
                  Engineering Tools &amp; Calculators
                </h1>
                <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-2xl">
                  Accurate, statutory decision models for UET Taxila: Real-time admission aggregate
                  calculator, semester GPA tracking, 5-year closing cutoffs, and need-based
                  scholarship matching.
                </p>
              </div>

              <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#14151a] p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Merit Weight:</span>
                  <span className="text-[#d9b451] font-bold">
                    33% ECAT &bull; 50% F.Sc &bull; 17% SSC
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Grading Scale:</span>
                  <span className="text-white font-bold">4.00 Max &bull; 2.00 Good Standing</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a] uppercase">Archive Scope:</span>
                  <span className="text-emerald-400 font-bold">
                    2021 &ndash; 2025 (14 Programs)
                  </span>
                </div>
              </div>
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
        <section className="border-t border-white/10 bg-[#0c0d10]/60 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-mono uppercase tracking-widest text-[#d9b451] font-bold">
                Knowledge Base
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
                Frequently Asked Questions About Tools
              </h2>
            </div>
            <div className="space-y-4">
              {toolsFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-white/10 bg-[#07080a] p-6 hover:border-white/20 transition-colors"
                >
                  <h3 className="text-sm font-bold text-white">{faq.question}</h3>
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
