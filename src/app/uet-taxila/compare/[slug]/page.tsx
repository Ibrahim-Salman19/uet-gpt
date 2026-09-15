import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { getAllComparisonSlugs, getComparisonBySlug } from "@/lib/comparisons-data";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllComparisonSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cmp = getComparisonBySlug(slug);
  if (!cmp) return {};

  const title = `UET Taxila vs ${cmp.peerShortName}: Fees, Merit & Admission Compared`;
  const description = `Compare UET Taxila and ${cmp.peerShortName} on entry test, merit formula, 2026 tuition, and accreditation — a fair, side-by-side guide for engineering applicants.`;

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/uet-taxila/compare/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/uet-taxila/compare/${slug}`,
      type: "article",
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: `UET Taxila vs ${cmp.peerShortName}`,
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

export default async function ComparisonPage({ params }: PageProps) {
  const { slug } = await params;
  const cmp = getComparisonBySlug(slug);

  if (!cmp) {
    notFound();
  }

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/uet-taxila/compare/${slug}#faq`,
    dateModified: SCHEMA_DATE_MODIFIED,
    mainEntity: cmp.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: `vs. ${cmp.peerShortName}`, url: `${siteUrl}/uet-taxila/compare/${slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
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
          <Link href="/uet-taxila" className="hover:text-white transition-colors">
            UET Taxila
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">vs. {cmp.peerShortName}</span>
        </nav>

        {/* Hero */}
        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              University Comparison
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              {cmp.peerLocation}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila vs {cmp.peerShortName}
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            {cmp.lead}
          </p>
        </header>

        {/* Comparison Table */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-white mb-6">Side-by-Side Comparison</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs sm:text-sm text-[#a1a1aa]">
              <thead className="bg-[#07080a] text-[11px] font-mono uppercase text-white">
                <tr>
                  <th className="p-3.5">Feature</th>
                  <th className="p-3.5 text-[#d9b451]">UET Taxila</th>
                  <th className="p-3.5">{cmp.peerShortName}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-[#0c0d10]">
                {cmp.rows.map((row) => (
                  <tr key={row.feature} className="hover:bg-white/[0.02]">
                    <td className="p-3.5 font-semibold text-white">{row.feature}</td>
                    <td className="p-3.5 font-bold text-[#d9b451]">{row.uetTaxila}</td>
                    <td className="p-3.5">{row.peer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Strengths - balanced, two-column */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
            <h2 className="text-lg font-bold text-[#d9b451] mb-4">Where UET Taxila Leads</h2>
            <ul className="space-y-3">
              {cmp.uetTaxilaStrengths.map((s) => (
                <li key={s} className="flex items-start gap-3 text-sm text-zinc-200">
                  <span className="text-[#d9b451] font-mono text-xs font-bold mt-0.5">&check;</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
            <h2 className="text-lg font-bold text-white mb-4">Where {cmp.peerShortName} Leads</h2>
            <ul className="space-y-3">
              {cmp.peerStrengths.map((s) => (
                <li key={s} className="flex items-start gap-3 text-sm text-zinc-200">
                  <span className="text-emerald-400 font-mono text-xs font-bold mt-0.5">
                    &check;
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTAs */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/tools?tab=merit"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">Check your ECAT aggregate for UET Taxila.</p>
          </Link>
          <Link
            href="/admissions?tab=fees"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Fee Simulator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">Estimate your 4-year UET Taxila tuition.</p>
          </Link>
          <Link
            href="/admissions?tab=compare"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Full Comparison Matrix &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">See all 5 universities side by side.</p>
          </Link>
        </section>

        {/* FAQs */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {cmp.faqs.map((f) => (
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
