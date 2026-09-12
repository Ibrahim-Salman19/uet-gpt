"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { GpaCalculator } from "@/components/calculator/gpa-calculator";
import { MeritArchiveExplorer } from "@/components/calculator/merit-archive-explorer";
import { MeritCalculator } from "@/components/calculator/merit-calculator";
import { ScholarshipScreener } from "@/components/scholarships/scholarship-screener";

type ToolTab = "merit" | "gpa" | "archive" | "scholarships";

const TABS: { id: ToolTab; label: string; badge?: string; desc: string }[] = [
  {
    id: "merit",
    label: "Merit Calculator",
    badge: "Official Formula",
    desc: "Calculate your undergraduate aggregate (33% ECAT, 50% HSSC, 17% SSC)",
  },
  {
    id: "gpa",
    label: "GPA & CGPA Calculator",
    badge: "4.00 Scale",
    desc: "Semester SGPA and cumulative CGPA calculator with official letter grades",
  },
  {
    id: "archive",
    label: "5-Yr Closing Merit",
    badge: "2021-2025",
    desc: "Historical closing merit cutoffs across Category A (Subsidized) and Category S",
  },
  {
    id: "scholarships",
    label: "Scholarship Screener",
    badge: "Aid Matcher",
    desc: "Instant eligibility matcher for Honhaar, HEC, Ehsaas, WWF, and PEEF",
  },
];

export function ToolsHub() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as ToolTab) || "merit";
  const [activeTab, setActiveTab] = useState<ToolTab>(
    ["merit", "gpa", "archive", "scholarships"].includes(initialTab) ? initialTab : "merit",
  );

  return (
    <div className="space-y-8">
      {/* Tab Selector Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all ${
                isActive
                  ? "border-[#d9b451] bg-[#d9b451]/10 text-white shadow-lg shadow-[#d9b451]/10"
                  : "border-white/10 bg-[#0c0d10] text-[#a1a1aa] hover:border-white/20 hover:text-white"
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold uppercase tracking-wider">
                  {tab.label}
                </span>
                {tab.badge && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                      isActive ? "bg-[#d9b451] text-[#07080a]" : "bg-white/10 text-[#a1a1aa]"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <p className="mt-2 text-[11px] leading-snug opacity-80">{tab.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Active Tab Panel */}
      <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8">
        {activeTab === "merit" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Undergraduate Aggregate Merit Calculator
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Compute your official admission aggregate according to UET Taxila&apos;s statutory
                PEC formula.
              </p>
            </div>
            <MeritCalculator />
          </div>
        )}

        {activeTab === "gpa" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Semester SGPA &amp; Cumulative CGPA Calculator
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Calculate your semester performance on UET Taxila&apos;s official 4.00 grading
                scale.
              </p>
            </div>
            <GpaCalculator />
          </div>
        )}

        {activeTab === "archive" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Historical Closing Merit Cutoffs (2022 – 2025)
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  Analyze admission trends across all 15 engineering, computing, and sciences
                  disciplines.
                </p>
              </div>
              <Link
                href="/uet-taxila/closing-merit"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#d9b451]/30 px-4 py-2 text-xs font-mono font-bold uppercase text-[#d9b451] hover:bg-[#d9b451]/10 transition-colors"
              >
                <span>Full Merit Table</span>
                <span>&rarr;</span>
              </Link>
            </div>
            <MeritArchiveExplorer />
          </div>
        )}

        {activeTab === "scholarships" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Scholarship &amp; Financial Aid Eligibility Screener
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Check instant eligibility for Punjab Honhaar, HEC Need-Based, Ehsaas, WWF, and PEEF.
              </p>
            </div>
            <ScholarshipScreener />
          </div>
        )}
      </div>
    </div>
  );
}
