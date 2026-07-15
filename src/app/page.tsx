import {
  ArrowRight,
  Award,
  BookOpen,
  Coins,
  Compass,
  Database,
  GraduationCap,
  MapPin,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  APP_DESCRIPTION,
  APP_KEYWORDS,
  APP_NAME,
  APP_TAGLINE,
  DEFAULT_SUGGESTIONS,
} from "@/lib/constants";
import { JsonLd } from "@/lib/json-ld";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

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

const FAQ_ITEMS = [
  {
    q: "What is UET GPT?",
    a: "UET GPT is an AI-powered assistant that answers questions about UET Taxila — admissions, fee structure, academic programs, departments, faculty, campus life, transport, hostels, scholarships, and more. It uses RAG (Retrieval-Augmented Generation) to provide accurate answers from official university data.",
  },
  {
    q: "Is UET GPT free to use?",
    a: "Yes, UET GPT is completely free for all UET Taxila students, faculty, and prospective applicants.",
  },
  {
    q: "What can I ask UET GPT about?",
    a: "You can ask about UET Taxila admissions, BS and MS fee structures, academic programs and departments, faculty information, hostel accommodation, transport routes, scholarship opportunities, campus facilities, examination schedules, and general university information.",
  },
  {
    q: "How does UET GPT get its information?",
    a: "UET GPT uses Retrieval-Augmented Generation (RAG) to pull information from official UET Taxila documents, including the university prospectus, fee schedules, departmental pages, and admission guidelines. All answers are grounded in verified university data.",
  },
  {
    q: "Does UET GPT work for UET Lahore or other UET campuses?",
    a: "UET GPT is currently focused on UET Taxila (University of Engineering and Technology, Taxila). It has been trained on official UET Taxila data including admissions information, fee structures, academic programs, and campus facilities specific to the Taxila campus.",
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

export default function LandingPage() {
  return (
    <>
      <JsonLd />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static schema object safe for serialization
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <div className="flex min-h-screen flex-col bg-[var(--surface-base)] text-[var(--text-primary)] selection:bg-[var(--accent)] selection:text-[var(--accent-fg)] relative overflow-x-hidden">
        {/* Background Mesh Overlay & Ambient Glow */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.008)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.008)_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none -z-10" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[640px] bg-[radial-gradient(circle_at_top,rgba(202,138,4,0.08)_0%,transparent_65%)] pointer-events-none -z-10" />

        {/* Sticky Glass Navigation Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]/70 bg-[var(--surface-base)]/50 backdrop-blur-md sticky top-0 z-50 animate-[fade-in_0.3s_ease-out_both]">
          <div className="flex items-center gap-3 select-none">
            <div className="size-8 rounded-lg bg-gradient-to-br from-[var(--accent)] to-[var(--accent-hover)] flex items-center justify-center text-[var(--accent-fg)] shadow-[0_0_15px_rgba(202,138,4,0.18)]">
              <svg
                className="h-4.5 w-4.5 text-[var(--accent-fg)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-label="Logo"
              >
                <title>UET GPT Logo</title>
                <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                <path d="M6 12v5c3 3 9 3 12 0v-5" />
              </svg>
            </div>
            <span className="font-semibold text-base font-mono tracking-tight">{APP_NAME}</span>
          </div>
          <nav className="flex items-center gap-5">
            <Link
              href="/sign-in"
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors font-mono font-medium tracking-wider uppercase"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="text-[10px] px-3.5 py-2 rounded bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] transition-all font-mono font-bold tracking-widest uppercase active:scale-[0.97] shadow-[0_2px_10px_rgba(202,138,4,0.12)]"
            >
              Get Started
            </Link>
          </nav>
        </header>

        <main id="main-content" className="flex-1">
          {/* Hero Section */}
          <section className="px-6 pt-28 pb-20 max-w-4xl mx-auto text-center relative animate-[slide-up_0.5s_ease-out_both]">
            {/* AI Platform Chip */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[var(--accent)]/20 bg-[var(--accent)]/5 text-[var(--accent)] font-mono text-[9px] uppercase tracking-[0.2em] mb-6">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]"></span>
              </span>
              {"UET Taxila Platform // Online"}
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-5 leading-none">
              {APP_NAME}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] mt-2 font-black">
                {APP_TAGLINE}
              </span>
            </h1>
            <p className="text-sm md:text-base text-[var(--text-secondary)] max-w-2xl mx-auto mb-10 leading-relaxed font-sans font-medium">
              {APP_DESCRIPTION}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/sign-up"
                className="group w-full sm:w-auto px-6 py-3.5 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] font-bold hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all text-[11px] font-mono tracking-widest uppercase shadow-[0_4px_15px_rgba(202,138,4,0.22)] flex items-center justify-center gap-2"
              >
                <span>Start Asking Questions</span>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/sign-in"
                className="w-full sm:w-auto px-6 py-3.5 rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]/30 active:scale-[0.98] transition-all text-[11px] font-mono tracking-widest uppercase"
              >
                Sign In
              </Link>
            </div>
          </section>

          {/* About Section */}
          <section className="px-6 py-16 max-w-4xl mx-auto border-t border-[var(--border)]/30 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(202,138,4,0.035)_0%,transparent_70%)] pointer-events-none -z-10" />

            <h2 className="text-xl md:text-2xl font-bold text-center mb-2 tracking-tight text-[var(--text-primary)] font-mono uppercase">
              [ UET TAXILA OVERVIEW ]
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[9px]">
              The campus, the history, and the AI guide built for it
            </p>
            <div className="space-y-4">
              <div className="group p-6 rounded-xl border border-[var(--border)]/75 bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-7 w-7 rounded bg-[var(--accent)]/5 flex items-center justify-center border border-[var(--accent)]/10 text-[var(--accent)]">
                    <Compass className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-base text-[var(--text-primary)] font-sans">
                    What is UET Taxila?
                  </h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans pl-9">
                  UET stands for the University of Engineering and Technology. UET Taxila — the
                  University of Engineering and Technology, Taxila — is one of Pakistan&apos;s
                  leading public engineering universities, located in Taxila, Punjab. Established as
                  a constituent college of UET Lahore in 1975, UET Taxila became an independent,
                  chartered university in 1993 and today enrolls more than 5,500 undergraduate and
                  postgraduate students across 14 departments.
                </p>
              </div>

              <div className="group p-6 rounded-xl border border-[var(--border)]/75 bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-7 w-7 rounded bg-[var(--accent)]/5 flex items-center justify-center border border-[var(--accent)]/10 text-[var(--accent)]">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-base text-[var(--text-primary)] font-sans">
                    Programs and campuses at UET Taxila
                  </h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans pl-9">
                  UET Taxila offers a wide range of BS, MS, and PhD programs through six faculties —
                  Civil and Environmental Engineering, Electronics and Electrical Engineering,
                  Mechanical and Aeronautical Engineering, Industrial Engineering, Telecommunication
                  and Information Engineering, and Basic Sciences and Humanities. From Civil and
                  Mechanical Engineering to Computer Science, Software, and Telecommunication
                  Engineering, UET Taxila prepares engineers for Pakistan&apos;s growing industrial
                  corridor near Taxila, Wah, and Islamabad.
                </p>
              </div>

              <div className="group p-6 rounded-xl border border-[var(--border)]/75 bg-[var(--surface-card)]/40 backdrop-blur-sm hover:border-[var(--accent)]/15 transition-all">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="h-7 w-7 rounded bg-[var(--accent)]/5 flex items-center justify-center border border-[var(--accent)]/10 text-[var(--accent)]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-base text-[var(--text-primary)] font-sans">
                    UET GPT — your AI guide to UET Taxila
                  </h3>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed font-sans pl-9">
                  UET GPT is the intelligent, AI-powered guide to UET Taxila. Whether you are a
                  prospective applicant, a current student, or a faculty member, UET GPT answers
                  questions about UET Taxila admissions, fee structures, departments, faculty,
                  hostels, transport, and scholarships — grounded in official university data.{" "}
                  <Link
                    href="/uet-taxila"
                    className="text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors underline font-medium"
                  >
                    Learn more about UET Taxila
                  </Link>
                  .
                </p>
              </div>
            </div>
          </section>

          {/* Features Grid Section */}
          <section className="px-6 py-16 max-w-5xl mx-auto border-t border-[var(--border)]/30">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-2 tracking-tight text-[var(--text-primary)] font-mono uppercase">
              [ KNOWLEDGE DOMAINS ]
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-10 font-mono uppercase tracking-wider text-[9px]">
              Explore everything you need to know about the institution
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: "Admissions",
                  desc: "BS & MS admission schedules, eligibility criteria, merit lists, and application procedures for UET Taxila.",
                  icon: <GraduationCap className="h-5 w-5 text-[var(--accent)]" />,
                },
                {
                  title: "Fee Structure",
                  desc: "Complete fee breakdowns for all BS and MS programs at UET Taxila, including semester fees and hostel charges.",
                  icon: <Coins className="h-5 w-5 text-[var(--accent)]" />,
                },
                {
                  title: "Academic Programs",
                  desc: "Explore all engineering, computer science, and technology programs offered at UET Taxila's departments.",
                  icon: <BookOpen className="h-5 w-5 text-[var(--accent)]" />,
                },
                {
                  title: "Departments & Faculty",
                  desc: "Information about UET Taxila departments, faculty members, research areas, and departmental facilities.",
                  icon: <Database className="h-5 w-5 text-[var(--accent)]" />,
                },
                {
                  title: "Campus Life",
                  desc: "Hostel accommodation, transport routes, sports facilities, student societies, and campus events at UET Taxila.",
                  icon: <MapPin className="h-5 w-5 text-[var(--accent)]" />,
                },
                {
                  title: "Scholarships",
                  desc: "Available scholarships, financial aid programs, and eligibility criteria for UET Taxila students.",
                  icon: <Award className="h-5 w-5 text-[var(--accent)]" />,
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 hover:border-[var(--accent)]/20 hover:bg-[var(--surface-card)]/50 transition-all duration-300 group"
                >
                  <div className="h-9 w-9 rounded-lg bg-[var(--accent)]/5 flex items-center justify-center border border-[var(--accent)]/10 text-[var(--accent)] mb-4 group-hover:scale-105 transition-transform duration-300">
                    {f.icon}
                  </div>
                  <h3 className="font-semibold text-base mb-2 text-[var(--text-primary)] font-sans">
                    {f.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] font-sans leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Suggestions Chips Section */}
          <section className="px-6 py-16 max-w-3xl mx-auto border-t border-[var(--border)]/30">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-2 tracking-tight text-[var(--text-primary)] font-mono uppercase">
              [ LIVE INTERFACE PREVIEW ]
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-8 font-sans">
              Sign in to get instant, authenticated answers about UET Taxila
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {DEFAULT_SUGGESTIONS.map((s) => (
                <Link
                  key={s.prompt}
                  href="/sign-up"
                  className="group flex flex-col items-start p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/25 hover:border-[var(--accent)]/30 hover:bg-[var(--surface-card)]/40 hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-[var(--accent)]/80 font-semibold">
                      {s.label}
                    </span>
                    <span className="text-[9px] text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors font-mono tracking-wider">
                      {"ASK //"}
                    </span>
                  </div>
                  <span className="text-xs md:text-sm text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors font-sans leading-relaxed text-left">
                    &ldquo;{s.prompt}&rdquo;
                  </span>
                </Link>
              ))}
            </div>
          </section>

          {/* FAQ Accordion Section */}
          <section className="px-6 py-16 max-w-3xl mx-auto border-t border-[var(--border)]/30">
            <h2 className="text-xl md:text-2xl font-bold text-center mb-2 tracking-tight text-[var(--text-primary)] font-mono uppercase">
              [ FAQ ]
            </h2>
            <p className="text-[var(--text-secondary)] text-sm text-center mb-8 font-mono uppercase tracking-wider text-[9px]">
              Answers to common queries
            </p>
            <div className="space-y-4">
              {FAQ_ITEMS.map((faq) => (
                <details
                  key={faq.q}
                  className="group p-4 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]/30 [&_summary::-webkit-details-marker]:hidden transition-all duration-300"
                >
                  <summary className="flex items-center justify-between font-semibold text-sm cursor-pointer text-[var(--text-primary)] select-none">
                    <span>{faq.q}</span>
                    <span className="text-[var(--text-secondary)] transition-transform duration-300 group-open:rotate-180 font-mono text-xs">
                      ▼
                    </span>
                  </summary>
                  <p className="mt-3 text-sm text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border)]/30 pt-3 font-sans">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] px-6 py-8 bg-[var(--surface-base)] text-[var(--text-secondary)] font-mono text-xs">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <p>&copy; {new Date().getFullYear()} UET GPT Team. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">
                Home
              </Link>
              <Link href="/chat" className="hover:text-[var(--text-primary)] transition-colors">
                Chat
              </Link>
              <Link href="/explore" className="hover:text-[var(--text-primary)] transition-colors">
                Explore
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
