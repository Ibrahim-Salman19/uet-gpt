import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "About UET GPT - Open Source AI Assistant",
  description:
    "Learn about UET GPT, the open-source, student-built AI assistant designed to provide accurate, citation-backed answers about UET Taxila.",
  alternates: {
    canonical: `${siteUrl}/about`,
  },
  openGraph: {
    title: "About UET GPT - Open Source AI Assistant",
    description:
      "Learn about UET GPT, the open-source, student-built AI assistant designed to provide accurate, citation-backed answers about UET Taxila.",
    url: `${siteUrl}/about`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "About UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About UET GPT - Open Source AI Assistant",
    description:
      "Learn about UET GPT, the open-source, student-built AI assistant designed to provide accurate, citation-backed answers about UET Taxila.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "About", url: `${siteUrl}/about` },
        ]}
      />

      <main
        id="main-content"
        className="flex-1 mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 w-full"
      >
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">About</span>
        </nav>

        <header className="mb-12 border-b border-[#27272a] pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">
            About UET GPT
          </h1>
          <p className="text-lg text-[#a1a1aa] leading-relaxed">
            The mission, architecture, and student community behind the AI assistant for UET Taxila.
          </p>
        </header>

        <section className="space-y-10 text-base text-[#a1a1aa] leading-relaxed">
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white mb-3">Our Mission</h2>
            <p className="text-sm sm:text-base leading-relaxed">
              UET GPT was created to solve a persistent challenge faced by thousands of prospective
              and current students at the University of Engineering and Technology (UET), Taxila:
              navigating complex admissions policies, fee structures, academic regulations, and
              campus announcements scattered across disparate documents and portals.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white mb-3">How It Works</h2>
            <p className="text-sm sm:text-base leading-relaxed mb-4">
              UET GPT employs Retrieval-Augmented Generation (RAG). When a user submits a query, our
              retrieval system searches official UET Taxila documentation—including undergraduate
              prospectuses, department bulletins, and fee schedules—and supplies this verified
              context to our language models. This prevents hallucinations and ensures all answers
              are backed by verifiable citations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-white/5 text-xs">
              <div className="p-3 rounded-lg bg-[#14151a]">
                <span className="font-semibold text-white block">1. User Query</span>
                <span className="text-[#71717a]">Natural language prompt</span>
              </div>
              <div className="p-3 rounded-lg bg-[#14151a]">
                <span className="font-semibold text-white block">2. Vector Search</span>
                <span className="text-[#71717a]">Turso / SQLite hybrid retrieval</span>
              </div>
              <div className="p-3 rounded-lg bg-[#14151a]">
                <span className="font-semibold text-white block">3. Grounded Answer</span>
                <span className="text-[#71717a]">Citations to official documents</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
            <h2 className="text-2xl font-semibold text-white mb-3">Community &amp; Independence</h2>
            <p className="text-sm sm:text-base leading-relaxed">
              UET GPT is an independent, open-source initiative built by students and alumni. It is
              not officially operated or endorsed by UET Taxila. We believe in transparent,
              accessible knowledge for every engineer and student.
            </p>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
