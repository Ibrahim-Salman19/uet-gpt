import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";
import { getAllProgramSlugs, getProgramBySlug } from "@/lib/programs-data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllProgramSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = getProgramBySlug(slug);
  if (!program) return {};

  const title = `${program.name} at UET Taxila: Curriculum & Merit`;
  const description = `${program.name} at UET Taxila: 4-year ${program.totalCreditHours} CH roadmap, ${program.accreditationBody} ${program.obeLevel} accreditation, labs, and ${CURRENT_ACADEMIC_YEAR} admissions.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/uet-taxila/programs/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/uet-taxila/programs/${slug}`,
      type: "article",
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `${program.name} - UET Taxila`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${siteUrl}/opengraph-image`],
    },
  };
}

export default async function ProgramDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const program = getProgramBySlug(slug);

  if (!program) {
    notFound();
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/uet-taxila/programs/${slug}#faq`,
    dateModified: SCHEMA_DATE_MODIFIED,
    mainEntity: program.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  const programSchema = {
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalProgram",
    "@id": `${siteUrl}/uet-taxila/programs/${slug}#program`,
    name: program.name,
    description: program.lead,
    provider: {
      "@type": "CollegeOrUniversity",
      name: "University of Engineering and Technology, Taxila",
      url: "https://web.uettaxila.edu.pk",
    },
    timeToComplete: "P4Y",
    educationalCredentialAwarded: program.degreeType,
    numberOfCredits: program.totalCreditHours,
    programPrerequisites: "F.Sc Pre-Engineering / ICS / Equivalent with ECAT",
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Programs", url: `${siteUrl}/uet-taxila/programs` },
          { name: program.name, url: `${siteUrl}/uet-taxila/programs/${slug}` },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(programSchema) }}
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
          <Link href="/uet-taxila/programs" className="hover:text-white transition-colors">
            Programs
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">{program.name}</span>
        </nav>

        {/* Hero Section */}
        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              {program.degreeType}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 font-mono">
              {program.accreditationBody} {program.obeLevel}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              {program.totalCreditHours} Credit Hours
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            {program.name}
          </h1>
          <p className="text-sm font-mono text-[#d9b451] mb-4">
            {program.department} &bull; {program.faculty}
          </p>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            {program.lead}
          </p>
        </header>

        {/* Quick Facts Grid */}
        <section
          aria-label="Program Fast Facts"
          className="mb-14 grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Duration</span>
            <span className="text-lg font-bold text-white mt-1 block font-mono">4 Years</span>
            <span className="text-[10px] text-[#71717a]">8 Semesters</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Accreditation</span>
            <span className="text-lg font-bold text-emerald-400 mt-1 block font-mono">
              {program.accreditationBody}
            </span>
            <span className="text-[10px] text-[#71717a]">{program.obeLevel}</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">Total Credits</span>
            <span className="text-lg font-bold text-[#d9b451] mt-1 block font-mono">
              {program.totalCreditHours} CH
            </span>
            <span className="text-[10px] text-[#71717a]">Theory + Labs</span>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 text-center">
            <span className="text-xs font-mono text-[#a1a1aa] uppercase block">
              Benchmark Merit
            </span>
            <span className="text-lg font-bold text-white mt-1 block font-mono">
              {program.benchmarkClosingMerit}
            </span>
            <span className="text-[10px] text-[#71717a]">Category A Open</span>
          </div>
        </section>

        {/* Program Overview */}
        <section className="mb-14 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Academic Overview &amp; Curriculum</h2>
          <div className="space-y-3 text-sm sm:text-base text-[#a1a1aa] leading-relaxed">
            {program.overview.map((paragraph) => (
              <p key={paragraph.substring(0, 30)}>{paragraph}</p>
            ))}
          </div>
        </section>

        {/* Sample Course Structure */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">
            Course Structure &amp; Study Scheme
          </h2>
          <div className="space-y-6">
            {program.semesters.map((sem) => (
              <div
                key={sem.semesterNumber}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#0c0d10]"
              >
                <div className="bg-[#14151a] px-5 py-3 border-b border-white/10 flex items-center justify-between">
                  <span className="font-semibold text-white text-sm">
                    Semester {sem.semesterNumber}
                  </span>
                  <span className="text-xs font-mono text-[#d9b451]">
                    {sem.totalCredits} Credit Hours
                  </span>
                </div>
                <div className="divide-y divide-white/5 font-mono text-xs">
                  {sem.courses.map((c) => (
                    <div
                      key={c.code}
                      className="px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#d9b451] font-bold w-16 shrink-0">{c.code}</span>
                        <span className="text-zinc-200 font-sans text-sm">{c.title}</span>
                      </div>
                      <span className="text-[#a1a1aa] shrink-0 font-sans">{c.creditHours} CH</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Laboratories & Research Centers */}
        <section className="mb-14 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Research Laboratories &amp; Facilities
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {program.labs.map((lab) => (
              <div
                key={lab}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-[#14151a]"
              >
                <span className="h-2 w-2 rounded-full bg-[#d9b451] shrink-0" />
                <span className="text-xs sm:text-sm text-zinc-200 font-medium">{lab}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Career Outcomes */}
        <section className="mb-14 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-white mb-4">
            Career Pathways &amp; Industry Placement
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {program.careerProspects.map((career) => (
              <div
                key={career}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-white/5 bg-[#14151a]"
              >
                <span className="text-emerald-400 font-mono text-xs font-bold">&check;</span>
                <span className="text-xs sm:text-sm text-zinc-200">{career}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Calculator & Compare CTAs */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Check if your aggregate meets the {program.benchmarkClosingMerit} benchmark.
            </p>
          </Link>
          <Link
            href="/uet-taxila/fee-structure"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Fee Simulator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Estimate 4-year tuition and hostel costs for {program.name}.
            </p>
          </Link>
          <Link
            href="/compare"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Compare Universities &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Compare UET Taxila vs NUST and FAST for {program.name}.
            </p>
          </Link>
        </section>

        {/* Program FAQs */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {program.faqs.map((f) => (
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
