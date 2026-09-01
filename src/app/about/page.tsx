import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "About UET GPT - Open-Source AI for UET Taxila",
  description:
    "Learn about UET GPT, our mission, technical RAG architecture, contributors, and how we empower students and prospective applicants of UET Taxila.",
  alternates: { canonical: `${siteUrl}/about` },
  openGraph: {
    title: "About UET GPT - Open-Source AI for UET Taxila",
    description: "Mission, architecture, and team behind UET GPT.",
    url: `${siteUrl}/about`,
    type: "website",
  },
};

export default function AboutPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "About", url: `${siteUrl}/about` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>{" "}
            / <span>About</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">About UET GPT</h1>
          <p className="text-base text-[#a1a1aa] mb-10 leading-relaxed">
            UET GPT is an open-source, student-driven AI assistant engineered to make official
            university information instantly accessible, verified, and conversational.
          </p>
          <div className="space-y-8 text-sm text-[#d4d4d8] leading-relaxed font-light">
            <section className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">Our Mission</h2>
              <p>
                To eliminate information barriers for applicants and students of University of
                Engineering and Technology, Taxila by synthesizing complex prospectuses, schedules,
                and departmental notices into citation-backed answers.
              </p>
            </section>
            <section className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">
                Independent Community Project
              </h2>
              <p>
                UET GPT is developed and maintained independently by students and open-source
                contributors. It is not an official university administration portal.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
