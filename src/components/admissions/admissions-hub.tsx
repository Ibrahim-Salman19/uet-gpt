"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
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
    desc: "Subject weightages, negative marking rules (-1), and interactive score simulator",
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

const ADMISSION_STEPS = [
  {
    step: "01",
    title: "ECAT Registration & Conduction",
    timeline: "July – August 2026",
    desc: "Register online via UET admission portal. Appear in the 100-MCQ computer-based entrance test at your designated center.",
  },
  {
    step: "02",
    title: "Online Application Submission",
    timeline: "August 2026",
    desc: "Fill the centralized preference form selecting degree programs in order of interest across Category A (Subsidized) and Category S.",
  },
  {
    step: "03",
    title: "Merit List Publication",
    timeline: "September 2026",
    desc: "1st, 2nd, and 3rd merit lists published online. Candidates receive SMS/Email notifications of program allocation.",
  },
  {
    step: "04",
    title: "Document Verification & Medical",
    timeline: "September 2026",
    desc: "Submit original HSSC, SSC, Domicile certificates, and medical fitness clearance at the Directorate of Admissions.",
  },
  {
    step: "05",
    title: "Fee Deposit & Orientation",
    timeline: "Late September 2026",
    desc: "Deposit semester dues at HBL UET Taxila branch or online, collect registration card, and attend freshmen orientation.",
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

  // Interactive ECAT Simulator State
  const [mathCorrect, setMathCorrect] = useState<number>(22);
  const [mathWrong, setMathWrong] = useState<number>(5);

  const [physicsCorrect, setPhysicsCorrect] = useState<number>(20);
  const [physicsWrong, setPhysicsWrong] = useState<number>(6);

  const [chemCorrect, setChemCorrect] = useState<number>(21);
  const [chemWrong, setChemWrong] = useState<number>(5);

  const [engCorrect, setEngCorrect] = useState<number>(7);
  const [engWrong, setEngWrong] = useState<number>(2);

  const ecatScore = useMemo(() => {
    const totalCorrect = mathCorrect + physicsCorrect + chemCorrect + engCorrect;
    const totalWrong = mathWrong + physicsWrong + chemWrong + engWrong;
    const totalAttempted = totalCorrect + totalWrong;
    const totalUnattempted = Math.max(0, 100 - totalAttempted);

    const rawMarks = totalCorrect * 4 - totalWrong * 1;
    const finalMarks = Math.max(0, Math.min(400, rawMarks));
    const percentage = (finalMarks / 400) * 100;
    const accuracy = totalAttempted > 0 ? (totalCorrect / totalAttempted) * 100 : 0;

    return {
      totalCorrect,
      totalWrong,
      totalUnattempted,
      finalMarks,
      percentage,
      accuracy,
    };
  }, [
    mathCorrect,
    mathWrong,
    physicsCorrect,
    physicsWrong,
    chemCorrect,
    chemWrong,
    engCorrect,
    engWrong,
  ]);

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
                Official statutory criteria, quota distributions, and step-by-step application
                walkthrough.
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

            {/* 5-Phase Application Process */}
            <div className="space-y-4 border-t border-white/10 pt-6">
              <h3 className="text-base font-bold text-white">5-Phase Admission Walkthrough</h3>
              <div className="grid gap-3 sm:grid-cols-5">
                {ADMISSION_STEPS.map((s) => (
                  <div
                    key={s.step}
                    className="rounded-xl border border-white/10 bg-[#07080a] p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-mono mb-2">
                        <span className="text-[#d9b451] font-bold">PHASE {s.step}</span>
                      </div>
                      <h4 className="text-xs font-bold text-white mb-1">{s.title}</h4>
                      <p className="text-[11px] text-[#a1a1aa] leading-relaxed">{s.desc}</p>
                    </div>
                    <span className="mt-3 text-[10px] font-mono text-[#71717a] block border-t border-white/5 pt-2">
                      {s.timeline}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Quotas & Categories */}
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
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white">
                ECAT 2026 Strategy Guide &amp; Interactive Score Simulator
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                400-marks computer-based test conducted by UET Lahore (100 MCQs total: +4 marks per
                correct answer, -1 mark penalty per incorrect answer).
              </p>
            </div>

            {/* Interactive ECAT Simulator */}
            <div className="rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Live ECAT Score Simulator</h3>
                  <p className="text-xs text-[#a1a1aa]">
                    Simulate your correct vs incorrect responses to see your net score after
                    negative marking.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono uppercase text-[#a1a1aa] block">
                    Simulated Score
                  </span>
                  <span className="text-3xl font-black font-mono text-[#d9b451]">
                    {ecatScore.finalMarks}
                  </span>
                  <span className="text-xs text-[#71717a] font-mono">
                    {" "}
                    / 400 ({ecatScore.percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Mathematics */}
                <div className="rounded-lg border border-white/10 bg-[#07080a] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Mathematics (30 Qs)</span>
                    <span className="text-[10px] font-mono text-[#d9b451]">Max 120</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 block mb-0.5 cursor-pointer">
                      <span>Correct (+4): {mathCorrect}</span>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={mathCorrect}
                        onChange={(e) => setMathCorrect(Number(e.target.value))}
                        className="w-full accent-emerald-400 mt-1 block"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] text-rose-400 block mb-0.5 cursor-pointer">
                      <span>Wrong (-1): {mathWrong}</span>
                      <input
                        type="range"
                        min={0}
                        max={30 - mathCorrect}
                        value={mathWrong}
                        onChange={(e) => setMathWrong(Number(e.target.value))}
                        className="w-full accent-rose-400 mt-1 block"
                      />
                    </label>
                  </div>
                </div>

                {/* Physics */}
                <div className="rounded-lg border border-white/10 bg-[#07080a] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Physics (30 Qs)</span>
                    <span className="text-[10px] font-mono text-[#d9b451]">Max 120</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 block mb-0.5 cursor-pointer">
                      <span>Correct (+4): {physicsCorrect}</span>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={physicsCorrect}
                        onChange={(e) => setPhysicsCorrect(Number(e.target.value))}
                        className="w-full accent-emerald-400 mt-1 block"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] text-rose-400 block mb-0.5 cursor-pointer">
                      <span>Wrong (-1): {physicsWrong}</span>
                      <input
                        type="range"
                        min={0}
                        max={30 - physicsCorrect}
                        value={physicsWrong}
                        onChange={(e) => setPhysicsWrong(Number(e.target.value))}
                        className="w-full accent-rose-400 mt-1 block"
                      />
                    </label>
                  </div>
                </div>

                {/* Chemistry / CS */}
                <div className="rounded-lg border border-white/10 bg-[#07080a] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">Chem / CS (30 Qs)</span>
                    <span className="text-[10px] font-mono text-[#d9b451]">Max 120</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 block mb-0.5 cursor-pointer">
                      <span>Correct (+4): {chemCorrect}</span>
                      <input
                        type="range"
                        min={0}
                        max={30}
                        value={chemCorrect}
                        onChange={(e) => setChemCorrect(Number(e.target.value))}
                        className="w-full accent-emerald-400 mt-1 block"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] text-rose-400 block mb-0.5 cursor-pointer">
                      <span>Wrong (-1): {chemWrong}</span>
                      <input
                        type="range"
                        min={0}
                        max={30 - chemCorrect}
                        value={chemWrong}
                        onChange={(e) => setChemWrong(Number(e.target.value))}
                        className="w-full accent-rose-400 mt-1 block"
                      />
                    </label>
                  </div>
                </div>

                {/* English */}
                <div className="rounded-lg border border-white/10 bg-[#07080a] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-white">English (10 Qs)</span>
                    <span className="text-[10px] font-mono text-[#d9b451]">Max 40</span>
                  </div>
                  <div>
                    <label className="text-[10px] text-emerald-400 block mb-0.5 cursor-pointer">
                      <span>Correct (+4): {engCorrect}</span>
                      <input
                        type="range"
                        min={0}
                        max={10}
                        value={engCorrect}
                        onChange={(e) => setEngCorrect(Number(e.target.value))}
                        className="w-full accent-emerald-400 mt-1 block"
                      />
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] text-rose-400 block mb-0.5 cursor-pointer">
                      <span>Wrong (-1): {engWrong}</span>
                      <input
                        type="range"
                        min={0}
                        max={10 - engCorrect}
                        value={engWrong}
                        onChange={(e) => setEngWrong(Number(e.target.value))}
                        className="w-full accent-rose-400 mt-1 block"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 text-[#a1a1aa] font-mono">
                  <span>
                    Correct: <strong className="text-emerald-400">{ecatScore.totalCorrect}</strong>
                  </span>
                  <span>
                    Wrong: <strong className="text-rose-400">{ecatScore.totalWrong}</strong>
                  </span>
                  <span>
                    Skipped: <strong className="text-white">{ecatScore.totalUnattempted}</strong>
                  </span>
                  <span>
                    Accuracy:{" "}
                    <strong className="text-[#d9b451]">{ecatScore.accuracy.toFixed(1)}%</strong>
                  </span>
                </div>
                <Link
                  href="/tools?tab=merit"
                  className="inline-flex items-center gap-1 text-[#d9b451] font-mono font-bold hover:underline"
                >
                  <span>Plug into Merit Calculator &rarr;</span>
                </Link>
              </div>
            </div>

            {/* Preparation Strategies */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <h3 className="text-sm font-bold text-[#d9b451]">High-Yield ECAT Focus Areas</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-[#a1a1aa]">
                  <li>
                    &bull; <strong className="text-white">Mathematics:</strong> Conic Sections,
                    Differentiation, Integration, Trigonometry, Vectors.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Physics:</strong> Electromagnetism,
                    Alternating Current, Nuclear Physics, Thermodynamics.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Chemistry:</strong> Organic Reaction
                    Mechanisms, Chemical Equilibrium, Electrochemistry.
                  </li>
                  <li>
                    &bull; <strong className="text-white">English:</strong> Sentence completion,
                    vocabulary in context, grammar correction.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <h3 className="text-sm font-bold text-[#d9b451]">Time Management Blueprint</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-[#a1a1aa]">
                  <li>&bull; Total Time: 100 minutes for 100 MCQs (exact 1 minute/question).</li>
                  <li>
                    &bull; <strong className="text-white">Pass 1 (0-40 min):</strong> Solve all
                    direct theoretical and 1-step numerical questions.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Pass 2 (40-80 min):</strong> Tackle
                    complex 2-step calculations in Physics &amp; Math.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Pass 3 (80-100 min):</strong> Review
                    flagged questions; avoid pure random guessing.
                  </li>
                </ul>
              </div>
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
