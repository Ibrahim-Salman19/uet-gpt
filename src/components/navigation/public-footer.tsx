import Link from "next/link";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/dates";

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#07080a] text-xs text-[#a1a1aa] transition-colors">
      {/* Top Banner: Quick AI CTA */}
      <div className="border-b border-white/5 bg-gradient-to-r from-[#d9b451]/10 via-[#07080a] to-[#d9b451]/5 py-6 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div>
            <span className="font-semibold text-white text-sm">
              Have a question about UET Taxila admissions or campus life?
            </span>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              UET GPT answers questions in real-time with official university source citations.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-lg bg-[#d9b451] px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-colors shadow-md shadow-[#d9b451]/10 min-h-[40px]"
          >
            <span>Ask AI Assistant</span>
            <span>&rarr;</span>
          </Link>
        </div>
      </div>

      {/* Main Multi-Column Link Directory */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-5">
          {/* Column 1: Engineering Tools */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Engineering Tools
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/tools"
                  className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 text-[#d9b451]"
                >
                  <span>Tools Suite Hub</span>
                  <span className="rounded bg-[#d9b451]/20 px-1 py-0.2 text-[9px] font-bold">
                    4-in-1
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/tools?tab=merit"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Merit Calculator (PEC)
                </Link>
              </li>
              <li>
                <Link
                  href="/tools?tab=gpa"
                  className="hover:text-white hover:underline transition-colors"
                >
                  GPA &amp; CGPA Simulator
                </Link>
              </li>
              <li>
                <Link
                  href="/tools?tab=archive"
                  className="hover:text-white hover:underline transition-colors"
                >
                  5-Yr Closing Merit Archive
                </Link>
              </li>
              <li>
                <Link
                  href="/tools?tab=scholarships"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Scholarship Eligibility Screener
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Academics */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Academics &amp; Syllabi
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/academics"
                  className="hover:text-white hover:underline transition-colors text-[#d9b451]"
                >
                  Academics Hub
                </Link>
              </li>
              <li>
                <Link
                  href="/academics?tab=programs"
                  className="hover:text-white hover:underline transition-colors"
                >
                  14 Degree Curriculums
                </Link>
              </li>
              <li>
                <Link
                  href="/academics?tab=calendar"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Academic Calendar {CURRENT_ACADEMIC_YEAR}
                </Link>
              </li>
              <li>
                <Link
                  href="/academics?tab=resources"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Past Papers &amp; OBE Grading
                </Link>
              </li>
              <li>
                <Link
                  href="/uet-taxila/programs/computer-science"
                  className="hover:text-white hover:underline transition-colors"
                >
                  BS Computer Science Roadmap
                </Link>
              </li>
              <li>
                <Link
                  href="/uet-taxila/programs/software-engineering"
                  className="hover:text-white hover:underline transition-colors"
                >
                  BS Software Engineering Roadmap
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Admissions & Aid */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Admissions &amp; Aid
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/admissions"
                  className="hover:text-white hover:underline transition-colors text-[#d9b451]"
                >
                  Admissions Hub {CURRENT_ACADEMIC_YEAR}
                </Link>
              </li>
              <li>
                <Link
                  href="/admissions?tab=overview"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Eligibility Criteria &amp; Quotas
                </Link>
              </li>
              <li>
                <Link
                  href="/admissions?tab=ecat"
                  className="hover:text-white hover:underline transition-colors"
                >
                  ECAT 2026 Strategy Blueprint
                </Link>
              </li>
              <li>
                <Link
                  href="/admissions?tab=fees"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Fee Structure &amp; Simulator
                </Link>
              </li>
              <li>
                <Link
                  href="/admissions?tab=scholarships"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Financial Aid Programs
                </Link>
              </li>
              <li>
                <Link
                  href="/admissions?tab=compare"
                  className="hover:text-white hover:underline transition-colors"
                >
                  University Comparison Matrix
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Campus Life */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Campus Life
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/campus-life"
                  className="hover:text-white hover:underline transition-colors text-[#d9b451]"
                >
                  Campus Life Hub
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life?tab=hostels"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Residential Halls &amp; Hostels
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life?tab=transport"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Bus Routes &amp; Fleet Schedules
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life?tab=societies"
                  className="hover:text-white hover:underline transition-colors"
                >
                  12 Student Societies &amp; Clubs
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life?tab=directory"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Campus Directory Phonebook
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Knowledge, Legal & Trust */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Knowledge &amp; Trust
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/learn" className="hover:text-white hover:underline transition-colors">
                  Taxila Glossary Index
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-white hover:underline transition-colors">
                  Founder &amp; Mission
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Contact &amp; Feedback
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white hover:underline transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a
                  href="/llms.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors"
                >
                  llms.txt (AI Index)
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Status, Copyright & Disclaimer */}
        <div className="mt-12 border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px]">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <p className="font-mono">
              &copy; {new Date().getFullYear()} UET GPT Community. Open source under GNU AGPL-3.0.
            </p>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-emerald-400">
                RAG Corpus Synced {CURRENT_ACADEMIC_YEAR}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[#71717a]">
            <a
              href="https://github.com/Ibrahim-Salman19/uet-gpt"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Repository
            </a>
            <span>&bull;</span>
            <span>Created by Ibrahim Salman</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
