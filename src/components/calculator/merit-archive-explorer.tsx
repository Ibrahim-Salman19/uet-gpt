"use client";

import { Search, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { MERIT_ARCHIVE_DATA } from "@/lib/merit-archive-data";

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
