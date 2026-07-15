import type { Metadata } from "next";
import Link from "next/link";
import { APP_DESCRIPTION, APP_KEYWORDS, APP_NAME, APP_TAGLINE, DEFAULT_SUGGESTIONS } from "@/lib/constants";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  keywords: APP_KEYWORDS,
  openGraph: {
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
    url: siteUrl,
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is UET GPT?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "UET GPT is an AI-powered assistant that answers questions about UET Taxila — admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more. It uses RAG (Retrieval-Augmented Generation) to provide accurate answers from official university data.",
      },
    },
    {
      "@type": "Question",
      name: "Is UET GPT free to use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, UET GPT is completely free for all UET Taxila students, faculty, and prospective applicants.",
      },
    },
    {
      "@type": "Question",
      name: "What can I ask UET GPT about?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can ask about UET Taxila admissions, BS and MS fee structures, academic programs and departments, faculty information, hostel accommodation, transport routes, scholarship opportunities, campus facilities, examination schedules, and general university information.",
      },
    },
    {
      "@type": "Question",
      name: "How does UET GPT get its information?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "UET GPT uses Retrieval-Augmented Generation (RAG) to pull information from official UET Taxila documents, including the university prospectus, fee schedules, departmental pages, and admission guidelines. All answers are grounded in verified university data.",
      },
    },
    {
      "@type": "Question",
      name: "Does UET GPT work for UET Lahore or other UET campuses?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "UET GPT is currently focused on UET Taxila (University of Engineering and Technology, Taxila). It has been trained on official UET Taxila data including admissions information, fee structures, academic programs, and campus facilities specific to the Taxila campus.",
      },
    },
  ],
};

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex min-h-screen flex-col bg-[#070708] text-[#e1e1e2]">
        <header className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1e]">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-bold text-sm">
              U
            </div>
            <span className="font-semibold text-base">{APP_NAME}</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <main className="flex-1">
          <section className="px-6 pt-24 pb-16 max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              {APP_NAME}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
                {APP_TAGLINE}
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              {APP_DESCRIPTION}
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
              >
                Start Asking Questions
              </Link>
              <Link
                href="/sign-in"
                className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base"
              >
                Sign In
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-12">
              Everything You Need to Know About UET Taxila
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: "Admissions", desc: "BS & MS admission schedules, eligibility criteria, merit lists, and application procedures for UET Taxila." },
                { title: "Fee Structure", desc: "Complete fee breakdowns for all BS and MS programs at UET Taxila, including semester fees and hostel charges." },
                { title: "Academic Programs", desc: "Explore all engineering, computer science, and technology programs offered at UET Taxila's departments." },
                { title: "Departments & Faculty", desc: "Information about UET Taxila departments, faculty members, research areas, and departmental facilities." },
                { title: "Campus Life", desc: "Hostel accommodation, transport routes, sports facilities, student societies, and campus events at UET Taxila." },
                { title: "Scholarships", desc: "Available scholarships, financial aid programs, and eligibility criteria for UET Taxila students." },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-[#a1a1aa]">{f.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Try Asking UET GPT
            </h2>
            <p className="text-[#a1a1aa] text-center mb-8">
              Sign in to get instant answers about UET Taxila
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DEFAULT_SUGGESTIONS.map((s) => (
                <Link
                  key={s.prompt}
                  href={`/sign-up`}
                  className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] text-sm text-[#a1a1aa] hover:border-[#6366f1] hover:text-[#e1e1e2] transition-colors"
                >
                  {s.prompt}
                </Link>
              ))}
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4 mt-8">
              {[
                { q: "What is UET GPT?", a: "UET GPT is an AI-powered assistant that answers questions about UET Taxila — admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more. It uses RAG (Retrieval-Augmented Generation) to provide accurate answers from official university data." },
                { q: "Is UET GPT free?", a: "Yes, UET GPT is completely free for all UET Taxila students, faculty, and prospective applicants." },
                { q: "What can I ask about?", a: "Admissions, BS/MS fee structures, academic programs, departments, faculty, hostel accommodation, transport, scholarships, campus facilities, examination schedules, and more." },
                { q: "How does UET GPT get its information?", a: "UET GPT uses RAG to pull information from official UET Taxila documents including the prospectus, fee schedules, departmental pages, and admission guidelines." },
                { q: "Does it work for other UET campuses?", a: "Currently focused on UET Taxila. It has been trained on official UET Taxila data including admissions, fee structures, programs, and facilities specific to the Taxila campus." },
              ].map((faq) => (
                <details
                  key={faq.q}
                  className="p-4 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]"
                >
                  <summary className="font-medium text-sm cursor-pointer">
                    {faq.q}
                  </summary>
                  <p className="mt-3 text-sm text-[#a1a1aa]">{faq.a}</p>
                </details>
              ))}
            </div>
          </section>
        </main>

        <footer className="border-t border-[#1a1a1e] px-6 py-8">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[#a1a1aa]">
              &copy; {new Date().getFullYear()} UET GPT Team. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-[#a1a1aa]">
              <Link href="/" className="hover:text-[#e1e1e2] transition-colors">
                Home
              </Link>
              <Link href="/chat" className="hover:text-[#e1e1e2] transition-colors">
                Chat
              </Link>
              <Link href="/explore" className="hover:text-[#e1e1e2] transition-colors">
                Explore
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
