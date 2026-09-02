import type { Metadata } from "next";
import { Suspense } from "react";
import { AcademicsHub } from "@/components/academics/academics-hub";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: `Academics, Degree Syllabi & Calendar | UET GPT`,
  description:
    "Official academic hub for UET Taxila: 14 PEC-accredited degree curriculums, 8-semester roadmaps, academic calendar, and OBE examination guidelines.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/academics",
  },
  openGraph: {
    title: `Academics, Degree Syllabi & Calendar | UET GPT`,
    description:
      "Official academic hub for UET Taxila: 14 PEC-accredited degree curriculums, 8-semester roadmaps, academic calendar, and OBE examination guidelines.",
    url: "https://uet-gpt.vercel.app/academics",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Academics, Degree Syllabi & Calendar | UET GPT`,
    description:
      "Official academic hub for UET Taxila: 14 PEC-accredited degree curriculums, 8-semester roadmaps, academic calendar, and OBE examination guidelines.",
  },
};

export default function AcademicsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Academics", item: "/academics" },
        ]}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-[#07080a] text-white">
        {/* Header */}
        <section className="relative border-b border-white/10 bg-gradient-to-b from-[#d9b451]/10 via-[#07080a] to-[#07080a] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-[#d9b451]">
                Academic Excellence
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Academics, Syllabi &amp; Calendar
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#a1a1aa] sm:text-base">
                Explore Washington Accord Level-II accredited engineering degrees, computing
                disciplines, official semester roadmaps, examination rubrics, and the academic
                calendar {CURRENT_ACADEMIC_YEAR}.
              </p>
            </div>
          </div>
        </section>

        {/* Academics Section */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-12 text-center text-sm font-mono text-[#a1a1aa]">
                  Loading academic programs and schedules...
                </div>
              }
            >
              <AcademicsHub />
            </Suspense>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
