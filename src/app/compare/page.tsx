import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila vs NUST, FAST & UET Lahore: Comparison",
  description:
    "Compare UET Taxila with NUST, FAST-NUCES, UET Lahore, and GIKI: fees, entry test (ECAT vs NET), PEC Washington Accord accreditation, and CS rankings.",
  alternates: {
    canonical: `${siteUrl}/compare`,
  },
  openGraph: {
    title: "UET Taxila vs NUST, FAST & UET Lahore: Comparison",
    description:
      "Compare UET Taxila with NUST, FAST-NUCES, UET Lahore, and GIKI: fees, entry test (ECAT vs NET), PEC Washington Accord accreditation, and CS rankings.",
    url: `${siteUrl}/compare`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila vs NUST, FAST, UET Lahore Comparison",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila vs NUST, FAST & UET Lahore: Comparison",
    description:
      "Compare tuition fees, admission tests, and PEC accreditations across top Pakistani engineering universities.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

interface UniversityMatrix {
  name: string;
  type: string;
  entryTest: string;
  semesterFee: string;
  pecObeStatus: string;
  hostelAvailability: string;
  campusArea: string;
  specialty: string;
}

const COMPARISON_DATA: UniversityMatrix[] = [
  {
    name: "UET Taxila",
    type: "Public (Government Sector)",
    entryTest: "ECAT (33% weight)",
    semesterFee: "PKR 48,000 (Subsidized)",
    pecObeStatus: "Level-II (Washington Accord)",
    hostelAvailability: "High (~2,000+ capacity, 5 halls)",
    campusArea: "163 Acres (Taxila)",
    specialty: "Core Engineering (Civil, Mechanical, Electrical, Mechatronics, Telecom)",
  },
  {
    name: "UET Lahore",
    type: "Public (Government Sector)",
    entryTest: "ECAT (33% weight)",
    semesterFee: "PKR 48,000 (Subsidized)",
    pecObeStatus: "Level-II (Washington Accord)",
    hostelAvailability: "Moderate (High demand)",
    campusArea: "170 Acres (Lahore)",
    specialty: "Oldest Engineering Institution, Chemical, Mining, Petroleum",
  },
  {
    name: "NUST Islamabad",
    type: "Public-Autonomous / Tri-Services",
    entryTest: "NET (75% weight)",
    semesterFee: "PKR 185,000+",
    pecObeStatus: "Level-II (Washington Accord)",
    hostelAvailability: "High on-campus accommodation",
    campusArea: "700+ Acres (H-12 Islamabad)",
    specialty: "Broad Engineering, Multidisciplinary Research, High International Ranking",
  },
  {
    name: "FAST-NUCES",
    type: "Private / Semi-Chartered",
    entryTest: "NU Test / SAT / NTS",
    semesterFee: "PKR 210,000+",
    pecObeStatus: "Level-II (Computing / EE)",
    hostelAvailability: "Limited / Off-campus",
    campusArea: "15-30 Acres (Sector-based campuses)",
    specialty: "Software Engineering, Computer Science, AI, Industry Job Placements",
  },
  {
    name: "GIKI (Topi, Swabi)",
    type: "Private / Autonomous",
    entryTest: "GIKI Admission Test",
    semesterFee: "PKR 450,000+",
    pecObeStatus: "Level-II (Washington Accord)",
    hostelAvailability: "100% Residential guaranteed",
    campusArea: "400+ Acres (Topi)",
    specialty: "Materials, Mechanical, AI, High Alumni Network",
  },
];

const FAQ_ITEMS = [
  {
    q: "Is UET Taxila degree recognized internationally under the Washington Accord?",
    a: "Yes. UET Taxila is accredited under PEC's Outcome-Based Education (OBE) Level-II framework, making its engineering degrees globally recognized and equivalent to professional engineering degrees in the US, UK, Australia, and Canada through the Washington Accord.",
  },
  {
    q: "How does the fee of UET Taxila compare to private universities like FAST or NUST?",
    a: "UET Taxila offers heavily subsidized government engineering education: regular open-merit semester tuition is approximately PKR 48,000 per semester, compared to PKR 185,000+ at NUST and PKR 210,000+ at FAST-NUCES.",
  },
  {
    q: "Should I choose UET Taxila or FAST for Computer Science?",
    a: "FAST-NUCES has an exceptionally strong software industry brand for pure coding roles, but comes with higher tuition and fewer subsidized seats. UET Taxila's Department of Computer Science and Software Engineering provides top-tier HEC-accredited education, high-spec research labs (e.g. Swarm Robotics NCRA lab), on-campus residential life, and affordable tuition.",
  },
  {
    q: "Which university is better for Mechanical and Electrical Engineering: UET Taxila or UET Lahore?",
    a: "Both UET Taxila and UET Lahore share identical public curriculums, PEC accreditation, and subsidized fee structures. UET Taxila is known for its spacious, peaceful 163-acre campus close to Islamabad/Rawalpindi with guaranteed hostel accessibility and specialized labs like the National Center of Robotics and Automation (NCRA).",
  },
];

export default function ComparePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/compare#faq`,
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

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Compare Universities", url: `${siteUrl}/compare` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema definitions
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 w-full"
      >
        {/* Breadcrumb Navigation */}
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">University Comparison</span>
        </nav>

        {/* Page Header */}
        <header className="mb-12 text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Engineering Admissions Decision Matrix {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila vs NUST, FAST, UET Lahore &amp; GIKI
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            An objective, side-by-side comparison of Pakistan&apos;s leading engineering and
            computing institutions: tuition fees, entry tests, PEC Washington Accord accreditations,
            and campus life.
          </p>
        </header>

        {/* Comparison Matrix Table */}
        <section aria-label="Comparison Matrix" className="mb-16">
          <h2 className="text-2xl font-bold text-white mb-6">Multi-University Comparison Table</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0c0d10] shadow-2xl">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-white/10 bg-[#14151a] font-mono text-[#a1a1aa] uppercase">
                <tr>
                  <th className="px-5 py-4 text-white">University</th>
                  <th className="px-5 py-4">Sector / Type</th>
                  <th className="px-5 py-4">Entry Test</th>
                  <th className="px-5 py-4">Semester Fee (Tuition)</th>
                  <th className="px-5 py-4">PEC Washington Accord</th>
                  <th className="px-5 py-4">Hostels &amp; Campus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#07080a]">
                {COMPARISON_DATA.map((uni) => {
                  const isTaxila = uni.name.includes("Taxila");
                  return (
                    <tr
                      key={uni.name}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        isTaxila ? "bg-[#d9b451]/5 font-semibold" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {isTaxila && (
                            <span className="h-2 w-2 rounded-full bg-[#d9b451] animate-pulse" />
                          )}
                          <span className={isTaxila ? "text-[#d9b451] text-base" : "text-white"}>
                            {uni.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#71717a] block mt-0.5 font-normal">
                          {uni.specialty}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-zinc-300">{uni.type}</td>
                      <td className="px-5 py-4 font-mono text-[#d9b451]">{uni.entryTest}</td>
                      <td className="px-5 py-4 font-mono text-zinc-200">{uni.semesterFee}</td>
                      <td className="px-5 py-4 text-emerald-400 font-mono text-xs">
                        {uni.pecObeStatus}
                      </td>
                      <td className="px-5 py-4 text-[#a1a1aa] text-xs">
                        {uni.hostelAvailability} &bull; {uni.campusArea}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Detailed Decision Factors */}
        <section className="mb-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <div className="text-xs font-mono text-[#d9b451] uppercase mb-2">
              01 / AFFORDABILITY
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Government Subsidies</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              At ~PKR 48,000 per semester, a 4-year engineering degree at UET Taxila costs ~PKR 6.7
              lakhs in total including hostel, compared to PKR 20&ndash;35 lakhs at private
              universities.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <div className="text-xs font-mono text-[#d9b451] uppercase mb-2">
              02 / GLOBAL MOBILITY
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Washington Accord (OBE)</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              UET Taxila degrees are accredited under PEC Level-II (Washington Accord), granting
              automatic international substantial equivalence for PE licensing in US, Canada, UK,
              and Australia.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <div className="text-xs font-mono text-[#d9b451] uppercase mb-2">
              03 / RESIDENTIAL LIFE
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Campus &amp; Location</h3>
            <p className="text-xs text-[#a1a1aa] leading-relaxed">
              163-acre peaceful green campus located 35 km from Islamabad/Rawalpindi with dedicated
              daily bus fleets and 5 on-campus residential halls.
            </p>
          </div>
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
              Compute your admission aggregate with the official formula.
            </p>
          </Link>
          <Link
            href="/uet-taxila/fee-structure"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Fee Structure Simulator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Interactive invoice generator for subsidized vs partial-subsidized seats.
            </p>
          </Link>
          <Link
            href="/gpa-calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              GPA &amp; CGPA Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Calculate semester SGPA and cumulative CGPA on the 4.00 scale.
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
