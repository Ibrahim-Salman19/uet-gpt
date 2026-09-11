import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const title = `ECAT ${CURRENT_ACADEMIC_YEAR} Preparation Guide: Syllabus, Strategy & Time Management`;
const description = `How to prepare for ECAT ${CURRENT_ACADEMIC_YEAR}: subject-wise high-yield topics, the 400-mark negative-marking scheme, and a 3-pass time-management strategy for UET Taxila's entry test.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}/uet-taxila/ecat-guide`,
  },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/uet-taxila/ecat-guide`,
    type: "article",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "ECAT Preparation Guide - UET GPT",
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

const SUBJECTS = [
  {
    name: "Mathematics",
    questions: 30,
    maxMarks: 120,
    topics: ["Conic Sections", "Differentiation", "Integration", "Trigonometry", "Vectors"],
  },
  {
    name: "Physics",
    questions: 30,
    maxMarks: 120,
    topics: ["Electromagnetism", "Alternating Current", "Nuclear Physics", "Thermodynamics"],
  },
  {
    name: "Chemistry / Computer Science",
    questions: 30,
    maxMarks: 120,
    topics: [
      "Organic Reaction Mechanisms",
      "Chemical Equilibrium",
      "Electrochemistry",
      "(CS candidates: programming fundamentals in lieu of Chemistry)",
    ],
  },
  {
    name: "English",
    questions: 10,
    maxMarks: 40,
    topics: ["Sentence completion", "Vocabulary in context", "Grammar correction"],
  },
];

const TIME_PASSES = [
  {
    pass: "Pass 1",
    window: "0-40 minutes",
    desc: "Solve every direct theoretical question and 1-step numerical you recognize immediately. Skip anything that needs a second look — mark it and move on.",
  },
  {
    pass: "Pass 2",
    window: "40-80 minutes",
    desc: "Return for complex 2-step calculations in Physics and Mathematics, now that the easy marks are already banked.",
  },
  {
    pass: "Pass 3",
    window: "80-100 minutes",
    desc: "Review flagged questions only. Avoid pure random guessing — the -1 penalty per wrong answer means a blind guess is expected-value-negative unless you can eliminate at least one of the four options first.",
  },
];

const faqs = [
  {
    q: "How many questions are on the ECAT test?",
    a: "ECAT has 100 multiple-choice questions worth 400 total marks: 30 Mathematics, 30 Physics, 30 Chemistry (or Computer Science for CS-track candidates), and 10 English, completed in 100 minutes.",
  },
  {
    q: "Does ECAT have negative marking?",
    a: "Yes. Each correct answer is worth +4 marks and each incorrect answer costs -1 mark. Leaving a question blank costs 0 marks, so guessing only makes sense once you can eliminate at least one of the four options.",
  },
  {
    q: "What are the highest-yield topics to study for ECAT?",
    a: "Based on UET Taxila's recurring ECAT pattern: Conic Sections, Differentiation, Integration, Trigonometry and Vectors in Mathematics; Electromagnetism, Alternating Current, Nuclear Physics and Thermodynamics in Physics; and Organic Reaction Mechanisms, Chemical Equilibrium and Electrochemistry in Chemistry.",
  },
  {
    q: "How much time should I spend per ECAT question?",
    a: "ECAT gives 100 minutes for 100 questions — exactly 1 minute per question on average. A 3-pass strategy (easy questions first, then 2-step calculations, then a final review of flagged questions) makes better use of that time than answering strictly in order.",
  },
  {
    q: "How much does ECAT count toward UET Taxila's merit aggregate?",
    a: "ECAT contributes 33% of the final merit aggregate, alongside 50% from FSc/HSSC marks and 17% from Matric marks. Use UET GPT's merit calculator to convert your practice ECAT score directly into a projected aggregate.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/uet-taxila/ecat-guide#faq`,
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

export default function EcatGuidePage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "ECAT Preparation Guide", url: `${siteUrl}/uet-taxila/ecat-guide` },
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
          <span className="text-white font-medium">ECAT Preparation Guide</span>
        </nav>

        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              Admission Test
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              400 Marks &bull; 100 MCQs &bull; 100 Minutes
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            ECAT {CURRENT_ACADEMIC_YEAR} Preparation Guide
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            ECAT (Engineering College Admission Test) is the 400-mark, negative-marked entry test
            UET Lahore conducts for UET Taxila and the wider Punjab engineering-admission system. It
            contributes 33% of your final merit aggregate. Here's the subject-wise syllabus
            breakdown, the marking scheme, and a time-management strategy for the 100-minute test
            window.
          </p>
        </header>

        {/* Syllabus breakdown */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-2">
            Subject-Wise Syllabus &amp; High-Yield Topics
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-6">
            Each correct answer is worth +4 marks; each incorrect answer costs -1 mark.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SUBJECTS.map((s) => (
              <div key={s.name} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">{s.name}</h3>
                  <span className="text-[10px] font-mono text-[#d9b451]">
                    {s.questions} Qs &bull; Max {s.maxMarks}
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-[#a1a1aa]">
                  {s.topics.map((t) => (
                    <li key={t}>&bull; {t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Time management */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">
            The 3-Pass Time Management Strategy
          </h2>
          <div className="space-y-4">
            {TIME_PASSES.map((p) => (
              <div
                key={p.pass}
                className="flex gap-4 rounded-xl border border-white/10 bg-[#0c0d10] p-5"
              >
                <div className="shrink-0 w-24">
                  <div className="text-sm font-bold text-[#d9b451]">{p.pass}</div>
                  <div className="text-[10px] font-mono text-[#71717a]">{p.window}</div>
                </div>
                <p className="text-sm text-[#a1a1aa] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTAs */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/admissions?tab=ecat"
            className="rounded-xl border border-[#d9b451]/30 bg-[#0c0d10] p-5 hover:border-[#d9b451]/60 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Live Score Simulator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Drag correct/wrong sliders per subject and see your net score in real time.
            </p>
          </Link>
          <Link
            href="/tools?tab=merit"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Turn your ECAT score into a projected UET Taxila merit aggregate.
            </p>
          </Link>
          <Link
            href="/learn/ecat"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              What is ECAT? &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Format, organizers, and how it fits into the merit formula.
            </p>
          </Link>
        </section>

        {/* FAQs */}
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
