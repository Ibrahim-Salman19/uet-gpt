import type { Metadata } from "next";
import Link from "next/link";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Programs & Departments: BS, MS, PhD",
  description:
    "Explore UET Taxila programs and UET Taxila departments: 14 departments across 6 faculties offering undergraduate, graduate (MS/MPhil), and PhD degrees - and how UET GPT helps you choose.",
  alternates: {
    canonical: `${siteUrl}/uet-taxila/programs`,
  },
  openGraph: {
    title: "UET Taxila Programs & Departments: BS, MS, PhD",
    description:
      "The 14 departments and 6 faculties of UET Taxila, plus its undergraduate, graduate, and PhD programs - and how UET GPT helps students choose the right path.",
    url: `${siteUrl}/uet-taxila/programs`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Programs & Departments",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Programs & Departments: BS, MS, PhD",
    description:
      "Explore 14 departments and 6 faculties at UET Taxila offering BS, MS, and PhD degrees.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "What undergraduate programs does UET Taxila offer?",
    a: "UET Taxila offers undergraduate degrees across its 14 departments. These include BSc Engineering programs in Civil, Environmental, Electrical, Electronics, Mechanical, Mechatronics, Industrial, Computer, Software, and Telecommunication Engineering, plus BS programs in Computer Science and the basic sciences (Mathematics and Physics). Computing offerings also include the BS Artificial Intelligence degree program within the Faculty of Telecommunication and Information Engineering. All undergraduate engineering admissions are based on the ECAT entry test.",
  },
  {
    q: "How many faculties and departments does UET Taxila have?",
    a: "UET Taxila has 14 departments organized under six faculties: Civil and Environmental Engineering (Civil, Environmental); Electronics and Electrical Engineering (Electrical, Electronics); Mechanical and Aeronautical Engineering (Mechanical, Mechatronics); Industrial Engineering (Industrial); Telecommunication and Information Engineering (Computer, Software, Telecommunication, and Computer Science); and Basic Sciences and Humanities (Mathematical Sciences, Physical Sciences, Humanities & Social Sciences).",
  },
  {
    q: "What graduate and PhD programs are available at UET Taxila?",
    a: "Alongside undergraduate degrees, UET Taxila offers graduate (MS/MSc Engineering and MPhil) and doctoral (PhD) programs in most disciplines. Engineering and computing departments provide MS/MPhil and PhD study in areas such as Civil, Environmental, Electrical, Electronics, Mechanical, Mechatronics, Industrial, Computer, Software, and Telecommunication Engineering, as well as Computer Science and the basic sciences. Research areas align with each department's laboratories and faculty expertise.",
  },
  {
    q: "Which faculty does each UET Taxila department belong to?",
    a: "The Department of Civil Engineering and Department of Environmental Engineering belong to the Faculty of Civil and Environmental Engineering. Electrical and Electronics belong to the Faculty of Electronics and Electrical Engineering. Mechanical and Mechatronics belong to the Faculty of Mechanical and Aeronautical Engineering. Industrial Engineering belongs to the Faculty of Industrial Engineering. Computer Engineering, Software Engineering, Telecommunication Engineering, and Computer Science belong to the Faculty of Telecommunication and Information Engineering. Mathematical Sciences, Physical Sciences, and Humanities & Social Sciences belong to the Faculty of Basic Sciences and Humanities.",
  },
  {
    q: "How can UET GPT help me choose the right UET Taxila program?",
    a: "UET GPT is the AI guide to UET Taxila. It explains each department and faculty, compares undergraduate, graduate, and PhD programs, clarifies ECAT and merit requirements, and answers questions about specializations, research areas, fee structures, and career outlook - all grounded in official UET Taxila data. Ask UET GPT before you apply so you can match your interests and strengths to the right department.",
  },
  {
    q: "What is the admission process for UET Taxila programs?",
    a: "Undergraduate admission to UET Taxila engineering and computing programs is based on the ECAT (Engineering College Admission Test), the designated Punjab engineering entry test. Merit combines ECAT marks with previous academic qualifications and other components; applicants generally need at least 60% marks (50% for Computer Science, Mathematics, and Physics combinations). Graduate and PhD admissions follow separate eligibility and test requirements set by each department. UET GPT can walk you through the current schedules, eligibility, and seat allocation.",
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

const FACULTIES = [
  {
    title: "Civil and Environmental Engineering",
    departments: ["Department of Civil Engineering", "Department of Environmental Engineering"],
    desc: "Undergraduate and graduate study in structures, geotechnics, water resources, and environmental systems.",
  },
  {
    title: "Electronics and Electrical Engineering",
    departments: ["Department of Electrical Engineering", "Department of Electronics Engineering"],
    desc: "Programs in power, control, electronics, embedded systems, and signal processing.",
  },
  {
    title: "Mechanical and Aeronautical Engineering",
    departments: ["Department of Mechanical Engineering", "Department of Mechatronics Engineering"],
    desc: "Thermal, manufacturing, robotics, and automation - including the Swarm Robotics lab under NCRA.",
  },
  {
    title: "Industrial Engineering",
    departments: ["Department of Industrial Engineering"],
    desc: "Operations, manufacturing systems, quality engineering, and supply-chain management.",
  },
  {
    title: "Telecommunication and Information Engineering",
    departments: [
      "Department of Computer Engineering",
      "Department of Software Engineering",
      "Department of Telecommunication Engineering",
      "Department of Computer Science",
    ],
    desc: "Computing and communication programs, including the BS Artificial Intelligence degree program.",
  },
  {
    title: "Basic Sciences and Humanities",
    departments: [
      "Department of Mathematical Sciences",
      "Department of Physical Sciences",
      "Department of Humanities & Social Sciences",
    ],
    desc: "Foundational disciplines in mathematics, physics, and humanities that support all engineering faculties.",
  },
] as const;

export default function UetTaxilaProgramsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "Programs", url: `${siteUrl}/uet-taxila/programs` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-[#d9b451] flex items-center justify-center text-[#07080a] font-bold text-sm">
              U
            </div>
            <span className="font-semibold text-base font-mono">UET GPT</span>
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
              href="/chat"
              className="text-sm px-4 py-2 rounded-lg bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-colors"
            >
              Start Chat
            </Link>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET Taxila Programs
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#d9b451] to-[#f0d178] mt-2">
                and Departments
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              14 departments across 6 faculties, offering undergraduate, graduate, and PhD degrees
              in engineering, computing, and the basic sciences - the complete map of what UET
              Taxila teaches, brought to you by UET GPT.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/chat"
                className="px-6 py-3 rounded-xl bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-colors text-base"
              >
                Ask UET GPT
              </Link>
              <Link
                href="/uet-taxila"
                className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base"
              >
                Back to UET Taxila Hub
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              The 6 Faculties and 14 Departments
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Every UET Taxila degree belongs to one of these faculties and departments
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FACULTIES.map((f) => (
                <div key={f.title} className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                  <h3 className="font-semibold text-base mb-3 text-white">{f.title}</h3>
                  <ul className="mb-3 space-y-1">
                    {f.departments.map((d) => (
                      <li key={d} className="text-sm text-[#a1a1aa]">
                        &bull; {d}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-[#a1a1aa]">{f.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-[#a1a1aa] text-center mt-8 max-w-3xl mx-auto">
              In total, UET Taxila&apos;s 14 departments are: Civil, Environmental, Electrical,
              Electronics, Mechanical, Mechatronics, Industrial, Computer, Software, and
              Telecommunication Engineering, together with Computer Science and the Mathematical
              Sciences, Physical Sciences, and Humanities &amp; Social Sciences departments.
            </p>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Undergraduate, Graduate &amp; PhD Programs
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Three levels of study, from your first engineering degree to a doctorate
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Undergraduate (BSc Engineering &amp; BS)
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET Taxila offers four-year BSc Engineering degrees in Civil, Environmental,
                  Electrical, Electronics, Mechanical, Mechatronics, Industrial, Computer, Software,
                  and Telecommunication Engineering, plus BS programs in Computer Science and the
                  basic sciences (Mathematics and Physics). Computing offerings additionally include
                  the BS Artificial Intelligence degree program. Undergraduate engineering and
                  computing admissions are based on the ECAT entry test.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Graduate (MS / MSc / MPhil)</h3>
                <p className="text-sm text-[#a1a1aa]">
                  Most departments offer graduate study through MS/MSc Engineering and MPhil
                  programs. These build advanced, research-oriented expertise in each
                  discipline&apos;s core and emerging areas, preparing students for specialized
                  industry roles or further doctoral work.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">Doctoral (PhD)</h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET Taxila awards PhD degrees in engineering, computing, and basic science
                  disciplines. Doctoral candidates work alongside faculty in the university&apos;s
                  laboratories and research centers, contributing original research in their field.
                  Eligibility and entry requirements are set by each department.
                </p>
              </div>
            </div>
          </section>

          {/* Sibling Cross-Links & Navigation */}
          <section className="px-6 py-12 max-w-4xl mx-auto border-t border-white/10">
            <h2 className="text-xl font-semibold mb-6 text-white">Related UET Taxila Hub Guides</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Link
                href="/uet-taxila/admissions"
                className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-xs text-[#d9b451] font-mono mb-1">ADMISSIONS</div>
                <h3 className="font-medium text-sm text-white">ECAT &amp; Merit 2026</h3>
                <p className="text-xs text-[#a1a1aa] mt-1">Requirements and entry test criteria.</p>
              </Link>
              <Link
                href="/uet-taxila/fee-structure"
                className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-xs text-[#d9b451] font-mono mb-1">FINANCES</div>
                <h3 className="font-medium text-sm text-white">Fee Structure 2026</h3>
                <p className="text-xs text-[#a1a1aa] mt-1">
                  Tuition, hostel, and semester charges.
                </p>
              </Link>
              <Link
                href="/learn/eligibility-criteria"
                className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
              >
                <div className="text-xs text-[#d9b451] font-mono mb-1">GLOSSARY</div>
                <h3 className="font-medium text-sm text-white">Eligibility Criteria</h3>
                <p className="text-xs text-[#a1a1aa] mt-1">60% vs 50% threshold rules.</p>
              </Link>
            </div>

            {/* Editorial byline and official portal link */}
            <div className="text-xs text-[#a1a1aa] border-t border-white/10 pt-4 mt-8 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono">
              <span>
                Published by UET GPT Editorial Team • Verified against official Prospectus
              </span>
              <a
                href="https://web.uettaxila.edu.pk"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#d9b451] hover:underline"
              >
                Official UET Taxila Portal &rarr;
              </a>
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Frequently Asked Questions about UET Taxila Programs
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
          </section>
        </main>

        <footer className="border-t border-[#1a1a1e] px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#a1a1aa]">
              &copy; {new Date().getFullYear()} UET GPT Community. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-6 text-sm text-[#a1a1aa]">
              <Link href="/" className="hover:text-[#e1e1e2] transition-colors">
                Home
              </Link>
              <Link href="/uet-taxila" className="hover:text-[#e1e1e2] transition-colors">
                UET Taxila Hub
              </Link>
              <Link href="/learn" className="hover:text-[#e1e1e2] transition-colors">
                Glossary
              </Link>
              <Link href="/about" className="hover:text-[#e1e1e2] transition-colors">
                About
              </Link>
              <Link href="/privacy" className="hover:text-[#e1e1e2] transition-colors">
                Privacy
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
