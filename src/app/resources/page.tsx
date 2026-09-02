import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Past Papers, Grading & Study Resources | UET GPT",
  description:
    "Official UET Taxila academic resources hub: Outcome-Based Education (OBE) grading breakdown, past papers guide, Central Library, and IEEE Xplore access.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/resources",
  },
  openGraph: {
    title: "Past Papers, Grading & Study Resources | UET GPT",
    description:
      "Official UET Taxila academic resources hub: Outcome-Based Education (OBE) grading breakdown, past papers guide, Central Library, and IEEE Xplore access.",
    url: "https://uet-gpt.vercel.app/resources",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Past Papers, Grading & Study Resources | UET GPT",
    description:
      "Official UET Taxila academic resources hub: Outcome-Based Education (OBE) grading breakdown, past papers guide, Central Library, and IEEE Xplore access.",
  },
};

const resourceFaqs = [
  {
    question: "How is semester grading calculated under the OBE system at UET Taxila?",
    answer:
      "Under PEC Level-II OBE regulations, theory courses are split into Continuous Assessment (20-30% comprising quizzes, assignments, and Complex Engineering Problems), Mid-Semester Examination (20-25%), and Final Semester Examination (40-50%), each mapped to specific Course Learning Outcomes (CLOs).",
  },
  {
    question: "How do students access IEEE Xplore and research journals on campus?",
    answer:
      "The Dr. Muhammad Akram Central Library provides high-speed optical fiber terminals with institutional IP authorization for the HEC National Digital Library, IEEE Xplore, ScienceDirect, and ASCE/ASME journals.",
  },
  {
    question: "What is the Book Bank scheme at UET Taxila Central Library?",
    answer:
      "The Central Library Book Bank issues complete sets of prescribed textbooks to students for the full semester duration at a nominal rental charge (10-15% of book value), returnable after final examinations.",
  },
  {
    question: "What are Open-Ended Labs (OEL) in engineering lab evaluations?",
    answer:
      "In the final 3-4 weeks of each practical lab course, students are assigned an Open-Ended Lab where they formulate hypotheses, design circuits/experiments independently, and present data-driven analysis to fulfill psychomotor (P4-P6) and cognitive CLOs.",
  },
];

export default function ResourcesPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: resourceFaqs.map((faq) => ({
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
          { name: "Academics", item: "/uet-taxila/programs" },
          { name: "Resources & Past Papers", item: "/resources" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white py-16 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Academic Excellence Hub
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-zinc-50">
                Past Papers, Grading &amp; Study Resources
              </h1>
              <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                A comprehensive guide to UET Taxila&apos;s Washington Accord Outcome-Based Education
                (OBE) examination rubrics, Central Library digital catalogs, Book Bank issuing, and
                semester study strategies.
              </p>
            </div>
          </div>
        </section>

        {/* OBE Grading Breakdown Grid */}
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              OBE Examination &amp; Evaluation Rubrics
            </h2>
            <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
              Official assessment distribution across all 14 undergraduate engineering and computing
              degrees:
            </p>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Continuous Assessment (20% – 30%)
                </span>
                <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  Sessional Quizzes &amp; CEPs
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Comprises 3-4 announced quizzes, numerical problem sets, and a team-based Complex
                  Engineering Problem (CEP) designed to assess design synthesis (Bloom&apos;s
                  Cognitive Levels C3-C5).
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Mid-Semester Exam (20% – 25%)
                </span>
                <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  9th-Week Evaluation
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  A 90-minute centralized written examination covering the first 8 weeks of course
                  syllabi with question papers explicitly tagged with target CLO achievement
                  thresholds.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Final Examination (40% – 50%)
                </span>
                <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  18th-Week Comprehensive Exam
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Comprehensive 3-hour examination covering complete course outcomes. Students must
                  attain minimum 50% cumulative CLO attainment to clear PEC accreditation standards.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Central Library & Research Facilities */}
        <section className="border-t border-zinc-200/80 bg-white py-12 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Dr. Muhammad Akram Central Library &amp; Digital Databases
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  HEC National Digital Library &amp; IEEE Xplore
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Over 60,000 physical volumes, 20,000+ electronic books, and unrestricted full-text
                  access to IEEE Xplore, ScienceDirect, SpringerLink, ACM Digital Library, and ASCE
                  journals via campus fiber network.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Book Bank Lending Program
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Subsidized textbook lending service where every student can borrow up to 6 core
                  course books for the entire 18-week semester at a nominal 10% wear-and-tear
                  deposit.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Past Papers Archive Guide */}
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              How to Access Past Papers &amp; Course Packs
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Channel 1
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Department CMS &amp; Moodle
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Official course outlines, OBE rubrics, weekly lecture slides, and sample exam
                  questions posted directly by course instructors on departmental LMS portals.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Channel 2
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  CR Batch Knowledge Drives
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Student-managed shared archives maintaining categorized mid-term papers, final
                  exam papers, solved numerical assignments, and Open-Ended Lab design templates.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Channel 3
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Campus Photocopy Centers
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Physical bound course packs, previous 5-year question paper compilations, and OBE
                  lab record journals available at the Student Service Center kiosks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="border-t border-zinc-200/80 bg-white py-12 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Frequently Asked Questions About Study Resources
            </h2>
            <div className="mt-6 space-y-4">
              {resourceFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30"
                >
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap justify-center gap-4 text-center">
              <Link
                href="/gpa-calculator"
                className="inline-flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                &larr; Calculate Your SGPA &amp; CGPA
              </Link>
              <span className="text-zinc-300 dark:text-zinc-700">|</span>
              <Link
                href="/uet-taxila/programs"
                className="inline-flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                Explore 14 Program Curriculums &rarr;
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
