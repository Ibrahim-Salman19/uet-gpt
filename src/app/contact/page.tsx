import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Contact UET GPT Team",
  description:
    "Get in touch with the UET GPT development and editorial team for feedback, data corrections, and open source contributions.",
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
  openGraph: {
    title: "Contact UET GPT Team",
    description:
      "Get in touch with the UET GPT development and editorial team for feedback, data corrections, and open source contributions.",
    url: `${siteUrl}/contact`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "Contact UET GPT Team",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact UET GPT Team",
    description: "Get in touch with the UET GPT team for feedback and support.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7]">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Contact", url: `${siteUrl}/contact` },
        ]}
      />
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Contact</span>
        </nav>

        <header className="mb-12 border-b border-[#27272a] pb-8">
          <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl mb-4">
            Contact &amp; Feedback
          </h1>
          <p className="text-lg text-[#a1a1aa] leading-relaxed">
            Have a question, suggestion, or correction for UET GPT? Reach out directly.
          </p>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[#27272a] bg-[#09090b] p-6">
            <h2 className="text-xl font-semibold text-white mb-2">Feedback &amp; Corrections</h2>
            <p className="text-sm text-[#a1a1aa] mb-4">
              If you notice any outdated prospectus data or policy changes, let our editorial team
              know so we can update the knowledge base.
            </p>
            <a
              href="mailto:contact@uet-gpt.com"
              className="inline-block text-sm font-medium text-[#d9b451] hover:underline"
            >
              contact@uet-gpt.com &rarr;
            </a>
          </div>

          <div className="rounded-xl border border-[#27272a] bg-[#09090b] p-6">
            <h2 className="text-xl font-semibold text-white mb-2">GitHub &amp; Contributions</h2>
            <p className="text-sm text-[#a1a1aa] mb-4">
              UET GPT is open-source. Report issues, request features, or submit pull requests on our
              public repository.
            </p>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-[#d9b451] hover:underline"
            >
              View on GitHub &rarr;
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
