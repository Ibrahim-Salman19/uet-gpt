import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "Privacy Policy - UET GPT",
  description:
    "Privacy Policy for UET GPT. Learn how we handle your information, chat queries, authentication data, and analytics with privacy by design.",
  alternates: { canonical: `${siteUrl}/privacy` },
  openGraph: {
    title: "Privacy Policy - UET GPT",
    description: "Learn how UET GPT protects user privacy and manages data securely.",
    url: `${siteUrl}/privacy`,
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Privacy Policy", url: `${siteUrl}/privacy` },
        ]}
      />
      <div className="min-h-screen bg-[#070708] text-[#e1e1e2]">
        <main id="main-content" className="max-w-4xl mx-auto px-6 py-20">
          <nav className="text-xs font-mono text-[#a1a1aa] mb-8" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">
              Home
            </Link>{" "}
            / <span>Privacy Policy</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white">Privacy Policy</h1>
          <p className="text-sm text-[#a1a1aa] mb-8">Last Updated: September 1, 2026</p>
          <div className="space-y-8 text-sm text-[#d4d4d8] leading-relaxed font-light">
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">1. Overview</h2>
              <p>
                UET GPT (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to
                protecting your privacy. This Privacy Policy explains how information is collected,
                used, and safeguarded when you use the UET GPT web application.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">2. Information We Collect</h2>
              <p>
                We only collect essential data required to provide AI assistance: your account email
                and username through Clerk authentication, user-submitted chat queries, and
                anonymized telemetry for performance monitoring.
              </p>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-white mb-2">
                3. User Data Rights &amp; Deletion
              </h2>
              <p>
                You have full control over your conversation history. You may delete threads or your
                entire account at any time through the Settings panel.
              </p>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
