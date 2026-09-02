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
      "Serving Satellite Town, Murree Road commercial belt, 6th Road, and connected Rawalpindi residential sectors.",
  },
  {
    id: "route-wah-1",
    routeNumber: "Route 05",
    routeName: "Wah Cantt & POF Residential Sectors",
    region: "wah-cantt",
    departureTime: "07:15 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Barrier No. 3",
      "Mall Road Wah",
      "23 Area POF",
      "6 Area POF",
      "Gulistan Colony",
      "POF Hotel & Officers Club",
      "Basti Chowk",
      "Taxila Museum Road",
      "UET Taxila Campus",
    ],
    description:
      "Direct rapid transit for POF employees' children and Wah Cantt residents with frequent morning and afternoon loops.",
  },
  {
    id: "route-attock-1",
    routeNumber: "Route 06",
    routeName: "Attock & Hassan Abdal Corridor",
    region: "attock",
    departureTime: "06:40 AM",
    returnTimes: ["02:15 PM", "04:30 PM"],
    keyStops: [
      "Attock City Bus Terminal",
      "Sanjwal Cantt",
      "Lawrencepur Phattak",
      "Hassan Abdal GT Road",
      "Gurdwara Panja Sahib Mor",
      "Wah Cantt Barrier 1",
      "Taxila Bypass",
      "UET Taxila Campus",
    ],
    description:
      "Long-range regional commuter bus connecting Attock district, Sanjwal, Lawrencepur, and Hassan Abdal to campus.",
  },
];

export function BusRoutesExplorer() {
  const [selectedRegion, setSelectedRegion] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputId = useId();

  const filteredRoutes = useMemo(() => {
    return BUS_ROUTES.filter((route) => {
      const matchesRegion = selectedRegion === "all" || route.region === selectedRegion;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        route.routeName.toLowerCase().includes(query) ||
        route.routeNumber.toLowerCase().includes(query) ||
        route.description.toLowerCase().includes(query) ||
        route.keyStops.some((stop) => stop.toLowerCase().includes(query));

      return matchesRegion && matchesSearch;
    });
  }, [selectedRegion, searchQuery]);

  return (
    <div className="space-y-8">
      {/* Search & Filter Controls */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800/80 dark:bg-zinc-900/60">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor={searchInputId}
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
            >
              Search Stops, Sectors, or Route
            </label>
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Faizabad, Zero Point, Saddar, Wah Cantt, Attock..."
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Filter by Region
            </span>
            <div className="mt-1 flex flex-wrap gap-2">
              {[
                { id: "all", label: "All Routes" },
                { id: "islamabad", label: "Islamabad" },
                { id: "rawalpindi", label: "Rawalpindi" },
                { id: "wah-cantt", label: "Wah Cantt" },
                { id: "attock", label: "Hassan Abdal / Attock" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedRegion(btn.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedRegion === btn.id
                      ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Route Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {filteredRoutes.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No commuter routes match your search criteria. Try a different stop or keyword.
          </div>
        ) : (
          filteredRoutes.map((route) => (
            <div
              key={route.id}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm transition-all hover:border-emerald-500/40 hover:shadow-md dark:border-zinc-800/80 dark:bg-zinc-900/60"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {route.routeNumber}
                  </span>
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                    Dept:{" "}
                    <strong className="text-zinc-900 dark:text-zinc-100">
                      {route.departureTime}
                    </strong>
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {route.routeName}
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{route.description}</p>

                <div className="mt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Key Stops &amp; Waypoints
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {route.keyStops.map((stop) => (
                      <span
                        key={stop}
                        className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        {stop}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
                <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                  <span>
                    Return Departure:{" "}
                    <strong className="text-zinc-700 dark:text-zinc-300">
                      {route.returnTimes.join(" & ")}
                    </strong>
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Official Fleet
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
