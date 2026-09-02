import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Scholarships 2026: HEC, Ehsaas & Aid",
  description:
    "Comprehensive guide to undergraduate scholarships at UET Taxila: HEC Need-Based, Ehsaas, PEEF, Alumni stipends, eligibility criteria, and how to apply.",
  alternates: {
    canonical: `${siteUrl}/scholarships`,
  },
  openGraph: {
    title: "UET Taxila Scholarships 2026: HEC, Ehsaas & Aid",
    description:
      "Comprehensive guide to undergraduate scholarships at UET Taxila: HEC Need-Based, Ehsaas, PEEF, Alumni stipends, eligibility criteria, and how to apply.",
    url: `${siteUrl}/scholarships`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Scholarships & Financial Aid Guide",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Scholarships 2026: HEC, Ehsaas & Aid",
    description:
      "Explore HEC, Ehsaas, PEEF, and Alumni scholarships available for UET Taxila undergraduate engineering students.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

interface ScholarshipItem {
  id: string;
  name: string;
  provider: string;
  coverage: string;
  eligibility: string;
  stipend: string;
}

const SCHOLARSHIP_PROGRAMS: ScholarshipItem[] = [
  {
    id: "hec-need-based",
    name: "HEC Need-Based Scholarship Program",
    provider: "Higher Education Commission (HEC) Pakistan",
    coverage: "Full Tuition Fee + Monthly Stipend",
    eligibility:
      "Financially needy students admitted on open merit with family income below PKR 45,000/month.",
    stipend: "PKR 6,000 / month living allowance",
  },
  {
    id: "ehsaas-undergraduate",
    name: "Ehsaas / BISP Undergraduate Scholarship",
    provider: "Benazir Income Support Programme / HEC",
    coverage: "100% Tuition Fee Coverage",
    eligibility:
      "Undergraduate students admitted on merit whose family income is below poverty threshold.",
    stipend: "PKR 4,000 / month stipend",
  },
  {
    id: "peef",
    name: "Punjab Educational Endowment Fund (PEEF)",
    provider: "Government of Punjab",
    coverage: "100% Tuition Fee Waiver",
    eligibility:
      "Punjab domicile holders with at least 60% marks in intermediate and monthly family income <= PKR 40,000.",
    stipend: "Boarding & day scholar stipends",
  },
  {
    id: "alumni-aid",
    name: "UET Taxila Alumni Association (UETTAA) Aid",
    provider: "UET Taxila Alumni Chapters (USA, UK, Middle East)",
    coverage: "Partial to Full Semester Tuition Support",
    eligibility:
      "Meritorious students experiencing sudden financial hardship or deceased parent/guardian.",
    stipend: "Book bank and hostel fee assistance",
  },
  {
    id: "merit-cum-poverty",
    name: "University Merit-cum-Poverty Scholarship",
    provider: "UET Taxila Financial Aid Office",
    coverage: "50% to 100% Tuition Fee Remission",
    eligibility:
      "Top 10% academic performers in each engineering department with verified financial need.",
    stipend: "Direct fee adjustment in semester dues",
  },
];

const FAQ_ITEMS = [
  {
    q: "Can self-finance (Category S) students apply for HEC scholarships at UET Taxila?",
    a: "Generally, government need-based scholarships like HEC Need-Based and Ehsaas are restricted to students admitted on Open Merit (Subsidized Category A). However, self-finance students can apply for UET Alumni Association assistance, external private trusts, and interest-free student loans.",
  },
  {
    q: "When are scholarship applications opened at UET Taxila?",
    a: "Applications for the major need-based scholarships open during the first semester (usually September - October) right after admission verification. Students must submit the institutional financial aid form through the UET Taxila Directorate of Student Affairs.",
  },
  {
    q: "What documents are required for UET Taxila financial aid?",
    a: "Required documents include: Salary slip or verified income certificate of father/guardian, utility bills (electricity, gas, water) of past 6 months, copies of CNIC/B-Form of all family members, educational fee receipts of siblings, and rented house agreement if applicable.",
  },
  {
    q: "Can a student hold two scholarships at the same time?",
    a: "No. Under university and HEC regulations, a student cannot hold two full concurrent scholarships covering the same expenses. If awarded a second scholarship, the student must surrender one in favor of another deserving candidate.",
  },
];

export default function ScholarshipsPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/scholarships#faq`,
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

  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${siteUrl}/scholarships#collection`,
    name: `UET Taxila Scholarships & Financial Aid Directory (${CURRENT_ACADEMIC_YEAR})`,
    description:
      "Directory of need-based and merit scholarships available for undergraduate engineering students at UET Taxila.",
    url: `${siteUrl}/scholarships`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: SCHOLARSHIP_PROGRAMS.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        description: `${item.provider}: ${item.coverage}. ${item.eligibility}`,
      })),
    },
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Scholarships", url: `${siteUrl}/scholarships` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
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
          <span className="text-white font-medium">Scholarships</span>
        </nav>

        {/* Page Header */}
        <header className="mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Financial Aid Guide {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Scholarships &amp; Financial Aid
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] max-w-3xl leading-relaxed">
            No deserving student should be denied engineering education due to financial
            constraints. Learn about the <strong>HEC Need-Based</strong>, <strong>Ehsaas</strong>,{" "}
            <strong>PEEF</strong>, and <strong>Alumni Association</strong> funding opportunities at
            the University of Engineering and Technology, Taxila.
          </p>
        </header>

        {/* Major Scholarship Cards */}
        <section aria-label="Available Scholarships" className="mb-16 space-y-6">
          <h2 className="text-2xl font-bold text-white mb-6">Major Scholarship Schemes</h2>
          <div className="grid grid-cols-1 gap-6">
            {SCHOLARSHIP_PROGRAMS.map((prog) => (
              <div
                key={prog.id}
                id={prog.id}
                className="rounded-xl border border-white/10 bg-[#0c0d10] p-6 hover:border-[#d9b451]/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4 mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">{prog.name}</h3>
                    <p className="text-xs text-[#d9b451] font-mono mt-0.5">{prog.provider}</p>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 w-fit">
                    {prog.coverage}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#a1a1aa]">
                  <div>
                    <span className="font-semibold text-white block mb-1">
                      Eligibility Criteria:
                    </span>
                    <p className="leading-relaxed">{prog.eligibility}</p>
                  </div>
                  <div>
                    <span className="font-semibold text-white block mb-1">
                      Stipend &amp; Benefits:
                    </span>
                    <p className="leading-relaxed text-zinc-300">{prog.stipend}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Step-by-Step Application Checklist */}
        <section className="mb-16 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            How to Apply for Financial Aid at UET Taxila
          </h2>
          <p className="text-sm text-[#a1a1aa] mb-6 leading-relaxed">
            Follow this step-by-step roadmap to submit a successful scholarship application through
            the Directorate of Student Affairs:
          </p>

          <ol className="space-y-4">
            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                1
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Obtain the Institutional Financial Aid Application Form
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Download the form from the official UET Taxila student portal or collect it from
                  the Directorate of Student Affairs (DSA office) in the administrative block.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                2
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Gather Verified Income Documentation
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Attach salary slips, pension certificates, or union council income affidavits
                  demonstrating gross monthly household earnings.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                3
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Institutional Scholarship Award Committee (ISAC) Interview
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Shortlisted candidates appear before the committee for means testing and
                  verification of financial circumstances.
                </p>
              </div>
            </li>

            <li className="flex gap-4 p-4 rounded-xl border border-white/5 bg-[#14151a]">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d9b451] text-xs font-bold text-[#07080a]">
                4
              </span>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Fee Remission &amp; Disbursement
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Once approved, tuition fees are directly adjusted against your semester fee
                  voucher by the treasurer&apos;s office, and stipends are credited to your bank
                  account.
                </p>
              </div>
            </li>
          </ol>
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
              Estimate your aggregate and check if you qualify for open merit seats.
            </p>
          </Link>
          <Link
            href="/uet-taxila/fee-structure"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Fee Structure Breakdown &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Review full semester-by-semester tuition, hostel, and registration fees.
            </p>
          </Link>
          <Link
            href="/campus-life"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Campus Life Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Hostel accommodation, bus transport routes, and campus facilities.
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
