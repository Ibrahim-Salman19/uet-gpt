import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { BusRoutesExplorer } from "@/components/transport/bus-routes-explorer";

export const metadata: Metadata = {
  title: "UET Taxila Bus Routes & Schedule | Commuter Fleet",
  description:
    "Explore UET Taxila official commuter bus routes, morning timings, pickup stops across Islamabad, Rawalpindi, Wah Cantt, Attock, and registration steps.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/bus-routes",
  },
  openGraph: {
    title: "UET Taxila Bus Routes & Schedule | Commuter Fleet",
    description:
      "Explore UET Taxila official commuter bus routes, morning timings, pickup stops across Islamabad, Rawalpindi, Wah Cantt, Attock, and registration steps.",
    url: "https://uet-gpt.vercel.app/bus-routes",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "UET Taxila Bus Routes & Schedule | Commuter Fleet",
    description:
      "Explore UET Taxila official commuter bus routes, morning timings, pickup stops across Islamabad, Rawalpindi, Wah Cantt, Attock, and registration steps.",
  },
};

const busFaqs = [
  {
    question: "Which cities are covered by UET Taxila commuter buses?",
    answer:
      "The university maintains 25+ daily commuter buses servicing Islamabad (Aabpara, Zero Point, F/G Sectors, Faizabad, I-8, H-8), Rawalpindi (Saddar, Cantt, 6th Road, Chandni Chowk, Peshawar Road, Chur Chowk), Wah Cantt (POF colonies, Barrier 3, Basti Chowk), Hassan Abdal, and Attock.",
  },
  {
    question: "What time do morning commuter buses depart?",
    answer:
      "Morning buses depart between 06:40 AM and 07:15 AM depending on the distance of the initial waypoint, arriving at the Taxila campus by 07:45 AM ahead of 08:00 AM lectures.",
  },
  {
    question: "How do students register for university bus transport?",
    answer:
      "Students submit a transport registration data form at the Transport Section office near the Mechanical Workshop along with the bank fee clearance voucher for the semester transport card.",
  },
  {
    question: "What is the contact number for the UET Taxila Transport Section?",
    answer:
      "The Transport Office can be reached directly at +92 51-9047469 or via the main university PBX exchange at +92 51-9047400 ext. 469.",
  },
];

export default function BusRoutesPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: busFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const transitSchema = {
    "@context": "https://schema.org",
    "@type": "BusTrip",
    busName: "UET Taxila Student Commuter Service",
    provider: {
      "@type": "EducationalOrganization",
      name: "University of Engineering and Technology, Taxila",
      url: "https://web.uettaxila.edu.pk",
    },
    departureStation: {
      "@type": "BusStation",
      name: "Twin Cities Commuter Terminals (Islamabad / Rawalpindi / Wah)",
    },
    arrivalStation: {
      "@type": "BusStation",
      name: "UET Taxila Campus Bus Terminal",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Taxila",
        addressRegion: "Punjab",
        addressCountry: "PK",
      },
    },
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Campus Life", item: "/campus-life" },
          { name: "Bus Routes", item: "/bus-routes" },
        ]}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema
        dangerouslySetInnerHTML={{ __html: JSON.stringify(transitSchema) }}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white py-16 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Official Transport Guide
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-zinc-50">
                UET Taxila Bus Routes &amp; Schedule
              </h1>
              <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                Complete route maps, morning departure timings, waypoint stops, and registration
                procedures for the 25+ university commuter buses connecting Islamabad, Rawalpindi,
                Wah Cantt, Hassan Abdal, and Attock.
              </p>
            </div>
          </div>
        </section>

        {/* Interactive Explorer */}
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <BusRoutesExplorer />
          </div>
        </section>

        {/* Transport Guidelines & Registration */}
        <section className="border-t border-zinc-200/80 bg-white py-12 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Bus Registration &amp; Transport Guidelines
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Step 1
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Collect Transport Form
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Obtain the student bus registration card application from the Transport Section
                  office adjacent to the university mechanical workshops.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Step 2
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Deposit Semester Dues
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Pay the subsidized per-semester transport fee via the designated bank challan at
                  HBL UET Taxila Branch and attach the paid deposit slip.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  Step 3
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Receive Bus Pass
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Submit the verified form with passport photos to receive your holographic RFID bus
                  pass, valid for daily boarding across all twin-city points.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Frequently Asked Questions About Transport
            </h2>
            <div className="mt-6 space-y-4">
              {busFaqs.map((faq) => (
                <div
                  key={faq.question}
                  className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60"
                >
                  <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                    {faq.question}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link
                href="/campus-life"
                className="inline-flex items-center text-sm font-semibold text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
              >
                &larr; Back to Campus Life, Hostels &amp; Facilities
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </>
  );
}
