import type { Metadata } from "next";
import { Suspense } from "react";
import { AcademicsHub } from "@/components/academics/academics-hub";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: `Academics, Degree Syllabi & Calendar | UET GPT`,
  description:
    "Official academic hub for UET Taxila: 14 PEC-accredited degree curriculums, 8-semester roadmaps, academic calendar, and OBE examination guidelines.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/academics",
  },
  openGraph: {
    title: `Academics, Degree Syllabi & Calendar | UET GPT`,
    description:
      "Official academic hub for UET Taxila: 14 PEC-accredited degree curriculums, 8-semester roadmaps, academic calendar, and OBE examination guidelines.",
    url: "https://uet-gpt.vercel.app/academics",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
    images: [
      {
        url: "https://uet-gpt.vercel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Academics, Degree Syllabi & Calendar | UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Academics, Degree Syllabi & Calendar | UET GPT`,
    description:
      "Official academic hub for UET Taxila: 14 PEC-accredited degree curriculums, 8-semester roadmaps, academic calendar, and OBE examination guidelines.",
    images: ["https://uet-gpt.vercel.app/opengraph-image"],
  },
};

const academicFaqs = [
  {
    question: "What is PEC Washington Accord Level-II Accreditation?",
    answer:
      "Level-II accreditation under the Washington Accord signifies that UET Taxila's engineering degrees meet international Outcome-Based Education (OBE) standards. Graduates enjoy substantial equivalency recognition across signatory nations like the US, UK, Canada, Australia, and Japan without requiring foreign qualification equivalence exams.",
  },
  {
    question: "How are course grades evaluated under Outcome-Based Education (OBE)?",
    answer:
      "Each course features defined Course Learning Outcomes (CLOs) mapped to Program Learning Outcomes (PLOs). Continuous assessments (quizzes, assignments, and Complex Engineering Problems) account for 20-30%, midterms account for 20-25%, and the comprehensive final exam represents 40-50% of the course grade.",
  },
  {
    question: "How do students borrow books from the Central Library Book Bank?",
    answer:
      "The Dr. Muhammad Akram Central Library provides a Book Bank scheme where enrolled students can borrow up to six core prescribed textbooks for the full duration of the semester for a nominal rental fee.",
  },
];

export default function AcademicsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: SCHEMA_DATE_MODIFIED,
    mainEntity: academicFaqs.map((faq) => ({
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
          { name: "Academics", item: "/academics" },
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
                  <span>PILLAR 02</span> &bull; <span>CURRICULUMS &amp; CALENDAR</span>
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-none">
                  Academics, Syllabi &amp; Calendar
                </h1>
                <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-2xl">
                  Accredited by Pakistan Engineering Council under the Washington Accord (Level-II)
                  and NCEAC Category &apos;W&apos;. Explore 14 undergraduate curricula, official
                  8-semester roadmaps, and the academic milestone calendar {CURRENT_ACADEMIC_YEAR}.
                </p>
              </div>

              <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#14151a] p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Accreditation:</span>
                  <span className="text-emerald-400 font-bold">
                    PEC Level-II (Washington Accord)
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Academic Scope:</span>
                  <span className="text-[#d9b451] font-bold">14 Degrees &bull; 6 Faculties</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a] uppercase">Current Year:</span>
                  <span className="text-white font-bold">{CURRENT_ACADEMIC_YEAR}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Academics Section */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-12 text-center text-sm font-mono text-[#a1a1aa]">
                  Loading academic programs and schedules...
                </div>
              }
            >
              <AcademicsHub />
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
                Frequently Asked Questions About Academics
              </h2>
            </div>
            <div className="space-y-4">
              {academicFaqs.map((faq) => (
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
