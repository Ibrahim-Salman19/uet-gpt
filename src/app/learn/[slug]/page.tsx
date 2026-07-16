import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getTermBySlug, getAllSlugs, LEARN_TERMS } from "@/lib/learn-terms";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

// ── Static generation ────────────────────────────────────────────────────────

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) return {};

  return {
    title: term.pageTitle,
    description: term.metaDescription,
    alternates: {
      canonical: `${siteUrl}/learn/${term.slug}`,
    },
    openGraph: {
      title: term.pageTitle,
      description: term.metaDescription,
      url: `${siteUrl}/learn/${term.slug}`,
      type: "article",
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LearnTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const term = getTermBySlug(slug);
  if (!term) notFound();

  // JSON-LD schemas
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: term.title,
    description: term.lead,
    url: `${siteUrl}/learn/${term.slug}`,
    datePublished: term.datePublished,
    dateModified: term.dateModified,
    author: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UET GPT Team",
    },
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UET GPT Team",
    },
    about: {
      "@type": "CollegeOrUniversity",
      "@id": "https://web.uettaxila.edu.pk/#university",
      name: "University of Engineering and Technology, Taxila",
      url: "https://web.uettaxila.edu.pk",
      dateModified: "2026-07-16",
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: term.dateModified,
    mainEntity: term.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  // Related terms (other glossary pages, exclude current)
  const related = LEARN_TERMS.filter((t) => t.slug !== term.slug).slice(0, 3);

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Learn", url: `${siteUrl}/learn` },
          { name: term.title, url: `${siteUrl}/learn/${term.slug}` },
        ]}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">
              U
            </div>
            <span className="font-semibold text-base">UET GPT</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET GPT Home
            </Link>
            <Link
              href="/uet-taxila"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET Taxila Hub
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          {/* Hero */}
          <section className="px-6 pt-20 pb-10 max-w-3xl mx-auto">
            {/* Breadcrumb trail (visible) */}
            <nav aria-label="Breadcrumb" className="text-xs text-[#71717a] mb-6 flex items-center gap-1">
              <Link href="/" className="hover:text-[#a1a1aa] transition-colors">Home</Link>
              <span>/</span>
              <Link href="/learn" className="hover:text-[#a1a1aa] transition-colors">Learn</Link>
              <span>/</span>
              <span className="text-[#a1a1aa]">{term.title}</span>
            </nav>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              {term.title}
            </h1>
            <p className="text-base text-[#a1a1aa] leading-relaxed mb-8">
              {term.lead}
            </p>

            <div className="flex flex-wrap gap-3">
              {term.hubLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          {/* Body sections */}
          <section className="px-6 pb-12 max-w-3xl mx-auto space-y-10">
            {term.sections.map((section) => (
              <div key={section.heading}>
                <h2 className="text-xl font-semibold mb-4 text-[#e1e1e2]">
                  {section.heading}
                </h2>
                <div className="space-y-3">
                  {section.paragraphs.map((para, i) => (
                    <p key={i} className="text-sm text-[#a1a1aa] leading-relaxed">
                      {para}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* FAQ */}
          <section className="px-6 py-12 max-w-3xl mx-auto">
            <h2 className="text-xl font-semibold mb-6">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {term.faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
                  <summary className="font-medium text-sm cursor-pointer">{faq.q}</summary>
                  <p className="mt-3 text-sm text-[#a1a1aa] leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Related terms */}
          {related.length > 0 && (
            <section className="px-6 py-12 max-w-3xl mx-auto border-t border-[#1a1a1e]">
              <h2 className="text-lg font-semibold mb-6 text-[#a1a1aa]">
                Related UET Taxila Terms
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/learn/${t.slug}`}
                    className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#3f3f46] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#e1e1e2] mb-1">{t.title}</p>
                    <p className="text-xs text-[#71717a] line-clamp-2">{t.lead.slice(0, 80)}...</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="px-6 py-16 max-w-3xl mx-auto text-center">
            <h2 className="text-xl font-semibold mb-3">
              Still have questions about UET Taxila?
            </h2>
            <p className="text-sm text-[#a1a1aa] mb-6">
              UET GPT is the AI guide to UET Taxila. Ask anything about admissions,
              programs, fees, campus life, and more — grounded in official sources,
              free for every student.
            </p>
            <Link
              href="/"
              className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
            >
              Ask UET GPT
            </Link>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#1a1a1e] px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#a1a1aa]">
              &copy; {new Date().getFullYear()} UET GPT Team. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-[#a1a1aa]">
              <Link href="/" className="hover:text-[#e1e1e2] transition-colors">
                UET GPT Home
              </Link>
              <Link href="/uet-taxila" className="hover:text-[#e1e1e2] transition-colors">
                UET Taxila Hub
              </Link>
              <Link href="/learn" className="hover:text-[#e1e1e2] transition-colors">
                Learn
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
