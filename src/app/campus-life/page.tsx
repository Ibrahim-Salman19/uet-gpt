import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { CURRENT_ACADEMIC_YEAR, SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET Taxila Campus Life: Hostels, Transport & Sports",
  description:
    "Comprehensive guide to student life at UET Taxila: on-campus hostels (Quaid, Iqbal, Ayesha Hall), university bus routes, central library, and societies.",
  alternates: {
    canonical: `${siteUrl}/campus-life`,
  },
  openGraph: {
    title: "UET Taxila Campus Life: Hostels, Transport & Sports",
    description:
      "Comprehensive guide to student life at UET Taxila: on-campus hostels (Quaid, Iqbal, Ayesha Hall), university bus routes, central library, and societies.",
    url: `${siteUrl}/campus-life`,
    type: "website",
    images: [
      {
        url: `${siteUrl}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: "UET Taxila Campus Life & Facilities",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Campus Life: Hostels, Transport & Sports",
    description:
      "Explore on-campus hostels, university bus routes, central library, and student societies at UET Taxila.",
    images: [`${siteUrl}/opengraph-image`],
  },
};

const HOSTEL_HALLS = [
  {
    name: "Quaid-e-Azam Hall",
    gender: "Male Students (Senior Year)",
    capacity: "~300 residents",
    amenities: "High-speed Wi-Fi, dining hall, indoor sports room, study lounge",
  },
  {
    name: "Allama Iqbal Hall",
    gender: "Male Students (Junior/Sophomore)",
    capacity: "~350 residents",
    amenities: "Common room with LED TV, mess facility, backup power generators",
  },
  {
    name: "Ali Hall & Umar Hall",
    gender: "Male Students (Freshmen & Sophomores)",
    capacity: "~500 residents combined",
    amenities: "Dedicated warden office, central lawn, reading room, filtered water plants",
  },
  {
    name: "Usman Hall",
    gender: "Male Postgraduate / MS Scholars",
    capacity: "~150 residents",
    amenities: "Single & double occupancy cubicles, quiet study environment",
  },
  {
    name: "Ayesha Hall",
    gender: "Female Students (All Academic Years)",
    capacity: "~450 residents",
    amenities: "High-security perimeter, biometric access, in-house dining hall, dedicated gym",
  },
];

const BUS_ROUTES = [
  {
    route: "Islamabad Express Route",
    destinations: "Faizabad, I-8, Zero Point, G-9, Kashmir Highway, G-13, NUST Gate, UET Taxila",
    frequency: "Morning 07:00 AM Departure | Afternoon 04:15 PM Return",
  },
  {
    route: "Rawalpindi City Route",
    destinations: "Saddar, Murree Road, Commercial Market, Chandni Chowk, Peshawar Road, Taxila",
    frequency: "Daily dedicated bus fleet for day-scholar students and faculty",
  },
  {
    route: "Wah Cantt & Local Shuttle",
    destinations: "Lala Rukh, Aslam Market, Barrier No. 3, Taxila Museum, Campus Gate",
    frequency: "Continuous hourly shuttle during peak campus operating hours",
  },
  {
    route: "Hassan Abdal & Attock Route",
    destinations: "Attock City, Sanjwal, Kamra, Burhan, Hassan Abdal, UET Taxila Campus",
    frequency: "Morning & evening daily commuter bus service",
  },
];

const FAQ_ITEMS = [
  {
    q: "Is hostel accommodation guaranteed for all freshmen at UET Taxila?",
    a: "Hostel accommodation is allocated strictly based on distance from the university and merit in the admission list. Students residing outside a 35 km radius from the university are given top priority. Female students admitted to Ayesha Hall are guaranteed accommodation.",
  },
  {
    q: "What is the annual hostel fee at UET Taxila?",
    a: "The room allotment and utilities charges are approximately PKR 12,000 to 18,000 per semester. Mess bills are calculated on a daily actual-cost basis and collected monthly by the elected student mess committee.",
  },
  {
    q: "How does the university transport system operate for day scholars?",
    a: "The UET Taxila Transport Section operates a fleet of over 25 buses covering all major sectors of Islamabad, Rawalpindi, Wah Cantt, Hassan Abdal, and Attock. Students purchase a subsidized semester transport pass.",
  },
  {
    q: "What extracurricular activities and technical societies are active on campus?",
    a: "Active technical chapters include ACM Student Chapter, IEEE Student Branch, ASME, and ICE. Co-curricular societies include Quaid-e-Azam Debating Society, UET Blood Donors Society, Dramatic Club, Environmental Protection Society, and the annual All-Pakistan Technocrat Festival.",
  },
];

export default function CampusLifePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${siteUrl}/campus-life#faq`,
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

  return (
    <div className="min-h-screen bg-[#070708] text-[#e4e4e7] flex flex-col">
      <PublicNav />

      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: siteUrl },
          { name: "Campus Life", url: `${siteUrl}/campus-life` },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object
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
          <span className="text-white font-medium">Campus Life</span>
        </nav>

        {/* Page Header */}
        <header className="mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3 py-1 text-xs font-semibold text-[#d9b451] uppercase tracking-wider mb-4">
            Student Life &amp; Facilities {CURRENT_ACADEMIC_YEAR}
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
            Campus Life at UET Taxila
          </h1>
          <p className="text-base sm:text-lg text-[#a1a1aa] max-w-3xl leading-relaxed">
            Spanning over <strong>163 acres</strong> in the historic city of Taxila, UET Taxila
            provides a vibrant, supportive residential campus environment featuring modern halls of
            residence, extensive transport networks, central library resources, and sports
            facilities.
          </p>
        </header>

        {/* Section 1: Hostels & Residences */}
        <section id="hostels" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Halls of Residence (Hostels)</h2>
            <Link
              href="/learn/hostel-allotment"
              className="text-xs font-mono text-[#d9b451] hover:underline"
            >
              Allotment Rules &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {HOSTEL_HALLS.map((hall) => (
              <div
                key={hall.name}
                className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-white">{hall.name}</h3>
                  <span className="text-[10px] font-mono text-[#d9b451] uppercase bg-[#d9b451]/10 px-2 py-0.5 rounded">
                    {hall.capacity}
                  </span>
                </div>
                <p className="text-xs text-[#a1a1aa] font-medium mb-3">{hall.gender}</p>
                <p className="text-xs text-[#71717a] leading-relaxed">
                  <strong className="text-zinc-400">Amenities:</strong> {hall.amenities}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 2: Transport Network */}
        <section
          id="transport"
          className="mb-16 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-4">University Bus Transport Network</h2>
          <p className="text-sm text-[#a1a1aa] mb-6 leading-relaxed">
            For non-resident day scholars, UET Taxila operates daily dedicated buses connecting the
            campus with Islamabad, Rawalpindi, Wah Cantt, Hassan Abdal, and Attock:
          </p>

          <div className="space-y-4">
            {BUS_ROUTES.map((route) => (
              <div
                key={route.route}
                className="rounded-xl border border-white/5 bg-[#14151a] p-4 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                  <h3 className="text-sm font-semibold text-white">{route.route}</h3>
                  <span className="font-mono text-[#d9b451]">{route.frequency}</span>
                </div>
                <p className="text-[#a1a1aa] leading-relaxed">
                  <strong className="text-zinc-300">Key Stops:</strong> {route.destinations}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Section 3: Central Library & Digital Research */}
        <section id="library" className="mb-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <h2 className="text-xl font-bold text-white mb-3">Central Library &amp; Book Bank</h2>
            <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">
              The central library houses over <strong>60,000 volumes</strong> covering engineering,
              applied sciences, and computer technologies. The dedicated Book Bank service provides
              full-semester textbook loans to undergraduate students at nominal rental rates.
            </p>
            <ul className="text-xs text-zinc-300 space-y-1.5 list-disc pl-4">
              <li>High-speed digital research lab with 100+ workstations</li>
              <li>Quiet reading halls with air-conditioned study cubicles</li>
              <li>Full access to IEEE Xplore, ScienceDirect, and HEC Digital Library</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-6">
            <h2 className="text-xl font-bold text-white mb-3">Sports Complex &amp; Gymnasium</h2>
            <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">
              The Directorate of Sports maintains extensive outdoor grounds and an indoor
              multipurpose sports complex promoting physical well-being alongside academic rigor.
            </p>
            <ul className="text-xs text-zinc-300 space-y-1.5 list-disc pl-4">
              <li>International-standard cricket ground and football stadium</li>
              <li>Indoor badminton courts, table tennis, and squash courts</li>
              <li>Modern fitness gymnasium with dedicated slots for male and female students</li>
            </ul>
          </div>
        </section>

        {/* Section 4: Student Societies */}
        <section
          id="societies"
          className="mb-16 rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8"
        >
          <h2 className="text-2xl font-bold text-white mb-4">Student Societies &amp; Chapters</h2>
          <p className="text-sm text-[#a1a1aa] mb-6 leading-relaxed">
            Gain leadership experience, organize national hackathons, and connect with global
            industry leaders through our active student organizations:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-[#14151a] border border-white/5">
              <span className="font-semibold text-white block">ACM Student Chapter</span>
              <span className="text-[#a1a1aa] text-[11px]">
                Computing &amp; Coding competitions
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#14151a] border border-white/5">
              <span className="font-semibold text-white block">IEEE Student Branch</span>
              <span className="text-[#a1a1aa] text-[11px]">
                Robotics &amp; Electrical symposiums
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#14151a] border border-white/5">
              <span className="font-semibold text-white block">ASME &amp; IMechE</span>
              <span className="text-[#a1a1aa] text-[11px]">Mechanical &amp; Automotive design</span>
            </div>
            <div className="p-3 rounded-lg bg-[#14151a] border border-white/5">
              <span className="font-semibold text-white block">ICE Student Chapter</span>
              <span className="text-[#a1a1aa] text-[11px]">Civil &amp; Structural engineering</span>
            </div>
            <div className="p-3 rounded-lg bg-[#14151a] border border-white/5">
              <span className="font-semibold text-white block">Debating Society</span>
              <span className="text-[#a1a1aa] text-[11px]">
                All-Pakistan bilingual parliamentary
              </span>
            </div>
            <div className="p-3 rounded-lg bg-[#14151a] border border-white/5">
              <span className="font-semibold text-white block">Blood Donors Society</span>
              <span className="text-[#a1a1aa] text-[11px]">
                Campus healthcare &amp; emergency relief
              </span>
            </div>
          </div>
        </section>

        {/* Quick Navigation Links */}
        <section className="mb-16 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/scholarships"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Scholarships Guide &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              HEC Need-Based, Ehsaas, and alumni financial aid programs.
            </p>
          </Link>
          <Link
            href="/calculator"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Merit Calculator &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Compute your admission aggregate with the official formula.
            </p>
          </Link>
          <Link
            href="/uet-taxila/fee-structure"
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/50 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-white group-hover:text-[#d9b451] transition-colors mb-1">
              Fee Structure Breakdown &rarr;
            </h3>
            <p className="text-xs text-[#a1a1aa]">Tuition, hostel, transport, and semester dues.</p>
          </Link>
        </section>

        {/* FAQ Section */}
        <section className="border-t border-white/10 pt-12">
          <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
          <dl className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <div key={item.q} className="rounded-xl border border-white/10 bg-[#0c0d10] p-5">
                <dt className="text-base font-semibold text-white mb-2">{item.q}</dt>
                <dd className="text-sm text-[#a1a1aa] leading-relaxed">{item.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
