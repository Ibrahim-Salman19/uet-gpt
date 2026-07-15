import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Admissions 2025 — ECAT, Eligibility & Merit",
  description:
    "UET Taxila admissions guide: UET Taxila ECAT entry test, 60%/50% eligibility, how merit is calculated (ECAT 33%, HSSC 50%, SSC 17%), merit lists, required documents, and how UET GPT helps applicants.",
  alternates: {
    canonical: `${siteUrl}/uet-taxila/admissions`,
  },
  openGraph: {
    title: "UET Taxila Admissions 2025 — ECAT, Eligibility & Merit",
    description:
      "How UET Taxila admissions work: the UET Taxila ECAT entry test, eligibility marks, the merit formula, merit lists, and required documents — explained with UET GPT.",
    url: `${siteUrl}/uet-taxila/admissions`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    q: "What is the entry test for UET Taxila admissions?",
    a: "Admission to undergraduate engineering and BS Computing programs at UET Taxila is based on the ECAT (Engineering College Admission Test). For Punjab, this is the combined entry test conducted by UET Lahore, or any other entry test for engineering programs designated as acceptable to PEC and UET Taxila. A valid ECAT score is required before an applicant's merit can be computed.",
  },
  {
    q: "What is the eligibility criteria for UET Taxila admissions?",
    a: "For admission to engineering programs and BS Computer Science, an applicant must have appeared in the ECAT and passed (or expect to pass) their HSSC or equivalent examination with at least 60% unadjusted marks. For BS Computer Science, BS Mathematics, and BS Physics the minimum is 50% unadjusted marks. The applicant must also be a resident of the area from which they seek admission and meet the prescribed medical (physique and eyesight) standards. Rounding off to reach 60% (or 50% for CS/Mathematics/Physics) is not accepted towards eligibility.",
  },
  {
    q: "How is merit calculated for UET Taxila admissions?",
    a: "For applicants with HSSC (Pre-Engineering) or an equivalent foreign qualification as their highest qualification, admission marks use weighted percentages: Entry Test (ECAT) 33%, HSSC Part-I 50%, and SSC 17%. For DAE holders the weighting is ECAT 33%, DAE 1st & 2nd year 50%, and SSC 17%. A credit of 20 marks is added for NCC training and for Hifz-e-Quran in the highest-qualification component. The prospectus gives a worked example: 300/400 ECAT, 700/1100 SSC, 500/550 HSSC Part-I, plus Hifz-e-Quran, yields 82.841% admission marks.",
  },
  {
    q: "When are UET Taxila merit lists displayed?",
    a: "Merit lists are displayed on the notified date and time, showing the percentage of applicants admitted in each discipline against the different admission categories (such as Open Merit, reserved categories, overseas, and tribal areas). Seats are allocated category-wise per the Seats Allocation Chart, and applicants compete within their own category. Unfilled seats in reserved categories are eventually transferred to open-merit seats.",
  },
  {
    q: "What documents are required for UET Taxila admission?",
    a: "Every applicant must submit an attested photocopy of their domicile certificate, without which the application is not considered. Documents attached with the Application Form (F-I) must be attested by a Class-I gazetted officer or a Class-A officer of the University. Depending on domicile and category, additional documents may be required — for example, a parent's domicile certificate and proof of inclusion in the electoral rolls for certain categories, or an IBCC equivalence certificate for A-Level and other foreign qualifications.",
  },
  {
    q: "How can UET GPT help with UET Taxila admissions?",
    a: "UET GPT is the AI guide to UET Taxila. It answers admissions questions grounded in the official UET Taxila prospectus — the ECAT entry test, eligibility marks for each program, how the merit formula works, expected merit ranges, seat categories, required documents, and deadlines — so prospective students can plan their application with accurate, sourced information. It is free for applicants, students, and faculty. Start on the UET GPT home page.",
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

export default function UetTaxilaAdmissionsPage() {
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
              UET Taxila Hub
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
              UET Taxila Admissions
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
                ECAT, Eligibility &amp; Merit
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              A complete, source-grounded guide to undergraduate admissions at
              the University of Engineering and Technology, Taxila — the entry
              test, who is eligible, how your merit is calculated, merit lists,
              and the documents you need. Brought to you by UET GPT.
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
              The UET Taxila Admission Process
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              From the entry test to the final merit list — what every
              undergraduate applicant goes through
            </p>
            <ol className="space-y-4">
              <li className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  1. Appear in the ECAT entry test
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Before applying, candidates for engineering programs and BS
                  Computer Science must appear in the ECAT (Engineering College
                  Admission Test) — the combined entry test conducted by UET
                  Lahore for Punjab, or another entry test for engineering
                  programs designated as acceptable to PEC and UET Taxila.
                </p>
              </li>
              <li className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  2. Submit the online application
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Applications are submitted online and should be filed as early
                  as possible rather than waiting for the closing date. The
                  Application Form (F-I) is accompanied by supporting documents,
                  and applicants select their discipline and category
                  preferences within the form.
                </p>
              </li>
              <li className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  3. Merit is computed and lists are published
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  The university calculates weighted admission marks from the
                  ECAT, HSSC, and SSC (or equivalent) results, then prepares
                  merit lists category-wise on the notified date and time,
                  showing the percentage of applicants admitted in each
                  discipline against each admission category.
                </p>
              </li>
              <li className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  4. Document verification and joining
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Selected candidates complete document verification and join
                  their allotted discipline and category. Admission can be
                  frozen, transferred to a higher preference if a seat opens, or
                  downgraded to a lower preference — each on the prescribed form
                  and subject to merit and seat availability.
                </p>
              </li>
            </ol>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              The UET Taxila ECAT Entry Test
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Why the entry test is the single most important component of your
              admission
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  ECAT is mandatory for engineering and computing
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  For admission in engineering programs and BS Computer Science,
                  the candidate must have appeared in the ECAT conducted by UET
                  Lahore or any other entry test for engineering programs
                  acceptable to PEC and UET Taxila. Without a valid entry-test
                  score, an applicant&apos;s merit cannot be determined.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  ECAT carries 33% of the admission aggregate
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  In the weighted merit formula, the Entry Test contributes 33%
                  of the admission marks for HSSC, DAE, BSc, and B.Tech
                  applicants alike. Because it is a single standardized exam, a
                  strong ECAT score can lift an applicant whose earlier academic
                  percentages were modest.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Combination of subjects matters
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Engineering programs require an HSSC combination of Mathematics,
                  Physics and Chemistry/Computer Science (or a relevant DAE from
                  PBTE Lahore). BS Computer Science and BS Mathematics/Physics
                  accept any HSSC combination with Mathematics/Physics, and FSc
                  Pre-Medical with Mathematics as an additional subject is also
                  eligible.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Eligibility: 60% for Engineering, 50% for CS / Mathematics / Physics
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              The minimum unadjusted marks an applicant must hold to be considered
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Minimum marks requirement
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  An applicant must have passed (or expect to pass) up to the
                  latest annual examination with at least 60% unadjusted marks in
                  the HSSC or equivalent examination on which they seek admission.
                  For BS Computer Science, BS Mathematics, and BS Physics the
                  threshold is 50% unadjusted marks.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Residency and medical standards
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  The applicant should be a resident of the area from which they
                  seek admission and must meet the physique and eyesight
                  standards set out in the medical certificate. Marks from NCC and
                  Hifz-e-Quran count toward merit determination, not toward
                  eligibility.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  No rounding off for eligibility
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Rounding off a percentage figure to reach 60% (or 50% in the
                  case of CS, Mathematics, and Physics) is not considered towards
                  eligibility. A-Level and other foreign-qualification applicants
                  must attach an IBCC equivalence certificate showing 60% or
                  higher with the relevant subject combination.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              How UET Taxila Merit Is Calculated
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Weighted percentages from the prospectus&apos;s admission-mark formula
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  HSSC / Pre-Engineering applicants
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Entry Test (ECAT) 33% + HSSC Part-I 50% + SSC 17%. A credit of
                  20 marks is added in the highest-qualification component for NCC
                  training and for Hifz-e-Quran.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  DAE holders
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Entry Test (ECAT) 33% + DAE 1st &amp; 2nd year 50% + SSC 17%,
                  with the same 20-mark NCC / Hifz-e-Quran credit in the
                  highest-qualification component.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Worked example
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  An applicant with 300/400 in ECAT, 700/1100 in SSC, 500/550 in
                  HSSC Part-I, and a Hifz-e-Quran certificate scores [33 × (300/400)
                  + 17 × (700/1100) + 50 × (500 + 20)/550] = 82.841% admission
                  marks.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Other qualification tracks
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  BSc/BASc and B.Tech (Hons)/BS/BSc/Bachelors in Engineering
                  Technology applicants use the same 33% ECAT weight with their
                  degree result replacing HSSC Part-I (30%) and HSSC/DAE 20%.
                  Foreign (A-Level etc.) applicants use O-Level 67% in place of
                  SSC/HSSC components.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Merit Lists, Seats &amp; Categories
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              How seats are allocated and where you stand once lists are out
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Category-wise merit
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Seats are distributed across categories such as Open Merit (A),
                  reserved district and minority categories, children of
                  university alumni and graduates, disabled persons, tribal areas,
                  and overseas Pakistanis. Eligible applicants in each category
                  compete among themselves for the seats allocated to that
                  category.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Tie-breaking and list publication
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  If two or more applicants have equal admission marks up to three
                  decimal places, they are treated at par and all may be admitted
                  to the last seat. Merit lists are displayed on the notified date
                  and time showing the percentage of applicants admitted per
                  discipline and category.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Movement of unfilled seats
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Unfilled seats in reserved categories are moved to open-merit
                  seats over the admission cycle. Applicants may be transferred
                  upward to a vacant higher preference, or request a one-time
                  downgrade, depending on merit and seat availability — or freeze
                  their selected discipline and category in writing.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Documents Required for Admission
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              What to keep attested and ready before you apply
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Domicile certificate (mandatory)
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  All applicants must submit an attested photocopy of their
                  domicile certificate; without it the application is not
                  considered. For certain categories, a parent&apos;s domicile
                  certificate and proof of inclusion in the electoral rolls are
                  also required.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Attestation of application documents
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  All documents attached with the Application Form (F-I) must be
                  attested by a Class-I gazetted officer of the Government or a
                  Class-A officer of the University at the time of joining.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Equivalence and category proofs
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  A-Level and other foreign-qualification applicants attach an IBCC
                  equivalence certificate (Pre-Engineering) with their application.
                  Children of government servants posted outside Punjab and other
                  specified categories submit additional forms (F-II / F-III)
                  downloaded from the admissions portal.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              How UET GPT Helps with UET Taxila Admissions
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Accurate, prospectus-grounded answers for every step of your
              application
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "ECAT & Eligibility",
                  desc: "Clarify which entry test applies, the 60%/50% eligibility thresholds, and the subject combinations needed for each program.",
                },
                {
                  title: "Merit Formula",
                  desc: "See exactly how ECAT (33%), HSSC (50%), and SSC (17%) combine, with worked examples you can adapt to your own marks.",
                },
                {
                  title: "Merit Lists & Seats",
                  desc: "Understand category-wise seat allocation, how lists are published, and how transfers, downgrades, and freezing work.",
                },
                {
                  title: "Documents Checklist",
                  desc: "Know the mandatory domicile certificate, attestation rules, and the extra proofs your category requires before you apply.",
                },
                {
                  title: "Always Grounded",
                  desc: "UET GPT answers from the official UET Taxila undergraduate prospectus, so admissions guidance stays accurate and current.",
                },
                {
                  title: "Free for Applicants",
                  desc: "UET GPT is free for prospective applicants, students, and faculty. Ask your admissions question on the UET GPT home page.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
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
                Ask UET GPT
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Frequently Asked Questions about UET Taxila Admissions
            </h2>
            <div className="space-y-4 mt-8">
              {FAQ_ITEMS.map((faq) => (
                <details
                  key={faq.q}
                  className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
                  <summary className="font-medium text-sm cursor-pointer">
                    {faq.q}
                  </summary>
                  <p className="mt-3 text-sm text-[#a1a1aa]">{faq.a}</p>
                </details>
              ))}
            </div>
            <p className="text-sm text-[#a1a1aa] text-center mt-8">
              Explore more on the{" "}
              <Link
                href="/uet-taxila"
                className="text-[#6366f1] hover:text-[#8b5cf6] transition-colors"
              >
                UET Taxila hub
              </Link>{" "}
              or go to the{" "}
              <Link
                href="/"
                className="text-[#6366f1] hover:text-[#8b5cf6] transition-colors"
              >
                UET GPT home page
              </Link>
              .
            </p>
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
              <Link
                href="/uet-taxila"
                className="hover:text-[#e1e1e2] transition-colors"
              >
                UET Taxila Hub
              </Link>
              <Link href="/chat" className="hover:text-[#e1e1e2] transition-colors">
                Chat
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
