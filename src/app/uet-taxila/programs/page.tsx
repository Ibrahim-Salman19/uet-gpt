import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";
import { PROGRAMS_DATA } from "@/lib/programs-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Programs & Departments: BS, MS, PhD",
  description:
    "Explore 14 departments and 6 faculties at UET Taxila offering accredited undergraduate (BSc/BS), graduate (MS/MSc), and PhD degree programs in engineering.",
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
  "@id": `${siteUrl}/uet-taxila/programs#faq`,
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
    desc: "Computing, software engineering, AI, telecom networks, and cyber security.",
  },
  {
    title: "Basic Sciences and Humanities",
    departments: [
      "Department of Mathematical Sciences",
      "Department of Physical Sciences",
      "Department of Humanities and Social Sciences",
    ],
    desc: "Foundational mathematics, physics, English, and social sciences supporting all engineering curricula.",
  },
];

const departmentsSchema = {
  "@context": "https://schema.org",
  "@type": "ItemList",
  "@id": `${siteUrl}/uet-taxila/programs#departments`,
  name: "UET Taxila Academic Departments",
  itemListElement: FACULTIES.flatMap((f) => f.departments).map((dept, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: dept,
  })),
};

export default function UetTaxilaProgramsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
      <PublicNav />

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
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(departmentsSchema) }}
      />

      <main id="main-content" className="flex-1">
        <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            PEC &amp; HEC Accredited Programs {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-white">
            UET Taxila Programs &amp; Departments
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#d9b451] to-[#f0d178] mt-2">
              14 Departments Across 6 Faculties
            </span>
          </h1>
          <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8 leading-relaxed">
            The full academic spectrum of the University of Engineering and Technology, Taxila -
            from undergraduate engineering and computer science to doctoral research.
          </p>
          <div className="flex items-center justify-center flex-wrap gap-4">
            <Link
              href="/calculator"
              className="px-6 py-3 rounded-xl bg-[#d9b451] text-[#07080a] font-semibold hover:bg-[#f0d178] transition-colors text-base min-h-[44px] flex items-center justify-center"
            >
              Check Department Merits
            </Link>
            <Link
              href="/uet-taxila/admissions"
              className="px-6 py-3 rounded-xl border border-[#d9b451]/40 text-[#d9b451] hover:bg-[#d9b451]/10 transition-colors text-base min-h-[44px] flex items-center justify-center"
            >
              Admissions Guide
            </Link>
            <Link
              href="/uet-taxila"
              className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base min-h-[44px] flex items-center justify-center"
            >
              UET Taxila Hub
            </Link>
          </div>
        </section>

        {/* 14 Undergraduate Degree Programs Grid */}
        <section className="px-6 py-16 max-w-5xl mx-auto border-t border-white/5">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-3">14 Undergraduate Degree Programs</h2>
            <p className="text-sm text-[#a1a1aa] max-w-2xl mx-auto">
              Select any engineering or computing program to explore its 4-year semester roadmap,
              course codes, laboratory facilities, and closing merit benchmarks.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROGRAMS_DATA.map((prog) => (
              <Link
                key={prog.slug}
                href={`/uet-taxila/programs/${prog.slug}`}
                className="group p-5 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 hover:bg-[#121318] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-[#d9b451] bg-[#d9b451]/10 px-2 py-0.5 rounded">
                      {prog.degreeType}
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {prog.accreditationBody}
                    </span>
                  </div>
                  <h3 className="font-semibold text-base text-white group-hover:text-[#d9b451] transition-colors mb-1.5">
                    {prog.name}
                  </h3>
                  <p className="text-xs text-[#a1a1aa] line-clamp-2 mb-4 leading-relaxed">
                    {prog.lead}
                  </p>
                </div>
                <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs font-mono">
                  <span className="text-[#71717a]">{prog.totalCreditHours} CH</span>
                  <span className="text-zinc-300 group-hover:text-[#d9b451] transition-colors">
                    View Syllabus &rarr;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Faculties Grid Section */}
        <section className="px-6 py-16 max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-4 text-white">
            Six Academic Faculties
          </h2>
          <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto text-sm">
            Each faculty groups related engineering and scientific disciplines, laboratories, and
            research centers.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FACULTIES.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#d9b451]/40 transition-colors"
              >
                <h3 className="font-semibold text-lg text-white mb-2">{f.title}</h3>
                <p className="text-xs text-[#a1a1aa] mb-4 leading-relaxed">{f.desc}</p>
                <div className="space-y-1.5 border-t border-white/5 pt-3">
                  {f.departments.map((dept) => (
                    <div key={dept} className="flex items-center gap-2 text-xs text-zinc-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#d9b451]" />
                      <span>{dept}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sibling Cross-Links & Navigation */}
        <section className="px-6 py-8 max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 text-white">Related University Resources</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/calculator"
              className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
            >
              <div className="text-xs text-[#d9b451] font-mono mb-1">TOOL</div>
              <h3 className="font-medium text-sm text-white">Merit Calculator</h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Compute your department aggregate.</p>
            </Link>
            <Link
              href="/uet-taxila/admissions"
              className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
            >
              <div className="text-xs text-[#d9b451] font-mono mb-1">ADMISSIONS</div>
              <h3 className="font-medium text-sm text-white">ECAT &amp; Eligibility</h3>
              <p className="text-xs text-[#a1a1aa] mt-1">60% vs 50% threshold rules and dates.</p>
            </Link>
            <Link
              href="/uet-taxila/fee-structure"
              className="p-4 rounded-xl border border-white/10 bg-[#0c0c0f] hover:border-[#d9b451]/50 transition-colors"
            >
              <div className="text-xs text-[#d9b451] font-mono mb-1">FINANCES</div>
              <h3 className="font-medium text-sm text-white">Fee Structure</h3>
              <p className="text-xs text-[#a1a1aa] mt-1">Tuition, hostel, and semester charges.</p>
            </Link>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="px-6 py-16 max-w-3xl mx-auto border-t border-white/10">
          <h2 className="text-2xl font-semibold text-center mb-6 text-white">
            Frequently Asked Questions about UET Taxila Programs
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
