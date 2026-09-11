import type { Metadata } from "next";
import Link from "next/link";
import { HOSTELS } from "@/components/campus/campus-life-hub";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const title = "UET Taxila Hostels: Halls, Fees & Facilities Guide";
const description =
  "All 5 UET Taxila residential halls compared: capacity, room types, facilities, and ~PKR 28,000/semester room dues, plus how hostel allotment priority works by home region.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}/uet-taxila/hostels`,
  },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/uet-taxila/hostels`,
    type: "article",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Hostels Guide - UET GPT",
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

const faqs = [
  {
    q: "How many hostels does UET Taxila have?",
    a: "UET Taxila has 5 on-campus residential halls: Sir Syed Hall, Allama Iqbal Hall, Ali Hall, and Quaid-e-Azam Hall for male students, and Fatima Jinnah Hall for female students.",
  },
  {
    q: "How much are UET Taxila hostel charges per semester?",
    a: "Room dues are approximately PKR 28,000 per semester, plus a refundable mess security deposit of PKR 8,000. See the full hostel-allotment glossary entry for the complete fee and refund policy.",
  },
  {
    q: "Is hostel accommodation guaranteed for all UET Taxila students?",
    a: "Priority is region-based. Outstation candidates located outside commuter-route reach (Southern Punjab, Sindh, KPK, Balochistan, AJK, GB) receive top priority for a guaranteed on-campus bed. Students from intermediate-distance cities (Jhelum, Chakwal, Mianwali) are allocated based on academic merit in the first and second admission rounds. Twin Cities and Wah Cantt students are encouraged to use the commuter bus network instead.",
  },
  {
    q: "Which UET Taxila hostel is for first-year students?",
    a: "Sir Syed Hall is the primary residential hall for incoming freshmen and 2nd-year undergraduates. Allama Iqbal Hall is reserved for 3rd Year and Final Year students, including Final Year Project researchers.",
  },
  {
    q: "How much does the UET Taxila hostel mess cost per month?",
    a: "Mess costs depend on the meal plan: roughly PKR 390/day for 3 meals, PKR 270/day for 2 meals, or PKR 340/day for a balanced plan, plus optional add-ons like a summer room cooler (PKR 1,500/month) or laundry service (PKR 900/month).",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/uet-taxila/hostels#faq`,
  dateModified: SCHEMA_DATE_MODIFIED,
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: f.a,
    },
  })),
};

export default function HostelsPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "Hostels", url: `${siteUrl}/uet-taxila/hostels` },
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
        <nav className="mb-8 flex items-center text-sm text-[#a1a1aa]" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <Link href="/uet-taxila" className="hover:text-white transition-colors">
            UET Taxila
          </Link>
          <span className="mx-2 text-[#52525b]">/</span>
          <span className="text-white font-medium">Hostels</span>
        </nav>

        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              Campus Life
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              {HOSTELS.length} Halls &bull; ~PKR 28,000/semester room dues
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Hostels
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            UET Taxila has {HOSTELS.length} on-campus residential halls with 24/7 security, solar
            backup power, and student-run dining mess. Here's every hall, who it's for, and what's
            included.
          </p>
        </header>

        <section className="mb-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HOSTELS.map((hostel) => (
            <div key={hostel.name} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                  {hostel.capacity}
                </span>
                <span className="text-[10px] font-mono text-emerald-400">{hostel.roomTypes}</span>
              </div>
              <h2 className="text-base font-bold text-white mb-1">{hostel.name}</h2>
              <p className="text-[11px] font-mono text-[#71717a] mb-2">{hostel.targetBatch}</p>
              <p className="text-xs leading-relaxed text-[#a1a1aa] mb-4">{hostel.desc}</p>
              <div className="border-t border-white/5 pt-3">
                <span className="text-[10px] font-mono uppercase text-[#71717a] block mb-1.5 font-bold">
                  Key Amenities:
                </span>
                <div className="flex flex-wrap gap-1">
                  {hostel.facilities.map((fac) => (
                    <span
                      key={fac}
                      className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-mono text-zinc-300"
                    >
                      {fac}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="mb-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/campus-life?tab=hostels"
            className="rounded-xl border border-[#d9b451]/30 bg-[#0c0d10] p-5 hover:border-[#d9b451]/60 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Living Cost Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Estimate your monthly mess bill and check your allotment priority tier.
            </p>
          </Link>
          <Link
            href="/learn/hostel-allotment"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Allotment Rules &amp; Refund Policy &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              How hostel rooms are allotted and whether security deposits are refundable.
            </p>
          </Link>
        </section>

        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {faqs.map((f) => (
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
