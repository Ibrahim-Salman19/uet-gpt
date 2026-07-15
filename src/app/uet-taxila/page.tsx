import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila — University of Engineering and Technology, Taxila",
  description:
    "UET Taxila (University of Engineering and Technology, Taxila) — history, campuses, faculties, departments, admissions, and how UET GPT helps students. The authoritative guide to UET Taxila.",
  alternates: {
    canonical: `${siteUrl}/uet-taxila`,
  },
  openGraph: {
    title: "UET Taxila — University of Engineering and Technology, Taxila",
    description:
      "History, campuses, faculties, departments, and admissions of UET Taxila, plus how UET GPT helps students navigate the university.",
    url: `${siteUrl}/uet-taxila`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    q: "What does UET stand for?",
    a: "UET stands for the University of Engineering and Technology. UET Taxila is the University of Engineering and Technology, Taxila — a public engineering university in Taxila, Punjab, Pakistan. It began in 1975 as a constituent college of UET Lahore and became an independent, chartered university in 1993.",
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
    a: "UET GPT is the AI guide to UET Taxila. It answers questions about admissions, ECAT and merit, BS and MS fee structures, academic programs, departments and faculty, hostel accommodation, transport routes, scholarships, and campus life — all grounded in official UET Taxila data. It is free for students, faculty, and prospective applicants. Visit the UET GPT home page to start asking.",
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

export default function UetTaxilaPage() {
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
              UET Taxila
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
                University of Engineering and Technology, Taxila
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              UET Taxila is one of Pakistan&apos;s leading public engineering
              universities. This page is the authoritative, AI-grounded guide to
              its history, campuses, faculties, departments, admissions, and
              campus life — brought to you by UET GPT.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
              >
                Ask UET GPT
              </Link>
              <Link
                href="/sign-up"
                className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base"
              >
                Sign In
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              About UET Taxila
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              What &quot;UET&quot; stands for, and how the Taxila campus became
              the university it is today
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  What does UET stand for?
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET stands for the University of Engineering and Technology. UET
                  Taxila is the University of Engineering and Technology, Taxila —
                  a public sector engineering university located in Taxila, in the
                  Attock–Rawalpindi region of Punjab, Pakistan. Today UET Taxila
                  enrolls more than 5,500 undergraduate and postgraduate students
                  across 14 departments.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  History and founding of UET Taxila
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  With the rapid industrial growth around Taxila in the 1970s — led
                  by Heavy Industries Taxila and nearby ordnance and aeronautical
                  complexes — the Government of the Punjab established the University
                  College of Engineering Taxila in 1975 as a constituent college
                  of UET Lahore. It functioned at Sahiwal for three years before
                  shifting to its permanent campus at Taxila in 1978, and on 1
                  October 1993 it received its charter as an independent university
                  under the University of Engineering and Technology Taxila
                  Ordinance 1993.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Campuses and location
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET Taxila&apos;s main campus sits at Taxila, a historic city and
                  archaeological site roughly midway between Islamabad and the
                  industrial belt of Wah and Taxila. The campus houses teaching and
                  research facilities for all faculties, hostels, transport
                  services, a central library, and student societies. The
                  university also operates sub-campuses to extend engineering
                  education across the region.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-12">
              Faculties &amp; Departments at UET Taxila
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Civil and Environmental Engineering",
                  desc: "Department of Civil Engineering and Department of Environmental Engineering — structures, geotechnics, water, and environmental systems.",
                },
                {
                  title: "Electronics and Electrical Engineering",
                  desc: "Department of Electrical Engineering and Department of Electronics Engineering — power, control, electronics, and embedded systems.",
                },
                {
                  title: "Mechanical and Aeronautical Engineering",
                  desc: "Department of Mechanical Engineering and Department of Mechatronics Engineering — thermal, manufacturing, robotics, and automation.",
                },
                {
                  title: "Industrial Engineering",
                  desc: "Department of Industrial Engineering — operations, manufacturing systems, quality, and supply-chain management.",
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
                  className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-[#a1a1aa]">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Admissions at UET Taxila
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              How to apply, the entry test, and how merit is determined
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Entry test and eligibility
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Undergraduate admission to UET Taxila is based on the ECAT
                  (Engineering College Admission Test), the designated entry test
                  for engineering colleges in Punjab. Applicants generally need at
                  least 60% unadjusted marks in their qualifying examination (50%
                  for Computer Science, Mathematics, and Physics combinations).
                  Applications are submitted online, and merit lists are published
                  with the percentage of admitted applicants per discipline.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  How merit is determined
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Admission merit at UET Taxila is calculated from multiple
                  components, with the ECAT entry test carrying a significant
                  weight (around 33%) alongside previous academic qualifications.
                  Domicile requirements, seat allocation by category, and document
                  verification all apply. UET GPT can explain the current fee
                  structure, schedules, and seat allocation in detail.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Programs offered
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET Taxila offers BS/BSc Engineering, MS/MSc Engineering, and PhD
                  programs across its 14 departments. Disciplines range from
                  Civil, Environmental, Electrical, Electronics, Mechanical,
                  Mechatronics, and Industrial Engineering to Computer, Software,
                  and Telecommunication Engineering, plus Computer Science and the
                  basic sciences.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              How UET GPT Helps UET Taxila Students
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              UET GPT is the intelligent guide to UET Taxila, built on official
              university data
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Admissions & Merit",
                  desc: "Get clear, current answers on UET Taxila ECAT, eligibility, merit lists, schedules, and seat allocation.",
                },
                {
                  title: "Fee Structure",
                  desc: "Understand BS and MS fee breakdowns, hostel charges, and dues — grounded in official UET Taxila records.",
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
                Go to UET GPT
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Frequently Asked Questions about UET Taxila
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
              <Link href="/chat" className="hover:text-[#e1e1e2] transition-colors">
                Chat
              </Link>
              <Link
                href="/explore"
                className="hover:text-[#e1e1e2] transition-colors"
              >
                Explore
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
