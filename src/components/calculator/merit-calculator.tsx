"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";

interface DepartmentThreshold {
  department: string;
  faculty: string;
  estimatedMerit: number;
  category: "Engineering" | "Computing" | "Sciences";
}

const HISTORICAL_BENCHMARKS: DepartmentThreshold[] = [
  {
    department: "Computer Science (BS CS)",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 82.5,
    category: "Computing",
  },
  {
    department: "Software Engineering (BS SE)",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 81.8,
    category: "Computing",
  },
  {
    department: "Electrical Engineering",
    faculty: "Faculty of Electronics & Electrical Engineering",
    estimatedMerit: 75.4,
    category: "Engineering",
  },
  {
    department: "Mechanical Engineering",
    faculty: "Faculty of Mechanical & Aeronautical Engineering",
    estimatedMerit: 74.2,
    category: "Engineering",
  },
  {
    department: "Civil Engineering",
    faculty: "Faculty of Civil & Environmental Engineering",
    estimatedMerit: 72.8,
    category: "Engineering",
  },
  {
    department: "Industrial Engineering",
    faculty: "Faculty of Industrial Engineering",
    estimatedMerit: 70.5,
    category: "Engineering",
  },
  {
    department: "Telecommunication Engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    estimatedMerit: 69.2,
    category: "Engineering",
  },
  {
    department: "Environmental Engineering",
    faculty: "Faculty of Civil & Environmental Engineering",
    estimatedMerit: 67.5,
    category: "Engineering",
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

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Inputs */}
        <div className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <h2 className="text-xl font-bold text-white">Enter Your Marks</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Based on official UET Taxila 2026 formula (33% ECAT, 50% HSSC, 17% SSC)
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
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  track === "fsc-part1"
                    ? "bg-[#d9b451] text-[#07080a]"
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
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  track === "fsc-full"
                    ? "bg-[#d9b451] text-[#07080a]"
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
                className={`rounded px-2.5 py-1 font-medium transition-colors ${
                  track === "dae"
                    ? "bg-[#d9b451] text-[#07080a]"
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
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b451]/20 text-[10px] text-[#d9b451] font-bold">
                  1
                </span>
                ECAT Entry Test Marks (33%)
              </label>
              <span className="text-xs text-[#d9b451] font-mono">
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
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
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
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm text-[#a1a1aa] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Total Marks (400)"
                />
              </div>
            </div>
          </div>

          {/* 2. HSSC Marks */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor={hsscId} className="text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b451]/20 text-[10px] text-[#d9b451] font-bold">
                  2
                </span>
                HSSC / F.Sc / DAE Marks (50%)
              </label>
              <span className="text-xs text-[#d9b451] font-mono">
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
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
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
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm text-[#a1a1aa] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Total Marks"
                />
              </div>
            </div>
          </div>

          {/* 3. SSC Marks */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor={sscId} className="text-white flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#d9b451]/20 text-[10px] text-[#d9b451] font-bold">
                  3
                </span>
                SSC / Matric Marks (17%)
              </label>
              <span className="text-xs text-[#d9b451] font-mono">
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
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
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
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-sm text-[#a1a1aa] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
                  placeholder="Total Marks (1100)"
                />
              </div>
            </div>
          </div>

          {/* 4. Bonus Checkbox */}
          <div className="flex items-center gap-3 pt-2">
            <input
              id="hifz-checkbox"
              type="checkbox"
              checked={isHifzOrNcc}
              onChange={(e) => setIsHifzOrNcc(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-[#14151a] text-[#d9b451] focus:ring-[#d9b451]"
            />
            <label htmlFor="hifz-checkbox" className="text-xs text-[#d4d4d8] cursor-pointer">
              Hifz-e-Quran / NCC Certificate (+20 marks added to HSSC component for merit
              calculation)
            </label>
          </div>
        </div>

        {/* Right Column: Results & Eligibility Card */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-[#a1a1aa]">
              <span>Your Calculated Aggregate</span>
              <span className="text-[#d9b451]">UET Taxila 2026</span>
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
                  <span className="font-mono text-white">{result.ecatWeighted.toFixed(3)}%</span>
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
                  <span className="font-mono text-white">{result.hsscWeighted.toFixed(3)}%</span>
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
                  <span className="font-mono text-white">{result.sscWeighted.toFixed(3)}%</span>
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
                    Eligible
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

          <div className="mt-6">
            <Link
              href="/uet-taxila/admissions"
              className="block w-full text-center rounded-lg bg-[#d9b451] px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-colors min-h-[44px] flex items-center justify-center"
            >
              View 2026 Admissions Guide &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Historical Merit Benchmark Table */}
      <div className="mt-10 pt-8 border-t border-white/10">
        <h3 className="text-base font-bold text-white mb-2">
          Estimated Department Closing Merit Benchmarks
        </h3>
        <p className="text-xs text-[#a1a1aa] mb-4">
          Compare your aggregate of{" "}
          <strong className="text-white">{result.aggregate.toFixed(2)}%</strong> against recent
          closing merit trends.
        </p>

        <div className="overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-xs text-[#d4d4d8]">
            <thead className="bg-[#14151a] text-[#a1a1aa] uppercase font-mono tracking-wider">
              <tr>
                <th className="px-4 py-3">Discipline</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Est. Closing Merit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#09090b]">
              {HISTORICAL_BENCHMARKS.map((dept) => {
                const diff = result.aggregate - dept.estimatedMerit;
                const isLikely = diff >= 0;
                const isBorderline = diff >= -1.5 && diff < 0;

                return (
                  <tr key={dept.department} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{dept.department}</td>
                    <td className="px-4 py-3 text-[#a1a1aa]">{dept.category}</td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#d9b451]">
                      ~{dept.estimatedMerit.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3">
                      {isLikely ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400 border border-emerald-500/20">
                          Competitive ({diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`})
                        </span>
                      ) : isBorderline ? (
                        <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-400 border border-amber-500/20">
                          Borderline ({diff.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-500/10 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400 border border-zinc-500/20">
                          Reach ({diff.toFixed(1)}%)
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
