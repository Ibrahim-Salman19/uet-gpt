import { SCHEMA_DATE_MODIFIED, SITE_FOUNDING_YEAR, UET_TAXILA_FOUNDING_YEAR } from "@/lib/dates";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${siteUrl}/#organization`,
  name: "UET GPT",
  alternateName: "UET GPT Community",
  url: siteUrl,
  description:
    "An intelligent AI assistant that answers questions about UET Taxila - admissions, fee structure, academic programs, departments, faculty, campus life, and more.",
  foundingDate: SITE_FOUNDING_YEAR,
  dateModified: SCHEMA_DATE_MODIFIED,
  founder: {
    "@type": "Person",
    name: "Hafiz Muhammad Saad",
    url: "https://github.com/devhms",
  },
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}/uet-logo.jpg`,
    width: 512,
    height: 512,
  },
  sameAs: [
    "https://github.com/devhms/uet_gpt",
    "https://twitter.com/uet_gpt",
    "https://www.linkedin.com/company/uet-gpt",
  ],
};

export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${siteUrl}/#website`,
  name: "UET GPT",
  url: siteUrl,
  description:
    "Your AI Guide to UET Taxila - ask anything about admissions, programs, campus life, faculty, departments, and more.",
  inLanguage: "en-PK",
  dateModified: SCHEMA_DATE_MODIFIED,
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
  operatingSystem: "Web, iOS, Android",
  applicationCategory: "EducationalApplication",
  applicationSubCategory: "Chatbot",
  description:
    "An AI assistant and chatbot for UET Taxila students that answers questions about admissions, fee structure, academic programs, departments, faculty, and campus life using RAG-powered retrieval from official university documents.",
  url: siteUrl,
  image: `${siteUrl}/opengraph-image`,
  screenshot: `${siteUrl}/opengraph-image`,
  softwareVersion: "1.0.0",
  featureList: [
    "UET Taxila Admissions & ECAT Merit Guidance",
    "Undergraduate & Postgraduate Fee Structure Breakdowns",
    "14 Departments and 6 Faculties Exploration",
    "Hostel Allotment and Transport Schedules",
    "RAG-Grounded Answers with Official Citations",
  ],
  about: { "@id": "https://web.uettaxila.edu.pk/#university" },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "PKR",
  },
  author: { "@id": `${siteUrl}/#organization` },
  datePublished: "2026-05-21",
  dateModified: SCHEMA_DATE_MODIFIED,
  license: "https://www.gnu.org/licenses/agpl-3.0.html",
};

export const collegeSchema = {
  "@context": "https://schema.org",
  "@type": "CollegeOrUniversity",
  "@id": "https://web.uettaxila.edu.pk/#university",
  name: "University of Engineering and Technology, Taxila",
  alternateName: ["UET Taxila", "UET"],
  url: "https://web.uettaxila.edu.pk",
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}/uet-logo.jpg`,
    width: 512,
    height: 512,
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "UET Taxila Campus",
    addressLocality: "Taxila",
    addressRegion: "Punjab",
    postalCode: "47050",
    addressCountry: "PK",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: 33.766,
    longitude: 72.8242,
  },
  telephone: "+92-51-9047400",
  numberOfStudents: "5500+",
  foundingDate: UET_TAXILA_FOUNDING_YEAR,
  dateModified: SCHEMA_DATE_MODIFIED,
  sameAs: [
    "https://en.wikipedia.org/wiki/University_of_Engineering_and_Technology,_Taxila",
    "https://www.facebook.com/uettaxila.official",
  ],
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

/**
 * Google BreadcrumbList schema helper.
 * Omits the `item` property on the last entry per Google's explicit Search Central specification.
 */
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const isLast = i === items.length - 1;
      return {
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
        ...(isLast ? {} : { item: item.url }),
      };
    }),
  };
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
