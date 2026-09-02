import type { Metadata } from "next";
import Link from "next/link";
import { FeeCalculator } from "@/components/calculator/fee-calculator";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Fee Structure: Tuition & Hostel Fees",
  description:
    "Explore UET Taxila undergraduate fee structures: subsidized and partial-subsidized tuition, hostel fees, payment schedules, and admission fee refund policy.",
  alternates: {
    canonical: `${siteUrl}/uet-taxila/fee-structure`,
  },
  openGraph: {
    title: "UET Taxila Fee Structure: Tuition & Hostel Fees",
    description:
      "Undergraduate tuition, hostel and other charges at UET Taxila, the payment schedule, and the fee refund policy - grounded in the official UET Taxila prospectus.",
    url: `${siteUrl}/uet-taxila/fee-structure`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Fee Structure",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Fee Structure: Tuition & Hostel Fees",
    description:
      "Undergraduate tuition, hostel charges, payment schedules, and refund policy at UET Taxila.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "What is included in the UET Taxila fee structure?",
    a: "The UET Taxila undergraduate fee structure is split into non-recurring charges (payable once at admission) and recurring charges (payable per semester). Non-recurring charges include admission charges, re-admission charges, the student identity card, document verification fee, and refundable library security. Recurring per-semester charges include registration, tuition, sports, magazine, medical, laboratory, examination, book bank rent, instructional tour, recreation, Smart & Safe Campus, digital library, and - where applicable - bus fares and survey camp charges. Hostel residents pay additional hostel, mess, and utility charges. Full figures are published in Table 30.1 of the UET Taxila undergraduate prospectus.",
  },
  {
    q: "How much is the tuition fee at UET Taxila?",
    a: "For the subsidized category, the per-semester tuition fee is Rs. 38,000. For the partial-subsidized categories (Category S - All Pakistan, and Category X - children of overseas Pakistanis), the per-semester tuition fee is Rs. 130,000. Admission charges also differ sharply: Rs. 7,000 for subsidized students versus Rs. 300,000 for partial-subsidized students. Bus fares, electricity, and gas charges can change each semester based on government-fixed fuel, electricity, and gas rates, so UET GPT provides the current figures rather than fixed numbers.",
  },
  {
    q: "What are the hostel charges at UET Taxila?",
    a: "Hostel residents pay additional charges on top of tuition. For the first semester a hostel resident pays Rs. 24,000 in non-refundable hostel charges, which covers services & contingencies (Rs. 3,000), room rent (Rs. 5,000), masjid fund (Rs. 500), electricity (Rs. 10,000), and Sui gas (Rs. 1,500). Two refundable securities are also collected at admission: hostel security (Rs. 8,000) and mess security (Rs. 8,000). Refundable securities are returned on clearance when a student leaves the university or hostel, subject to deduction of outstanding dues.",
  },
  {
    q: "What is the difference between subsidized and partial-subsidized (S and X) categories?",
    a: "Most UET Taxila seats are subsidized, where fees are heavily subsidized by the university. Category S (All Pakistan, partial-subsidized) and Category X (children of overseas Pakistanis, partial-subsidized) are partially subsidized. The difference is reflected directly in the fee schedule: partial-subsidized students pay Rs. 300,000 in admission charges and Rs. 130,000 per-semester tuition, compared with Rs. 7,000 admission charges and Rs. 38,000 per-semester tuition for subsidized students. There is no relaxation, concession, or waiver in fee for the S and X categories.",
  },
  {
    q: "How are fees paid and when are they due at UET Taxila?",
    a: "Non-recurring fees are charged at the time of admission, while recurring fees are charged per semester and are payable before the start of every semester (Fall or Spring). The Treasurer notifies the fee schedule about one month before the start of each semester, and registration and fee submission must be completed at least ten days before the semester begins. Late deposit attracts a fine of Rs. 100 per day up to one month after the commencement of classes; beyond that, admission or registration can be suspended or cancelled. Need-based students may request a payment extension or two-installment plan from their department chairman.",
  },
  {
    q: "What is UET Taxila's fee refund policy?",
    a: "UET Taxila follows the National Level Fee-Refund Policy for Higher Education Institutions of Pakistan adopted by the university. On admission withdrawal, 100% of applicable fee is refunded up to the 7th day of commencement of classes, 50% from the 8th to the 15th day, and 0% from the 16th day onward. The percentage applies to all fee components except security and admission charges. The timeline is calculated continuously, covering both weekdays and weekends.",
  },
  {
    q: "How does UET GPT explain current UET Taxila fees?",
    a: "UET GPT is the AI guide to UET Taxila and answers fee questions grounded in official university documents, including the undergraduate prospectus. Because several charges - such as bus fares, electricity, and gas - are revised each semester based on government-fixed rates, and because the university may change fees without prior notice, UET GPT provides the current figures and cites the official source rather than presenting outdated numbers. Ask UET GPT about any fee component, category, or refund scenario for an up-to-date, sourced answer.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/uet-taxila/fee-structure#faq`,
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

const feeRows = [
  { item: "Admission Charges", subsidized: "7,000", partial: "300,000" },
  { item: "Re-admission Charges", subsidized: "4,000", partial: "4,000" },
  { item: "Student Identity Card", subsidized: "2,000", partial: "2,000" },
  { item: "Document Verification Fee", subsidized: "3,000", partial: "3,000" },
  { item: "Library Security (Refundable)", subsidized: "2,000", partial: "2,000" },
  { item: "Registration Charges (per semester)", subsidized: "2,000", partial: "2,000" },
  { item: "Tuition Fee (per semester)", subsidized: "38,000", partial: "130,000" },
  { item: "Sports Charges (per semester)", subsidized: "2,000", partial: "2,000" },
  { item: "Magazine Charges (per semester)", subsidized: "1,000", partial: "1,000" },
  { item: "Medical Charges (per semester)", subsidized: "3,000", partial: "3,000" },
  { item: "Laboratory Charges (per semester)", subsidized: "3,000", partial: "3,000" },
  { item: "Examination Charges (per semester)", subsidized: "3,000", partial: "3,000" },
  { item: "Book Bank Rent (per semester)", subsidized: "500", partial: "500" },
  { item: "Instructional Tour Charges (per semester)", subsidized: "5,000", partial: "5,000" },
  { item: "Recreation Charges (per semester)", subsidized: "3,000", partial: "3,000" },
  { item: "Smart & Safe Campus Charges (per semester)", subsidized: "3,000", partial: "3,000" },
  { item: "Digital Library Charges (per semester)", subsidized: "500", partial: "500" },
  {
    item: "Survey Camp Charges - Civil Engg only (per semester)",
    subsidized: "10,000",
    partial: "10,000",
  },
  { item: "Bus Fare - Non-Resident (per semester)", subsidized: "22,000", partial: "22,000" },
  { item: "Bus Fare - Resident (per semester)", subsidized: "10,000", partial: "10,000" },
  { item: "SAP Charges (per semester)", subsidized: "1,800", partial: "1,800" },
];

const hostelRows = [
  { item: "Hostel Security (Refundable)", amount: "8,000" },
  { item: "Mess Security (Refundable)", amount: "8,000" },
  { item: "Services & Contingencies", amount: "3,000" },
  { item: "Room Rent", amount: "5,000" },
  { item: "Masjid Fund", amount: "500" },
  { item: "Electricity Charges", amount: "10,000" },
  { item: "Sui Gas Charges", amount: "1,500" },
];

export default function UetTaxilaFeeStructurePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "Fee Structure", url: `${siteUrl}/uet-taxila/fee-structure` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main id="main-content" className="flex-1">
        <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Official Schedule {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            UET Taxila Fee Structure
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#d9b451] to-[#f0d178] mt-2">
              Tuition, Hostel &amp; Other Charges
            </span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8 leading-relaxed">
            A clear breakdown of the undergraduate fee schedule at the University of Engineering and
            Technology, Taxila - grounded in the official UET Taxila undergraduate prospectus and
            verified by UET GPT.
          </p>
          <div className="flex items-center justify-center flex-wrap gap-4">
            <Link
              href="#calculator"
              className="px-6 py-3 rounded-xl bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-colors text-base min-h-[44px] flex items-center justify-center"
            >
              Simulate Semester Fees
            </Link>
            <Link
              href="/scholarships"
              className="px-6 py-3 rounded-xl border border-[#d9b451]/40 text-[#d9b451] hover:bg-[#d9b451]/10 transition-colors text-base min-h-[44px] flex items-center justify-center"
            >
              Financial Aid &amp; Scholarships
            </Link>
            <Link
              href="/uet-taxila"
              className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base min-h-[44px] flex items-center justify-center"
            >
              UET Taxila Hub
            </Link>
          </div>
        </section>

        {/* Interactive Fee Calculator Section */}
        <section id="calculator" className="px-6 py-12 max-w-5xl mx-auto">
          <FeeCalculator />
        </section>

        {/* Official Fee Schedule Table Section */}
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-4 text-white">
            Undergraduate Fee Schedule (Table 30.1)
          </h2>
          <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto text-sm">
            All amounts in Pakistan Rupees (PKR). Non-recurring charges are payable once at the time
            of admission; recurring charges are payable before the start of each semester.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#1a1a1e]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1a1a1e] bg-[#0c0c0f] text-xs uppercase text-[#a1a1aa] font-mono">
                <tr>
                  <th className="px-6 py-4">Item of Charges</th>
                  <th className="px-6 py-4">Subsidized (Rs.)</th>
                  <th className="px-6 py-4">Partial-Subsidized (S &amp; X) (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1e] bg-[#070708]">
                {feeRows.map((row) => (
                  <tr key={row.item} className="hover:bg-[#0c0c0f] transition-colors">
                    <td className="px-6 py-3.5 text-zinc-300">{row.item}</td>
                    <td className="px-6 py-3.5 font-mono text-[#d9b451]">{row.subsidized}</td>
                    <td className="px-6 py-3.5 font-mono text-[#d9b451]">{row.partial}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Hostel Charges Table Section */}
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-4 text-white">
            Hostel Charges for Resident Students
          </h2>
          <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto text-sm">
            Charged in addition to tuition. Refundable securities are returned on clearance upon
            leaving the university, subject to deduction of outstanding dues.
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#1a1a1e]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#1a1a1e] bg-[#0c0c0f] text-xs uppercase text-[#a1a1aa] font-mono">
                <tr>
                  <th className="px-6 py-4">Hostel Item</th>
                  <th className="px-6 py-4">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1e] bg-[#070708]">
                {hostelRows.map((row) => (
                  <tr key={row.item} className="hover:bg-[#0c0c0f] transition-colors">
                    <td className="px-6 py-3.5 text-zinc-300">{row.item}</td>
                    <td className="px-6 py-3.5 font-mono text-[#d9b451]">{row.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Refund Policy Section */}
        <section className="px-6 py-16 max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-4 text-white">
            Admission Withdrawal &amp; Fee Refund Policy
          </h2>
          <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto text-sm">
            Per the National Level Fee-Refund Policy adopted by UET Taxila, calculated from the
            commencement of classes:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
              <div className="text-2xl font-bold text-emerald-400 font-mono mb-2">100% Refund</div>
              <h3 className="font-semibold text-sm mb-2 text-white">Up to 7th Day</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Full refund of tuition and recurring fees if applied up to the 7th day of classes.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
              <div className="text-2xl font-bold text-[#d9b451] font-mono mb-2">50% Refund</div>
              <h3 className="font-semibold text-sm mb-2 text-white">8th to 15th Day</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                Half fee refund if applied between the 8th and 15th calendar day.
              </p>
            </div>
            <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
              <div className="text-2xl font-bold text-rose-400 font-mono mb-2">0% Refund</div>
              <h3 className="font-semibold text-sm mb-2 text-white">16th Day Onward</h3>
              <p className="text-xs text-[#a1a1aa] leading-relaxed">
                No fee refund after the 15th day of commencement of academic sessions.
              </p>
            </div>
          </div>
        </section>

        {/* Sibling Cross-Links & Navigation */}
        <section className="px-6 py-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 text-white">Related University Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/scholarships"
              className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
            >
              <div className="text-xs text-[#d9b451] font-mono mb-1">FINANCIAL AID</div>
              <h3 className="font-medium text-sm text-white">Scholarships &amp; Grants</h3>
              <p className="text-xs text-[#a1a1aa] mt-1">HEC Need-Based, Ehsaas, and alumni aid.</p>
            </Link>
            <Link
              href="/uet-taxila/admissions"
              className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
            >
              <div className="text-xs text-[#d9b451] font-mono mb-1">ADMISSIONS</div>
              <h3 className="font-medium text-sm text-white">Admissions &amp; ECAT</h3>
              <p className="text-xs text-[#a1a1aa] mt-1">
                ECAT entry test and eligibility criteria.
              </p>
            </Link>
            <Link
              href="/campus-life"
              className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
            >
              <div className="text-xs text-[#d9b451] font-mono mb-1">CAMPUS</div>
              <h3 className="font-medium text-sm text-white">Hostels &amp; Transport</h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Bus routes and residential halls.</p>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-6 py-16 max-w-3xl mx-auto border-t border-white/10">
          <h2 className="text-2xl font-semibold text-center mb-6 text-white">
            Frequently Asked Questions about UET Taxila Fees
          </h2>
          <div className="space-y-4">
            {FAQ_ITEMS.map((faq) => (
              <details
                key={faq.q}
                className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] transition-all"
              >
                <summary className="font-medium text-sm cursor-pointer text-white">{faq.q}</summary>
                <p className="mt-3 text-sm text-[#a1a1aa] leading-relaxed">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
