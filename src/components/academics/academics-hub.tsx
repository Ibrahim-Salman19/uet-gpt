"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/dates";
import { PROGRAMS_DATA } from "@/lib/programs-data";

type AcademicTab = "programs" | "calendar" | "resources";

const TABS: { id: AcademicTab; label: string; badge?: string; desc: string }[] = [
  {
    id: "programs",
    label: "14 Degree Curriculums",
    badge: "PEC Level-II",
    desc: "4-year semester roadmaps, course credit hours, and syllabi for all disciplines",
  },
  {
    id: "calendar",
    label: "Academic Calendar",
    badge: `${CURRENT_ACADEMIC_YEAR}`,
    desc: "Admissions schedule, semester commencement, midterm assessments, and exams",
  },
  {
    id: "resources",
    label: "Past Papers & OBE Grading",
    badge: "Washington Accord",
    desc: "Course Learning Outcomes (CLOs), exam rubrics, and Central Library access",
  },
];

const CALENDAR_EVENTS = [
  {
    date: "July 15 - August 10, 2026",
    title: "ECAT 2026 Registration Window",
    desc: "Online registration for the combined engineering entrance exam on the admission portal.",
  },
  {
    date: "August 15 - August 22, 2026",
    title: "ECAT Examination Conduction",
    desc: "Computer-based testing across multiple designated testing centers across Pakistan.",
  },
  {
    date: "August 28, 2026",
    title: "ECAT Official Results Announcement",
    desc: "Publication of computerized scores and individual percentile ranks.",
  },
  {
    date: "September 05, 2026",
    title: "First Merit List Announcement",
    desc: "Display of 1st merit list for Category A (Subsidized) and Category S (Self-Finance).",
  },
  {
    date: "September 28, 2026",
    title: "Freshmen Orientation & Classes Commence",
    desc: "Official orientation day and commencement of regular Fall 2026 undergraduate classes.",
  },
  {
    date: "November 23 - November 28, 2026",
    title: "Mid-Semester Examination Week",
    desc: "Centralized 9th-week written assessments mapped directly to course CLOs.",
  },
  {
    date: "January 25 - February 06, 2027",
    title: "End-Semester Final Examinations",
    desc: "Comprehensive 18th-week final theory exams and Open-Ended Lab (OEL) assessments.",
  },
];

export function AcademicsHub() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as AcademicTab) || "programs";
  const [activeTab, setActiveTab] = useState<AcademicTab>(
    ["programs", "calendar", "resources"].includes(initialTab) ? initialTab : "programs",
  );
  const [degreeFilter, setDegreeFilter] = useState<"all" | "engineering" | "computing">("all");

  const filteredPrograms = PROGRAMS_DATA.filter((p) => {
    if (degreeFilter === "all") return true;
    if (degreeFilter === "computing") return p.degreeType === "BS Computing";
    if (degreeFilter === "engineering") return p.degreeType === "BSc Engineering";
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Tab Selector Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        {activeTab === "programs" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  14 Undergraduate Degree Curriculums
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  Accredited by Pakistan Engineering Council (PEC) under Washington Accord Level-II.
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#07080a] p-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setDegreeFilter("all")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    degreeFilter === "all"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  All (14)
                </button>
                <button
                  type="button"
                  onClick={() => setDegreeFilter("engineering")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    degreeFilter === "engineering"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  BSc Engineering (9)
                </button>
                <button
                  type="button"
                  onClick={() => setDegreeFilter("computing")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    degreeFilter === "computing"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  BS Computing (5)
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPrograms.map((prog) => (
                <Link
                  key={prog.slug}
                  href={`/uet-taxila/programs/${prog.slug}`}
                  className="group flex flex-col justify-between rounded-xl border border-white/10 bg-[#07080a] p-5 transition-all hover:border-[#d9b451]/50 hover:bg-white/[0.02]"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                        {prog.degreeType} &bull; {prog.totalCreditHours} Credits
                      </span>
                      <span className="font-mono text-[10px] text-[#71717a]">{prog.duration}</span>
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-white group-hover:text-[#d9b451] transition-colors">
                      {prog.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-[#a1a1aa] line-clamp-2">{prog.lead}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px] font-mono text-[#d9b451]">
                    <span>View 8-Semester Roadmap</span>
                    <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Academic Calendar &amp; Central Timetable {CURRENT_ACADEMIC_YEAR}
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Official milestone schedule for entrance tests, admissions clearance, semester
                starts, and examinations.
              </p>
            </div>

            <div className="space-y-3">
              {CALENDAR_EVENTS.map((event, idx) => (
                <div
                  key={event.title}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#07080a] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d9b451]/20 font-mono text-[11px] font-bold text-[#d9b451]">
                      {idx + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-white">{event.title}</h3>
                      <p className="mt-0.5 text-xs text-[#a1a1aa]">{event.desc}</p>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs font-semibold text-[#d9b451] sm:text-right">
                    {event.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "resources" && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-bold text-white">
                Outcome-Based Education (OBE) &amp; Study Resources
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Assessment rubrics, Central Library digital resources, and semester past paper
                archives.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="font-mono text-[10px] font-bold text-[#d9b451] uppercase">
                  Continuous (20% – 30%)
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">Quizzes &amp; CEPs</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  3-4 announced quizzes, numerical problem sets, and a team-based Complex
                  Engineering Problem (Bloom&apos;s C3-C5).
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="font-mono text-[10px] font-bold text-[#d9b451] uppercase">
                  Midterm (20% – 25%)
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">9th-Week Exam</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Centralized 90-minute examination covering the first 8 weeks of course syllabi
                  with explicit CLO mapping.
                </p>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <span className="font-mono text-[10px] font-bold text-[#d9b451] uppercase">
                  Final Exam (40% – 50%)
                </span>
                <h3 className="mt-2 text-sm font-bold text-white">18th-Week Exam</h3>
                <p className="mt-1 text-xs text-[#a1a1aa] leading-relaxed">
                  Comprehensive 3-hour examination covering the entire semester syllabus. 50%
                  cumulative threshold required for CLO attainment.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#07080a] p-6">
              <h3 className="text-sm font-bold text-white">
                Dr. Muhammad Akram Central Library &amp; Digital Databases
              </h3>
              <p className="mt-2 text-xs text-[#a1a1aa] leading-relaxed">
                Campus-wide optical fiber terminals provide full-text institutional access to IEEE
                Xplore, ScienceDirect, SpringerLink, and the HEC National Digital Library. Students
                can borrow up to 6 core prescribed textbooks for the full semester via the Book Bank
                program.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
