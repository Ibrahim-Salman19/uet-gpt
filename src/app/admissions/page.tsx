import type { Metadata } from "next";
import { Suspense } from "react";
import { AdmissionsHub } from "@/components/admissions/admissions-hub";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: `Admissions, ECAT Guide & Fee Structure | UET GPT`,
  description: `UET Taxila admissions guide for ${CURRENT_ACADEMIC_YEAR}: Eligibility criteria, ECAT strategy blueprint, interactive fee simulator, and scholarship programs.`,
  alternates: {
    canonical: "https://uet-gpt.vercel.app/admissions",
  },
  openGraph: {
    title: `Admissions, ECAT Guide & Fee Structure | UET GPT`,
    description: `UET Taxila admissions guide for ${CURRENT_ACADEMIC_YEAR}: Eligibility criteria, ECAT strategy blueprint, interactive fee simulator, and scholarship programs.`,
    url: "https://uet-gpt.vercel.app/admissions",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
    images: [
      {
        url: "https://uet-gpt.vercel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "UET Taxila Admissions, ECAT Guide & Fee Structure | UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Admissions, ECAT Guide & Fee Structure | UET GPT`,
    description: `UET Taxila admissions guide for ${CURRENT_ACADEMIC_YEAR}: Eligibility criteria, ECAT strategy blueprint, interactive fee simulator, and scholarship programs.`,
    images: ["https://uet-gpt.vercel.app/opengraph-image"],
  },
};

const admissionsFaqs = [
  {
    question: "What is the minimum intermediate percentage required for UET Taxila admissions?",
    answer:
      "For all BSc Engineering programs, a minimum of 60% unadjusted marks in FSc Pre-Engineering or equivalent (A-Levels / DAE) is strictly mandatory. For BS Computer Science, Software Engineering, and Basic Sciences, the eligibility threshold is 50% marks.",
  },
  {
    question: "What is the difference between Category A and Category S seats?",
    answer:
      "Category A consists of Open Merit subsidized seats (primarily for Punjab domicile holders) with government-subsidized tuition of approximately PKR 48,000–55,000/semester. Category S consists of Partial Subsidized (Self-Finance) seats open nationwide with tuition of approximately PKR 135,000–145,000/semester and slightly lower merit cutoffs.",
  },
  {
    question: "Is there negative marking in the ECAT entry test?",
    answer:
      "No. According to UET Lahore's official ECAT page, the test contains 100 MCQs (400 total marks), each correct answer is worth 4 marks, and there is no negative marking or passing threshold. Wrong and unattempted answers both score 0.",
  },
];

export default function AdmissionsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: SCHEMA_DATE_MODIFIED,
    mainEntity: admissionsFaqs.map((faq) => ({
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
          { name: "Admissions & Aid", item: "/admissions" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
                  <span>PILLAR 03</span> &bull; <span>ADMISSIONS &amp; FINANCIAL AID</span>
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-none">
                  Admissions, Aid &amp; Fees
                </h1>
                <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-2xl">
                  End-to-end undergraduate admissions portal for {CURRENT_ACADEMIC_YEAR}: Statutory
                  eligibility thresholds, ECAT 400-mark strategy blueprint, real-time semester fee
                  simulator, and need-based financial aid.
                </p>
              </div>

              <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#14151a] p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Engineering Cutoff:</span>
                  <span className="text-white font-bold">&ge; 60% F.Sc / DAE</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Computing Cutoff:</span>
                  <span className="text-emerald-400 font-bold">&ge; 50% Intermediate</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a] uppercase">Tuition Dues:</span>
                  <span className="text-[#d9b451] font-bold">~PKR 48,000 / Semester</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Admissions Section */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-12 text-center text-sm font-mono text-[#a1a1aa]">
                  Loading admissions and financial aid hub...
                </div>
              }
            >
              <AdmissionsHub />
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
                Frequently Asked Questions About Admissions
              </h2>
            </div>
            <div className="space-y-4">
              {admissionsFaqs.map((faq) => (
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
