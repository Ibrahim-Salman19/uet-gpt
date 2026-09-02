import type { Metadata } from "next";
import { Suspense } from "react";
import { AdmissionsHub } from "@/components/admissions/admissions-hub";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: `Admissions, ECAT Guide & Fee Structure | UET GPT`,
  description: `Comprehensive UET Taxila admissions hub for ${CURRENT_ACADEMIC_YEAR}: Eligibility criteria, ECAT strategy blueprint, interactive fee simulator, and scholarships.`,
  alternates: {
    canonical: "https://uet-gpt.vercel.app/admissions",
  },
  openGraph: {
    title: `Admissions, ECAT Guide & Fee Structure | UET GPT`,
    description: `Comprehensive UET Taxila admissions hub for ${CURRENT_ACADEMIC_YEAR}: Eligibility criteria, ECAT strategy blueprint, interactive fee simulator, and scholarships.`,
    url: "https://uet-gpt.vercel.app/admissions",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Admissions, ECAT Guide & Fee Structure | UET GPT`,
    description: `Comprehensive UET Taxila admissions hub for ${CURRENT_ACADEMIC_YEAR}: Eligibility criteria, ECAT strategy blueprint, interactive fee simulator, and scholarships.`,
  },
};

export default function AdmissionsPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Admissions & Aid", item: "/admissions" },
        ]}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-[#07080a] text-white">
        {/* Header */}
        <section className="relative border-b border-white/10 bg-gradient-to-b from-[#d9b451]/10 via-[#07080a] to-[#07080a] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3.5 py-1 text-xs font-mono font-semibold uppercase tracking-wider text-[#d9b451]">
                Admissions {CURRENT_ACADEMIC_YEAR}
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
                Admissions, Aid &amp; Fees
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[#a1a1aa] sm:text-base">
                Your end-to-end gateway for UET Taxila admissions: eligibility rules, ECAT entry
                test strategies, live fee simulations, and financial aid grants.
              </p>
            </div>
          </div>
        </section>

        {/* Admissions Section */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-12 text-center text-sm font-mono text-[#a1a1aa]">
                  Loading admissions and financial aid hub...
                </div>
              }
            >
              <AdmissionsHub />
            </Suspense>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
