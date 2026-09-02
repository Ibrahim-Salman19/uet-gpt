"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { FeeCalculator } from "@/components/calculator/fee-calculator";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/dates";

type AdmissionTab = "overview" | "ecat" | "fees" | "scholarships" | "compare";

const TABS: { id: AdmissionTab; label: string; badge?: string; desc: string }[] = [
  {
    id: "overview",
    label: "Eligibility & Quotas",
    badge: "60% / 50%",
    desc: "Admission criteria, Category A (Subsidized) vs S (Self-Finance), and application steps",
  },
  {
    id: "ecat",
    label: "ECAT Strategy Guide",
    badge: "400 Marks",
    desc: "Subject weightages, negative marking rules (-1), and high-yield preparation blueprint",
  },
  {
    id: "fees",
    label: "Fee Simulator",
    badge: "Live Calc",
    desc: "Interactive tuition, hostel, and registration fee estimator for both categories",
  },
  {
    id: "scholarships",
    label: "Financial Aid Schemes",
    badge: "100% Tuition",
    desc: "Punjab Honhaar, HEC Need-Based, Ehsaas, Workers Welfare Fund (WWF), and PEEF",
  },
  {
    id: "compare",
    label: "University Comparison",
    badge: "Decision Matrix",
    desc: "Side-by-side comparison: UET Taxila vs NUST, FAST, UET Lahore, and GIKI",
  },
];

const COMPARISON_DATA = [
  {
    feature: "Tuition / Semester (Subsidized / Regular)",
    uetTaxila: "PKR 55,000 - 68,000",
    nust: "PKR 180,000 - 220,000",
    fast: "PKR 195,000 - 240,000",
    uetLahore: "PKR 58,000 - 72,000",
    giki: "PKR 420,000 - 550,000",
  },
  {
    feature: "Accreditation Standard",
    uetTaxila: "PEC Washington Accord Level-II",
    nust: "PEC Washington Accord Level-II",
    fast: "PEC / NCEAC Computing",
    uetLahore: "PEC Washington Accord Level-II",
    giki: "PEC Washington Accord Level-II",
  },
  {
    feature: "Hostel Accommodation",
    uetTaxila: "5 On-Campus Halls (PKR 28k/sem)",
    nust: "On-Campus (Subject to availability)",
    fast: "Limited / Private Hostels",
    uetLahore: "On-Campus Hostels",
    giki: "100% On-Campus Residential",
  },
  {
    feature: "Commuter Bus Network",
    uetTaxila: "25+ Routes (Isb, Rwp, Wah, Attock)",
    nust: "Twin Cities Routes",
    fast: "Twin Cities Routes",
    uetLahore: "Lahore Metro Routes",
    giki: "Topi, Swabi Transit",
  },
  {
    feature: "Primary Entry Test",
    uetTaxila: "ECAT (33% Aggregate Weight)",
    nust: "NET (75% Aggregate Weight)",
    fast: "NU Test / NAT / SAT",
    uetLahore: "ECAT (33% Aggregate Weight)",
    giki: "GIKI Entry Test",
  },
];

export function AdmissionsHub() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as AdmissionTab) || "overview";
  const [activeTab, setActiveTab] = useState<AdmissionTab>(
    ["overview", "ecat", "fees", "scholarships", "compare"].includes(initialTab)
      ? initialTab
      : "overview",
  );

  return (
    <div className="space-y-8">
      {/* Tab Selector Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
        {activeTab === "overview" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white">
                Undergraduate Admissions &amp; Eligibility {CURRENT_ACADEMIC_YEAR}
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Official eligibility thresholds, quota distributions, and application procedure.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="font-mono text-[10px] font-bold text-[#d9b451] uppercase">
                  BSc Engineering
                </span>
                <h3 className="mt-2 text-base font-bold text-white">60% FSc Pre-Engineering</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Minimum 60% unadjusted marks in FSc Pre-Engineering (Math, Physics, Chemistry) or
                  equivalent A-Levels / DAE with valid ECAT score.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="font-mono text-[10px] font-bold text-[#d9b451] uppercase">
                  BS Computing
                </span>
                <h3 className="mt-2 text-base font-bold text-white">50% Intermediate</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Minimum 50% marks in ICS, FSc Pre-Engineering, or Pre-Medical with Additional
                  Mathematics.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="font-mono text-[10px] font-bold text-[#d9b451] uppercase">
                  Merit Weightage
                </span>
                <h3 className="mt-2 text-base font-bold text-white">33% ECAT + 50% HSSC</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Formula: 33% ECAT + 50% Intermediate + 17% Matriculation. Calculate on our{" "}
                  <Link href="/tools?tab=merit" className="text-[#d9b451] underline">
                    Merit Calculator
                  </Link>
                  .
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-white/10 pt-6">
              <h3 className="text-base font-bold text-white">Seat Categories &amp; Quotas</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                  <h4 className="text-sm font-bold text-[#d9b451]">
                    Category A: Open Merit (Subsidized)
                  </h4>
                  <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                    Highly competitive subsidized seats for Punjab domicile holders. Tuition fees
                    are heavily subsidized by the government (~PKR 55k – 68k/semester).
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                  <h4 className="text-sm font-bold text-[#d9b451]">
                    Category S: Partial Subsidized (Self-Finance)
                  </h4>
                  <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                    Open to all Pakistan domicile holders with slightly lower merit cutoff
                    thresholds. Regular tuition + partial institutional subsidy (~PKR 140k –
                    175k/semester).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "ecat" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                ECAT 2026 Strategy Guide &amp; Blueprint
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                400-marks computer-based test conducted by UET Lahore for all public engineering
                universities in Punjab.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-4 text-center">
                <div className="font-mono text-xl font-bold text-[#d9b451]">100 Marks</div>
                <div className="mt-1 text-xs font-semibold text-white">Mathematics</div>
                <div className="text-[11px] text-[#a1a1aa]">30 MCQs &bull; 4 marks each</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-4 text-center">
                <div className="font-mono text-xl font-bold text-[#d9b451]">100 Marks</div>
                <div className="mt-1 text-xs font-semibold text-white">Physics</div>
                <div className="text-[11px] text-[#a1a1aa]">30 MCQs &bull; 4 marks each</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-4 text-center">
                <div className="font-mono text-xl font-bold text-[#d9b451]">100 Marks</div>
                <div className="mt-1 text-xs font-semibold text-white">Chemistry / CS</div>
                <div className="text-[11px] text-[#a1a1aa]">30 MCQs &bull; 4 marks each</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-4 text-center">
                <div className="font-mono text-xl font-bold text-[#d9b451]">100 Marks</div>
                <div className="mt-1 text-xs font-semibold text-white">English</div>
                <div className="text-[11px] text-[#a1a1aa]">10 MCQs &bull; 4 marks each</div>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
              <h3 className="text-sm font-bold text-white">Negative Marking Rule (-1)</h3>
              <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                Each correct answer awards <strong>+4 marks</strong>, while an incorrect response
                deducts <strong>-1 mark</strong>. Unattempted questions yield 0 marks. Educated
                elimination is statistically viable only when at least 2 incorrect options can be
                ruled out.
              </p>
            </div>
          </div>
        )}

        {activeTab === "fees" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Interactive Semester Fee Simulator {CURRENT_ACADEMIC_YEAR}
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Calculate exact semester expenses for Open Merit vs Self-Finance including hostel
                charges.
              </p>
            </div>
            <FeeCalculator />
          </div>
        )}

        {activeTab === "scholarships" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Scholarships &amp; Financial Aid Programs
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  Over 35% of UET Taxila undergraduates receive merit or need-based financial
                  sponsorship.
                </p>
              </div>
              <Link
                href="/tools?tab=scholarships"
                className="inline-flex items-center gap-2 rounded-lg bg-[#d9b451] px-4 py-2 text-xs font-mono font-bold uppercase text-[#07080a] hover:bg-[#f0d178] transition-colors"
              >
                <span>Launch Aid Screener</span>
                <span>&rarr;</span>
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Government of Punjab
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">
                  Chief Minister Honhaar Scholarship
                </h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  100% full tuition waiver for 4 years for students with &ge;70% Intermediate marks
                  and annual family income &lt; PKR 350,000.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Federal HEC
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">HEC Need-Based Financial Aid</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  100% full tuition sponsorship plus PKR 6,000 monthly living stipend for
                  financially constrained undergraduates.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Industrial Quota
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">Workers Welfare Fund (WWF)</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Full 100% tuition, hostel, transport, PKR 5,000 semester book grant, and monthly
                  stipend for children of registered industrial laborers.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  Alumni Network
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">
                  UETTAA Alumni Emergency Grants
                </h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Direct financial grants and emergency semester tuition payments funded by global
                  alumni in North America, Europe, and GCC.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "compare" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                University Comparison Decision Matrix
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Evaluate engineering education costs, accreditations, and facilities side-by-side.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-left text-xs text-[#a1a1aa]">
                <thead className="bg-[#07080a] text-[11px] font-mono uppercase text-white">
                  <tr>
                    <th className="p-3.5">Key Metric</th>
                    <th className="p-3.5 text-[#d9b451]">UET Taxila</th>
                    <th className="p-3.5">NUST</th>
                    <th className="p-3.5">FAST-NUCES</th>
                    <th className="p-3.5">UET Lahore</th>
                    <th className="p-3.5">GIKI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#0c0d10]">
                  {COMPARISON_DATA.map((row) => (
                    <tr key={row.feature} className="hover:bg-white/[0.02]">
                      <td className="p-3.5 font-semibold text-white">{row.feature}</td>
                      <td className="p-3.5 font-bold text-[#d9b451]">{row.uetTaxila}</td>
                      <td className="p-3.5">{row.nust}</td>
                      <td className="p-3.5">{row.fast}</td>
                      <td className="p-3.5">{row.uetLahore}</td>
                      <td className="p-3.5">{row.giki}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
