"use client";

import { useId, useMemo, useState } from "react";

interface CourseRow {
  id: string;
  name: string;
  creditHours: number;
  grade: string;
}

const GRADE_POINTS: Record<string, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  F: 0.0,
};

const INITIAL_COURSES: CourseRow[] = [
  { id: "1", name: "Engineering Mechanics / Programming", creditHours: 3, grade: "A" },
  { id: "2", name: "Calculus & Analytical Geometry", creditHours: 3, grade: "B+" },
  { id: "3", name: "Applied Physics", creditHours: 3, grade: "A-" },
  { id: "4", name: "Functional English", creditHours: 2, grade: "A" },
  { id: "5", name: "Engineering Drawing & Workshop / Lab", creditHours: 2, grade: "B+" },
  { id: "6", name: "Islamic / Pakistan Studies", creditHours: 2, grade: "A" },
];

export function GpaCalculator() {
  const [courses, setCourses] = useState<CourseRow[]>(INITIAL_COURSES);
  const [previousCgpa, setPreviousCgpa] = useState<string>("");
  const [previousCredits, setPreviousCredits] = useState<string>("");

  const prevCgpaId = useId();
  const prevCreditsId = useId();

  const addCourse = () => {
    const nextId = String(Date.now());
    setCourses((prev) => [
      ...prev,
      { id: nextId, name: `Course ${prev.length + 1}`, creditHours: 3, grade: "B" },
    ]);
  };

  const removeCourse = (id: string) => {
    if (courses.length <= 1) return;
    setCourses((prev) => prev.filter((c) => c.id !== id));
  };

  const updateCourse = (id: string, field: keyof CourseRow, value: string | number) => {
    setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const calculation = useMemo(() => {
    let currentTotalPoints = 0;
    let currentTotalCredits = 0;

    for (const course of courses) {
      const pts = GRADE_POINTS[course.grade] ?? 0;
      const ch = Number(course.creditHours) || 0;
      currentTotalPoints += pts * ch;
      currentTotalCredits += ch;
    }

    const gpa = currentTotalCredits > 0 ? currentTotalPoints / currentTotalCredits : 0;

    // Cumulative calculation
    const prevCgpaNum = Number.parseFloat(previousCgpa) || 0;
    const prevCreditsNum = Number.parseFloat(previousCredits) || 0;

    const cumulativePoints = prevCgpaNum * prevCreditsNum + currentTotalPoints;
    const cumulativeCredits = prevCreditsNum + currentTotalCredits;

    const cgpa = cumulativeCredits > 0 ? cumulativePoints / cumulativeCredits : gpa;

    return {
      currentGpa: Number(gpa.toFixed(3)),
      currentCredits: currentTotalCredits,
      cumulativeCgpa: Number(cgpa.toFixed(3)),
      cumulativeCredits,
      isProbation: gpa < 2.0 && currentTotalCredits > 0,
      isDeanList: gpa >= 3.7 && currentTotalCredits >= 12,
    };
  }, [courses, previousCgpa, previousCredits]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form: Semester Courses */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Semester Courses &amp; Grades</h2>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Official UET Taxila 4.00 grading scale. Add course titles, credit hours, and
                expected letter grades.
              </p>
            </div>
            <button
              type="button"
              onClick={addCourse}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9b451]/50 bg-[#d9b451]/10 px-3 py-1.5 text-xs font-mono font-semibold text-[#d9b451] hover:bg-[#d9b451]/20 transition-colors w-fit"
            >
              <span>+ Add Course</span>
            </button>
          </div>

          {/* Courses Table / List */}
          <div className="space-y-3">
            {courses.map((course, idx) => (
              <div
                key={course.id}
                className="grid grid-cols-12 gap-2.5 items-center p-3 rounded-xl border border-white/5 bg-[#14151a]"
              >
                {/* Course Name */}
                <div className="col-span-6 sm:col-span-6">
                  <input
                    type="text"
                    value={course.name}
                    aria-label={`Course ${idx + 1} Name`}
                    onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#07080a] px-3 py-2 text-xs text-white focus:border-[#d9b451] focus:outline-none"
                    placeholder="Course name"
                  />
                </div>

                {/* Credit Hours */}
                <div className="col-span-3 sm:col-span-2">
                  <select
                    value={course.creditHours}
                    aria-label={`Course ${idx + 1} Credit Hours`}
                    onChange={(e) => updateCourse(course.id, "creditHours", Number(e.target.value))}
                    className="w-full rounded-lg border border-white/10 bg-[#07080a] px-2 py-2 text-xs text-white focus:border-[#d9b451] focus:outline-none font-mono"
                  >
                    <option value={1}>1 CH</option>
                    <option value={2}>2 CH</option>
                    <option value={3}>3 CH</option>
                    <option value={4}>4 CH</option>
                  </select>
                </div>

                {/* Grade */}
                <div className="col-span-2 sm:col-span-3">
                  <select
                    value={course.grade}
                    aria-label={`Course ${idx + 1} Grade`}
                    onChange={(e) => updateCourse(course.id, "grade", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#07080a] px-2 py-2 text-xs text-[#d9b451] focus:border-[#d9b451] focus:outline-none font-mono font-bold"
                  >
                    {Object.entries(GRADE_POINTS).map(([letter, pts]) => (
                      <option key={letter} value={letter}>
                        {letter} ({pts.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Remove Button */}
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() => removeCourse(course.id)}
                    disabled={courses.length <= 1}
                    className="text-[#71717a] hover:text-rose-400 disabled:opacity-30 transition-colors p-1"
                    aria-label="Remove Course"
                  >
                    &times;
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Optional Previous CGPA Inputs for Cumulative calculation */}
          <div className="rounded-xl border border-white/10 bg-[#14151a] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
              Cumulative CGPA Projection (Optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor={prevCgpaId} className="text-[#a1a1aa] block mb-1">
                  Previous CGPA (e.g. 3.45):
                </label>
                <input
                  id={prevCgpaId}
                  type="number"
                  step="0.01"
                  min="0"
                  max="4.0"
                  value={previousCgpa}
                  onChange={(e) => setPreviousCgpa(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-[#07080a] px-3 py-2 text-white focus:border-[#d9b451] focus:outline-none font-mono"
                />
              </div>
              <div>
                <label htmlFor={prevCreditsId} className="text-[#a1a1aa] block mb-1">
                  Total Completed Credit Hours:
                </label>
                <input
                  id={prevCreditsId}
                  type="number"
                  min="0"
                  max="160"
                  value={previousCredits}
                  onChange={(e) => setPreviousCredits(e.target.value)}
                  placeholder="e.g. 36"
                  className="w-full rounded-lg border border-white/10 bg-[#07080a] px-3 py-2 text-white focus:border-[#d9b451] focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Output: GPA Summary Card */}
        <div className="lg:col-span-4 rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl flex flex-col justify-between">
          <div className="space-y-6">
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#a1a1aa] block">
                Calculated Standing
              </span>
              <span className="text-xs font-semibold text-[#d9b451]">UET Taxila Regulations</span>
            </div>

            {/* Semester GPA */}
            <div className="text-center py-4 bg-white/5 rounded-xl border border-white/5">
              <span className="text-xs text-[#a1a1aa] uppercase tracking-wider block mb-1">
                Semester GPA (SGPA)
              </span>
              <span className="text-4xl sm:text-5xl font-extrabold font-mono text-[#d9b451]">
                {calculation.currentGpa.toFixed(3)}
              </span>
              <span className="text-[11px] text-[#71717a] block mt-1">
                {calculation.currentCredits} Semester Credit Hours
              </span>
            </div>

            {/* Cumulative CGPA */}
            <div className="p-4 bg-[#07080a] rounded-xl border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#a1a1aa] block">Cumulative CGPA</span>
                <span className="text-xs font-mono text-white">
                  {calculation.cumulativeCredits} Total Credits
                </span>
              </div>
              <span className="text-2xl font-bold font-mono text-white">
                {calculation.cumulativeCgpa.toFixed(3)}
              </span>
            </div>

            {/* Standing Alerts */}
            {calculation.isProbation && (
              <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                ⚠️ <strong>Academic Warning / Probation:</strong> Semester GPA is below 2.00.
                Students must maintain CGPA $\ge 2.00$ to avoid academic dismissal.
              </div>
            )}

            {calculation.isDeanList && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
                🌟 <strong>Dean&apos;s Honors List:</strong> Outstanding academic performance
                ($\text{SGPA} \ge 3.70$).
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#71717a] text-center">
            Scale: A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0, C-=1.7, D=1.0, F=0.0
          </div>
        </div>
      </div>
    </div>
  );
}
