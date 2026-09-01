import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Contact UET GPT Team",
  description:
    "Get in touch with the UET GPT developer team. Report inaccuracies, submit feature requests, or contribute to the open-source project.",
  alternates: { canonical: `${siteUrl}/contact` },
  openGraph: {
    title: "Contact UET GPT Team",
    description: "Contact the UET GPT open-source project team.",
    url: `${siteUrl}/contact`,
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Contact", url: `${siteUrl}/contact` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>{" "}
            / <span>Contact</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">Contact &amp; Feedback</h1>
          <p className="text-base text-[#a1a1aa] mb-10 leading-relaxed">
            Have questions, feedback, or found an inaccuracy in a response? We welcome your input.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">
                GitHub Issues &amp; Discussions
              </h2>
              <p className="text-sm text-[#a1a1aa] mb-4">
                Report bugs, suggest knowledge base additions, or view source code.
              </p>
              <a
                href="https://github.com/devhms/uet_gpt"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#d9b451] hover:underline"
              >
                github.com/devhms/uet_gpt &rarr;
              </a>
            </div>
            <div className="p-6 rounded-xl border border-white/10 bg-white/[0.02]">
              <h2 className="text-lg font-semibold text-white mb-2">
                Official University Contacts
              </h2>
              <p className="text-sm text-[#a1a1aa] mb-4">
                For official admission processing and university administration queries:
              </p>
              <a
                href="https://web.uettaxila.edu.pk/contact/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#d9b451] hover:underline"
              >
                web.uettaxila.edu.pk/contact &rarr;
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
