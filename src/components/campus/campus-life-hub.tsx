"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CampusDirectory } from "@/components/directory/campus-directory";
import { SocietiesDirectory } from "@/components/societies/societies-directory";
import { BusRoutesExplorer } from "@/components/transport/bus-routes-explorer";

type CampusTab = "hostels" | "transport" | "societies" | "directory";

const TABS: { id: CampusTab; label: string; badge?: string; desc: string }[] = [
  {
    id: "hostels",
    label: "Hostels & Residence",
    badge: "5 Halls",
    desc: "On-campus residential facilities, mess system, Wi-Fi connectivity, and room allotments",
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

const HOSTELS = [
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
                  5 on-campus halls providing secure accommodation (~PKR 28,000/semester room dues)
                  with 24/7 security and dining mess.
                </p>
              </div>
            </div>

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
                    <span className="text-[10px] font-mono uppercase text-[#71717a] block mb-1.5">
                      Key Amenities:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {hostel.facilities.map((fac) => (
                        <span
                          key={fac}
                          className="rounded bg-white/5 px-2 py-0.5 text-[10px] text-zinc-300"
                        >
                          {fac}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 border-t border-white/10 pt-6">
              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <h3 className="text-sm font-bold text-[#d9b451]">
                  Hostel Allotment &amp; Priority Rules
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                  <li>
                    &bull; Allotments are managed online by the Senior Warden Office at the start of
                    each academic year.
                  </li>
                  <li>
                    &bull; <strong className="text-white">Priority 1:</strong> Outstation students
                    whose domicile is outside the university bus network boundaries (beyond
                    Islamabad/Rawalpindi/Attock).
                  </li>
                  <li>
                    &bull; <strong className="text-white">Priority 2:</strong> Top merit list
                    position holders and provincial quota seats.
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#07080a] p-5">
                <h3 className="text-sm font-bold text-[#d9b451]">
                  Mess System &amp; Dining Charges
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-[#a1a1aa] leading-relaxed">
                  <li>
                    &bull; Cooperative student-managed mess system serving breakfast, lunch, and
                    dinner.
                  </li>
                  <li>
                    &bull; Monthly dining expense averages{" "}
                    <strong className="text-white">PKR 10,000 – 12,000/month</strong> based on
                    consumption.
                  </li>
                  <li>
                    &bull; Refundable mess security deposit of PKR 8,000 collected once at the time
                    of admission.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === "transport" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                University Commuter Bus Routes &amp; Timetable
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Search pickup points, fleet departure timings, and return schedules across the Twin
                Cities.
              </p>
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
