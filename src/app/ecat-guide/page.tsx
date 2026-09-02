import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "ECAT 2026 Preparation Guide: Pattern & Syllabus",
  description:
    "Complete ECAT 2026 preparation guide: 400-marks paper pattern, negative marking (+4 / -1), subject-wise syllabus breakdown, and time management strategies.",
  alternates: {
    canonical: `${siteUrl}/ecat-guide`,
  },
  openGraph: {
    title: "ECAT 2026 Preparation Guide: Pattern & Syllabus",
    description:
      "Complete ECAT 2026 preparation guide: 400-marks paper pattern, negative marking (+4 / -1), subject-wise syllabus breakdown, and time management strategies.",
    url: `${siteUrl}/ecat-guide`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "ECAT 2026 Preparation Guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "ECAT 2026 Preparation Guide: Pattern & Syllabus",
    description:
      "Master the Punjab Engineering College Admission Test (ECAT) with official test patterns and syllabus breakdowns.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const SUBJECT_BREAKDOWN = [
  {
    subject: "Mathematics / Biology",
    mcqs: "30 MCQs",
    marks: "120 Marks",
    weight: "30%",
    topics:
      "Calculus, Analytical Geometry, Conics, Trigonometry, Vectors, Matrices, Complex Numbers",
  },
  {
    subject: "Physics",
    mcqs: "30 MCQs",
    marks: "120 Marks",
    weight: "30%",
    topics:
      "Electromagnetism, Modern Physics, Nuclear Physics, Optics, Waves, Thermodynamics, Mechanics",
  },
  {
    subject: "Chemistry / Computer Science",
    mcqs: "30 MCQs",
    marks: "120 Marks",
    weight: "30%",
    topics:
      "Organic Mechanisms, Chemical Equilibrium, Electrochemistry / OOP, Data Structures, Logic Gates",
  },
  {
    subject: "English Comprehension",
    mcqs: "10 MCQs",
    marks: "40 Marks",
    weight: "10%",
    topics:
      "Reading Comprehension, Sentence Completion, Vocabulary in Context, Grammar & Prepositions",
  },
];

const FAQ_ITEMS = [
  {
    q: "How does negative marking work in ECAT?",
    a: "The ECAT test consists of 100 Multiple Choice Questions (MCQs) for a total of 400 marks. For each correct answer, you are awarded +4 marks. For each incorrect answer, -1 mark is deducted. Unattempted questions receive 0 marks.",
  },
  {
    q: "What is a safe ECAT score for admission to UET Taxila Computer Science or Software Engineering?",
    a: "Because Computer Science and Software Engineering are among the highest closing merit disciplines (aggregate ~78% to 82%+), an ECAT score of 180 to 240+ out of 400 (alongside 85%+ in F.Sc) provides a strong competitive edge.",
  },
  {
    q: "How many times can I appear in the ECAT entry test in a year?",
    a: "UET conducts two ECAT sessions per year (ECAT-1 in Spring and ECAT-2 in Summer). Applicants can appear in both sessions, and the highest score achieved is automatically considered for merit aggregate computation.",
  },
  {
    q: "Is a calculator allowed in the ECAT exam?",
    a: "No. Handheld calculators and electronic devices are strictly prohibited during the computer-based ECAT examination. Questions are structured to test conceptual understanding and mental arithmetic.",
  },
];

export default function EcatGuidePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/ecat-guide#faq`,
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

  const howToSchema = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${siteUrl}/ecat-guide#howto`,
    name: "How to Prepare for the ECAT Engineering Entry Test",
    description: "5-step strategic roadmap to scoring 200+ in the Punjab ECAT examination.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Master Punjab Textbook Board (PTB) F.Sc Concepts",
        text: "Thoroughly review intermediate Part-1 and Part-2 textbooks for Mathematics, Physics, and Chemistry/CS.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Memorize Short-Cut Formulas and Math Identities",
        text: "Because calculators are prohibited, practice mental math tricks, integration short-cuts, and vector rules.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Solve 10+ Years of Past ECAT Papers",
        text: "Familiarize yourself with question patterns, recurring physics scenarios, and tricky English comprehension passages.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Practice Under Strict 100-Minute Time Constraints",
        text: "Simulate computer-based test conditions by answering 100 questions within 100 minutes (1 minute per MCQ).",
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Estimate Aggregate & Plan Second Attempt Strategy",
        text: "Use the UET Taxila Merit Calculator to compute your combined aggregate (33% ECAT + 50% HSSC + 17% SSC).",
        url: `${siteUrl}/calculator`,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "ECAT Guide", url: `${siteUrl}/ecat-guide` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema definitions
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema definitions
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 w-full"
      >
        {/* Breadcrumb Navigation */}
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">ECAT Guide</span>
        </nav>

        {/* Page Header */}
        <header className="mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Entry Test Strategy {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            ECAT 2026 Preparation Guide
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] max-w-3xl leading-relaxed">
            The Engineering College Admission Test (ECAT) accounts for{" "}
            <strong>33% of your merit aggregate</strong> for admission to UET Taxila and UET Lahore.
            Master the 400-marks exam format, negative marking rules, and subject-wise high-yield
            syllabus.
          </p>
        </header>

        {/* Quick Test Facts Banner */}
        <section
          aria-label="ECAT Quick Facts"
          className="mb-16 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Total Marks</span>
            <span className="text-3xl font-extrabold font-mono text-[#d9b451] mt-1 block">400</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">
              Total Questions
            </span>
            <span className="text-3xl font-extrabold font-mono text-white mt-1 block">
              100 MCQs
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Total Time</span>
            <span className="text-3xl font-extrabold font-mono text-white mt-1 block">
              100 Mins
            </span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">
              Negative Marking
            </span>
            <span className="text-3xl font-extrabold font-mono text-rose-400 mt-1 block">
              -1 Mark
            </span>
          </div>
        </section>

        {/* Subject-wise Marks Breakdown Table */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">
            Subject-wise Pattern &amp; Syllabus
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0c0d10] shadow-xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-white/10 bg-[#14151a] font-mono text-[#a1a1aa] uppercase">
                <tr>
                  <th className="px-5 py-4 text-white">Subject</th>
                  <th className="px-5 py-4">Questions</th>
                  <th className="px-5 py-4">Marks</th>
                  <th className="px-5 py-4">Weight</th>
                  <th className="px-5 py-4">Key High-Yield Topics</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#07080a]">
                {SUBJECT_BREAKDOWN.map((item) => (
                  <tr key={item.subject} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 font-semibold text-white">{item.subject}</td>
                    <td className="px-5 py-4 font-mono text-zinc-300">{item.mcqs}</td>
                    <td className="px-5 py-4 font-mono text-[#d9b451]">{item.marks}</td>
                    <td className="px-5 py-4 font-mono text-emerald-400">{item.weight}</td>
                    <td className="px-5 py-4 text-xs text-[#a1a1aa] leading-relaxed max-w-xs">
                      {item.topics}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5-Step Strategic Guide */}
        <section className="mb-16 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-6">
            5-Step Strategy to Score 200+ in ECAT
          </h2>
          <ol className="space-y-4">
            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                1
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Focus on Conceptual Mastery over Rote Learning
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  ECAT physics and math problems test physical intuition and rapid problem
                  decomposition. Focus on textbook derivations and fundamental theorems.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                2
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Avoid Blind Guessing to Protect Marks
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Because every incorrect choice subtracts 1 mark, random guessing on 4 options
                  yields a negative expected value. Only make an educated guess if you can eliminate
                  at least 2 options.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                3
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Time Budgeting: 1 Minute Per MCQ
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Start with English (10 MCQs in 5 mins) and Chemistry/CS (30 MCQs in 25 mins) to
                  bank 30 minutes for complex calculus and multi-step mechanics questions.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                4
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Take Full Computer-Based Mock Tests
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Get accustomed to the on-screen navigation, timer countdown, and question review
                  flags of the official computerized testing software.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                5
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Compute Your Combined Admission Aggregate
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Plug your mock ECAT scores into the UET Taxila Merit Calculator to see which
                  engineering disciplines you qualify for.
                </p>
              </div>
            </li>
          </ol>
        </section>

        {/* Quick Links */}
        <section className="mb-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Simulate aggregate: 33% ECAT + 50% HSSC + 17% SSC.
            </p>
          </Link>
          <Link
            href="/uet-taxila/admissions"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Admissions Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Quota categories, eligibility rules, and key dates.
            </p>
          </Link>
          <Link
            href="/compare"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Compare Universities &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Compare ECAT vs NET vs FAST NU entry test formats.
            </p>
          </Link>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
                <dt className="text-base font-semibold text-white mb-2">{item.q}</dt>
                <dd className="text-sm text-[#a1a1aa] leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
