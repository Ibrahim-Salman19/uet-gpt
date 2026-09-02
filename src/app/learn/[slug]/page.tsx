import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BreadcrumbJsonLd } from "@/lib/json-ld";
import { getAllSlugs, getTermBySlug, LEARN_TERMS } from "@/lib/learn-terms";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

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
      images: [
        {
          url: `${siteUrl}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: term.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: term.pageTitle,
      description: term.metaDescription,
      images: [`${siteUrl}/opengraph-image`],
    },
  };
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function LearnTermPage({ params }: { params: Promise<{ slug: string }> }) {
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
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${siteUrl}/learn/${term.slug}`,
    },
    image: [`${siteUrl}/opengraph-image`],
    datePublished: term.datePublished,
    dateModified: term.dateModified,
    author: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UET GPT",
    },
    publisher: {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "UET GPT",
    },
    about: {
      "@type": "CollegeOrUniversity",
      "@id": "https://web.uettaxila.edu.pk/#university",
      name: "University of Engineering and Technology, Taxila",
      url: "https://web.uettaxila.edu.pk",
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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="flex min-h-screen flex-col bg-[#07080a] text-[#edf0ec]">
        <PublicNav />

        <main id="main-content" className="flex-1">
          {/* Hero */}
          <section className="px-6 pt-20 pb-10 max-w-3xl mx-auto">
            {/* Breadcrumb trail (visible) */}
            <nav
              aria-label="Breadcrumb"
              className="text-xs text-[#71717a] mb-6 flex items-center gap-1.5"
            >
              <Link href="/" className="hover:text-white transition-colors">
                Home
              </Link>
              <span>/</span>
              <Link href="/learn" className="hover:text-white transition-colors">
                Learn
              </Link>
              <span>/</span>
              <span className="text-[#d9b451]">{term.title}</span>
            </nav>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mb-4 text-white">
              {term.title}
            </h1>
            <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed mb-8">{term.lead}</p>

            <div className="flex flex-wrap gap-3">
              {term.hubLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-xs font-mono font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#d9b451]/15 text-[#d9b451] border border-[#d9b451]/30 hover:bg-[#d9b451] hover:text-[#07080a] transition-all"
                >
                  {link.label} &rarr;
                </Link>
              ))}
            </div>
          </section>

          {/* Body sections */}
          <section className="px-6 pb-12 max-w-3xl mx-auto space-y-10">
            {term.sections.map((section) => (
              <div
                key={section.heading}
                className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8"
              >
                <h2 className="text-xl font-bold mb-4 text-white">{section.heading}</h2>
                <div className="space-y-3">
                  {section.paragraphs.map((para, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static list of paragraphs that never reorders
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
            <h2 className="text-2xl font-bold mb-6 text-white">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {term.faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="p-5 rounded-xl border border-white/10 bg-[#0c0d10] group"
                >
                  <summary className="font-semibold text-sm cursor-pointer text-white group-hover:text-[#d9b451] transition-colors">
                    {faq.q}
                  </summary>
                  <p className="mt-3 text-sm text-[#a1a1aa] leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Related terms */}
          {related.length > 0 && (
            <section className="px-6 py-12 max-w-3xl mx-auto border-t border-white/10">
              <h2 className="text-lg font-bold mb-6 text-white font-mono uppercase tracking-wider text-xs">
                Related Knowledge Base Guides
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {related.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/learn/${t.slug}`}
                    className="p-5 rounded-xl border border-white/10 bg-[#0c0d10] hover:border-[#d9b451]/50 hover:bg-white/[0.02] transition-all group"
                  >
                    <p className="text-sm font-bold text-white mb-1 group-hover:text-[#d9b451] transition-colors">
                      {t.title}
                    </p>
                    <p className="text-xs text-[#a1a1aa] line-clamp-2">{t.lead.slice(0, 80)}...</p>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* CTA */}
          <section className="px-6 py-16 max-w-3xl mx-auto text-center border-t border-white/10">
            <h2 className="text-xl font-bold mb-3 text-white">
              Still have questions about UET Taxila?
            </h2>
            <p className="text-sm text-[#a1a1aa] mb-6 max-w-xl mx-auto leading-relaxed">
              UET GPT is the AI guide to UET Taxila. Ask anything about admissions, programs, fees,
              campus life, and more — grounded in official sources, free for every student.
            </p>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#d9b451] text-[#07080a] font-bold hover:bg-[#f0d178] transition-colors text-xs font-mono uppercase tracking-wider"
            >
              <span>Ask UET GPT Assistant</span>
              <span>&rarr;</span>
            </Link>
          </section>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
