"use client";

import { useId, useMemo, useState } from "react";

export interface ScholarshipMatch {
  id: string;
  name: string;
  provider: string;
  coverage: string;
  stipend: string;
  eligibilitySummary: string;
  requirements: string[];
  portalUrl: string;
}

export function ScholarshipScreener() {
  const [incomeRange, setIncomeRange] = useState<string>("under45k");
  const [domicile, setDomicile] = useState<string>("punjab");
  const [academicScore, setAcademicScore] = useState<string>("above70");
  const [specialCategory, setSpecialCategory] = useState<string>("general");

  const incomeId = useId();
  const domicileId = useId();
  const scoreId = useId();
  const categoryId = useId();

  const matchedScholarships = useMemo(() => {
    const list: ScholarshipMatch[] = [];

    // 1. Honhaar Scholarship Program (Punjab Govt)
    if (
      domicile === "punjab" &&
      (incomeRange === "under45k" || incomeRange === "45k-80k") &&
      academicScore === "above70"
    ) {
      list.push({
        id: "honhaar",
        name: "Chief Minister Punjab Honhaar Scholarship Program",
        provider: "Government of the Punjab",
        coverage: "100% Full Tuition Fee Coverage (All 4 Years)",
        stipend: "Disbursed directly to University Treasurer",
        eligibilitySummary:
          "Punjab domicile, minimum 70% marks in intermediate (HSSC), annual household income under PKR 350,000.",
        requirements: [
          "Punjab Domicile certificate",
          "HSSC / F.Sc / ICS original result card (>= 70%)",
          "Salary slip or verified income certificate from Assistant Commissioner",
          "Paid utility bills of past 6 months",
        ],
        portalUrl: "https://honhaarscholarship.punjabhec.gov.pk",
      });
    }

    // 2. HEC Need-Based Scholarship
    if (incomeRange === "under45k" || incomeRange === "45k-80k") {
      list.push({
        id: "hec-need-based",
        name: "HEC Need-Based Financial Assistance Grant",
        provider: "Higher Education Commission (HEC) Pakistan",
        coverage: "100% Full Tuition Fee Waiver",
        stipend: "PKR 6,000 / month living stipend",
        eligibilitySummary:
          "Enrolled in regular undergraduate degree on merit with proven financial need.",
        requirements: [
          "HEC Need-Based application form with institutional endorsement",
          "Father/Guardian CNIC and death certificate (if applicable)",
          "Rent agreement or house ownership documents",
          "Educational expenditure statements of siblings",
        ],
        portalUrl: "https://hec.gov.pk",
      });
    }

    // 3. Ehsaas / BISP Undergraduate Scholarship
    if (incomeRange === "under45k") {
      list.push({
        id: "ehsaas",
        name: "Ehsaas / BISP Undergraduate Scholarship",
        provider: "Benazir Income Support Programme / HEC",
        coverage: "100% Full Tuition Fee Coverage",
        stipend: "PKR 4,000 / month annual living stipend (~PKR 40,000/yr)",
        eligibilitySummary:
          "Open merit freshmen from families with household income under poverty threshold (<= PKR 45,000/mo). 50% reserved for female students.",
        requirements: [
          "BISP poverty scorecard validation or NADRA household profile",
          "Proof of admission at UET Taxila (Roll Number & Challan)",
          "Income affidavit on PKR 100 judicial stamp paper",
        ],
        portalUrl: "https://bisp.gov.pk",
      });
    }

    // 4. PEEF (Punjab Educational Endowment Fund)
    if (
      domicile === "punjab" &&
      (incomeRange === "under45k" || incomeRange === "45k-80k") &&
      (academicScore === "above70" || academicScore === "60-70")
    ) {
      list.push({
        id: "peef",
        name: "Punjab Educational Endowment Fund (PEEF) Scholarship",
        provider: "PEEF / Govt. of Punjab",
        coverage: "100% Subsidized Tuition Fee Payment",
        stipend: "Quarterly boarding stipend for hostelite students",
        eligibilitySummary:
          "Punjab domicile holder with minimum 60% in intermediate and monthly family income <= PKR 45,000.",
        requirements: [
          "PEEF scholarship registration form",
          "Affidavit of family income verified by Gazetted Officer (Grade 17+)",
          "Attested copies of Matric and F.Sc certificates",
        ],
        portalUrl: "https://peef.org.pk",
      });
    }

    // 5. Workers Welfare Fund (WWF) Scholarship
    if (specialCategory === "industrial-worker") {
      list.push({
        id: "wwf",
        name: "Workers Welfare Fund (WWF) Full Educational Sponsorship",
        provider: "Ministry of Overseas Pakistanis & HRD / WWF",
        coverage: "100% Tuition + Hostel Dues + Transport Dues",
        stipend: "PKR 5,000 / semester book allowance + Monthly pocket stipend",
        eligibilitySummary:
          "Children of factory/industrial workers registered under EOBI/PESSI with minimum 3 years active service.",
        requirements: [
          "Factory worker EOBI/PESSI registration card",
          "Service certificate signed by Factory General Manager",
          "Attested verification from District Workers Welfare Board",
        ],
        portalUrl: "https://wwf.gov.pk",
      });
    }

    // 6. Armed Forces / Fauji Foundation Benevolent Grant
    if (specialCategory === "armed-forces") {
      list.push({
        id: "fauji-foundation",
        name: "Fauji Foundation & Armed Forces Benevolent Fund",
        provider: "Fauji Foundation / GHQ Welfare Directorate",
        coverage: "Semester Tuition Fee Reimbursement",
        stipend: "Annual educational stipend based on rank",
        eligibilitySummary:
          "Children of serving, retired, deceased, or disabled military personnel and defense establishment workers.",
        requirements: [
          "Father/Mother discharge book or serving certificate",
          "Pension book copy (for retired personnel)",
          "Verification from respective Regimental Center or Station HQ",
        ],
        portalUrl: "https://fauji.org.pk",
      });
    }

    // 7. UETTAA (Alumni Association) Emergency & Book Bank Grant
    list.push({
      id: "uettaa",
      name: "UET Taxila Alumni Association (UETTAA) Endowment Grant",
      provider: "UETTAA Global Chapters (North America, UAE, Pakistan)",
      coverage: "Emergency Tuition Subsidy & Semester Relief",
      stipend: "Full course pack & textbook lending from Book Bank",
      eligibilitySummary:
        "Enrolled students maintaining satisfactory academic standing who encounter unexpected family financial hardships.",
      requirements: [
        "UETTAA hardship application through Departmental Chairperson",
        "Recommendation letter from Academic Advisor",
        "Recent semester SGPA/CGPA transcript",
      ],
      portalUrl: "https://uettaa.com",
    });

    return list;
  }, [incomeRange, domicile, academicScore, specialCategory]);

  return (
    <div className="space-y-8">
      {/* Questionnaire Card */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60 sm:p-8">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Check Your Scholarship Eligibility
        </h2>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          Answer the 4 criteria questions below to discover financial aid programs matching your
          profile.
        </p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {/* Question 1: Income */}
          <div>
            <label
              htmlFor={incomeId}
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              1. Monthly Household Income
            </label>
            <select
              id={incomeId}
              value={incomeRange}
              onChange={(e) => setIncomeRange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="under45k">Under PKR 45,000 / month (Highest Need)</option>
              <option value="45k-80k">PKR 45,000 – 80,000 / month</option>
              <option value="80k-150k">PKR 80,000 – 150,000 / month</option>
              <option value="above150k">Above PKR 150,000 / month</option>
            </select>
          </div>

          {/* Question 2: Domicile */}
          <div>
            <label
              htmlFor={domicileId}
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              2. Domicile Province
            </label>
            <select
              id={domicileId}
              value={domicile}
              onChange={(e) => setDomicile(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="punjab">Punjab (including Rawalpindi / Taxila)</option>
              <option value="kpk">Khyber Pakhtunkhwa (KPK)</option>
              <option value="sindh">Sindh</option>
              <option value="balochistan">Balochistan</option>
              <option value="ajk">Azad Jammu &amp; Kashmir (AJK)</option>
              <option value="gb">Gilgit-Baltistan (GB)</option>
              <option value="fata">FATA / Merged Tribal Districts</option>
            </select>
          </div>

          {/* Question 3: Academic Score */}
          <div>
            <label
              htmlFor={scoreId}
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              3. Intermediate (HSSC) / Aggregate Score
            </label>
            <select
              id={scoreId}
              value={academicScore}
              onChange={(e) => setAcademicScore(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="above70">70% and Above (Merit Honors)</option>
              <option value="60-70">60% – 69.9% (Standard Eligibility)</option>
              <option value="under60">Below 60%</option>
            </select>
          </div>

          {/* Question 4: Special Category */}
          <div>
            <label
              htmlFor={categoryId}
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              4. Special Quota / Category
            </label>
            <select
              id={categoryId}
              value={specialCategory}
              onChange={(e) => setSpecialCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-zinc-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="general">General Open Merit</option>
              <option value="industrial-worker">
                Industrial Worker Ward (WWF / EOBI Registered)
              </option>
              <option value="armed-forces">Armed Forces / Shuhada / Defense Personnel Ward</option>
              <option value="minority">Minority / Special Needs Student</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Matched Financial Aid Programs ({matchedScholarships.length})
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Based on your selected income, domicile, and academic score:
          </p>
        </div>
      </div>

      {/* Scholarships List */}
      <div className="space-y-4">
        {matchedScholarships.map((sch) => (
          <div
            key={sch.id}
            className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all hover:border-emerald-500/40 dark:border-zinc-800/80 dark:bg-zinc-900/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                {sch.provider}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {sch.coverage}
              </span>
            </div>

            <h4 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-100">{sch.name}</h4>

            <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              {sch.eligibilitySummary}
            </p>

            <div className="mt-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-800/40">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Stipend &amp; Living Support:
              </span>{" "}
              <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                {sch.stipend}
              </span>
            </div>

            <div className="mt-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Required Verification Documents
              </span>
              <ul className="mt-1.5 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                {sch.requirements.map((req) => (
                  <li key={req} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
