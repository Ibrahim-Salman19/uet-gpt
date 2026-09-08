import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila - History, Faculties & Admissions Guide",
  description:
    "UET Taxila history, campuses, 14 departments, faculties, admissions, and fee structure. Your AI-grounded guide powered by UET GPT.",
  alternates: {
    canonical: `${siteUrl}/uet-taxila`,
  },
  openGraph: {
    title: "UET Taxila - History, Faculties & Admissions Guide",
    description:
      "UET Taxila history, campuses, faculties, departments, admissions, and how UET GPT helps students.",
    url: `${siteUrl}/uet-taxila`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET GPT: AI Assistant for UET Taxila",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila - History, Faculties & Admissions Guide",
    description: "UET Taxila history, faculties, departments, admissions, and campus life.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "What does UET stand for?",
    a: "UET stands for the University of Engineering and Technology. UET Taxila is the University of Engineering and Technology, Taxila - a public engineering university in Taxila, Punjab, Pakistan. It began in 1975 as a constituent college of UET Lahore and became an independent, chartered university in 1993.",
  },
  {
    q: "When was UET Taxila established?",
    a: "The University College of Engineering Taxila was established in 1975 and functioned at Sahiwal for its first three years before moving to its permanent campus at Taxila in 1978. It received its charter as an independent university in October 1993 under the University of Engineering and Technology Taxila Ordinance 1993.",
  },
  {
    q: "How many departments and faculties does UET Taxila have?",
    a: "UET Taxila has 14 departments organized under six faculties: Civil and Environmental Engineering; Electronics and Electrical Engineering; Mechanical and Aeronautical Engineering; Industrial Engineering; Telecommunication and Information Engineering; and Basic Sciences and Humanities. Departments include Civil, Environmental, Electrical, Electronics, Mechanical, Mechatronics, Industrial, Computer, Software, Telecommunication, Computer Science, and the basic-science disciplines.",
  },
  {
    q: "What is the entry test for UET Taxila admissions?",
    a: "Admission to undergraduate engineering and computing programs at UET Taxila is based on the ECAT (Engineering College Admission Test), the designated entry test for engineering colleges in Punjab. Merit is determined from a combination of ECAT marks, previous academic qualifications, and other components; applicants generally need at least 60% marks (50% for Computer Science, Mathematics, and Physics combinations).",
  },
  {
    q: "What programs does UET Taxila offer?",
    a: "UET Taxila offers undergraduate (BS/BSc Engineering), graduate (MS/MSc Engineering), and doctoral (PhD) programs across engineering, computing, and basic sciences. Programs span Civil, Environmental, Electrical, Electronics, Mechanical, Mechatronics, Industrial, Computer, Software, and Telecommunication Engineering, along with Computer Science and supporting mathematical, physical, and humanities disciplines.",
  },
  {
    q: "How can UET GPT help UET Taxila students and applicants?",
    a: "UET GPT is the AI guide to UET Taxila. It answers questions about admissions, ECAT and merit, BS and MS fee structures, academic programs, departments and faculty, hostel accommodation, transport routes, scholarships, and campus life - all grounded in official UET Taxila data. It is free for students, faculty, and prospective applicants. Visit the UET GPT home page to start asking.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
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

export default function UetTaxilaPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        <PublicNav />

        <main id="main-content" className="flex-1">
          {/* Hero Section */}
          <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET Taxila
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] mt-2">
                University of Engineering and Technology, Taxila
              </span>
            </h1>
            <p className="text-base md:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto mb-8 font-sans leading-relaxed">
              UET Taxila is one of Pakistan&apos;s leading public engineering universities. This
              page is the authoritative, AI-grounded guide to its history, campuses, faculties,
              departments, admissions, and campus life - brought to you by UET GPT.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/chat"
                className="w-full sm:w-auto px-6 py-3.5 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all text-xs font-mono tracking-wider uppercase shadow-[0_4px_12px_rgba(202,138,4,0.2)]"
              >
                Ask UET GPT
              </Link>
              <Link
                href="/admissions?tab=overview"
                className="w-full sm:w-auto px-6 py-3.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 active:scale-[0.98] transition-all text-xs font-mono tracking-wider uppercase"
              >
                Admissions Guide
              </Link>
            </div>
          </section>

          {/* About Section */}
          <section id="about" className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--text-primary)]">
              About UET Taxila
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[10px]">
              What &quot;UET&quot; stands for, and how the Taxila campus became the university it is
              today
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  What does UET stand for?
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  UET stands for the University of Engineering and Technology. UET Taxila is the
                  University of Engineering and Technology, Taxila - a public sector engineering
                  university located in Taxila, in the Attock–Rawalpindi region of Punjab, Pakistan.
                  Today UET Taxila enrolls more than 5,500 undergraduate and postgraduate students
                  across 14 departments.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  History and founding of UET Taxila
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  With the rapid industrial growth around Taxila in the 1970s - led by Heavy
                  Industries Taxila and nearby ordnance complexes - the Government of the Punjab
                  established the University College of Engineering Taxila in 1975 as a constituent
                  college of UET Lahore. It functioned at Sahiwal for three years before shifting to
                  its permanent campus at Taxila in 1978, and on 1 October 1993 it received its
                  charter as an independent university under the University of Engineering and
                  Technology Taxila Ordinance 1993.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  Campuses and location
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  UET Taxila&apos;s main campus sits at Taxila, a historic city and archaeological
                  site roughly midway between Islamabad and the industrial belt of Wah and Taxila.
                  The campus houses teaching and research facilities for all faculties, hostels,
                  transport services, a central library, and student societies. The university also
                  operates sub-campuses to extend engineering education across the region.
                </p>
              </div>
            </div>
          </section>

          {/* Faculties Section */}
          <section id="faculties" className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-10 tracking-tight text-[var(--text-primary)]">
              Faculties &amp; Departments at UET Taxila
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Civil and Environmental Engineering",
                  desc: "Department of Civil Engineering and Department of Environmental Engineering - structures, geotechnics, water, and environmental systems.",
                },
                {
                  title: "Electronics and Electrical Engineering",
                  desc: "Department of Electrical Engineering and Department of Electronics Engineering - power, control, electronics, and embedded systems.",
                },
                {
                  title: "Mechanical and Aeronautical Engineering",
                  desc: "Department of Mechanical Engineering and Department of Mechatronics Engineering - thermal, manufacturing, robotics, and automation.",
                },
                {
                  title: "Industrial Engineering",
                  desc: "Department of Industrial Engineering - operations, manufacturing systems, quality, and supply-chain management.",
                },
                {
                  title: "Telecommunication and Information Engineering",
                  desc: "Department of Computer Engineering, Software Engineering, Telecommunication Engineering, and Computer Science.",
                },
                {
                  title: "Basic Sciences and Humanities",
                  desc: "Department of Mathematical Sciences, Department of Physical Sciences, and Department of Humanities & Social Sciences.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-card)]/50 transition-all duration-300"
                >
                  <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                    {f.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] font-sans leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Admissions Section */}
          <section id="admissions" className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--text-primary)]">
              Admissions at UET Taxila
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[10px]">
              How to apply, the entry test, and how merit is determined
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  Entry test and eligibility
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  Undergraduate admission to UET Taxila is based on the ECAT (Engineering College
                  Admission Test), the designated entry test for engineering colleges in Punjab.
                  Applicants generally need at least 60% unadjusted marks in their qualifying
                  examination (50% for Computer Science, Mathematics, and Physics combinations).
                  Applications are submitted online, and merit lists are published with the
                  percentage of admitted applicants per discipline.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  How merit is determined
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  Admission merit at UET Taxila is calculated from multiple components, with the
                  ECAT entry test carrying a significant weight (around 33%) alongside previous
                  academic qualifications. Domicile requirements, seat allocation by category, and
                  document verification all apply. UET GPT can explain the current fee structure,
                  schedules, and seat allocation in detail.
                </p>
              </div>

              <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                  Programs offered
                </h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans">
                  UET Taxila offers BS/BSc Engineering, MS/MSc Engineering, and PhD programs across
                  its 14 departments. Disciplines range from Civil, Environmental, Electrical,
                  Electronics, Mechanical, Mechatronics, and Industrial Engineering to Computer,
                  Software, and Telecommunication Engineering, plus Computer Science and the basic
                  sciences.
                </p>
              </div>
            </div>
          </section>

          {/* Benefits Grid */}
          <section id="uet-gpt" className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--text-primary)]">
              How UET GPT Helps UET Taxila Students
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[10px]">
              UET GPT is the intelligent guide to UET Taxila, built on official university data
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Admissions & Merit",
                  desc: "Get clear, current answers on UET Taxila ECAT, eligibility, merit lists, schedules, and seat allocation.",
                },
                {
                  title: "Fee Structure",
                  desc: "Understand BS and MS fee breakdowns, hostel charges, and dues - grounded in official UET Taxila records.",
                },
                {
                  title: "Departments & Faculty",
                  desc: "Explore UET Taxila's 14 departments, faculties, research areas, and program details before you choose.",
                },
                {
                  title: "Campus Life",
                  desc: "Find hostel allotment, transport routes, scholarships, libraries, and student societies at UET Taxila.",
                },
                {
                  title: "Always Grounded",
                  desc: "UET GPT uses Retrieval-Augmented Generation over official UET Taxila documents, so answers stay accurate.",
                },
                {
                  title: "Free for Everyone",
                  desc: "UET GPT is free for all UET Taxila students, faculty, and prospective applicants. Start on the UET GPT home page.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-card)]/50 transition-all duration-300"
                >
                  <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                    {f.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] font-sans leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href="/chat"
                className="px-6 py-3.5 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] font-semibold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all text-xs font-mono tracking-wider uppercase shadow-[0_4px_12px_rgba(202,138,4,0.2)]"
              >
                Start Chat with UET GPT
              </Link>
            </div>
          </section>

          {/* Sub Guides Section - Fixed direct routing URLs */}
          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-2 tracking-tight text-[var(--text-primary)]">
              Explore UET Taxila Guides
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-8 font-sans">
              Deep-dive into the topics UET GPT knows best
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link
                href="/admissions?tab=overview"
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/20 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-card)]/30 transition-all"
              >
                <h3 className="font-semibold text-base mb-1 text-[var(--text-primary)]">
                  Admissions &amp; ECAT
                </h3>
                <p className="text-sm text-[var(--text-secondary)] font-sans">
                  Eligibility thresholds, seat quotas, and application steps.
                </p>
              </Link>
              <Link
                href="/academics?tab=programs"
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/20 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-card)]/30 transition-all"
              >
                <h3 className="font-semibold text-base mb-1 text-[var(--text-primary)]">
                  Programs &amp; Syllabi
                </h3>
                <p className="text-sm text-[var(--text-secondary)] font-sans">
                  14 PEC-accredited engineering and computing roadmaps.
                </p>
              </Link>
              <Link
                href="/admissions?tab=fees"
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/20 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-card)]/30 transition-all"
              >
                <h3 className="font-semibold text-base mb-1 text-[var(--text-primary)]">
                  Fee Simulator
                </h3>
                <p className="text-sm text-[var(--text-secondary)] font-sans">
                  Tuition, hostel dues, and 4-year degree cost forecast.
                </p>
              </Link>
              <Link
                href="/tools?tab=merit"
                className="p-5 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/20 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-card)]/30 transition-all"
              >
                <h3 className="font-semibold text-base mb-1 text-[var(--text-primary)]">
                  Merit Calculator
                </h3>
                <p className="text-sm text-[var(--text-secondary)] font-sans">
                  Calculate admission aggregate using statutory 33/50/17 formula.
                </p>
              </Link>
            </div>

            {/* Editorial byline and official portal link */}
            <div className="text-xs text-[var(--text-secondary)] border-t border-[var(--border)] pt-4 mt-8 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono">
              <span>
                Published by UET GPT Editorial Team • Verified against official Prospectus
              </span>
              <a
                href="https://web.uettaxila.edu.pk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                Official UET Taxila Portal &rarr;
              </a>
            </div>
          </section>

          {/* FAQ Accordion Section */}
          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-xl md:text-2xl font-semibold text-center mb-8 tracking-tight text-[var(--text-primary)]">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {FAQ_ITEMS.map((faq) => (
                <details
                  key={faq.q}
                  className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 [&_summary::-webkit-details-marker]:hidden transition-all"
                >
                  <summary className="flex items-center justify-between font-medium text-sm cursor-pointer text-[var(--text-primary)] select-none">
                    <span>{faq.q}</span>
                    <span className="text-[var(--text-secondary)] transition-transform group-open:rotate-180 font-mono text-xs">
                      ▼
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)]/30 pt-3">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>
        <PublicFooter />
      </div>
    </>
  );
}
