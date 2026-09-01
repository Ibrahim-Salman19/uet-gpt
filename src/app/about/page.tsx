import type { Metadata } from "next";
import Link from "next/link";
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
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7]">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "About", url: `${siteUrl}/about` },
        ]}
      />
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
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
            The mission, architecture, and student community behind the AI assistant for UET
            Taxila.
          </p>
        </header>

        <section className="space-y-8 text-base text-[#a1a1aa] leading-relaxed">
          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">Our Mission</h2>
            <p>
              UET GPT was created to solve a persistent challenge faced by thousands of prospective
              and current students at the University of Engineering and Technology (UET), Taxila:
              navigating complex admissions policies, fee structures, academic regulations, and
              campus announcements scattered across disparate documents and portals.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">How It Works</h2>
            <p>
              UET GPT employs Retrieval-Augmented Generation (RAG). When a user submits a query, our
              retrieval system searches official UET Taxila documentation—including undergraduate
              prospectuses, department bulletins, and fee schedules—and supplies this verified
              context to our language models. This prevents hallucinations and ensures all answers
              are backed by verifiable citations.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-white mb-3">Community &amp; Independence</h2>
            <p>
              UET GPT is an independent, open-source initiative built by students and alumni. It is
              not officially operated or endorsed by UET Taxila. We believe in transparent,
              accessible knowledge for every engineer and student.
            </p>
          </div>
        </section>

        <footer className="mt-16 border-t border-[#27272a] pt-8 flex items-center justify-between text-sm text-[#71717a]">
          <p>&copy; {new Date().getFullYear()} UET GPT Community.</p>
          <Link href="/contact" className="hover:text-white transition-colors">
            Get in touch &rarr;
          </Link>
        </footer>
      </main>
    </div>
  );
}
