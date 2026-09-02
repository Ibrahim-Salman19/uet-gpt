import type { Metadata } from "next";
import Link from "next/link";
import { GpaCalculator } from "@/components/calculator/gpa-calculator";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila GPA Calculator: SGPA & CGPA Tool",
  description:
    "Calculate your semester GPA (SGPA) and cumulative CGPA using the official UET Taxila 4.00 grading scale. Check academic probation and Dean's list status.",
  alternates: {
    canonical: `${siteUrl}/gpa-calculator`,
  },
  openGraph: {
    title: "UET Taxila GPA Calculator: SGPA & CGPA Tool",
    description:
      "Calculate your semester GPA (SGPA) and cumulative CGPA using the official UET Taxila 4.00 grading scale. Check academic probation and Dean's list status.",
    url: `${siteUrl}/gpa-calculator`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila GPA Calculator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila GPA Calculator: SGPA & CGPA Tool",
    description:
      "Free interactive GPA and CGPA calculator built strictly on UET Taxila examination regulations.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "How is SGPA and CGPA calculated at UET Taxila?",
    a: "Semester GPA (SGPA) is calculated by multiplying the grade points earned in each course by its credit hours, summing the quality points, and dividing by total credit hours registered. Cumulative CGPA is the weighted average across all semesters completed.",
  },
  {
    q: "What is the official UET Taxila grading scale?",
    a: "The grading scheme uses a 4.00 scale: A = 4.00 (85%+), A- = 3.70 (80-84%), B+ = 3.30 (75-79%), B = 3.00 (70-74%), B- = 2.70 (65-69%), C+ = 2.30 (61-64%), C = 2.00 (58-60%), C- = 1.70 (54-57%), D = 1.00 (50-53%), and F = 0.00 (<50%).",
  },
  {
    q: "What are the rules for academic probation and dismissal at UET Taxila?",
    a: "A student is placed on Academic Probation if their semester GPA falls below 2.00. If a student fails to achieve a CGPA of 2.00 for two consecutive probationary semesters, their admission is subject to academic dismissal per university regulations.",
  },
  {
    q: "What CGPA is required to graduate with Honors or First Division?",
    a: "To qualify for the Dean's Honors List in a semester, a student must secure an SGPA of 3.70 or higher with a minimum of 12 credit hours. To graduate in First Division, a cumulative CGPA of 2.50 or higher is required.",
  },
];

export default function GpaCalculatorPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/gpa-calculator#faq`,
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

  const appSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${siteUrl}/gpa-calculator#app`,
    name: "UET Taxila GPA Calculator",
    url: `${siteUrl}/gpa-calculator`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "All",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "PKR",
    },
    description:
      "Free interactive GPA and CGPA calculator for UET Taxila engineering and computing students.",
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "GPA Calculator", url: `${siteUrl}/gpa-calculator` },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
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
          <span className="text-white font-medium">GPA Calculator</span>
        </nav>

        {/* Page Header */}
        <header className="mb-10 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Official Examination Scale {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila GPA &amp; CGPA Calculator
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            Compute your semester SGPA and cumulative CGPA according to the official UET Taxila
            examination regulations. Track probation risks and Dean&apos;s Honors list standing in
            real-time.
          </p>
        </header>

        {/* Interactive GPA Calculator Tool */}
        <section aria-label="GPA Calculator Tool" className="mb-16">
          <GpaCalculator />
        </section>

        {/* Grading Regulations Guide */}
        <section className="mb-16 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            UET Taxila Semester Grading System Regulations
          </h2>
          <div className="space-y-4 text-sm text-[#a1a1aa] leading-relaxed">
            <p>
              According to the UET Taxila Semester Examination Regulations, letter grades and grade
              points are assigned on the following continuous scale:
            </p>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#14151a] font-mono text-[#a1a1aa] uppercase">
                  <tr>
                    <th className="px-4 py-3">Letter Grade</th>
                    <th className="px-4 py-3">Grade Points</th>
                    <th className="px-4 py-3">Marks Range</th>
                    <th className="px-4 py-3">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#07080a] font-mono">
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">A</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">4.00</td>
                    <td className="px-4 py-2.5">85% &ndash; 100%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Exceptional</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">A-</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">3.70</td>
                    <td className="px-4 py-2.5">80% &ndash; 84%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Excellent</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">B+</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">3.30</td>
                    <td className="px-4 py-2.5">75% &ndash; 79%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Very Good</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">B</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">3.00</td>
                    <td className="px-4 py-2.5">70% &ndash; 74%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Good</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">B-</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">2.70</td>
                    <td className="px-4 py-2.5">65% &ndash; 69%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Above Average</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">C+</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">2.30</td>
                    <td className="px-4 py-2.5">61% &ndash; 64%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Average</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">C</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">2.00</td>
                    <td className="px-4 py-2.5">58% &ndash; 60%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">
                      Satisfactory (Pass Threshold)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">C-</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">1.70</td>
                    <td className="px-4 py-2.5">54% &ndash; 57%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Below Average</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-white">D</td>
                    <td className="px-4 py-2.5 text-[#d9b451]">1.00</td>
                    <td className="px-4 py-2.5">50% &ndash; 53%</td>
                    <td className="px-4 py-2.5 font-sans text-[#a1a1aa]">Marginal Pass</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-bold text-rose-400">F</td>
                    <td className="px-4 py-2.5 text-rose-400">0.00</td>
                    <td className="px-4 py-2.5">&lt; 50%</td>
                    <td className="px-4 py-2.5 font-sans text-rose-400">
                      Fail (Must Repeat Course)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Quick Navigation Cards */}
        <section className="mb-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Compute admission aggregate with 33% ECAT, 50% HSSC, 17% SSC formula.
            </p>
          </Link>
          <Link
            href="/scholarships"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Scholarships Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              HEC Need-Based, Ehsaas, and merit-cum-poverty fee remissions.
            </p>
          </Link>
          <Link
            href="/campus-life"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Campus Life &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Hostels, transport bus schedules, central library, and student societies.
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
