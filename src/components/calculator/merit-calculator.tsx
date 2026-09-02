"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

interface DepartmentThreshold {
  department: string;
  slug: string;
  faculty: string;
  estimatedMerit: number;
  category: "Engineering" | "Computing" | "Sciences";
}

const HISTORICAL_BENCHMARKS: DepartmentThreshold[] = [
  {
    department: "BS Computer Science",
    slug: "computer-science",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 80.45,
    category: "Computing",
  },
  {
    department: "BS Software Engineering",
    slug: "software-engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 79.82,
    category: "Computing",
  },
  {
    department: "BSc Computer Engineering",
    slug: "computer-engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 76.9,
    category: "Engineering",
  },
  {
    department: "BSc Electrical Engineering",
    slug: "electrical-engineering",
    faculty: "Faculty of Electronics & Electrical Engineering",
    estimatedMerit: 74.15,
    category: "Engineering",
  },
  {
    department: "BSc Mechanical Engineering",
    slug: "mechanical-engineering",
    faculty: "Faculty of Mechanical & Aeronautical Engineering",
    estimatedMerit: 73.89,
    category: "Engineering",
  },
  {
    department: "BSc Mechatronics Engineering",
    slug: "mechatronics-engineering",
    faculty: "Faculty of Mechanical & Aeronautical Engineering",
    estimatedMerit: 72.84,
    category: "Engineering",
  },
  {
    department: "BSc Civil Engineering",
    slug: "civil-engineering",
    faculty: "Faculty of Civil & Environmental Engineering",
    estimatedMerit: 71.42,
    category: "Engineering",
  },
  {
    department: "BSc Electronics Engineering",
    slug: "electronics-engineering",
    faculty: "Faculty of Electronics & Electrical Engineering",
    estimatedMerit: 71.1,
    category: "Engineering",
  },
  {
    department: "BSc Telecommunication Engineering",
    slug: "telecommunication-engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 70.15,
    category: "Engineering",
  },
  {
    department: "BSc Industrial Engineering",
    slug: "industrial-engineering",
    faculty: "Faculty of Industrial Engineering",
    estimatedMerit: 69.8,
    category: "Engineering",
  },
  {
    department: "BSc Environmental Engineering",
    slug: "environmental-engineering",
    faculty: "Faculty of Civil & Environmental Engineering",
    estimatedMerit: 68.5,
    category: "Engineering",
  },
  {
    department: "BS Mathematics",
    slug: "mathematics",
    faculty: "Faculty of Basic Sciences & Humanities",
    estimatedMerit: 65.2,
    category: "Sciences",
  },
  {
    department: "BS Physics",
    slug: "physics",
    faculty: "Faculty of Basic Sciences & Humanities",
    estimatedMerit: 64.8,
    category: "Sciences",
  },
  {
    department: "BS Chemistry",
    slug: "chemistry",
    faculty: "Faculty of Basic Sciences & Humanities",
    estimatedMerit: 64.5,
    category: "Sciences",
  },
];

export function MeritCalculator() {
  const [ecatMarks, setEcatMarks] = useState<number>(280);
  const [ecatTotal, setEcatTotal] = useState<number>(400);
  const [hsscMarks, setHsscMarks] = useState<number>(470);
  const [hsscTotal, setHsscTotal] = useState<number>(550);
  const [sscMarks, setSscMarks] = useState<number>(980);
  const [sscTotal, setSscTotal] = useState<number>(1100);
  const [isHifzOrNcc, setIsHifzOrNcc] = useState<boolean>(false);
  const [track, setTrack] = useState<"fsc-part1" | "fsc-full" | "dae">("fsc-part1");
  const [filterTab, setFilterTab] = useState<"all" | "competitive" | "borderline">("all");
  const [copied, setCopied] = useState<boolean>(false);

  const ecatId = useId();
  const ecatTotalId = useId();
  const hsscId = useId();
  const hsscTotalId = useId();
  const sscId = useId();
  const sscTotalId = useId();

  // Calculation
  const result = useMemo(() => {
    const safeEcatTotal = ecatTotal > 0 ? ecatTotal : 400;
    const safeHsscTotal = hsscTotal > 0 ? hsscTotal : 550;
    const safeSscTotal = sscTotal > 0 ? sscTotal : 1100;

    const bonus = isHifzOrNcc ? 20 : 0;
    const adjustedHssc = Math.min(hsscMarks + bonus, safeHsscTotal + bonus);

    const ecatPct = (Math.max(0, ecatMarks) / safeEcatTotal) * 100;
    const hsscPct = (Math.max(0, adjustedHssc) / safeHsscTotal) * 100;
    const sscPct = (Math.max(0, sscMarks) / safeSscTotal) * 100;

    const ecatWeighted = ecatPct * 0.33;
    const hsscWeighted = hsscPct * 0.5;
    const sscWeighted = sscPct * 0.17;

    const aggregate = ecatWeighted + hsscWeighted + sscWeighted;

    // Eligibility check
    const rawHsscPct = (Math.max(0, hsscMarks) / safeHsscTotal) * 100;
    const isEligibleEngineering = rawHsscPct >= 60 && ecatMarks > 0;
    const isEligibleComputing = rawHsscPct >= 50 && ecatMarks > 0;

    return {
      aggregate: Math.min(100, Math.max(0, aggregate)),
      ecatWeighted,
      hsscWeighted,
      sscWeighted,
      rawHsscPct,
      isEligibleEngineering,
      isEligibleComputing,
    };
  }, [ecatMarks, ecatTotal, hsscMarks, hsscTotal, sscMarks, sscTotal, isHifzOrNcc]);

  const handleCopySummary = () => {
    const text = `UET Taxila Admission Aggregate 2026: ${result.aggregate.toFixed(3)}%\nECAT (33%): ${result.ecatWeighted.toFixed(3)}% | HSSC (50%): ${result.hsscWeighted.toFixed(3)}% | SSC (17%): ${result.sscWeighted.toFixed(3)}%\nCalculated via UET GPT (https://uet-gpt.vercel.app/tools)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredBenchmarks = useMemo(() => {
    return HISTORICAL_BENCHMARKS.filter((dept) => {
      const diff = result.aggregate - dept.estimatedMerit;
      if (filterTab === "competitive") return diff >= 0;
      if (filterTab === "borderline") return diff >= -2.0 && diff < 0;
      return true;
    });
  }, [result.aggregate, filterTab]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-lg font-bold text-white">Enter Your Academic Marks</h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Statutory PEC Formula: 33% ECAT + 50% HSSC/F.Sc + 17% SSC/Matric
              </p>
            </div>
            {/* Track Selector */}
            <div className="flex rounded-lg border border-white/10 bg-[#14151a] p-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setTrack("fsc-part1");
                  setHsscTotal(550);
                }}
                className={`rounded px-2.5 py-1 font-mono font-medium transition-colors ${
                  track === "fsc-part1"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                HSSC Part-1
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrack("fsc-full");
                  setHsscTotal(1100);
                }}
                className={`rounded px-2.5 py-1 font-mono font-medium transition-colors ${
                  track === "fsc-full"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                HSSC Full
              </button>
              <button
                type="button"
                onClick={() => {
                  setTrack("dae");
                  setHsscTotal(1000);
                }}
                className={`rounded px-2.5 py-1 font-mono font-medium transition-colors ${
                  track === "dae"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "text-[#a1a1aa] hover:text-white"
                }`}
              >
                DAE
              </button>
            </div>
          </div>

          {/* 1. ECAT Marks */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor={ecatId} className="text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b451]/20 text-[10px] text-[#d9b451] font-bold font-mono">
                  1
                </span>
                ECAT Entry Test Marks (33%)
              </label>
              <span className="text-xs text-[#d9b451] font-mono font-bold">
                {result.ecatWeighted.toFixed(3)}% weight
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  id={ecatId}
                  type="number"
                  min={0}
                  max={ecatTotal}
                  value={ecatMarks}
                  onChange={(e) => setEcatMarks(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm font-mono text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Marks Obtained"
                />
              </div>
              <div>
                <input
                  id={ecatTotalId}
                  type="number"
                  min={1}
                  value={ecatTotal}
                  onChange={(e) => setEcatTotal(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm font-mono text-[#a1a1aa] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Total Marks (400)"
                />
              </div>
            </div>
          </div>

          {/* 2. HSSC Marks */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor={hsscId} className="text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b451]/20 text-[10px] text-[#d9b451] font-bold font-mono">
                  2
                </span>
                HSSC / F.Sc / DAE Marks (50%)
              </label>
              <span className="text-xs text-[#d9b451] font-mono font-bold">
                {result.hsscWeighted.toFixed(3)}% weight
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  id={hsscId}
                  type="number"
                  min={0}
                  max={hsscTotal}
                  value={hsscMarks}
                  onChange={(e) => setHsscMarks(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm font-mono text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Marks Obtained"
                />
              </div>
              <div>
                <input
                  id={hsscTotalId}
                  type="number"
                  min={1}
                  value={hsscTotal}
                  onChange={(e) => setHsscTotal(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm font-mono text-[#a1a1aa] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Total Marks"
                />
              </div>
            </div>
          </div>

          {/* 3. SSC Marks */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor={sscId} className="text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b451]/20 text-[10px] text-[#d9b451] font-bold font-mono">
                  3
                </span>
                SSC / Matric Marks (17%)
              </label>
              <span className="text-xs text-[#d9b451] font-mono font-bold">
                {result.sscWeighted.toFixed(3)}% weight
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <input
                  id={sscId}
                  type="number"
                  min={0}
                  max={sscTotal}
                  value={sscMarks}
                  onChange={(e) => setSscMarks(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm font-mono text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Marks Obtained"
                />
              </div>
              <div>
                <input
                  id={sscTotalId}
                  type="number"
                  min={1}
                  value={sscTotal}
                  onChange={(e) => setSscTotal(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm font-mono text-[#a1a1aa] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Total Marks (1100)"
                />
              </div>
            </div>
          </div>

          {/* 4. Bonus Checkbox */}
          <div className="flex items-center gap-3 pt-2 rounded-lg border border-white/5 bg-[#14151a] p-3">
            <input
              id="hifz-checkbox"
              type="checkbox"
              checked={isHifzOrNcc}
              onChange={(e) => setIsHifzOrNcc(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#07080a] text-[#d9b451] focus:ring-[#d9b451]"
            />
            <label htmlFor="hifz-checkbox" className="text-xs text-[#d4d4d8] cursor-pointer">
              <span className="font-semibold text-white">Hifz-e-Quran / NCC Certificate:</span> +20
              marks added to HSSC component for merit calculation (Prospectus Table 18).
            </label>
          </div>
        </div>

        {/* Right Column: Results & Eligibility Card */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-[#a1a1aa]">
              <span>Your Admission Aggregate</span>
              <span className="text-[#d9b451]">2026-2027</span>
            </div>

            <div className="mt-4 text-center">
              <span className="text-5xl sm:text-6xl font-black tracking-tight text-white font-mono">
                {result.aggregate.toFixed(3)}
                <span className="text-2xl text-[#d9b451] font-normal">%</span>
              </span>
            </div>

            {/* Score Breakdown Bars */}
            <div className="mt-6 space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-[#a1a1aa] mb-1">
                  <span>ECAT Component (33%)</span>
                  <span className="font-mono text-white font-semibold">
                    {result.ecatWeighted.toFixed(3)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#d9b451]"
                    style={{ width: `${(result.ecatWeighted / 33) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#a1a1aa] mb-1">
                  <span>HSSC Component (50%)</span>
                  <span className="font-mono text-white font-semibold">
                    {result.hsscWeighted.toFixed(3)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#6366f1]"
                    style={{ width: `${(result.hsscWeighted / 50) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[#a1a1aa] mb-1">
                  <span>SSC Component (17%)</span>
                  <span className="font-mono text-white font-semibold">
                    {result.sscWeighted.toFixed(3)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#10b981]"
                    style={{ width: `${(result.sscWeighted / 17) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Eligibility Badges */}
            <div className="mt-6 pt-4 border-t border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#a1a1aa]">Engineering Eligibility (≥60% HSSC):</span>
                {result.isEligibleEngineering ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Eligible ({result.rawHsscPct.toFixed(1)}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Ineligible (&lt;60%)
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#a1a1aa]">CS / Math / Physics (≥50% HSSC):</span>
                {result.isEligibleComputing ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Eligible ({result.rawHsscPct.toFixed(1)}%)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    Ineligible
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <button
              type="button"
              onClick={handleCopySummary}
              className="w-full text-center rounded-lg border border-white/15 bg-[#07080a] px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#d9b451] hover:border-[#d9b451] hover:bg-[#d9b451]/10 transition-colors"
            >
              {copied ? "✓ Aggregate Summary Copied!" : "Copy Aggregate Summary"}
            </button>
            <Link
              href="/admissions?tab=overview"
              className="block w-full text-center rounded-lg bg-[#d9b451] px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-colors"
            >
              Admissions Quota Breakdown &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Historical Merit Benchmark Table for All 14 Degrees */}
      <div className="mt-10 pt-8 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white">
              All 14 Department Closing Merit Benchmarks (Category A Open Merit)
            </h3>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Live qualification assessment for your calculated aggregate of{" "}
              <strong className="text-[#d9b451] font-mono">{result.aggregate.toFixed(3)}%</strong>.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#14151a] p-1 text-xs font-mono">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterTab === "all"
                  ? "bg-[#d9b451] text-[#07080a] font-bold"
                  : "text-[#a1a1aa] hover:text-white"
              }`}
            >
              All (14)
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("competitive")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterTab === "competitive"
                  ? "bg-emerald-500 text-white font-bold"
                  : "text-[#a1a1aa] hover:text-white"
              }`}
            >
              Competitive
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("borderline")}
              className={`rounded px-2.5 py-1 transition-colors ${
                filterTab === "borderline"
                  ? "bg-amber-500 text-[#07080a] font-bold"
                  : "text-[#a1a1aa] hover:text-white"
              }`}
            >
              Borderline
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-xs text-[#d4d4d8]">
            <thead className="bg-[#14151a] text-[#a1a1aa] uppercase font-mono tracking-wider">
              <tr>
                <th className="px-4 py-3">Degree Program</th>
                <th className="px-4 py-3">Faculty / Discipline</th>
                <th className="px-4 py-3">Benchmark Cutoff</th>
                <th className="px-4 py-3">Your Margin</th>
                <th className="px-4 py-3">Admission Chance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#09090b]">
              {filteredBenchmarks.map((dept) => {
                const diff = result.aggregate - dept.estimatedMerit;
                const isLikely = diff >= 0;
                const isBorderline = diff >= -2.0 && diff < 0;

                return (
                  <tr key={dept.department} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-semibold text-white">
                      <Link
                        href={`/uet-taxila/programs/${dept.slug}`}
                        className="hover:text-[#d9b451] hover:underline transition-colors"
                      >
                        {dept.department}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#a1a1aa]">{dept.faculty}</td>
                    <td className="px-4 py-3 font-mono font-bold text-[#d9b451]">
                      {dept.estimatedMerit.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <span className={diff >= 0 ? "text-emerald-400 font-bold" : "text-rose-400"}>
                        {diff >= 0 ? `+${diff.toFixed(3)}%` : `${diff.toFixed(3)}%`}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isLikely ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                          Highly Competitive
                        </span>
                      ) : isBorderline ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                          Borderline / 2nd List
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-500/20">
                          Reach
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
