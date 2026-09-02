import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { ScholarshipScreener } from "@/components/scholarships/scholarship-screener";

export const metadata: Metadata = {
  title: "Scholarship Eligibility Screener & Finder | UET GPT",
  description:
    "Interactive scholarship screener for UET Taxila: Check eligibility for HEC Need-Based, Punjab Honhaar, Ehsaas, PEEF, WWF, and alumni grants.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/scholarship-finder",
  },
  openGraph: {
    title: "Scholarship Eligibility Screener & Finder | UET GPT",
    description:
      "Interactive scholarship screener for UET Taxila: Check eligibility for HEC Need-Based, Punjab Honhaar, Ehsaas, PEEF, WWF, and alumni grants.",
    url: "https://uet-gpt.vercel.app/scholarship-finder",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scholarship Eligibility Screener & Finder | UET GPT",
    description:
      "Interactive scholarship screener for UET Taxila: Check eligibility for HEC Need-Based, Punjab Honhaar, Ehsaas, PEEF, WWF, and alumni grants.",
  },
};

const screenerFaqs = [
  {
    question: "What is the Punjab Honhaar Scholarship cutoff for engineering?",
    answer:
      "The Chief Minister Punjab Honhaar Scholarship requires a minimum of 70% unadjusted marks in Intermediate (HSSC / F.Sc / ICS) and a family annual income below PKR 350,000, providing 100% full tuition coverage for all 4 years.",
  },
  {
    question: "Can self-finance (Category S) students apply for HEC Need-Based Aid?",
    answer:
      "Generally, government financial aid programs (HEC Need-Based, Ehsaas, PEEF) prioritize open-merit (Category A) students. However, UETTAA Alumni emergency grants and department book bank resources assist all enrolled students experiencing genuine hardship.",
  },
  {
    question: "What expenses are covered by the Workers Welfare Fund (WWF) grant?",
    answer:
      "Children of registered industrial workers with 3+ years of EOBI/PESSI service receive 100% full sponsorship covering all tuition fees, hostel room rent, bus transport charges, examination dues, a PKR 5,000 per semester book grant, and monthly living stipends.",
  },
  {
    question: "Where do students submit physical scholarship documentation on campus?",
    answer:
      "Hardcopy applications, verified income affidavits, utility bills, and salary slips are submitted to the University Scholarship Committee (USC) office located inside the Administration Block (Room 104).",
  },
];

export default function ScholarshipFinderPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: screenerFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Scholarships", item: "/scholarships" },
          { name: "Scholarship Finder", item: "/scholarship-finder" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white py-16 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Interactive Aid Calculator
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-zinc-50">
                Scholarship Eligibility Screener
              </h1>
              <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                Instantly evaluate your eligibility for Punjab Honhaar, HEC Need-Based, Ehsaas BISP,
                PEEF, Workers Welfare Fund (WWF), and UETTAA alumni grants.
              </p>
            </div>
          </div>
        </section>

        {/* Screener Component */}
        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <ScholarshipScreener />
          </div>
        </section>

        {/* FAQs */}
        <section className="border-t border-zinc-200/80 bg-white py-12 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Financial Aid &amp; Screener FAQs
            </h2>
            <div className="mt-6 space-y-4">
              {screenerFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30"
                >
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/scholarships"
                className="inline-flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                &larr; View Complete Scholarships &amp; Financial Aid Guide
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
