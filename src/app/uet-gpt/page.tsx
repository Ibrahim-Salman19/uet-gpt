import type { Metadata } from "next";
import Link from "next/link";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const metadata: Metadata = {
  title: "UET GPT — AI Guide to UET Taxila",
  description:
    "UET GPT is the AI guide to UET Taxila, built for students of the University of Engineering and Technology, Taxila. Ask about admissions, ECAT, merit, fees, departments, and campus life — grounded in official UET Taxila data.",
  alternates: {
    canonical: `${siteUrl}/uet-gpt`,
  },
  openGraph: {
    title: "UET GPT — AI Guide to UET Taxila",
    description:
      "UET GPT is the AI guide to UET Taxila, built for students of the University of Engineering and Technology, Taxila. Ask about admissions, ECAT, merit, fees, and campus life.",
    url: `${siteUrl}/uet-gpt`,
    type: "website",
  },
};

const FAQ_ITEMS = [
  {
    q: "What is UET GPT?",
    a: "UET GPT is the AI guide to UET Taxila — an open-source chatbot built for the students, faculty, and prospective applicants of the University of Engineering and Technology, Taxila (UET Taxila) in Pakistan. It answers questions about admissions, ECAT, merit, fee structures, departments, faculty, hostels, transport, scholarships, and campus life using Retrieval-Augmented Generation over official university data. It is a student-built project and is not affiliated with, endorsed by, or operated by the official UET Taxila or the University of Engineering and Technology.",
  },
  {
    q: "Is UET GPT affiliated with the official UET Taxila or the University of Engineering and Technology?",
    a: "No. UET GPT is an independent, open-source project created by students. It is not affiliated with, officially connected to, or endorsed by the University of Engineering and Technology, Taxila, or any campus of the University of Engineering and Technology. The name \"UET GPT\" refers to this community-built guide, and it should not be confused with official university websites, portals, or announcements.",
  },
  {
    q: "How does UET GPT work?",
    a: "UET GPT uses Retrieval-Augmented Generation (RAG). When you ask a question, it retrieves the most relevant passages from a curated knowledge base built from official UET Taxila sources — including admissions policies, fee schedules, department pages, and notices — and then generates a clear, sourced answer grounded in that retrieved content. This keeps answers accurate and reduces hallucination compared with a general-purpose model answering from memory.",
  },
  {
    q: "What can I ask UET GPT?",
    a: "You can ask about undergraduate and graduate admissions at UET Taxila, the ECAT entry test, how merit is calculated, BS and MS fee breakdowns, the 14 departments and six faculties, research areas, hostel allotment, transport routes, scholarships, the central library, and student societies and campus life. If a detail is not present in the official sources, UET GPT will tell you rather than guess.",
  },
  {
    q: "Where can I find the UET GPT source code?",
    a: "UET GPT is open source. The project lives on GitHub at https://github.com/devhms/uet_gpt, where you can read the code, report issues, suggest improvements, or contribute. The live app is available at https://uet-gpt.vercel.app.",
  },
  {
    q: "Is UET GPT free to use?",
    a: "Yes. UET GPT is free for all UET Taxila students, faculty, and prospective applicants. It is a community resource maintained by volunteers and released as open-source software under its repository license.",
  },
] as const;

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function UetGptPage() {
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
            <span className="font-semibold text-base">UET GPT</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-[#a1a1aa] hover:text-[#e1e1e2] transition-colors"
            >
              UET GPT Home
            </Link>
            <Link
              href="/sign-up"
              className="text-sm px-4 py-2 rounded-lg bg-[#6366f1] text-white hover:bg-[#5558e6] transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          <section className="px-6 pt-24 pb-16 max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              UET GPT
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#6366f1] to-[#a78bfa]">
                The AI Guide to UET Taxila
              </span>
            </h1>
            <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-8">
              UET GPT is an open-source AI chatbot built for the students, faculty,
              and prospective applicants of the University of Engineering and
              Technology, Taxila. Ask anything about UET Taxila and get clear,
              sourced answers.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-[#6366f1] text-white font-medium hover:bg-[#5558e6] transition-colors text-base"
              >
                Ask UET GPT
              </Link>
              <Link
                href="/uet-taxila"
                className="px-6 py-3 rounded-xl border border-[#27272a] text-[#a1a1aa] hover:text-[#e1e1e2] hover:border-[#3f3f46] transition-colors text-base"
              >
                Guide to UET Taxila
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              What is UET GPT?
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              A student-built assistant that turns official UET Taxila information
              into instant, conversational answers
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  The AI guide to UET Taxila
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET GPT is an AI chatbot designed specifically for the University
                  of Engineering and Technology, Taxila (UET Taxila), a public
                  engineering university in Taxila, Punjab, Pakistan. Unlike a
                  general-purpose assistant, UET GPT is focused entirely on UET
                  Taxila: its admissions, academics, fees, campus services, and
                  student life. Whether you are a first-year student trying to
                  understand your fee voucher or a prospective applicant comparing
                  engineering disciplines, UET GPT gives you a single place to ask.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Built for students, not by the university
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET GPT is an independent, community project created by students
                  who wanted faster, clearer access to UET Taxila information. It
                  is not affiliated with, endorsed by, or operated by the official
                  University of Engineering and Technology, Taxila. It is offered
                  as a helpful companion that points you to the right official
                  sources — never a replacement for them.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  Grounded, not guessing
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  The goal of UET GPT is accurate, trustworthy answers. Instead of
                  generating replies purely from a model&apos;s memory, UET GPT
                  grounds its responses in retrieved official documents, so you can
                  rely on what it tells you about deadlines, eligibility, and
                  procedures.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              How UET GPT Works
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Retrieval-Augmented Generation over official UET Taxila data
            </p>
            <div className="space-y-4">
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  1. Curated knowledge from official sources
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  UET GPT builds its knowledge base from official UET Taxila
                  material — admissions policies, ECAT and merit guidance, fee
                  schedules, department and faculty pages, notices, and campus
                  service information. Content is structured and indexed so the
                  right passage can be found quickly.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  2. Retrieval-Augmented Generation (RAG)
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  When you ask a question, UET GPT first retrieves the most
                  relevant passages from its knowledge base, then generates a
                  response based only on that retrieved context. This retrieval
                  step is what keeps answers tied to official UET Taxila data and
                  reduces hallucination.
                </p>
              </div>
              <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
                <h3 className="font-semibold text-base mb-2">
                  3. Clear, conversational answers
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  The result is a plain-language answer you can act on — and when a
                  detail is not covered by the official sources, UET GPT is
                  designed to say so rather than invent an answer. That honesty is
                  central to how UET GPT is meant to be used.
                </p>
              </div>
            </div>
          </section>

          <section className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-12">
              Key Features of UET GPT
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Admissions & ECAT",
                  desc: "Ask about UET Taxila ECAT, eligibility, merit lists, schedules, and seat allocation in plain language.",
                },
                {
                  title: "Fee Structure",
                  desc: "Understand BS and MS fee breakdowns, hostel charges, and dues — grounded in official UET Taxila records.",
                },
                {
                  title: "Departments & Faculty",
                  desc: "Explore UET Taxila's 14 departments and six faculties, research areas, and program details before you choose.",
                },
                {
                  title: "Campus Life",
                  desc: "Find hostel allotment, transport routes, scholarships, the central library, and student societies at UET Taxila.",
                },
                {
                  title: "Grounded Answers",
                  desc: "UET GPT uses Retrieval-Augmented Generation over official UET Taxila documents, so replies stay accurate.",
                },
                {
                  title: "Open Source",
                  desc: "UET GPT is open-source on GitHub at devhms/uet_gpt — read the code, report issues, or contribute.",
                },
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

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Open Source & Community
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              UET GPT is free, transparent, and built in the open
            </p>
            <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
              <p className="text-sm text-[#a1a1aa]">
                UET GPT is released as open-source software. The full source code,
                issue tracker, and contribution guidelines are available on GitHub
                at{" "}
                <Link
                  href="https://github.com/devhms/uet_gpt"
                  className="text-[#6366f1] hover:text-[#8b5cf6] transition-colors underline"
                >
                  github.com/devhms/uet_gpt
                </Link>
                . The live app runs at{" "}
                <Link
                  href="/"
                  className="text-[#6366f1] hover:text-[#8b5cf6] transition-colors underline"
                >
                  uet-gpt.vercel.app
                </Link>
                . Because the project is student-built and community-maintained,
                anyone can suggest improvements, report inaccuracies, or help
                expand coverage of UET Taxila topics.
              </p>
            </div>
          </section>

          <section className="px-6 py-16 max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Not Affiliated With the Official UET
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              An important distinction for anyone searching for &quot;UET GPT&quot;
            </p>
            <div className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f]">
              <p className="text-sm text-[#a1a1aa]">
                UET GPT is an independent project and is{" "}
                <span className="text-[#e1e1e2] font-medium">
                  not affiliated with, endorsed by, or operated by
                </span>{" "}
                the University of Engineering and Technology, Taxila, or any campus
                of the University of Engineering and Technology. The name
                &quot;UET GPT&quot; refers specifically to this open-source
                guide. It is not an official university portal, and for binding,
                authoritative decisions — admissions results, fee deadlines, and
                official notices — you should always consult the official UET
                Taxila channels. UET GPT is a helpful companion that points you to
                the right official sources.
              </p>
            </div>
          </section>

          <section className="px-6 py-16 max-w-5xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Explore UET Taxila with UET GPT
            </h2>
            <p className="text-[#a1a1aa] text-center mb-12 max-w-3xl mx-auto">
              Start asking, or read the broader guide to the university
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                href="/"
                className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#3f3f46] transition-colors"
              >
                <h3 className="font-semibold text-base mb-2 text-[#e1e1e2]">
                  UET GPT Home
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Open the chatbot and start asking questions about UET Taxila
                  admissions, fees, departments, and campus life.
                </p>
              </Link>
              <Link
                href="/uet-taxila"
                className="p-6 rounded-xl border border-[#1a1a1e] bg-[#0c0c0f] hover:border-[#3f3f46] transition-colors"
              >
                <h3 className="font-semibold text-base mb-2 text-[#e1e1e2]">
                  Guide to UET Taxila
                </h3>
                <p className="text-sm text-[#a1a1aa]">
                  Read the authoritative, AI-grounded guide to UET Taxila — its
                  history, campuses, faculties, departments, and admissions.
                </p>
              </Link>
            </div>
          </section>

          <section className="px-6 py-16 max-w-3xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-4">
              Frequently Asked Questions about UET GPT
            </h2>
            <div className="space-y-4 mt-8">
              {FAQ_ITEMS.map((faq) => (
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
                UET GPT Home
              </Link>
              <Link
                href="/uet-taxila"
                className="hover:text-[#e1e1e2] transition-colors"
              >
                UET Taxila
              </Link>
              <Link
                href="https://github.com/devhms/uet_gpt"
                className="hover:text-[#e1e1e2] transition-colors"
              >
                GitHub
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
