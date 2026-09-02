import type { Metadata } from "next";
import Link from "next/link";
import { CampusDirectory } from "@/components/directory/campus-directory";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Campus Directory & Contact Information",
  description: `Official UET Taxila directory for ${CURRENT_ACADEMIC_YEAR}: Phone extensions, email addresses, and office locations for Admissions, Registrar, Hostels, and 14 Departments.`,
  alternates: {
    canonical: `${siteUrl}/directory`,
  },
  openGraph: {
    title: "UET Taxila Campus Directory & Contacts",
    description:
      "Complete contact directory for UET Taxila: phone numbers, emails, and office locations for academic departments and administration.",
    url: `${siteUrl}/directory`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Directory",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Campus Directory & Contacts",
    description: "Find phone numbers and emails for UET Taxila offices and departments.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const FAQ_ITEMS = [
  {
    q: "How can I contact the UET Taxila Admissions Office?",
    a: "You can reach the Directorate of Admissions at admissions@uettaxila.edu.pk or by phone at +92 (51) 9047412 during official office hours (Monday to Friday, 8:00 AM - 4:00 PM).",
  },
  {
    q: "Where is the UET Taxila main campus located?",
    a: "The university is located on HMC Road, Taxila, Rawalpindi District, Punjab 47050, Pakistan (approximately 30 km from Islamabad/Rawalpindi).",
  },
  {
    q: "How do I contact the Hostel Warden for room allotment inquiries?",
    a: "Contact the Chief Warden Office at hostels@uettaxila.edu.pk or +92 (51) 9047450 located at the Central Hostel Office near Quaid-e-Azam Hall.",
  },
];

const contactPageSchema = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  "@id": `${siteUrl}/directory#contact`,
  name: "UET Taxila Campus Directory",
  description: "Official phone extensions, emails, and departmental directory for UET Taxila.",
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: {
    "@type": "CollegeOrUniversity",
    name: "University of Engineering and Technology, Taxila",
    telephone: "+92-51-9047400",
    email: "info@uettaxila.edu.pk",
    address: {
      "@type": "PostalAddress",
      streetAddress: "HMC Road",
      addressLocality: "Taxila",
      addressRegion: "Punjab",
      postalCode: "47050",
      addressCountry: "PK",
    },
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/directory#faq`,
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function CampusDirectoryPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Campus Directory", url: `${siteUrl}/directory` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }}
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
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Campus Directory</span>
        </nav>

        {/* Header */}
        <header className="mb-12 border-b border-white/10 pb-8 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Official University Directory
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Campus Directory
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed">
            Search direct phone extensions, official departmental email addresses, and physical
            office locations across the 163-acre campus.
          </p>
        </header>

        {/* Interactive Searchable Directory */}
        <section aria-label="Searchable Campus Directory" className="mb-14">
          <CampusDirectory />
        </section>

        {/* Emergency & Helpline Cards */}
        <section className="mb-14 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
            <span className="text-xs font-mono text-[#d9b451] uppercase block mb-1">
              Campus Exchange
            </span>
            <p className="text-base font-bold text-white font-mono">+92 (51) 9047400</p>
            <p className="text-xs text-[#a1a1aa] mt-1">Direct PBX central telephone exchange.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
            <span className="text-xs font-mono text-emerald-400 uppercase block mb-1">
              Medical Emergency
            </span>
            <p className="text-base font-bold text-white font-mono">+92 (51) 9047470</p>
            <p className="text-xs text-[#a1a1aa] mt-1">24/7 on-campus ambulance and clinic.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
            <span className="text-xs font-mono text-blue-400 uppercase block mb-1">
              Campus Security
            </span>
            <p className="text-base font-bold text-white font-mono">+92 (51) 9047490</p>
            <p className="text-xs text-[#a1a1aa] mt-1">Main Gate security checkpoint and patrol.</p>
          </div>
        </section>

        {/* FAQs */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((f) => (
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
