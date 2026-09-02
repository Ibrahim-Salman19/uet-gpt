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
          {/* Column 1: Admissions & Tools */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Admissions &amp; Tools
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/calculator"
                  className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 text-[#d9b451]"
                >
                  <span>Merit Calculator</span>
                  <span className="rounded bg-[#d9b451]/20 px-1 py-0.2 text-[9px] font-bold">
                    Tool
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/gpa-calculator"
                  className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 text-[#d9b451]"
                >
                  <span>GPA &amp; CGPA Calculator</span>
                  <span className="rounded bg-[#d9b451]/20 px-1 py-0.2 text-[9px] font-bold">
                    New
                  </span>
                </Link>
              </li>
              <li>
                <Link
                  href="/compare"
                  className="hover:text-white hover:underline transition-colors flex items-center gap-1.5 text-white"
                >
                  <span>University Comparison</span>
                </Link>
              </li>
              <li>
                <Link
                  href="/ecat-guide"
                  className="hover:text-white hover:underline transition-colors"
                >
                  ECAT 2026 Strategy Guide
                </Link>
              </li>
              <li>
                <Link
                  href="/uet-taxila/admissions"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Admissions Guide {CURRENT_ACADEMIC_YEAR}
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/merit-formula"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Merit Formula Breakdown
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/eligibility-criteria"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Eligibility Criteria (60%/50%)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Academics & Fees */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Academics &amp; Fees
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/uet-taxila/programs"
                  className="hover:text-white hover:underline transition-colors"
                >
                  14 Degree Programs
                </Link>
              </li>
              <li>
                <Link
                  href="/uet-taxila/fee-structure"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Fee Structure {CURRENT_ACADEMIC_YEAR}
                </Link>
              </li>
              <li>
                <Link
                  href="/scholarships"
                  className="hover:text-white hover:underline transition-colors text-[#d9b451]"
                >
                  Scholarships &amp; Financial Aid
                </Link>
              </li>
              <li>
                <Link
                  href="/uet-taxila"
                  className="hover:text-white hover:underline transition-colors"
                >
                  6 Academic Faculties
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/fee-structure"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Subsidized vs Self-Finance
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Campus & Facilities */}
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
                  Campus Life Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/hostel-allotment"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Hostels &amp; Allotment
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life#transport"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Transport Bus Routes
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life#library"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Central Library Facilities
                </Link>
              </li>
              <li>
                <Link
                  href="/campus-life#societies"
                  className="hover:text-white hover:underline transition-colors"
                >
                  Student Societies &amp; Clubs
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Knowledge Base & AI */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Knowledge &amp; AI
            </h3>
            <ul className="space-y-2">
              <li>
                <Link href="/learn" className="hover:text-white hover:underline transition-colors">
                  Taxila Glossary Index
                </Link>
              </li>
              <li>
                <Link href="/uet" className="hover:text-white hover:underline transition-colors">
                  Institutional Guide (UET)
                </Link>
              </li>
              <li>
                <Link
                  href="/uet-gpt"
                  className="hover:text-white hover:underline transition-colors"
                >
                  About UET GPT AI
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
              <li>
                <a
                  href="/llms-full.txt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors"
                >
                  llms-full.txt (Full Spec)
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: Trust, Legal & Team */}
          <div className="space-y-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              About &amp; Trust
            </h3>
            <ul className="space-y-2">
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
                  href="https://web.uettaxila.edu.pk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors inline-flex items-center gap-1"
                >
                  <span>Official University Site</span>
                  <span className="text-[10px]">&nearr;</span>
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
              href="https://github.com/devhms/uet_gpt"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub Repository
            </a>
            <span>&bull;</span>
            <span>Created by Hafiz Muhammad Saad</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
