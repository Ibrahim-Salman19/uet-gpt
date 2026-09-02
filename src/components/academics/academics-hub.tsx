"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CURRENT_ACADEMIC_YEAR } from "@/lib/dates";
import { PROGRAMS_DATA, type ProgramDetail } from "@/lib/programs-data";

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
    category: "admissions",
    date: "July 15 - August 10, 2026",
    title: "ECAT 2026 Registration Window",
    desc: "Online registration for the combined engineering entrance exam on the admission portal.",
  },
  {
    category: "admissions",
    date: "August 15 - August 22, 2026",
    title: "ECAT Examination Conduction",
    desc: "Computer-based testing across multiple designated testing centers across Pakistan.",
  },
  {
    category: "admissions",
    date: "August 28, 2026",
    title: "ECAT Official Results Announcement",
    desc: "Publication of computerized scores and individual percentile ranks.",
  },
  {
    category: "admissions",
    date: "September 05, 2026",
    title: "First Merit List Announcement",
    desc: "Display of 1st merit list for Category A (Subsidized) and Category S (Self-Finance).",
  },
  {
    category: "classes",
    date: "September 28, 2026",
    title: "Freshmen Orientation & Classes Commence",
    desc: "Official orientation day and commencement of regular Fall 2026 undergraduate classes.",
  },
  {
    category: "exams",
    date: "November 23 - November 28, 2026",
    title: "Mid-Semester Examination Week",
    desc: "Centralized 9th-week written assessments mapped directly to course CLOs.",
  },
  {
    category: "exams",
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
  const [degreeFilter, setDegreeFilter] = useState<
    "all" | "engineering" | "computing" | "sciences"
  >("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [calendarCategory, setCalendarCategory] = useState<
    "all" | "admissions" | "classes" | "exams"
  >("all");
  const [selectedProgram, setSelectedProgram] = useState<ProgramDetail | null>(null);

  const filteredPrograms = useMemo(() => {
    return PROGRAMS_DATA.filter((p) => {
      // Degree type filter
      if (degreeFilter === "computing" && p.degreeType !== "BS Computing") return false;
      if (degreeFilter === "engineering" && p.degreeType !== "BSc Engineering") return false;
      if (degreeFilter === "sciences" && p.degreeType !== "BS Basic Sciences") return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(query) ||
          p.department.toLowerCase().includes(query) ||
          p.faculty.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [degreeFilter, searchQuery]);

  const filteredCalendar = useMemo(() => {
    if (calendarCategory === "all") return CALENDAR_EVENTS;
    return CALENDAR_EVENTS.filter((e) => e.category === calendarCategory);
  }, [calendarCategory]);

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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  14 Undergraduate Degree Curriculums
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  Accredited by Pakistan Engineering Council (PEC) under Washington Accord Level-II
                  &amp; NCEAC Category &apos;W&apos;. Click any card for instant syllabus preview.
                </p>
              </div>

              {/* Live Search Input */}
              <div className="w-full md:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search degree or department..."
                  className="w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2 text-xs text-white placeholder-[#71717a] focus:border-[#d9b451] focus:outline-none"
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2 border-b border-white/5 pb-4 font-mono text-xs">
              <button
                type="button"
                onClick={() => setDegreeFilter("all")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  degreeFilter === "all"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "border border-white/10 text-[#a1a1aa] hover:text-white"
                }`}
              >
                All Programs ({PROGRAMS_DATA.length})
              </button>
              <button
                type="button"
                onClick={() => setDegreeFilter("engineering")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  degreeFilter === "engineering"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "border border-white/10 text-[#a1a1aa] hover:text-white"
                }`}
              >
                BSc Engineering (9)
              </button>
              <button
                type="button"
                onClick={() => setDegreeFilter("computing")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  degreeFilter === "computing"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "border border-white/10 text-[#a1a1aa] hover:text-white"
                }`}
              >
                BS Computing (2)
              </button>
              <button
                type="button"
                onClick={() => setDegreeFilter("sciences")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${
                  degreeFilter === "sciences"
                    ? "bg-[#d9b451] text-[#07080a] font-bold"
                    : "border border-white/10 text-[#a1a1aa] hover:text-white"
                }`}
              >
                BS Basic Sciences (3)
              </button>
            </div>

            {/* Programs Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredPrograms.map((prog) => (
                <button
                  type="button"
                  key={prog.slug}
                  onClick={() => setSelectedProgram(prog)}
                  className="group flex flex-col justify-between rounded-xl border border-white/10 bg-[#07080a] p-5 text-left transition-all hover:border-[#d9b451]/50 hover:bg-white/[0.02] cursor-pointer"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                        {prog.degreeType} &bull; {prog.totalCreditHours} CH
                      </span>
                      <span className="font-mono text-[10px] text-emerald-400">
                        {prog.accreditationBody}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-bold text-white group-hover:text-[#d9b451] transition-colors">
                      {prog.name}
                    </h3>
                    <p className="mt-1 text-[11px] font-mono text-[#71717a]">{prog.department}</p>
                    <p className="mt-2 text-xs text-[#a1a1aa] line-clamp-2 leading-relaxed">
                      {prog.lead}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-3 text-xs font-mono text-[#d9b451]">
                    <span>Closing Merit: {prog.benchmarkClosingMerit}</span>
                    <span className="group-hover:translate-x-1 transition-transform font-bold">
                      View Syllabus &rarr;
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Instant Syllabus Preview Modal */}
            {selectedProgram && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#d9b451]/40 bg-[#0c0d10] p-6 sm:p-8 shadow-2xl space-y-6">
                  <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded bg-[#d9b451]/10 px-2.5 py-0.5 text-xs font-mono font-bold text-[#d9b451] mb-2">
                        <span>{selectedProgram.degreeType}</span> &bull;{" "}
                        <span>{selectedProgram.duration}</span> &bull;{" "}
                        <span>{selectedProgram.totalCreditHours} Credit Hours</span>
                      </div>
                      <h2 className="text-2xl font-bold text-white">{selectedProgram.name}</h2>
                      <p className="text-xs font-mono text-emerald-400 mt-0.5">
                        {selectedProgram.accreditation} &bull; {selectedProgram.obeLevel}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProgram(null)}
                      className="rounded-lg border border-white/10 bg-[#14151a] px-3 py-1.5 text-xs font-mono text-[#a1a1aa] hover:text-white"
                    >
                      &times; Close
                    </button>
                  </div>

                  {/* Program Description */}
                  <p className="text-xs sm:text-sm text-[#a1a1aa] leading-relaxed">
                    {selectedProgram.lead}
                  </p>

                  {/* Semesters Roadmap Preview */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-3">
                      Core Semester Roadmap (Sample Semesters 1 &amp; 2):
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {selectedProgram.semesters.map((sem) => (
                        <div
                          key={sem.semesterNumber}
                          className="rounded-xl border border-white/10 bg-[#07080a] p-4 space-y-2"
                        >
                          <div className="flex items-center justify-between font-mono text-xs font-bold text-[#d9b451] border-b border-white/5 pb-1.5">
                            <span>Semester {sem.semesterNumber}</span>
                            <span>{sem.totalCredits} Credit Hours</span>
                          </div>
                          <ul className="space-y-1 text-xs">
                            {sem.courses.map((c) => (
                              <li
                                key={c.code}
                                className="flex items-center justify-between text-[#d4d4d8]"
                              >
                                <span className="font-mono text-[11px] text-[#71717a]">
                                  {c.code}: {c.title}
                                </span>
                                <span className="font-mono text-[10px] text-[#d9b451] font-bold">
                                  {c.creditHours}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Laboratory Infrastructure */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2">
                      Departmental Laboratories &amp; Research Centers:
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProgram.labs.map((lab) => (
                        <span
                          key={lab}
                          className="rounded-lg border border-white/10 bg-[#14151a] px-2.5 py-1 text-xs font-mono text-zinc-300"
                        >
                          {lab}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Career Pathways */}
                  <div>
                    <h3 className="text-sm font-bold text-white mb-2">Key Career Destinations:</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedProgram.careerProspects.map((dest) => (
                        <span
                          key={dest}
                          className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-xs font-mono text-emerald-300"
                        >
                          {dest}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <Link
                      href={`/tools?tab=merit`}
                      className="w-full sm:w-auto rounded-lg border border-[#d9b451] bg-[#d9b451]/10 px-4 py-2 text-center text-xs font-mono font-bold text-[#d9b451] hover:bg-[#d9b451] hover:text-[#07080a] transition-colors"
                    >
                      Calculate Merit for this Degree &rarr;
                    </Link>
                    <Link
                      href={`/uet-taxila/programs/${selectedProgram.slug}`}
                      className="w-full sm:w-auto rounded-lg bg-[#d9b451] px-4 py-2 text-center text-xs font-mono font-bold text-[#07080a] hover:bg-[#f0d178] transition-colors"
                    >
                      Full 8-Semester Syllabus Page &rarr;
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "calendar" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Academic Calendar &amp; Milestone Schedule {CURRENT_ACADEMIC_YEAR}
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  Official dates for entrance tests, merit admissions clearance, semester starts,
                  and examinations.
                </p>
              </div>

              {/* Category Filter */}
              <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#07080a] p-1 font-mono text-xs">
                <button
                  type="button"
                  onClick={() => setCalendarCategory("all")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    calendarCategory === "all"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarCategory("admissions")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    calendarCategory === "admissions"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  Admissions
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarCategory("classes")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    calendarCategory === "classes"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  Classes
                </button>
                <button
                  type="button"
                  onClick={() => setCalendarCategory("exams")}
                  className={`rounded px-2.5 py-1 transition-colors ${
                    calendarCategory === "exams"
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  Exams
                </button>
              </div>
            </div>

            <div className="divide-y divide-white/5 rounded-xl border border-white/10 bg-[#07080a]">
              {filteredCalendar.map((item) => (
                <div
                  key={item.title}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 gap-2 hover:bg-white/[0.01] transition-colors"
                >
                  <div className="space-y-1">
                    <span className="font-mono text-xs text-[#d9b451] font-bold uppercase tracking-wider block">
                      {item.date}
                    </span>
                    <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                    <p className="text-xs text-[#a1a1aa]">{item.desc}</p>
                  </div>
                  <span
                    className={`self-start sm:self-center shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-mono capitalize ${
                      item.category === "admissions"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : item.category === "classes"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                    }`}
                  >
                    {item.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "resources" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                OBE Examination Rubrics &amp; Academic Regulations
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Statutory grading policies compliant with PEC Level-II Washington Accord guidelines.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#d9b451]">
                  Outcome-Based Education (OBE) Weightage
                </h3>
                <ul className="space-y-2 text-xs text-[#a1a1aa] leading-relaxed">
                  <li>
                    &bull; <strong className="text-white">Continuous Assessments (20-30%):</strong>{" "}
                    Quizzes, assignments, and Complex Engineering Problems (CEPs).
                  </li>
                  <li>
                    &bull; <strong className="text-white">Midterm Exam (20-25%):</strong> Formal
                    written examination testing CLO-1 and CLO-2 cognitive levels.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Final Exam (40-50%):</strong>{" "}
                    Comprehensive 18th-week assessment covering all course CLOs.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5 space-y-3">
                <h3 className="text-sm font-bold text-[#d9b451]">
                  Academic Probation &amp; Good Standing
                </h3>
                <ul className="space-y-2 text-xs text-[#a1a1aa] leading-relaxed">
                  <li>
                    &bull; <strong className="text-white">Good Standing:</strong> Cumulative CGPA
                    &ge; 2.00 across all registered semester credit hours.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Probation 1:</strong> Triggered when SGPA
                    drops below 2.00 in any semester.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Course Retakes:</strong> Allowed for
                    grades of &apos;C-&apos;, &apos;D&apos;, or &apos;F&apos; to replace earlier
                    quality points.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
