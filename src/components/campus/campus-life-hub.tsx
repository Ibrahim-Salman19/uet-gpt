"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { CampusDirectory } from "@/components/directory/campus-directory";
import { SocietiesDirectory } from "@/components/societies/societies-directory";
import { BusRoutesExplorer } from "@/components/transport/bus-routes-explorer";

type CampusTab = "hostels" | "transport" | "societies" | "directory";

const TABS: { id: CampusTab; label: string; badge?: string; desc: string }[] = [
  {
    id: "hostels",
    label: "Hostels & Residence",
    badge: "5 Halls",
    desc: "On-campus residential facilities, mess calculator, Wi-Fi connectivity, and room allotments",
  },
  {
    id: "transport",
    label: "Bus Routes & Timetables",
    badge: "25+ Routes",
    desc: "Commuter transit schedules across Islamabad, Rawalpindi, Wah Cantt, and Attock",
  },
  {
    id: "societies",
    label: "Societies & Clubs",
    badge: "12 Chapters",
    desc: "IEEE, GDG on Campus, SOFTDESK, ASME, Debating Society, and annual flagship events",
  },
  {
    id: "directory",
    label: "Campus Directory",
    badge: "Phonebook",
    desc: "Searchable contact numbers, direct phone extensions, and departmental official emails",
  },
];

export const HOSTELS = [
  {
    name: "Sir Syed Hall (Boys)",
    capacity: "250+ Residents",
    roomTypes: "2-Seater & 3-Seater Dorms",
    targetBatch: "Freshmen & 2nd Year Undergraduates",
    facilities: [
      "Fiber Optic Internet",
      "Common TV Lounge",
      "Table Tennis Arena",
      "Filtered RO Water Plant",
    ],
    desc: "Primary residential hall for incoming undergraduate engineers with dedicated common study rooms, 24/7 solar backup power, and recreational areas.",
  },
  {
    name: "Allama Iqbal Hall (Boys)",
    capacity: "300+ Residents",
    roomTypes: "Cubicles (Singles) & 2-Seaters",
    targetBatch: "3rd Year & Final Year (Senior) Undergraduates",
    facilities: ["Quiet Study Rooms", "Badminton Court", "Laundry Facility", "Subsidized Canteen"],
    desc: "Senior undergraduate residential block with cubicles for Final Year Project (FYP) researchers and direct access to Central Library.",
  },
  {
    name: "Ali Hall (Boys)",
    capacity: "280+ Residents",
    roomTypes: "2-Seater & 3-Seater Rooms",
    targetBatch: "2nd & 3rd Year Undergraduates",
    facilities: [
      "Uninterrupted Solar Power",
      "Indoor Sports Arena",
      "Modern Dining Hall",
      "CCTV Security",
    ],
    desc: "Modern residential hall equipped with high-speed campus LAN ports, solar energy inverters, and hygienic dining mess.",
  },
  {
    name: "Quaid-e-Azam Hall (Boys)",
    capacity: "320+ Residents",
    roomTypes: "Dormitories & 2-Seaters",
    targetBatch: "Undergraduates & Postgraduate Scholars",
    facilities: ["Sports Complex Access", "Gymnasium Proximity", "Mosque Adjacent", "Guest Rooms"],
    desc: "Largest on-campus residential block situated right next to the University Main Stadium, Gymnasium, and Central Mosque.",
  },
  {
    name: "Fatima Jinnah Hall (Girls)",
    capacity: "350+ Residents",
    roomTypes: "Cubicles, 2-Seaters & 3-Seater Suites",
    targetBatch: "All Undergraduate & Postgraduate Female Students",
    facilities: [
      "24/7 Dedicated Female Security",
      "On-Site Gymnasium",
      "Exclusive Dining Mess",
      "Private Courtyard & Garden",
    ],
    desc: "State-of-the-art secure female residential complex featuring round-the-clock CCTV surveillance, biometric access, and dedicated transport pickup.",
  },
];

export function CampusLifeHub() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as CampusTab) || "hostels";
  const [activeTab, setActiveTab] = useState<CampusTab>(
    ["hostels", "transport", "societies", "directory"].includes(initialTab)
      ? initialTab
      : "hostels",
  );

  // Interactive Hostel Mess Simulator
  const [messDays, setMessDays] = useState<number>(26);
  const [mealPlan, setMealPlan] = useState<"standard" | "light" | "custom">("standard");
  const [hasCooler, setHasCooler] = useState<boolean>(false);
  const [hasLaundry, setHasLaundry] = useState<boolean>(true);

  // Allotment Priority Checker
  const [homeRegion, setHomeRegion] = useState<"outstation" | "distant" | "commuter">("outstation");

  const daysSliderId = useId();
  const coolerCheckboxId = useId();
  const laundryCheckboxId = useId();
  const regionSelectId = useId();

  const messCalculation = useMemo(() => {
    const dailyRate = mealPlan === "standard" ? 390 : mealPlan === "light" ? 270 : 340;
    const foodCost = messDays * dailyRate;
    const coolerCost = hasCooler ? 1500 : 0;
    const laundryCost = hasLaundry ? 900 : 0;
    const monthlyTotal = foodCost + coolerCost + laundryCost;

    return {
      dailyRate,
      foodCost,
      coolerCost,
      laundryCost,
      monthlyTotal,
      semesterDues: 28000,
    };
  }, [messDays, mealPlan, hasCooler, hasLaundry]);

  return (
    <div className="space-y-8">
      {/* Tab Selector Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
        {activeTab === "hostels" && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Residential Halls &amp; Student Housing
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  5 on-campus residential halls (~PKR 28,000/semester room dues) with 24/7 security,
                  uninterrupted solar backup, and student-run dining mess.
                </p>
              </div>
              <Link
                href="/uet-taxila/hostels"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#d9b451]/30 px-4 py-2 text-xs font-mono font-bold uppercase text-[#d9b451] hover:bg-[#d9b451]/10 transition-colors"
              >
                <span>Full Hall Guide</span>
                <span>&rarr;</span>
              </Link>
            </div>

            {/* 5 Hostels Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HOSTELS.map((hostel) => (
                <div
                  key={hostel.name}
                  className="rounded-xl border border-white/10 bg-[#07080a] p-5 flex flex-col justify-between hover:border-[#d9b451]/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                        {hostel.capacity}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {hostel.roomTypes}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white mb-1">{hostel.name}</h3>
                    <p className="text-[11px] font-mono text-[#71717a] mb-2">
                      {hostel.targetBatch}
                    </p>
                    <p className="text-xs leading-relaxed text-[#a1a1aa] mb-4">{hostel.desc}</p>
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <span className="text-[10px] font-mono uppercase text-[#71717a] block mb-1.5 font-bold">
                      Key Amenities:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {hostel.facilities.map((fac) => (
                        <span
                          key={fac}
                          className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-mono text-zinc-300"
                        >
                          {fac}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Interactive Living Expense & Mess Simulator */}
            <div className="rounded-xl border border-[#d9b451]/30 bg-[#07080a] p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div>
                  <span className="text-xs font-mono uppercase text-[#d9b451] font-bold block">
                    Interactive Living Cost Calculator
                  </span>
                  <h3 className="text-lg font-bold text-white">
                    Monthly Mess Bill &amp; Living Expenses
                  </h3>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  Estimated Monthly Total: ~PKR {messCalculation.monthlyTotal.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Inputs */}
                <div className="lg:col-span-7 space-y-4">
                  <div>
                    <label
                      htmlFor={daysSliderId}
                      className="text-xs font-mono uppercase text-[#a1a1aa] block mb-1"
                    >
                      Days on Campus Per Month:{" "}
                      <strong className="text-white">{messDays} Days</strong>
                    </label>
                    <input
                      id={daysSliderId}
                      type="range"
                      min={10}
                      max={31}
                      value={messDays}
                      onChange={(e) => setMessDays(Number(e.target.value))}
                      className="w-full accent-[#d9b451] cursor-pointer"
                    />
                  </div>

                  <div>
                    <span className="text-xs font-mono uppercase text-[#a1a1aa] block mb-1.5">
                      Meal Plan Selection:
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                      {[
                        { id: "standard", label: "3 Meals (PKR 390/d)" },
                        { id: "light", label: "2 Meals (PKR 270/d)" },
                        { id: "custom", label: "Balanced (PKR 340/d)" },
                      ].map((plan) => (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => setMealPlan(plan.id as typeof mealPlan)}
                          className={`rounded-lg p-2 text-center transition-colors ${
                            mealPlan === plan.id
                              ? "bg-[#d9b451] text-[#07080a] font-bold"
                              : "border border-white/10 bg-[#14151a] text-[#a1a1aa] hover:text-white"
                          }`}
                        >
                          {plan.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#14151a] p-3">
                      <input
                        id={coolerCheckboxId}
                        type="checkbox"
                        checked={hasCooler}
                        onChange={(e) => setHasCooler(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-[#07080a] text-[#d9b451]"
                      />
                      <label
                        htmlFor={coolerCheckboxId}
                        className="text-xs text-[#d4d4d8] cursor-pointer"
                      >
                        Summer Room Cooler (+PKR 1,500/mo)
                      </label>
                    </div>

                    <div className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-[#14151a] p-3">
                      <input
                        id={laundryCheckboxId}
                        type="checkbox"
                        checked={hasLaundry}
                        onChange={(e) => setHasLaundry(e.target.checked)}
                        className="h-4 w-4 rounded border-white/20 bg-[#07080a] text-[#d9b451]"
                      />
                      <label
                        htmlFor={laundryCheckboxId}
                        className="text-xs text-[#d4d4d8] cursor-pointer"
                      >
                        Hostel Laundry Service (+PKR 900/mo)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Bill Breakdown */}
                <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#14151a] p-5 space-y-3 font-mono text-xs flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <span className="text-[10px] uppercase tracking-wider text-[#71717a] block font-bold">
                      Estimated Monthly Invoice
                    </span>
                    <div className="flex justify-between text-[#a1a1aa] border-b border-white/5 pb-1.5">
                      <span>
                        Dining Mess ({messDays} days @ PKR {messCalculation.dailyRate}/d):
                      </span>
                      <span className="text-white font-bold">
                        PKR {messCalculation.foodCost.toLocaleString()}
                      </span>
                    </div>
                    {hasCooler && (
                      <div className="flex justify-between text-[#a1a1aa] border-b border-white/5 pb-1.5">
                        <span>Cooler Surcharge:</span>
                        <span className="text-white font-bold">
                          PKR {messCalculation.coolerCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {hasLaundry && (
                      <div className="flex justify-between text-[#a1a1aa] border-b border-white/5 pb-1.5">
                        <span>Laundry Facility:</span>
                        <span className="text-white font-bold">
                          PKR {messCalculation.laundryCost.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-[#d9b451] pt-1 text-sm font-bold">
                      <span>Total Monthly Out-of-Pocket:</span>
                      <span>PKR {messCalculation.monthlyTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white/5 p-3 text-[11px] text-[#a1a1aa] font-sans">
                    <strong className="text-white font-mono block mb-0.5">
                      Fixed Semester Dues:
                    </strong>
                    Room dues (~PKR 28,000) and refundable mess security deposit (PKR 8,000) are
                    charged per semester at registration.
                  </div>
                </div>
              </div>
            </div>

            {/* Allotment Priority Checker */}
            <div className="rounded-xl border border-white/10 bg-[#07080a] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <h3 className="text-base font-bold text-white">
                  Hostel Allotment Priority Checker
                </h3>
                <span className="text-xs font-mono text-[#d9b451]">Senior Warden Regulations</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                <div className="sm:col-span-6">
                  <label
                    htmlFor={regionSelectId}
                    className="text-xs font-mono uppercase text-[#71717a] block mb-1"
                  >
                    Select Your Permanent Domicile / City:
                  </label>
                  <select
                    id={regionSelectId}
                    value={homeRegion}
                    onChange={(e) => setHomeRegion(e.target.value as typeof homeRegion)}
                    className="w-full rounded-lg border border-white/15 bg-[#14151a] px-3.5 py-2 text-xs font-mono text-white focus:border-[#d9b451] focus:outline-none"
                  >
                    <option value="outstation">
                      Southern Punjab / Sindh / KPK / Balochistan / AJK / GB
                    </option>
                    <option value="distant">
                      Intermediate Distance (&gt;50km: Jhelum, Chakwal, Mianwali)
                    </option>
                    <option value="commuter">
                      Twin Cities &amp; Local (Islamabad, Rawalpindi, Wah, Hassan Abdal)
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-6 rounded-lg border border-white/10 bg-[#14151a] p-4 text-xs">
                  {homeRegion === "outstation" && (
                    <div className="text-emerald-400 space-y-1">
                      <span className="font-bold font-mono block">
                        ✓ Priority 1: Guaranteed On-Campus Bed
                      </span>
                      <p className="text-[11px] text-[#a1a1aa] font-sans">
                        Outstation candidates located outside commuter route reach receive top
                        priority allotment in Sir Syed Hall (Boys) or Fatima Jinnah Hall (Girls).
                      </p>
                    </div>
                  )}
                  {homeRegion === "distant" && (
                    <div className="text-amber-400 space-y-1">
                      <span className="font-bold font-mono block">
                        ★ Priority 2: High Allocation Probability
                      </span>
                      <p className="text-[11px] text-[#a1a1aa] font-sans">
                        Allotment granted based on academic merit standing in the first and second
                        rounds of hostel admissions.
                      </p>
                    </div>
                  )}
                  {homeRegion === "commuter" && (
                    <div className="text-[#a1a1aa] space-y-1">
                      <span className="font-bold font-mono text-zinc-300 block">
                        ℹ Priority 3: Commuter Transit Recommended
                      </span>
                      <p className="text-[11px] text-[#a1a1aa] font-sans">
                        Students from Twin Cities and Wah Cantt are strongly encouraged to use the
                        university&apos;s 25+ daily point buses (~PKR 18,000/sem).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "transport" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white">
                  University Commuter Bus Routes &amp; Timetable
                </h2>
                <p className="mt-1 text-xs text-[#a1a1aa]">
                  Search pickup points, fleet departure timings, and return schedules across the
                  Twin Cities.
                </p>
              </div>
              <Link
                href="/uet-taxila/bus-routes"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#d9b451]/30 px-4 py-2 text-xs font-mono font-bold uppercase text-[#d9b451] hover:bg-[#d9b451]/10 transition-colors"
              >
                <span>Full Route List</span>
                <span>&rarr;</span>
              </Link>
            </div>
            <BusRoutesExplorer />
          </div>
        )}

        {activeTab === "societies" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Student Societies, Chapters &amp; Organizations
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Join technical chapters, coding clubs, literary circles, and sports organizations on
                campus.
              </p>
            </div>
            <SocietiesDirectory />
          </div>
        )}

        {activeTab === "directory" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                Campus Phonebook &amp; Departmental Extensions
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Search key administrative offices, faculty departments, and emergency helplines.
              </p>
            </div>
            <CampusDirectory />
          </div>
        )}
      </div>
    </div>
  );
}
