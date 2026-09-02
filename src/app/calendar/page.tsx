import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: `UET Taxila Academic Calendar ${CURRENT_ACADEMIC_YEAR}: Dates & Schedules`,
  description: `Official UET Taxila academic calendar for ${CURRENT_ACADEMIC_YEAR}: Fall & Spring semester dates, ECAT test schedule, merit list announcements, exam weeks, and holidays.`,
  alternates: {
    canonical: `${siteUrl}/calendar`,
  },
  openGraph: {
    title: `UET Taxila Academic Calendar ${CURRENT_ACADEMIC_YEAR}`,
    description:
      "Important dates, admission cycles, semester commencement, midterms, finals, and fee payment deadlines for UET Taxila.",
    url: `${siteUrl}/calendar`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Academic Calendar",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `UET Taxila Academic Calendar ${CURRENT_ACADEMIC_YEAR}`,
    description: "Important dates, admission cycles, and exam weeks for UET Taxila.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

interface CalendarEvent {
  date: string;
  title: string;
  category: "admissions" | "academics" | "fees" | "exams" | "holidays";
  description: string;
  highlight?: boolean;
}

const EVENTS_2026: CalendarEvent[] = [
  {
    date: "July 01 - July 20, 2026",
    title: "ECAT 2026 Online Registration Window",
    category: "admissions",
    description: "Online submission of ECAT entry test application tokens via admission portal.",
    highlight: true,
  },
  {
    date: "July 27 - August 02, 2026",
    title: "ECAT 2026 Computer-Based Examination",
    category: "admissions",
    description: "400-marks computer-based entry test conducted at designated university centers.",
    highlight: true,
  },
  {
    date: "August 10, 2026",
    title: "ECAT Official Result Declaration",
    category: "admissions",
    description: "Scorecards published online for aggregate calculations.",
  },
  {
    date: "August 15 - August 25, 2026",
    title: "UET Taxila Undergraduate Admission Applications Open",
    category: "admissions",
    description:
      "Online preference form submission for all 14 engineering and computing disciplines.",
    highlight: true,
  },
  {
    date: "September 05, 2026",
    title: "First Merit List Announcement",
    category: "admissions",
    description:
      "Display of 1st merit list for Category A (Subsidized) and Category S (Self-Finance).",
    highlight: true,
  },
  {
    date: "September 06 - September 11, 2026",
    title: "1st Merit List Fee Submission & Document Clearance",
    category: "fees",
    description:
      "Submission of bank challan and original educational certificates at Admissions Office.",
  },
  {
    date: "September 14, 2026",
    title: "Second Merit List Announcement",
    category: "admissions",
    description: "Display of 2nd merit list and upgradation status for vacant seats.",
  },
  {
    date: "September 28, 2026",
    title: "Orientation Day & Freshmen Campus Welcome",
    category: "academics",
    description: "Campus orientation, hostel room possession, and departmental briefing.",
    highlight: true,
  },
  {
    date: "September 29, 2026",
    title: "Commencement of Fall 2026 Regular Classes",
    category: "academics",
    description:
      "Official start of academic lectures and laboratory sessions across all faculties.",
    highlight: true,
  },
  {
    date: "November 23 - November 28, 2026",
    title: "Fall 2026 Midterm Examinations",
    category: "exams",
    description:
      "9th-week centralized midterm evaluation covering initial 8 weeks course material.",
  },
  {
    date: "January 25 - February 06, 2027",
    title: "Fall 2026 End-Semester Final Examinations",
    category: "exams",
    description: "Comprehensive final theory exams and laboratory practical viva voce.",
    highlight: true,
  },
  {
    date: "February 08 - February 19, 2027",
    title: "Winter / Semester Break",
    category: "holidays",
    description: "Two-week inter-semester recess for students.",
  },
  {
    date: "February 22, 2027",
    title: "Commencement of Spring 2027 Semester",
    category: "academics",
    description: "Registration and start of Spring 2027 classes.",
  },
];

const FAQ_ITEMS = [
  {
    q: "When do undergraduate classes start at UET Taxila?",
    a: "Fall semester classes typically commence in late September. Freshmen orientation takes place the day prior, with hostel allotment occurring the preceding weekend.",
  },
  {
    q: "What happens if I miss the fee submission deadline after merit list display?",
    a: "If an applicant fails to deposit the admission fee within the notified bank clearance dates, their seat is automatically forfeited and offered to the next candidate in the subsequent merit list.",
  },
  {
    q: "How many weeks are there in a UET Taxila regular semester?",
    a: "A regular semester spans 18 weeks: 16 weeks of active teaching and laboratory instruction, 1 week for midterm assessments, and 1-2 weeks for final examinations.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/calendar#faq`,
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

export default function AcademicCalendarPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Academic Calendar", url: `${siteUrl}/calendar` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8 w-full"
      >
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Academic Calendar</span>
        </nav>

        {/* Header */}
        <header className="mb-12 border-b border-white/10 pb-8 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Official Schedule {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Academic Calendar
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            Key milestone dates for admissions, ECAT testing, merit lists, semester registration,
            midterm exams, and end-semester finals.
          </p>
        </header>

        {/* Quick Legend / Fast Stats */}
        <section
          aria-label="Calendar Summary"
          className="mb-12 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Fall Semester</span>
            <span className="text-lg font-bold text-white mt-1 block font-mono">Sep - Feb</span>
            <span className="text-[10px] text-[#71717a]">18 Academic Weeks</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">
              Spring Semester
            </span>
            <span className="text-lg font-bold text-white mt-1 block font-mono">Feb - Jul</span>
            <span className="text-[10px] text-[#71717a]">18 Academic Weeks</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Summer Term</span>
            <span className="text-lg font-bold text-[#d9b451] mt-1 block font-mono">Jul - Aug</span>
            <span className="text-[10px] text-[#71717a]">8 Weeks Remedial</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">ECAT Window</span>
            <span className="text-lg font-bold text-emerald-400 mt-1 block font-mono">
              July 2026
            </span>
            <span className="text-[10px] text-[#71717a]">Annual Testing</span>
          </div>
        </section>

        {/* Timeline List */}
        <section aria-label="Academic Timeline" className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">Fall 2026 / Spring 2027 Schedule</h2>
          <div className="space-y-4">
            {EVENTS_2026.map((event) => (
              <div
                key={event.title}
                className={`p-5 rounded-xl border transition-all ${
                  event.highlight
                    ? "border-[#d9b451]/40 bg-[#0c0d10] shadow-[0_4px_20px_rgba(217,180,81,0.06)]"
                    : "border-white/10 bg-[#0c0d10]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-bold text-[#d9b451] bg-[#d9b451]/10 px-2.5 py-1 rounded w-fit">
                    {event.date}
                  </span>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border w-fit ${
                      event.category === "admissions"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : event.category === "exams"
                          ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                          : event.category === "fees"
                            ? "border-blue-500/30 text-blue-400 bg-blue-500/10"
                            : "border-zinc-500/30 text-zinc-400 bg-zinc-500/10"
                    }`}
                  >
                    {event.category}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white mb-1">{event.title}</h3>
                <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                  {event.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Sibling Tools Section */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/ecat-guide"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              ECAT Strategy Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Review the 400-marks syllabus and negative marking rules.
            </p>
          </Link>
          <Link
            href="/calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Calculate aggregate with your matric, FSc, and ECAT scores.
            </p>
          </Link>
          <Link
            href="/gpa-calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              GPA Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Simulate semester SGPA and probation safety thresholds.
            </p>
          </Link>
        </section>

        {/* FAQs */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
                <dt className="text-base font-semibold text-white mb-2">{f.q}</dt>
                <dd className="text-sm text-[#a1a1aa] leading-relaxed">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
