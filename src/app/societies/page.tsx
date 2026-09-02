import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/json-ld";
import { PublicFooter } from "@/components/navigation/public-footer";
import { PublicNav } from "@/components/navigation/public-nav";
import { SOCIETIES_DATA, SocietiesDirectory } from "@/components/societies/societies-directory";

export const metadata: Metadata = {
  title: "Student Societies & Clubs at UET Taxila | UET GPT",
  description:
    "Discover active student societies at UET Taxila: IEEE, GDG on Campus, SOFTDESK, ASME, ICE, Quaid-e-Azam Debating Society, HackXila, and AutoShow events.",
  alternates: {
    canonical: "https://uet-gpt.vercel.app/societies",
  },
  openGraph: {
    title: "Student Societies & Clubs at UET Taxila | UET GPT",
    description:
      "Discover active student societies at UET Taxila: IEEE, GDG on Campus, SOFTDESK, ASME, ICE, Quaid-e-Azam Debating Society, HackXila, and AutoShow events.",
    url: "https://uet-gpt.vercel.app/societies",
    siteName: "UET GPT",
    locale: "en_PK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Student Societies & Clubs at UET Taxila | UET GPT",
    description:
      "Discover active student societies at UET Taxila: IEEE, GDG on Campus, SOFTDESK, ASME, ICE, Quaid-e-Azam Debating Society, HackXila, and AutoShow events.",
  },
};

const societiesFaqs = [
  {
    question: "How do first-year students join student societies at UET Taxila?",
    answer:
      "During the annual Freshmen Orientation and Recruitment Week (typically held in September/October), all registered societies set up information desks in their respective departments and the Student Center. Students submit membership forms and attend induction interviews.",
  },
  {
    question: "What are the premier technical engineering societies on campus?",
    answer:
      "The top technical societies include IEEE UET Taxila Student Branch (with PES, WIE, and CES chapters), GDG on Campus (Google Developer Groups), SOFTDESK in Software Engineering, ASME in Mechanical Engineering, and ICE in Civil Engineering.",
  },
  {
    question: "Which major national competitions and hackathons are hosted at UET Taxila?",
    answer:
      "Flagship events include HackXila (national software hackathon), CIVCON (national civil engineering competition), UET Taxila AutoShow, All-Pakistan Bilingual Debates 'Jirrah', SoftExpo Job Fair, and the Annual Inter-Departmental Sports Olympiad.",
  },
  {
    question: "Who oversees and approves student organizations at UET Taxila?",
    answer:
      "The Directorate of Student Affairs (DSA) oversees registration, faculty advisor appointments, event permits, budget allocations, and disciplinary adherence for all student bodies.",
  },
];

export default function SocietiesPage() {
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: societiesFaqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  const orgListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Student Societies and Extracurricular Organizations at UET Taxila",
    description:
      "Official directory of registered student societies and technical chapters at UET Taxila.",
    itemListElement: SOCIETIES_DATA.map((soc, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Organization",
        name: soc.name,
        alternateName: soc.acronym,
        description: soc.description,
        parentOrganization: {
          "@type": "EducationalOrganization",
          name: "University of Engineering and Technology, Taxila",
          url: "https://web.uettaxila.edu.pk",
        },
      },
    })),
  };

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", item: "/" },
          { name: "Campus Life", item: "/campus-life" },
          { name: "Societies", item: "/societies" },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgListSchema) }}
      />

      <PublicNav />

      <main id="main-content" className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-zinc-200/80 bg-white py-16 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                Student Life &amp; Leadership
              </span>
              <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-zinc-50">
                Student Societies &amp; Technical Chapters
              </h1>
              <p className="mt-4 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
                Explore 12+ student-led technical organizations, literary clubs, debating teams, and
                welfare bodies at UET Taxila. Join hackathons, national conferences, robotics
                trials, and creative stages.
              </p>
            </div>
          </div>
        </section>

        {/* Directory Explorer */}
        <section className="py-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SocietiesDirectory />
          </div>
        </section>

        {/* Annual Flagship Events Showcase */}
        <section className="border-t border-zinc-200/80 bg-white py-12 dark:border-zinc-800/80 dark:bg-zinc-900/50">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Campus Flagship Events Calendar
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  National Hackathon
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  HackXila by GDG
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  A 48-hour national hackathon challenging teams across Pakistan in generative AI,
                  prompt engineering, mobile app development, and cloud computing.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Engineering Convention
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  CIVCON by ICE
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Pakistan&apos;s premier civil engineering convention featuring structural bridge
                  loading tests, hydraulic design marathons, and surveying championships.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-6 dark:border-zinc-800 dark:bg-zinc-900/30">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Automotive Gala
                </span>
                <h3 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-100">
                  UET AutoShow by ASME
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Annual campus exhibition gathering 200+ modified racing cars, vintage
                  collectibles, superbikes, and mechanical project demonstrations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FAQs */}
        <section className="py-12">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Frequently Asked Questions About Societies
            </h2>
            <div className="mt-6 space-y-4">
              {societiesFaqs.map((faq) => (
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
