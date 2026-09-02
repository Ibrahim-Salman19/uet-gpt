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
    desc: "Primary hostel for freshmen engineering students with dedicated common rooms, high-speed fiber internet, and indoor sports facilities.",
  },
  {
    name: "Iqbal Hall (Boys)",
    capacity: "300+ Residents",
    desc: "Senior undergraduate residential block featuring study libraries, subsidized cafeteria, and badminton courts.",
  },
  {
    name: "Ali Hall (Boys)",
    capacity: "280+ Residents",
    desc: "Modern block with uninterrupted solar back-up power, table tennis arenas, and filtered water plants.",
  },
  {
    name: "Quaid-e-Azam Hall (Boys)",
    capacity: "320+ Residents",
    desc: "Largest residential hall with proximity to central sports complex and gymnasium.",
  },
  {
    name: "Fatima Jinnah Hall (Girls)",
    capacity: "350+ Residents",
    desc: "Dedicated secure female residential complex with 24/7 CCTV surveillance, exclusive dining mess, on-site gym, and indoor recreation center.",
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
            <div>
              <h2 className="text-xl font-bold text-white">
                Residential Halls &amp; Student Housing
              </h2>
              <p className="mt-1 text-xs text-[#a1a1aa]">
                Affordable on-campus accommodation (~PKR 28,000/semester) with 24/7 security and
                dining mess.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {HOSTELS.map((hostel) => (
                <div
                  key={hostel.name}
                  className="rounded-xl border border-white/10 bg-[#07080a] p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                      {hostel.capacity}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-bold text-white">{hostel.name}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#a1a1aa]">{hostel.desc}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/10 bg-[#07080a] p-6">
              <h3 className="text-sm font-bold text-white">Allotment Criteria &amp; Rules</h3>
              <p className="mt-2 text-xs text-[#a1a1aa] leading-relaxed">
                Hostel allotments are processed online at the start of each semester by the Senior
                Warden Office. Outstation students residing outside the university bus network
                boundaries (beyond Islamabad/Rawalpindi/Attock) receive primary allotment priority.
              </p>
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
                Join technical chapters, literary circles, and sports clubs on campus.
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
