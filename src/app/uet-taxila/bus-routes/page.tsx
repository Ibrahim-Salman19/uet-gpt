import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BUS_ROUTES } from "@/components/transport/bus-routes-explorer";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

const title = "UET Taxila Bus Routes: Commuter Schedule & Pickup Points";
const description =
  "UET Taxila's 6 commuter bus routes across Islamabad, Rawalpindi, Wah Cantt, and Attock: departure times, return schedules, and every pickup point along each route.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: `${siteUrl}/uet-taxila/bus-routes`,
  },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/uet-taxila/bus-routes`,
    type: "article",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Bus Routes - UET GPT",
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

const REGION_LABELS: Record<string, string> = {
  islamabad: "Islamabad",
  rawalpindi: "Rawalpindi",
  "wah-cantt": "Wah Cantt",
  attock: "Attock",
};

const faqs = [
  {
    q: "How many commuter bus routes does UET Taxila operate?",
    a: "UET Taxila operates 6 commuter bus routes covering Islamabad (2 routes), Rawalpindi (2 routes), Wah Cantt (1 route), and Attock (1 route), each ending at the UET Taxila campus.",
  },
  {
    q: "What time do UET Taxila buses depart?",
    a: "Departure times vary by route, from 06:40 AM to 07:15 AM. Each route runs two return trips in the afternoon, typically at 02:15 PM and 04:30 PM.",
  },
  {
    q: "Does UET Taxila have a bus route from Rawalpindi Saddar?",
    a: "Yes. Route 03 (Rawalpindi Saddar & Mall Road) covers Kachehri Chowk, Saddar, Mall Road Cantt, Qasim Market, Peshawar Road, and Pirwadhai Mor before reaching campus.",
  },
  {
    q: "Is there a UET Taxila bus route from Wah Cantt?",
    a: "Yes. Route 05 (Wah Cantt & POF Residential Sectors) covers Lala Rukh, Aslam Market, Officers Colony, Wah Cantt Railway Station, and Taxila Museum Chowk.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": `${siteUrl}/uet-taxila/bus-routes#faq`,
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

export default function BusRoutesPage() {
  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "UET Taxila", url: `${siteUrl}/uet-taxila` },
          { name: "Bus Routes", url: `${siteUrl}/uet-taxila/bus-routes` },
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
          <span className="text-white font-medium">Bus Routes</span>
        </nav>

        <header className="mb-12 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider">
              Campus Life
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[#a1a1aa] font-mono">
              {BUS_ROUTES.length} Routes &bull; Twin Cities, Wah Cantt &amp; Attock
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            UET Taxila Bus Routes
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] leading-relaxed max-w-3xl">
            UET Taxila runs {BUS_ROUTES.length} commuter bus routes for students traveling from
            Islamabad, Rawalpindi, Wah Cantt, and Attock. Every route below lists its departure
            time, return schedule, and every pickup point along the way.
          </p>
        </header>

        <section className="mb-14 space-y-5">
          {BUS_ROUTES.map((route) => (
            <div key={route.id} className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                  <span className="text-[10px] font-mono text-[#d9b451] uppercase tracking-wider">
                    {route.routeNumber} &bull; {REGION_LABELS[route.region] ?? route.region}
                  </span>
                  <h2 className="text-lg font-bold text-white">{route.routeName}</h2>
                </div>
                <div className="text-right text-xs font-mono">
                  <div className="text-[#a1a1aa]">
                    Departs <span className="text-white font-bold">{route.departureTime}</span>
                  </div>
                  <div className="text-[#a1a1aa]">
                    Returns{" "}
                    <span className="text-white font-bold">{route.returnTimes.join(", ")}</span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-[#a1a1aa] leading-relaxed mb-4">{route.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {route.keyStops.map((stop) => (
                  <span
                    key={stop}
                    className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-mono text-zinc-300"
                  >
                    {stop}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="mb-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/campus-life?tab=transport"
            className="rounded-xl border border-[#d9b451]/30 bg-[#0c0d10] p-5 hover:border-[#d9b451]/60 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Search &amp; Filter Routes &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Use the interactive route explorer to search by stop or filter by region.
            </p>
          </Link>
          <Link
            href="/campus-life?tab=hostels"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              On-Campus Hostels &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Compare commuting from home against living in one of 5 residential halls.
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
