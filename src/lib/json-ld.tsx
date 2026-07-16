const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "UET GPT",
  alternateName: "UET GPT Team",
  url: siteUrl,
  description:
    "An intelligent AI assistant that answers any question about UET Taxila - admissions, fee structure, academic programs, departments, faculty, campus life, and more.",
  foundingDate: "2025",
  dateModified: "2026-07-16",
  founder: {
    "@type": "Organization",
    name: "UET GPT Team",
  },
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}/uet-logo.jpg`,
    width: 512,
    height: 512,
  },
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "UET GPT",
  url: siteUrl,
  description:
    "Your AI Guide to UET Taxila - ask anything about admissions, programs, campus life, faculty, departments, and more.",
  inLanguage: "en",
  dateModified: "2026-07-16",
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

export const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": `${siteUrl}/#software`,
  name: "UET GPT",
  operatingSystem: "Web",
  applicationCategory: "Utilities",
  applicationSubCategory: "Chatbot",
  description:
    "An AI assistant and chatbot for UET Taxila students that answers questions about admissions, fee structure, academic programs, departments, faculty, and campus life using RAG-powered retrieval from official university documents.",
  url: siteUrl,
  about: {
    "@type": "CollegeOrUniversity",
    "@id": "https://web.uettaxila.edu.pk/#university",
    name: "University of Engineering and Technology, Taxila",
    url: "https://web.uettaxila.edu.pk",
    dateModified: "2026-07-16",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  author: { "@id": `${siteUrl}/#organization` },
  datePublished: "2026-05-21",
  dateModified: "2026-07-16",
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
};

export const collegeSchema = {
  "@context": "https://schema.org",
  "@type": "CollegeOrUniversity",
  "@id": "https://web.uettaxila.edu.pk/#university",
  name: "University of Engineering and Technology, Taxila",
  alternateName: "UET Taxila",
  url: "https://web.uettaxila.edu.pk",
  logo: `${siteUrl}/uet-logo.jpg`,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Taxila",
    addressRegion: "Punjab",
    addressCountry: "PK",
  },
  foundingDate: "1975",
  dateModified: "2026-07-16",
  sameAs: ["https://en.wikipedia.org/wiki/University_of_Engineering_and_Technology,_Taxila"],
};

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [organizationSchema, websiteSchema, softwareSchema, collegeSchema],
        }),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
