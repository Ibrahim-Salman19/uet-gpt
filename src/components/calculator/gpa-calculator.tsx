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

const PRESETS: Record<string, { label: string; courses: CourseRow[] }> = {
  eng_sem1: {
    label: "BSc Engineering Sem 1 (18 CH)",
    courses: [
      { id: "1", name: "Linear Circuit Analysis / Statics", creditHours: 4, grade: "A" },
      { id: "2", name: "Calculus & Analytical Geometry", creditHours: 3, grade: "B+" },
      { id: "3", name: "Applied Physics", creditHours: 3, grade: "A-" },
      { id: "4", name: "Functional English", creditHours: 3, grade: "A" },
      { id: "5", name: "Engineering Drawing & Workshop Practice", creditHours: 3, grade: "B+" },
      { id: "6", name: "Islamic Studies / Ethics", creditHours: 2, grade: "A" },
    ],
  },
  cs_sem1: {
    label: "BS Computer Science Sem 1 (17 CH)",
    courses: [
      { id: "1", name: "Programming Fundamentals", creditHours: 4, grade: "A" },
      { id: "2", name: "Application of Information Technologies", creditHours: 3, grade: "A-" },
      { id: "3", name: "Calculus & Analytical Geometry", creditHours: 3, grade: "B+" },
      { id: "4", name: "Functional English", creditHours: 3, grade: "A" },
      { id: "5", name: "Applied Physics", creditHours: 2, grade: "A" },
      { id: "6", name: "Pakistan Studies", creditHours: 2, grade: "A" },
    ],
  },
  deans_honor: {
    label: "Dean's Honors Target (3.80+ GPA)",
    courses: [
      { id: "1", name: "Core Engineering Subject I", creditHours: 4, grade: "A" },
      { id: "2", name: "Core Engineering Subject II", creditHours: 4, grade: "A" },
      { id: "3", name: "Applied Mathematics / Differential Equations", creditHours: 3, grade: "A" },
      { id: "4", name: "Engineering Laboratory Practice", creditHours: 2, grade: "A-" },
      { id: "5", name: "Technical Report Writing", creditHours: 3, grade: "A" },
    ],
  },
};

export function GpaCalculator() {
  const [mode, setMode] = useState<"semester" | "planner">("semester");
  const [courses, setCourses] = useState<CourseRow[]>(PRESETS.eng_sem1?.courses ?? []);
  const [previousCgpa, setPreviousCgpa] = useState<string>("");
  const [previousCredits, setPreviousCredits] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Future Planner State
  const [currentPlannerCgpa, setCurrentPlannerCgpa] = useState<number>(2.9);
  const [completedCredits, setCompletedCredits] = useState<number>(68);
  const [targetCgpa, setTargetCgpa] = useState<number>(3.3);
  const [totalDegreeCredits, setTotalDegreeCredits] = useState<number>(134);

  const prevCgpaId = useId();
  const prevCreditsId = useId();
  const plannerCurrentCgpaId = useId();
  const plannerCompletedCreditsId = useId();
  const plannerTargetCgpaId = useId();
  const plannerTotalCreditsId = useId();

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

  const loadPreset = (presetKey: string) => {
    if (PRESETS[presetKey]) {
      setCourses(PRESETS[presetKey].courses);
    }
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

  // Target Planner Calculations
  const plannerResult = useMemo(() => {
    const remainingCredits = Math.max(0, totalDegreeCredits - completedCredits);
    if (remainingCredits <= 0) {
      return { remainingCredits: 0, requiredGpa: 0, status: "completed" };
    }

    const targetTotalPoints = targetCgpa * totalDegreeCredits;
    const currentTotalPoints = currentPlannerCgpa * completedCredits;
    const requiredPoints = targetTotalPoints - currentTotalPoints;
    const requiredGpa = requiredPoints / remainingCredits;

    let status: "achievable" | "challenging" | "impossible" = "achievable";
    if (requiredGpa > 4.0) status = "impossible";
    else if (requiredGpa >= 3.5) status = "challenging";

    return {
      remainingCredits,
      requiredGpa: Number(requiredGpa.toFixed(2)),
      status,
    };
  }, [currentPlannerCgpa, completedCredits, targetCgpa, totalDegreeCredits]);

  const handleCopyTranscript = () => {
    const text = `UET Taxila SGPA Calculation: ${calculation.currentGpa.toFixed(3)} | Total Credits: ${calculation.currentCredits} CH\nCumulative CGPA: ${calculation.cumulativeCgpa.toFixed(3)} | Cumulative Credits: ${calculation.cumulativeCredits} CH\nCalculated via UET GPT (https://uet-gpt.vercel.app/tools?tab=gpa)`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("semester")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
              mode === "semester"
                ? "bg-[#d9b451] text-[#07080a]"
                : "border border-white/10 text-[#a1a1aa] hover:text-white"
            }`}
          >
            Semester SGPA Calculator
          </button>
          <button
            type="button"
            onClick={() => setMode("planner")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
              mode === "planner"
                ? "bg-[#d9b451] text-[#07080a]"
                : "border border-white/10 text-[#a1a1aa] hover:text-white"
            }`}
          >
            Target CGPA Planner
          </button>
        </div>
      </div>

      {mode === "semester" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Form: Semester Courses */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Semester Courses &amp; Quality Points
                </h3>
                <p className="text-xs text-[#a1a1aa] mt-0.5">
                  Official UET Taxila 4.00 grading regulations and course credit weightages.
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => loadPreset("eng_sem1")}
                  className="rounded-lg border border-white/10 bg-[#14151a] px-2 py-1 text-[11px] font-mono text-[#a1a1aa] hover:border-[#d9b451] hover:text-white transition-colors"
                >
                  Eng Sem-1
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset("cs_sem1")}
                  className="rounded-lg border border-white/10 bg-[#14151a] px-2 py-1 text-[11px] font-mono text-[#a1a1aa] hover:border-[#d9b451] hover:text-white transition-colors"
                >
                  CS Sem-1
                </button>
                <button
                  type="button"
                  onClick={() => loadPreset("deans_honor")}
                  className="rounded-lg border border-white/10 bg-[#14151a] px-2 py-1 text-[11px] font-mono text-[#d9b451] hover:border-[#d9b451] hover:bg-[#d9b451]/10 transition-colors"
                >
                  Dean&apos;s Honor Target
                </button>
              </div>
            </div>

            {/* Cumulative Prior Semesters (Optional) */}
            <div className="rounded-xl border border-white/10 bg-[#14151a]/50 p-4 space-y-3">
              <span className="text-xs font-mono uppercase tracking-wider text-[#d9b451] font-bold block">
                Optional: Cumulative CGPA Mode
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor={prevCgpaId} className="text-xs text-[#a1a1aa] block mb-1">
                    Previous Cumulative CGPA
                  </label>
                  <input
                    id={prevCgpaId}
                    type="number"
                    step="0.01"
                    min="0"
                    max="4"
                    value={previousCgpa}
                    onChange={(e) => setPreviousCgpa(e.target.value)}
                    placeholder="e.g. 3.45"
                    className="w-full rounded-lg border border-white/15 bg-[#07080a] px-3 py-1.5 text-sm font-mono text-white focus:border-[#d9b451] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={prevCreditsId} className="text-xs text-[#a1a1aa] block mb-1">
                    Previous Total Credit Hours
                  </label>
                  <input
                    id={prevCreditsId}
                    type="number"
                    min="0"
                    max="140"
                    value={previousCredits}
                    onChange={(e) => setPreviousCredits(e.target.value)}
                    placeholder="e.g. 68"
                    className="w-full rounded-lg border border-white/15 bg-[#07080a] px-3 py-1.5 text-sm font-mono text-white focus:border-[#d9b451] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Courses List Table */}
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-mono uppercase tracking-wider text-[#a1a1aa] px-2">
                <span className="col-span-6 sm:col-span-7">Course Title</span>
                <span className="col-span-3 sm:col-span-2 text-center">Credits</span>
                <span className="col-span-2 text-center">Grade</span>
                <span className="col-span-1 text-center" />
              </div>

              {courses.map((course) => (
                <div
                  key={course.id}
                  className="grid grid-cols-12 gap-2 items-center rounded-xl border border-white/5 bg-[#14151a] p-2 hover:border-white/15 transition-colors"
                >
                  <div className="col-span-6 sm:col-span-7">
                    <input
                      type="text"
                      value={course.name}
                      onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                      className="w-full bg-transparent px-2 py-1 text-xs text-white focus:outline-none"
                      placeholder="Course name"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <select
                      value={course.creditHours}
                      onChange={(e) =>
                        updateCourse(course.id, "creditHours", Number(e.target.value))
                      }
                      className="w-full rounded bg-[#07080a] border border-white/10 px-2 py-1 text-xs font-mono text-center text-white focus:outline-none"
                    >
                      <option value={1}>1 CH</option>
                      <option value={2}>2 CH</option>
                      <option value={3}>3 CH</option>
                      <option value={4}>4 CH</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={course.grade}
                      onChange={(e) => updateCourse(course.id, "grade", e.target.value)}
                      className="w-full rounded bg-[#07080a] border border-white/10 px-2 py-1 text-xs font-mono font-bold text-center text-[#d9b451] focus:outline-none"
                    >
                      {Object.entries(GRADE_POINTS).map(([letter, pts]) => (
                        <option key={letter} value={letter}>
                          {letter} ({pts.toFixed(1)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => removeCourse(course.id)}
                      className="text-[#71717a] hover:text-rose-400 text-sm font-mono"
                      title="Remove course"
                    >
                      &times;
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={addCourse}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-1.5 text-xs font-mono font-semibold text-white hover:border-[#d9b451] hover:text-[#d9b451] transition-colors"
              >
                <span>+ Add Course</span>
              </button>

              <span className="text-xs font-mono text-[#a1a1aa]">
                Total Semester Credits:{" "}
                <strong className="text-white">{calculation.currentCredits} CH</strong>
              </span>
            </div>
          </div>

          {/* Right Card: GPA Output Dial & Regulation Badges */}
          <div className="lg:col-span-4 flex flex-col justify-between rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#a1a1aa] block text-center">
                Semester SGPA
              </span>
              <div className="mt-3 text-center">
                <span className="text-6xl font-black font-mono tracking-tight text-white">
                  {calculation.currentGpa.toFixed(2)}
                </span>
                <span className="text-xs text-[#d9b451] block font-mono mt-1">
                  / 4.00 Max Scale
                </span>
              </div>

              {/* Cumulative Summary */}
              <div className="mt-6 rounded-xl border border-white/10 bg-[#07080a] p-4 text-center space-y-1">
                <span className="text-[11px] font-mono text-[#a1a1aa] uppercase tracking-wider">
                  Updated Cumulative CGPA
                </span>
                <div className="text-2xl font-black font-mono text-white">
                  {calculation.cumulativeCgpa.toFixed(2)}
                </div>
                <span className="text-[10px] text-[#71717a] block font-mono">
                  Across {calculation.cumulativeCredits} Total Credit Hours
                </span>
              </div>

              {/* Academic Standing Status */}
              <div className="mt-6 space-y-2.5">
                {calculation.isDeanList && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-center">
                    <span className="text-xs font-bold text-emerald-400 block font-mono">
                      ★ Dean&apos;s Honors List Candidate
                    </span>
                    <p className="text-[10px] text-emerald-300/80 mt-0.5">
                      SGPA ≥ 3.70 with minimum 12 credit hours load.
                    </p>
                  </div>
                )}

                {calculation.isProbation && (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-center">
                    <span className="text-xs font-bold text-rose-400 block font-mono">
                      ⚠ Academic Probation Alert
                    </span>
                    <p className="text-[10px] text-rose-300/80 mt-0.5">
                      SGPA &lt; 2.00 triggers academic probation per UET Taxila semester
                      regulations.
                    </p>
                  </div>
                )}

                {!calculation.isDeanList && !calculation.isProbation && (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                    <span className="text-xs font-medium text-[#d4d4d8] block">
                      Academic Standing: Good Standing
                    </span>
                    <p className="text-[10px] text-[#a1a1aa] mt-0.5">
                      Meets the minimum 2.00 CGPA graduation threshold.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <button
                type="button"
                onClick={handleCopyTranscript}
                className="w-full text-center rounded-lg border border-white/15 bg-[#07080a] px-4 py-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#d9b451] hover:border-[#d9b451] hover:bg-[#d9b451]/10 transition-colors"
              >
                {copied ? "✓ Transcript Copied!" : "Copy Grade Transcript"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Target CGPA Goal Planner */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">Target CGPA Goal Planner</h3>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Calculate the exact GPA you must maintain across your remaining semesters to reach
                your target graduation CGPA.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor={plannerCurrentCgpaId}
                  className="text-xs font-mono uppercase text-[#a1a1aa] block mb-1"
                >
                  Current Cumulative CGPA:{" "}
                  <strong className="text-white">{currentPlannerCgpa.toFixed(2)}</strong>
                </label>
                <input
                  id={plannerCurrentCgpaId}
                  type="range"
                  min={1.0}
                  max={4.0}
                  step={0.01}
                  value={currentPlannerCgpa}
                  onChange={(e) => setCurrentPlannerCgpa(Number(e.target.value))}
                  className="w-full accent-[#d9b451] cursor-pointer"
                />
              </div>

              <div>
                <label
                  htmlFor={plannerCompletedCreditsId}
                  className="text-xs font-mono uppercase text-[#a1a1aa] block mb-1"
                >
                  Completed Credit Hours:{" "}
                  <strong className="text-white">{completedCredits} CH</strong>
                </label>
                <input
                  id={plannerCompletedCreditsId}
                  type="range"
                  min={10}
                  max={120}
                  step={1}
                  value={completedCredits}
                  onChange={(e) => setCompletedCredits(Number(e.target.value))}
                  className="w-full accent-[#6366f1] cursor-pointer"
                />
              </div>

              <div>
                <label
                  htmlFor={plannerTargetCgpaId}
                  className="text-xs font-mono uppercase text-[#a1a1aa] block mb-1"
                >
                  Desired Graduation CGPA:{" "}
                  <strong className="text-[#d9b451]">{targetCgpa.toFixed(2)}</strong>
                </label>
                <input
                  id={plannerTargetCgpaId}
                  type="range"
                  min={2.0}
                  max={4.0}
                  step={0.01}
                  value={targetCgpa}
                  onChange={(e) => setTargetCgpa(Number(e.target.value))}
                  className="w-full accent-[#10b981] cursor-pointer"
                />
              </div>

              <div>
                <label
                  htmlFor={plannerTotalCreditsId}
                  className="text-xs font-mono uppercase text-[#a1a1aa] block mb-1"
                >
                  Total Degree Credit Hours:{" "}
                  <strong className="text-white">{totalDegreeCredits} CH</strong>
                </label>
                <input
                  id={plannerTotalCreditsId}
                  type="number"
                  value={totalDegreeCredits}
                  onChange={(e) => setTotalDegreeCredits(Number(e.target.value))}
                  className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3 py-2 text-xs font-mono text-white"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl">
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-[#a1a1aa] block text-center">
                Required Average GPA
              </span>
              <div className="mt-3 text-center">
                <span
                  className={`text-6xl font-black font-mono tracking-tight ${
                    plannerResult.status === "impossible" ? "text-rose-400" : "text-[#d9b451]"
                  }`}
                >
                  {plannerResult.requiredGpa > 4.0
                    ? "> 4.00"
                    : plannerResult.requiredGpa.toFixed(2)}
                </span>
                <span className="text-xs text-[#71717a] block font-mono mt-1">
                  Across Remaining {plannerResult.remainingCredits} Credit Hours
                </span>
              </div>

              <div className="mt-6 rounded-xl border border-white/10 bg-[#07080a] p-4 text-xs space-y-2">
                {plannerResult.status === "impossible" ? (
                  <div className="text-rose-400 space-y-1">
                    <span className="font-bold block">
                      ⚠ Target Mathematically Impossible Without Repeats
                    </span>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                      Even with straight 4.00 (A grades) in all remaining{" "}
                      {plannerResult.remainingCredits} credit hours, your maximum achievable CGPA is{" "}
                      {(
                        (currentPlannerCgpa * completedCredits +
                          4.0 * plannerResult.remainingCredits) /
                        totalDegreeCredits
                      ).toFixed(2)}
                      . Consider retaking courses with D or C- grades.
                    </p>
                  </div>
                ) : plannerResult.status === "challenging" ? (
                  <div className="text-amber-400 space-y-1">
                    <span className="font-bold block">★ Challenging Target</span>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                      You must average an{" "}
                      <strong className="text-white">{plannerResult.requiredGpa} GPA</strong>{" "}
                      (mostly A and A- grades). Prioritize high credit courses (3+1) and final year
                      design projects.
                    </p>
                  </div>
                ) : (
                  <div className="text-emerald-400 space-y-1">
                    <span className="font-bold block">✓ Realistic &amp; Achievable</span>
                    <p className="text-[11px] text-[#a1a1aa] leading-relaxed">
                      Maintaining an average of{" "}
                      <strong className="text-white">{plannerResult.requiredGpa} GPA</strong> will
                      successfully secure your target {targetCgpa.toFixed(2)} CGPA!
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={() => setMode("semester")}
                className="w-full text-center rounded-lg bg-[#d9b451] px-4 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-[#07080a] hover:bg-[#f0d178] transition-colors"
              >
                Back to Semester Calculator &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
