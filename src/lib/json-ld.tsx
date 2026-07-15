const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "UET GPT",
  alternateName: "UET GPT Team",
  url: siteUrl,
  description:
    "An intelligent AI assistant that answers any question about UET Taxila — admissions, fee structure, academic programs, departments, faculty, campus life, and more.",
  foundingDate: "2025",
  founder: {
    "@type": "Organization",
    name: "UET GPT Team",
  },
  sameAs: [
    "https://github.com/devhms/uet_gpt",
  ],
};

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "UET GPT",
  url: siteUrl,
  description:
    "Your AI Guide to UET Taxila — ask anything about admissions, programs, campus life, faculty, departments, and more.",
  inLanguage: "en",
  publisher: { "@id": `${siteUrl}/#organization` },
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${siteUrl}/chat?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/#software`,
  name: "UET GPT",
  operatingSystem: "Web",
  applicationCategory: "EducationalApplication",
  description:
    "An intelligent AI assistant that answers any question about UET Taxila using RAG-powered retrieval from official university documents.",
  url: siteUrl,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: { "@id": `${siteUrl}/#organization` },
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [organizationSchema, websiteSchema, softwareSchema],
        }),
      }}
    />
  );
}
