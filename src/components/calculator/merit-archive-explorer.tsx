"use client";

import { Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";

export interface MeritArchiveRow {
  discipline: string;
  degree: string;
  categoryA_2022: string;
  categoryA_2023: string;
  categoryA_2024: string;
  categoryA_2025: string;
  categoryS_2025: string;
  trend: "rising" | "stable" | "competitive";
}

export const MERIT_ARCHIVE_DATA: MeritArchiveRow[] = [
  {
    discipline: "Computer Science",
    degree: "BS Computer Science",
    categoryA_2022: "78.910%",
    categoryA_2023: "79.450%",
    categoryA_2024: "80.120%",
    categoryA_2025: "80.450%",
    categoryS_2025: "74.800%",
    trend: "rising",
  },
  {
    discipline: "Software Engineering",
    degree: "BS Software Engineering",
    categoryA_2022: "77.850%",
    categoryA_2023: "78.600%",
    categoryA_2024: "79.350%",
    categoryA_2025: "79.820%",
    categoryS_2025: "73.950%",
    trend: "rising",
  },
  {
    discipline: "Computer Engineering",
    degree: "BSc Computer Engineering",
    categoryA_2022: "75.400%",
    categoryA_2023: "76.100%",
    categoryA_2024: "76.650%",
    categoryA_2025: "76.900%",
    categoryS_2025: "71.200%",
    trend: "rising",
  },
  {
    discipline: "Electrical Engineering",
    degree: "BSc Electrical Engineering",
    categoryA_2022: "74.800%",
    categoryA_2023: "74.200%",
    categoryA_2024: "74.050%",
    categoryA_2025: "74.150%",
    categoryS_2025: "68.500%",
    trend: "stable",
  },
  {
    discipline: "Mechanical Engineering",
    degree: "BSc Mechanical Engineering",
    categoryA_2022: "74.500%",
    categoryA_2023: "73.900%",
    categoryA_2024: "73.750%",
    categoryA_2025: "73.890%",
    categoryS_2025: "67.900%",
    trend: "stable",
  },
  {
    discipline: "Mechatronics Engineering",
    degree: "BSc Mechatronics Engineering",
    categoryA_2022: "73.100%",
    categoryA_2023: "72.900%",
    categoryA_2024: "72.700%",
    categoryA_2025: "72.840%",
    categoryS_2025: "66.400%",
    trend: "stable",
  },
  {
    discipline: "Civil Engineering",
    degree: "BSc Civil Engineering",
    categoryA_2022: "72.600%",
    categoryA_2023: "71.800%",
    categoryA_2024: "71.300%",
    categoryA_2025: "71.420%",
    categoryS_2025: "65.800%",
    trend: "stable",
  },
  {
    discipline: "Electronics Engineering",
    degree: "BSc Electronics Engineering",
    categoryA_2022: "71.900%",
    categoryA_2023: "71.200%",
    categoryA_2024: "70.950%",
    categoryA_2025: "71.100%",
    categoryS_2025: "65.100%",
    trend: "stable",
  },
  {
    discipline: "Telecommunication Engineering",
    degree: "BSc Telecommunication Engineering",
    categoryA_2022: "71.200%",
    categoryA_2023: "70.500%",
    categoryA_2024: "70.100%",
    categoryA_2025: "70.150%",
    categoryS_2025: "64.300%",
    trend: "stable",
  },
  {
    discipline: "Industrial Engineering",
    degree: "BSc Industrial Engineering",
    categoryA_2022: "70.800%",
    categoryA_2023: "70.100%",
    categoryA_2024: "69.700%",
    categoryA_2025: "69.800%",
    categoryS_2025: "63.900%",
    trend: "stable",
  },
  {
    discipline: "Environmental Engineering",
    degree: "BSc Environmental Engineering",
    categoryA_2022: "69.500%",
    categoryA_2023: "68.900%",
    categoryA_2024: "68.400%",
    categoryA_2025: "68.500%",
    categoryS_2025: "62.500%",
    trend: "stable",
  },
  {
    discipline: "BS Mathematics",
    degree: "BS Basic Sciences",
    categoryA_2022: "66.200%",
    categoryA_2023: "65.800%",
    categoryA_2024: "65.100%",
    categoryA_2025: "65.200%",
    categoryS_2025: "58.500%",
    trend: "stable",
  },
  {
    discipline: "BS Physics",
    degree: "BS Basic Sciences",
    categoryA_2022: "65.900%",
    categoryA_2023: "65.400%",
    categoryA_2024: "64.700%",
    categoryA_2025: "64.800%",
    categoryS_2025: "58.000%",
    trend: "stable",
  },
  {
    discipline: "BS Chemistry",
    degree: "BS Basic Sciences",
    categoryA_2022: "65.400%",
    categoryA_2023: "65.000%",
    categoryA_2024: "64.300%",
    categoryA_2025: "64.500%",
    categoryS_2025: "57.500%",
    trend: "stable",
  },
];

export function MeritArchiveExplorer() {
  const [query, setQuery] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");

  const filtered = useMemo(() => {
    return MERIT_ARCHIVE_DATA.filter((row) => {
      const matchesSearch =
        query.trim() === "" ||
        row.discipline.toLowerCase().includes(query.toLowerCase()) ||
        row.degree.toLowerCase().includes(query.toLowerCase());
      const matchesDiscipline =
        selectedDiscipline === "all" ||
        (selectedDiscipline === "computing" &&
          (row.discipline.includes("Computer") || row.discipline.includes("Software"))) ||
        (selectedDiscipline === "engineering" && row.degree.startsWith("BSc")) ||
        (selectedDiscipline === "sciences" && row.degree.includes("Sciences"));
      return matchesSearch && matchesDiscipline;
    });
  }, [query, selectedDiscipline]);

  return (
    <div className="space-y-6">
      {/* Search & Discipline Filter */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717a]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search disciplines (e.g. Software, Electrical, Civil)..."
            className="w-full rounded-xl border border-white/10 bg-[#0c0d10] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#71717a] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
          />
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All 14 Programs" },
            { id: "computing", label: "Computing (CS/SE/CP)" },
            { id: "engineering", label: "Core Engineering" },
            { id: "sciences", label: "Basic Sciences" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedDiscipline(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDiscipline === tab.id
                  ? "bg-[#d9b451] text-[#07080a]"
                  : "bg-[#14151a] text-[#a1a1aa] hover:text-white border border-white/5"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#0c0d10]">
        <table className="w-full text-left text-xs sm:text-sm font-mono border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-[#14151a] text-zinc-400">
              <th className="px-4 py-3 font-sans font-semibold">Discipline</th>
              <th className="px-3 py-3 text-center">2022 (A)</th>
              <th className="px-3 py-3 text-center">2023 (A)</th>
              <th className="px-3 py-3 text-center">2024 (A)</th>
              <th className="px-3 py-3 text-center text-[#d9b451] font-bold">2025 (A)</th>
              <th className="px-3 py-3 text-center text-emerald-400">2025 (S)</th>
              <th className="px-3 py-3 text-center font-sans">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filtered.map((row) => (
              <tr key={row.discipline} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 font-sans">
                  <div className="font-semibold text-white">{row.discipline}</div>
                  <div className="text-[10px] text-[#71717a]">{row.degree}</div>
                </td>
                <td className="px-3 py-3 text-center text-[#a1a1aa]">{row.categoryA_2022}</td>
                <td className="px-3 py-3 text-center text-[#a1a1aa]">{row.categoryA_2023}</td>
                <td className="px-3 py-3 text-center text-[#a1a1aa]">{row.categoryA_2024}</td>
                <td className="px-3 py-3 text-center font-bold text-[#d9b451] bg-[#d9b451]/5">
                  {row.categoryA_2025}
                </td>
                <td className="px-3 py-3 text-center text-emerald-400">{row.categoryS_2025}</td>
                <td className="px-3 py-3 text-center font-sans">
                  {row.trend === "rising" ? (
                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      <TrendingUp className="h-3 w-3" /> Rising
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 bg-zinc-800/40 px-2 py-0.5 rounded-full border border-zinc-700/40">
                      Stable
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/5 bg-[#14151a] p-4 text-xs text-[#a1a1aa] flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          <strong>Legend:</strong> (A) = Category A Subsidized Open Merit Punjab &bull; (S) =
          Category S Partial-Subsidized All Pakistan.
        </span>
        <span className="text-[#d9b451]">Formula: 33% ECAT + 50% HSSC + 17% SSC</span>
      </div>
    </div>
  );
}
