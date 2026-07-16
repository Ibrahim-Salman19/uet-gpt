import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Fee Structure - Undergraduate Tuition, Hostel & Other Charges",
  description:
    "UET Taxila fee structure explained: subsidized and partial-subsidized (S and X) undergraduate tuition, hostel and other charges, payment schedules, and the admission fee refund policy - with how UET GPT provides current figures.",
  alternates: {
    canonical: `${siteUrl}/uet-taxila/fee-structure`,
  },
  openGraph: {
    title: "UET Taxila Fee Structure - Undergraduate Tuition, Hostel & Other Charges",
    description:
      "Undergraduate tuition, hostel and other charges at UET Taxila, the payment schedule, and the fee refund policy - grounded in the official UET Taxila prospectus.",
    url: `${siteUrl}/uet-taxila/fee-structure`,
    type: "website",
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">
              U
            </div>
            <span className="font-semibold text-base">UET GPT</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET GPT Home
            </Link>
            <Link
              href="/uet-taxila"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET Taxila
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET Taxila Fee Structure
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
                Tuition, Hostel &amp; Other Charges
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              A clear breakdown of the undergraduate fee schedule at the University of Engineering
              and Technology, Taxila - grounded in the official UET Taxila undergraduate prospectus
              and explained the way UET GPT delivers it.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
              >
                Ask UET GPT
              </Link>
              <Link
                href="/uet-taxila"
                className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base"
              >
                UET Taxila Hub
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Overview of the UET Taxila Fee Structure
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              How the university organizes fees into non-recurring and recurring charges
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Non-recurring charges (paid at admission)
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  These are charged once, when a student is admitted. They include admission
                  charges, re-admission charges, the student identity card, the document
                  verification fee, and the refundable library security deposit. Together with the
                  first semester&apos;s recurring charges, they make up the amount due at the start
                  of the program.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Recurring charges (paid per semester)
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  These are charged every semester (Fall or Spring) and include registration,
                  tuition, sports, magazine, medical, laboratory, examination, book bank rent,
                  instructional tour, recreation, Smart &amp; Safe Campus, and digital library
                  charges. Survey camp charges apply to Civil Engineering students, and bus fares
                  apply to students using university transport. The recurring total for the first
                  semester is Rs. 101,800 for subsidized students and Rs. 256,800 for
                  partial-subsidized students.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Why the two totals differ</h3>
                <p className="text-sm text-[#a1a1aa]">
                  The large gap between the subsidized and partial-subsidized first-semester totals
                  comes almost entirely from admission charges (Rs. 7,000 vs Rs. 300,000) and
                  per-semester tuition (Rs. 38,000 vs Rs. 130,000). All other recurring components
                  are identical across categories. The full schedule is published in Table 30.1 of
                  the UET Taxila undergraduate prospectus.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Undergraduate Fee Schedule (Table 30.1)
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Amounts in Pakistani Rupees. Subsidized vs partial-subsidized (Category S and Category
              X)
            </p>
            <div className="overflow-x-auto rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1e] text-left">
                    <th className="p-4 font-semibold">Fee Component</th>
                    <th className="p-4 font-semibold text-right">Subsidized</th>
                    <th className="p-4 font-semibold text-right">Partial-Subsidized</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRows.map((row) => (
                    <tr key={row.item} className="border-b border-[#141417] last:border-0">
                      <td className="p-4 text-[#e1e1e2]">{row.item}</td>
                      <td className="p-4 text-right text-[#a1a1aa]">{row.subsidized}</td>
                      <td className="p-4 text-right text-[#a1a1aa]">{row.partial}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#1a1a1e] font-medium">
                    <td className="p-4">Total for First Semester</td>
                    <td className="p-4 text-right text-[#e1e1e2]">101,800</td>
                    <td className="p-4 text-right text-[#e1e1e2]">256,800</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[#a1a1aa] mt-4">
              Source: UET Taxila Undergraduate Prospectus 2025, Table 30.1. Bus fares, electricity,
              and gas charges are revised each semester based on government-fixed fuel, electricity,
              and gas rates, and the university may change fees without prior notice. UET GPT
              provides the current figures.
            </p>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">Hostel &amp; Other Charges</h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Additional charges paid by students residing in UET Taxila hostels
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Hostel resident charges</h3>
                <p className="text-sm text-[#a1a1aa]">
                  In addition to tuition and semester dues, hostel residents pay hostel and mess
                  securities (both refundable) plus per-semester services &amp; contingencies, room
                  rent, masjid fund, electricity, and Sui gas charges. For the first semester the
                  non-refundable hostel charges total Rs. 24,000, with refundable hostel and mess
                  securities of Rs. 8,000 each also collected at admission.
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1a1a1e] text-left">
                      <th className="p-4 font-semibold">Hostel Component</th>
                      <th className="p-4 font-semibold text-right">Amount (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hostelRows.map((row) => (
                      <tr key={row.item} className="border-b border-[#141417] last:border-0">
                        <td className="p-4 text-[#e1e1e2]">{row.item}</td>
                        <td className="p-4 text-right text-[#a1a1aa]">{row.amount}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-[#1a1a1e] font-medium">
                      <td className="p-4">Total for First Semester (Resident, non-refundable)</td>
                      <td className="p-4 text-right text-[#e1e1e2]">24,000</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Refundable securities</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Library security, hostel security, and mess security are refundable. They are
                  returned on clearance when a student leaves the university or hostel, subject to
                  deduction of outstanding dues - provided the claim is made within two years, after
                  which unclaimed securities lapse to the university Welfare Fund.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Differences Across Programs &amp; Categories
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              What changes between subsidized and partial-subsidized students
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Subsidized vs partial-subsidized (S and X)
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Most UET Taxila seats are subsidized. Category S (All Pakistan) and Category X
                  (children of overseas Pakistanis) are partial-subsidized. Fees are subsidized for
                  all categories except S and X, and there is no relaxation, concession, or waiver
                  in fee for the S and X categories. The difference shows up in admission charges
                  (Rs. 7,000 vs Rs. 300,000) and per-semester tuition (Rs. 38,000 vs Rs. 130,000).
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Program-specific charges</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Civil Engineering students pay survey camp charges (Rs. 10,000 per semester) with
                  the fee of the 2nd, 3rd, and 4th semesters. Students using university transport
                  pay bus fares that differ for residents and non-residents, and these - along with
                  electricity and gas charges - depend on prevailing government-fixed rates and are
                  set each semester by the Vice Chancellor on the Treasurer&apos;s and PD&apos;s
                  recommendations.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Payment, Deadlines &amp; Refunds
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              When fees are due, what happens on late payment, and how refunds work
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">When fees are due</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Regular semester fees are payable before the start of every semester. The
                  Treasurer notifies the schedule about one month ahead, and registration plus fee
                  submission must be completed ten days before the semester begins. The last date
                  for semester registration is the last date for fee submission.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Late payment and extensions</h3>
                <p className="text-sm text-[#a1a1aa]">
                  A late registration fine of Rs. 100 per day applies up to one month after classes
                  commence. A department chairman may grant a need-based extension (up to 30 days)
                  or allow payment in two installments; the late fee fine itself generally cannot be
                  waived. Persistent non-payment can lead to suspension or cancellation of
                  admission.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Fee refund policy</h3>
                <p className="text-sm text-[#a1a1aa]">
                  On admission withdrawal, UET Taxila applies the National Level Fee-Refund Policy:
                  100% of applicable fee refunded up to the 7th day of commencement of classes, 50%
                  from the 8th to the 15th day, and 0% from the 16th day onward. The percentage
                  applies to all components except security and admission charges, and the timeline
                  runs continuously across weekdays and weekends.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              How UET GPT Explains Current UET Taxila Fees
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Accurate, sourced, and always current - that is how UET GPT answers fee questions
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Grounded in official data",
                  desc: "UET GPT answers fee questions using Retrieval-Augmented Generation over official UET Taxila documents, including the undergraduate prospectus and the university website.",
                },
                {
                  title: "Current figures, not guesses",
                  desc: "Because bus fares, electricity, and gas charges change each semester, UET GPT provides the current figures and cites the official source rather than presenting outdated numbers.",
                },
                {
                  title: "Any fee component",
                  desc: "Ask about tuition, admission charges, hostel dues, refunds, category differences, or payment deadlines - UET GPT breaks it down clearly.",
                },
                {
                  title: "Category clarity",
                  desc: "UET GPT distinguishes subsidized from partial-subsidized (S and X) fees so applicants understand exactly what they owe.",
                },
                {
                  title: "Refund scenarios",
                  desc: "Get an up-to-date read on the fee refund policy and how much is recoverable at each stage of admission withdrawal.",
                },
                {
                  title: "Free for everyone",
                  desc: "UET GPT is free for all UET Taxila students, faculty, and prospective applicants. Start on the UET GPT home page.",
                },
              ].map((f) => (
                <div key={f.title} className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-[#a1a1aa]">{f.desc}</p>
                </div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
              >
                Go to UET GPT
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Frequently Asked Questions about UET Taxila Fees
            </h2>
            <div className="space-y-4 mt-8">
              {FAQ_ITEMS.map((faq) => (
                <details
                  key={faq.q}
                  className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
                  <summary className="font-medium text-sm cursor-pointer">{faq.q}</summary>
                  <p className="mt-3 text-sm text-[#a1a1aa]">{faq.a}</p>
                </details>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href="/uet-taxila"
                className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base"
              >
                Back to UET Taxila Hub
              </Link>
            </div>
          </section>
        </main>

        <footer className="border-t border-[#1a1a1e] px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#a1a1aa]">
              &copy; {new Date().getFullYear()} UET GPT Team. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-[#a1a1aa]">
              <Link href="/" className="hover:text-[#e1e1e2] transition-colors">
                UET GPT Home
              </Link>
              <Link href="/uet-taxila" className="hover:text-[#e1e1e2] transition-colors">
                UET Taxila
              </Link>
              <Link href="/chat" className="hover:text-[#e1e1e2] transition-colors">
                Chat
              </Link>
              <Link href="/explore" className="hover:text-[#e1e1e2] transition-colors">
                Explore
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
