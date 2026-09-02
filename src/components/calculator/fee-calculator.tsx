"use client";

import { useId, useMemo, useState } from "react";

export function FeeCalculator() {
  const [category, setCategory] = useState<"subsidized" | "partial-subsidized">("subsidized");
  const [program, setProgram] = useState<"engineering" | "computing" | "postgraduate">(
    "engineering",
  );
  const [residence, setResidence] = useState<"day-scholar" | "hostel">("day-scholar");
  const [semesterType, setSemesterType] = useState<"first" | "subsequent">("first");

  const categoryId = useId();
  const programId = useId();
  const residenceId = useId();
  const semesterTypeId = useId();

  const invoice = useMemo(() => {
    let tuitionFee = 0;
    let admissionFee = 0;
    const registrationExamFee = 12500;
    const librarySportsFee = 4500;
    let securityDeposit = 0;
    let hostelFee = 0;
    let transportFee = 0;

    // 1. Tuition calculation
    if (program === "engineering") {
      tuitionFee = category === "subsidized" ? 48000 : 135000;
    } else if (program === "computing") {
      tuitionFee = category === "subsidized" ? 52000 : 145000;
    } else {
      // Postgraduate
      tuitionFee = 65000;
    }

    // 2. One-time 1st semester fees
    if (semesterType === "first") {
      admissionFee = 25000;
      securityDeposit = 15000; // Refundable
    }

    // 3. Residential / Commute
    if (residence === "hostel") {
      hostelFee = 16000;
      if (semesterType === "first") {
        hostelFee += 10000; // Hostel security deposit
      }
    } else {
      transportFee = 14000; // Subsidized semester bus card
    }

    const totalSemesterDues =
      tuitionFee +
      admissionFee +
      registrationExamFee +
      librarySportsFee +
      securityDeposit +
      hostelFee +
      transportFee;

    // 4-Year (8 Semesters) Estimated Degree Cost
    const subsequentSemesterDues =
      tuitionFee +
      registrationExamFee +
      librarySportsFee +
      (residence === "hostel" ? 16000 : 14000);
    const total4YearCost = totalSemesterDues + subsequentSemesterDues * 7;

    return {
      tuitionFee,
      admissionFee,
      registrationExamFee,
      librarySportsFee,
      securityDeposit,
      hostelFee,
      transportFee,
      totalSemesterDues,
      total4YearCost,
    };
  }, [category, program, residence, semesterType]);

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0c0d10] p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Input Selectors */}
        <div className="lg:col-span-6 space-y-5">
          <div>
            <h2 className="text-xl font-bold text-white">Interactive Fee Estimator</h2>
            <p className="text-xs text-[#a1a1aa] mt-0.5">
              Simulate semester dues and total 4-year degree costs based on the official UET Taxila
              fee schedule.
            </p>
          </div>

          {/* Admission Category */}
          <div className="space-y-1.5">
            <label
              htmlFor={categoryId}
              className="text-xs font-semibold text-white uppercase tracking-wider"
            >
              Admission Category
            </label>
            <select
              id={categoryId}
              value={category}
              onChange={(e) => setCategory(e.target.value as "subsidized" | "partial-subsidized")}
              className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2.5 text-sm text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
            >
              <option value="subsidized">Subsidized / Open Merit (Category A)</option>
              <option value="partial-subsidized">
                Partially Subsidized / Self-Finance (Category S)
              </option>
            </select>
          </div>

          {/* Degree Program */}
          <div className="space-y-1.5">
            <label
              htmlFor={programId}
              className="text-xs font-semibold text-white uppercase tracking-wider"
            >
              Degree Program
            </label>
            <select
              id={programId}
              value={program}
              onChange={(e) =>
                setProgram(e.target.value as "engineering" | "computing" | "postgraduate")
              }
              className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2.5 text-sm text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
            >
              <option value="engineering">
                BSc Engineering (Mechanical, Electrical, Civil, etc.)
              </option>
              <option value="computing">BS Computer Science / Software Engineering</option>
              <option value="postgraduate">Postgraduate (MS / PhD)</option>
            </select>
          </div>

          {/* Residential / Transport Status */}
          <div className="space-y-1.5">
            <label
              htmlFor={residenceId}
              className="text-xs font-semibold text-white uppercase tracking-wider"
            >
              Accommodation &amp; Commute
            </label>
            <select
              id={residenceId}
              value={residence}
              onChange={(e) => setResidence(e.target.value as "day-scholar" | "hostel")}
              className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2.5 text-sm text-white focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
            >
              <option value="day-scholar">Day Scholar (University Commuter Bus)</option>
              <option value="hostel">Boarder (On-Campus Hostel Resident)</option>
            </select>
          </div>

          {/* Semester Type */}
          <div className="space-y-1.5">
            <label
              htmlFor={semesterTypeId}
              className="text-xs font-semibold text-white uppercase tracking-wider"
            >
              Semester
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSemesterType("first")}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  semesterType === "first"
                    ? "bg-[#d9b451] text-[#07080a]"
                    : "border border-white/10 bg-[#14151a] text-[#a1a1aa] hover:text-white"
                }`}
              >
                1st Semester (Admission)
              </button>
              <button
                type="button"
                onClick={() => setSemesterType("subsequent")}
                className={`rounded-lg py-2 text-xs font-semibold transition-colors ${
                  semesterType === "subsequent"
                    ? "bg-[#d9b451] text-[#07080a]"
                    : "border border-white/10 bg-[#14151a] text-[#a1a1aa] hover:text-white"
                }`}
              >
                2nd &ndash; 8th Semesters
              </button>
            </div>
          </div>
        </div>

        {/* Right: Estimated Invoice Breakdown Card */}
        <div className="lg:col-span-6 rounded-xl border border-[#d9b451]/30 bg-gradient-to-b from-[#14151a] to-[#0d0e12] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-widest text-[#a1a1aa] border-b border-white/10 pb-3">
              <span>Estimated Invoice</span>
              <span className="text-[#d9b451]">Official Rates</span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-[#a1a1aa]">
                <span>Tuition Fee</span>
                <span className="font-mono text-white">
                  PKR {invoice.tuitionFee.toLocaleString()}
                </span>
              </div>

              {invoice.admissionFee > 0 && (
                <div className="flex justify-between text-[#a1a1aa]">
                  <span>Admission Fee (One-Time)</span>
                  <span className="font-mono text-white">
                    PKR {invoice.admissionFee.toLocaleString()}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-[#a1a1aa]">
                <span>Registration &amp; Examination</span>
                <span className="font-mono text-white">
                  PKR {invoice.registrationExamFee.toLocaleString()}
                </span>
              </div>

              <div className="flex justify-between text-[#a1a1aa]">
                <span>Library, Sports &amp; Medical Funds</span>
                <span className="font-mono text-white">
                  PKR {invoice.librarySportsFee.toLocaleString()}
                </span>
              </div>

              {invoice.securityDeposit > 0 && (
                <div className="flex justify-between text-[#a1a1aa]">
                  <span>Security Deposit (Refundable)</span>
                  <span className="font-mono text-emerald-400">
                    PKR {invoice.securityDeposit.toLocaleString()}
                  </span>
                </div>
              )}

              {invoice.hostelFee > 0 && (
                <div className="flex justify-between text-[#a1a1aa]">
                  <span>Hostel Room &amp; Utilities</span>
                  <span className="font-mono text-white">
                    PKR {invoice.hostelFee.toLocaleString()}
                  </span>
                </div>
              )}

              {invoice.transportFee > 0 && (
                <div className="flex justify-between text-[#a1a1aa]">
                  <span>University Bus Transport Pass</span>
                  <span className="font-mono text-white">
                    PKR {invoice.transportFee.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Total Semester Dues */}
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Total Semester Dues:
              </span>
              <span className="text-2xl font-extrabold font-mono text-[#d9b451]">
                PKR {invoice.totalSemesterDues.toLocaleString()}
              </span>
            </div>

            {/* Total 4-Year Degree Projection */}
            <div className="mt-4 rounded-lg bg-white/5 p-3 text-xs text-[#a1a1aa] flex items-center justify-between">
              <span>Estimated 4-Year Total (8 Semesters):</span>
              <span className="font-mono font-bold text-white">
                ~PKR {invoice.total4YearCost.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/10 text-[11px] text-[#71717a] text-center">
            *Fees are subject to annual revision per UET Taxila Syndicate regulations. Mess charges
            not included.
          </div>
        </div>
      </div>
    </div>
  );
}
