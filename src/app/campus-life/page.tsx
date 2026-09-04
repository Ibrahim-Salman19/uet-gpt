import type { Metadata } from "next";
import { Suspense } from "react";
import { CampusLifeHub } from "@/components/campus/campus-life-hub";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SCHEMA_DATE_MODIFIED } from "@/lib/dates";
import { BreadcrumbJsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Campus Life, Hostels, Transport & Societies | UET GPT",
  description:
    "Official campus life guide for UET Taxila: Student hostels, 25+ commuter bus route schedules, 12 registered societies, and campus telephone directory.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/campus-life",
  },
  openGraph: {
    title: "Campus Life, Hostels, Transport & Societies | UET GPT",
    description:
      "Official campus life guide for UET Taxila: Student hostels, 25+ commuter bus route schedules, 12 registered societies, and campus telephone directory.",
    url: "https://uet-gpt.vercel.app/campus-life",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
    images: [
      {
        url: "https://uet-gpt.vercel.app/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Campus Life, Hostels, Transport & Societies | UET GPT",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Campus Life, Hostels, Transport & Societies | UET GPT",
    description:
      "Official campus life guide for UET Taxila: Student hostels, 25+ commuter bus route schedules, 12 registered societies, and campus telephone directory.",
    images: ["https://uet-gpt.vercel.app/opengraph-image"],
  },
};

const campusFaqs = [
  {
    question: "Who is eligible for on-campus hostel accommodation?",
    answer:
      "Hostel accommodation is open to full-time enrolled students. Priority is given to outstation students whose domicile is outside the coverage boundaries of the university commuter bus network (beyond Islamabad, Rawalpindi, Wah Cantt, and Attock).",
  },
  {
    question: "What areas do the university commuter buses cover?",
    answer:
      "The university operates 25+ commuter bus routes covering Islamabad (Aabpara, Zero Point, Faizabad, I-8, H-8, Kashmir Highway), Rawalpindi (Saddar, Murree Road, 6th Road, Peshawar Road), Wah Cantt, Hassan Abdal, and Attock.",
  },
  {
    question: "How can students join technical and cultural societies?",
    answer:
      "Student society recruitment drives take place annually in October following freshmen orientation. Students can register for IEEE, GDG on Campus, SOFTDESK, ASME, QDLC Drama Club, or the Sports Society through departmental booths or society executive cabinets.",
  },
];

export default function CampusLifePage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    dateModified: SCHEMA_DATE_MODIFIED,
    mainEntity: campusFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Campus Life", item: "/campus-life" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <PublicNav />

      <main
        id="main-content"
        className="min-h-screen bg-[#07080a] text-white selection:bg-[#d9b451] selection:text-[#07080a]"
      >
        {/* Asymmetric High-Contrast Header */}
        <section className="border-b border-white/10 bg-[#0c0d10] py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8 space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#d9b451]/30 bg-[#d9b451]/10 px-3.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-[#d9b451]">
                  <span>PILLAR 04</span> &bull; <span>STUDENT LIFE &amp; RESIDENCE</span>
                </div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-none">
                  Campus Life &amp; Facilities
                </h1>
                <p className="text-sm sm:text-base text-[#a1a1aa] leading-relaxed max-w-2xl">
                  Explore student residential halls, university commuter bus timetables connecting
                  Islamabad and Rawalpindi, 12 registered student societies, and the official campus
                  directory.
                </p>
              </div>

              <div className="lg:col-span-4 rounded-xl border border-white/10 bg-[#14151a] p-5 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Residential Halls:</span>
                  <span className="text-white font-bold">5 Halls (1,400+ Beds)</span>
                </div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[#71717a] uppercase">Commuter Buses:</span>
                  <span className="text-emerald-400 font-bold">25+ Twin Cities Routes</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#71717a] uppercase">Student Clubs:</span>
                  <span className="text-[#d9b451] font-bold">12 Active Chapters</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Suspense
              fallback={
                <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-12 text-center text-sm font-mono text-[#a1a1aa]">
                  Loading campus life hub...
                </div>
              }
            >
              <CampusLifeHub />
            </Suspense>
          </div>
        </section>

        {/* FAQs */}
        <section className="border-t border-white/10 bg-[#0c0d10]/60 py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-mono uppercase tracking-widest text-[#d9b451] font-bold">
                Knowledge Base
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
                Frequently Asked Questions About Campus Life
              </h2>
            </div>
            <div className="space-y-4">
              {campusFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-xl border border-white/10 bg-[#07080a] p-6 hover:border-white/20 transition-colors"
                >
                  <h3 className="text-sm font-bold text-white">{faq.question}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#a1a1aa]">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
