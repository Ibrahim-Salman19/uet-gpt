"use client";

import { useId, useMemo, useState } from "react";

export interface BusRoute {
  id: string;
  routeNumber: string;
  routeName: string;
  region: "islamabad" | "rawalpindi" | "wah-cantt" | "attock";
  departureTime: string;
  returnTimes: string[];
  keyStops: string[];
  description: string;
}

export const BUS_ROUTES: BusRoute[] = [
  {
    id: "route-isb-1",
    routeNumber: "Route 01",
    routeName: "Islamabad Express (Aabpara & Zero Point)",
    region: "islamabad",
    departureTime: "06:45 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Bara Kahu",
      "Aabpara Market",
      "Zero Point",
      "F-6 / Super Market",
      "G-6 / Melody",
      "G-9 / Karachi Company",
      "G-10 / G-11 Signals",
      "Kashmir Highway",
      "Motorway Toll Plaza",
      "UET Taxila Campus",
    ],
    description:
      "Primary Islamabad commuter route covering core residential sectors, diplomatic enclave access, and Kashmir Highway.",
  },
  {
    id: "route-isb-2",
    routeNumber: "Route 02",
    routeName: "Islamabad South (Faizabad & I-8/H-8)",
    region: "islamabad",
    departureTime: "06:50 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Koral Chowk",
      "Faizabad Interchange",
      "I-8 Markaz",
      "H-8 / HEC Head Office",
      "I-9 Police Line",
      "I-10 Carriage Factory",
      "IJP Road",
      "Tarnol Phattak",
      "UET Taxila Campus",
    ],
    description:
      "Dedicated South Islamabad route servicing Islamabad Expressway, I-8, H-8, and IJP Road student communities.",
  },
  {
    id: "route-rwp-1",
    routeNumber: "Route 03",
    routeName: "Rawalpindi Saddar & Mall Road",
    region: "rawalpindi",
    departureTime: "07:00 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Kachehri Chowk",
      "MH Hospital / Saddar",
      "Mall Road Cantt",
      "Qasim Market",
      "Peshawar Road",
      "Chur Chowk",
      "Westridge 1 & 2",
      "Pirwadhai Mor",
      "Kohinoor Mills",
      "UET Taxila Campus",
    ],
    description:
      "High-capacity double route for Rawalpindi Cantonment, Saddar central hub, and the Peshawar Road arterial corridor.",
  },
  {
    id: "route-rwp-2",
    routeNumber: "Route 04",
    routeName: "Rawalpindi City (Murree Road & 6th Road)",
    region: "rawalpindi",
    departureTime: "06:45 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Chandni Chowk",
      "6th Road / Satellite Town",
      "Rehmanabad",
      "Shamsabad",
      "Faizabad Underpass",
      "IJP Commercial Corridor",
      "Golra Mor",
      "Tarnol Bypass",
      "UET Taxila Campus",
    ],
    description:
      "Direct transit connecting Murree Road arterial hubs, Satellite Town student hostels, and northern Rawalpindi.",
  },
  {
    id: "route-wah-1",
    routeNumber: "Route 05",
    routeName: "Wah Cantt & POF Residential Sectors",
    region: "wah-cantt",
    departureTime: "07:15 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Lala Rukh",
      "Aslam Market",
      "Officers Colony",
      "Basti",
      "Barrier No. 3",
      "Wah Cantt Railway Station",
      "GT Road Wah",
      "Taxila Museum Chowk",
      "UET Taxila Campus",
    ],
    description:
      "Fast shuttle service serving Wah Cantt residential colonies, POF sectors, and central Taxila city.",
  },
  {
    id: "route-attock-1",
    routeNumber: "Route 06",
    routeName: "Attock & Hassan Abdal Corridor",
    region: "attock",
    departureTime: "06:40 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Attock City Kachehri",
      "Kamra Road",
      "Sanjwal Cantt",
      "Hassan Abdal Bus Stand",
      "Cadet College Mor",
      "Burhan Interchange",
      "Margalla Mor",
      "UET Taxila Campus",
    ],
    description:
      "Regional commuter connector linking western Punjab, Attock district, and Hassan Abdal students.",
  },
];

export function BusRoutesExplorer() {
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputId = useId();

  const filteredRoutes = useMemo(() => {
    return BUS_ROUTES.filter((route) => {
      const matchesRegion = selectedRegion === "all" || route.region === selectedRegion;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        route.routeName.toLowerCase().includes(q) ||
        route.routeNumber.toLowerCase().includes(q) ||
        route.description.toLowerCase().includes(q) ||
        route.keyStops.some((stop) => stop.toLowerCase().includes(q));

      return matchesRegion && matchesSearch;
    });
  }, [selectedRegion, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Search & Filter Bar */}
      <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="flex-1">
            <label
              htmlFor={searchInputId}
              className="text-xs font-mono uppercase text-[#71717a] block mb-1"
            >
              Search by neighborhood or pickup stop:
            </label>
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. F-10, Saddar, Aabpara, Faizabad, Wah Cantt..."
              className="w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2 text-xs font-mono text-white placeholder-[#71717a] focus:border-[#d9b451] focus:outline-none"
            />
          </div>

          {/* Region Tabs */}
          <div>
            <span className="text-xs font-mono uppercase text-[#71717a] block mb-1">
              Filter by Region:
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-xs">
              {[
                { id: "all", label: "All Routes" },
                { id: "islamabad", label: "Islamabad" },
                { id: "rawalpindi", label: "Rawalpindi" },
                { id: "wah-cantt", label: "Wah Cantt" },
                { id: "attock", label: "Attock" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedRegion(btn.id)}
                  className={`rounded-lg px-2.5 py-1.5 transition-colors ${
                    selectedRegion === btn.id
                      ? "bg-[#d9b451] text-[#07080a] font-bold"
                      : "border border-white/10 bg-[#14151a] text-[#a1a1aa] hover:text-white"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Routes Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredRoutes.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-white/15 p-12 text-center text-sm font-mono text-[#a1a1aa]">
            No commuter routes match your search for &quot;{searchQuery}&quot;. Try searching
            another stop or select All Routes.
          </div>
        ) : (
          filteredRoutes.map((route) => (
            <div
              key={route.id}
              className="rounded-xl border border-white/10 bg-[#07080a] p-5 flex flex-col justify-between hover:border-[#d9b451]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="rounded bg-[#d9b451]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#d9b451]">
                    {route.routeNumber}
                  </span>
                  <span className="text-xs font-mono text-emerald-400">
                    Dept: {route.departureTime}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-1">{route.routeName}</h3>
                <p className="text-xs text-[#a1a1aa] leading-relaxed mb-4">{route.description}</p>

                <div>
                  <span className="text-[10px] font-mono uppercase text-[#71717a] block mb-1.5 font-bold">
                    Key Stops &amp; Waypoints ({route.keyStops.length}):
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {route.keyStops.map((stop) => {
                      const isMatched =
                        searchQuery.trim() !== "" &&
                        stop.toLowerCase().includes(searchQuery.toLowerCase().trim());
                      return (
                        <span
                          key={stop}
                          className={`rounded px-2 py-0.5 text-[10px] font-mono transition-colors ${
                            isMatched
                              ? "bg-[#d9b451] text-[#07080a] font-bold"
                              : "bg-[#14151a] text-zinc-300 border border-white/5"
                          }`}
                        >
                          {stop}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-5 border-t border-white/5 pt-3 flex items-center justify-between text-xs font-mono text-[#71717a]">
                <span>
                  Return: <strong className="text-zinc-300">{route.returnTimes.join(" & ")}</strong>
                </span>
                <span className="text-[#d9b451] font-bold">Official Fleet</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
