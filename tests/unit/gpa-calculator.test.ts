import { describe, expect, it } from "vitest";

describe("UET Taxila GPA Calculator Logic", () => {
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

  it("calculates semester GPA accurately for typical 1st semester engineering load", () => {
    // 3 CH with A (4.0) = 12
    // 3 CH with B+ (3.3) = 9.9
    // 3 CH with A- (3.7) = 11.1
    // 2 CH with A (4.0) = 8.0
    // 2 CH with B+ (3.3) = 6.6
    // 2 CH with A (4.0) = 8.0
    // Total Credits = 15, Total Points = 55.6
    const courses = [
      { ch: 3, grade: "A" },
      { ch: 3, grade: "B+" },
      { ch: 3, grade: "A-" },
      { ch: 2, grade: "A" },
      { ch: 2, grade: "B+" },
      { ch: 2, grade: "A" },
    ];

    let totalPoints = 0;
    let totalCredits = 0;
    for (const c of courses) {
      totalPoints += GRADE_POINTS[c.grade] * c.ch;
      totalCredits += c.ch;
    }

    const gpa = totalPoints / totalCredits;
    expect(Number(gpa.toFixed(3))).toBe(3.707);
    expect(gpa).toBeGreaterThanOrEqual(3.7); // Dean's list threshold
  });

  it("triggers academic probation flag when semester GPA is below 2.00", () => {
    const courses = [
      { ch: 3, grade: "C-" }, // 1.7 * 3 = 5.1
      { ch: 3, grade: "D" }, // 1.0 * 3 = 3.0
      { ch: 3, grade: "F" }, // 0.0 * 3 = 0.0
      { ch: 3, grade: "C" }, // 2.0 * 3 = 6.0
    ];

    let totalPoints = 0;
    let totalCredits = 0;
    for (const c of courses) {
      totalPoints += GRADE_POINTS[c.grade] * c.ch;
      totalCredits += c.ch;
    }

    const gpa = totalPoints / totalCredits;
    expect(gpa).toBeLessThan(2.0);
    expect(Number(gpa.toFixed(2))).toBe(1.18);
  });

  it("computes cumulative CGPA by combining previous semesters with current semester", () => {
    const prevCgpa = 3.4;
    const prevCredits = 30; // 102 points
    const currentPoints = 55.6;
    const currentCredits = 15;

    const cumulativePoints = prevCgpa * prevCredits + currentPoints;
    const cumulativeCredits = prevCredits + currentCredits; // 45
    const cgpa = cumulativePoints / cumulativeCredits;

    expect(Number(cgpa.toFixed(3))).toBe(3.502);
  });
});
