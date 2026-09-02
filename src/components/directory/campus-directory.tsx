"use client";

import { Mail, MapPin, Phone, Search } from "lucide-react";
import { useMemo, useState } from "react";

export interface DirectoryEntry {
  title: string;
  category: "admin" | "academic" | "services";
  official: string;
  email: string;
  phone: string;
  location: string;
}

export const DIRECTORY_DATA: DirectoryEntry[] = [
  {
    title: "Directorate of Admissions",
    category: "admin",
    official: "Director Admissions",
    email: "admissions@uettaxila.edu.pk",
    phone: "+92 (51) 9047412",
    location: "Admin Block, Ground Floor",
  },
  {
    title: "Registrar Secretariat",
    category: "admin",
    official: "Registrar",
    email: "registrar@uettaxila.edu.pk",
    phone: "+92 (51) 9047406",
    location: "Admin Block, 1st Floor",
  },
  {
    title: "Controller of Examinations",
    category: "admin",
    official: "Controller of Examinations",
    email: "controller.exams@uettaxila.edu.pk",
    phone: "+92 (51) 9047420",
    location: "Examinations Branch",
  },
  {
    title: "Treasurer / Accounts Office",
    category: "admin",
    official: "Treasurer",
    email: "treasurer@uettaxila.edu.pk",
    phone: "+92 (51) 9047416",
    location: "Admin Block, Ground Floor",
  },
  {
    title: "Directorate of Financial Aid (Scholarships)",
    category: "admin",
    official: "Director Financial Aid",
    email: "financial.aid@uettaxila.edu.pk",
    phone: "+92 (51) 9047418",
    location: "Student Service Center",
  },
  {
    title: "Chief Warden Office (Hostels)",
    category: "services",
    official: "Chief Warden",
    email: "hostels@uettaxila.edu.pk",
    phone: "+92 (51) 9047450",
    location: "Central Hostel Office, Near Quaid Hall",
  },
  {
    title: "Transport Directorate",
    category: "services",
    official: "Transport Officer",
    email: "transport@uettaxila.edu.pk",
    phone: "+92 (51) 9047460",
    location: "Central Transport Depot",
  },
  {
    title: "University Medical Center",
    category: "services",
    official: "Senior Medical Officer",
    email: "medical@uettaxila.edu.pk",
    phone: "+92 (51) 9047470",
    location: "Campus Dispensary & Medical Complex",
  },
  {
    title: "Department of Computer Science",
    category: "academic",
    official: "Chairman, Computer Science",
    email: "cs.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047560",
    location: "CS & SE Academic Complex",
  },
  {
    title: "Department of Software Engineering",
    category: "academic",
    official: "Chairman, Software Engineering",
    email: "se.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047570",
    location: "CS & SE Academic Complex",
  },
  {
    title: "Department of Electrical Engineering",
    category: "academic",
    official: "Chairman, Electrical Engineering",
    email: "ee.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047510",
    location: "Electrical Engineering Building",
  },
  {
    title: "Department of Mechanical Engineering",
    category: "academic",
    official: "Chairman, Mechanical Engineering",
    email: "me.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047530",
    location: "Mechanical Engineering Complex",
  },
  {
    title: "Department of Civil Engineering",
    category: "academic",
    official: "Chairman, Civil Engineering",
    email: "ce.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047540",
    location: "Civil Engineering Complex",
  },
  {
    title: "Department of Mechatronics Engineering",
    category: "academic",
    official: "Chairman, Mechatronics Engineering",
    email: "mechatronics@uettaxila.edu.pk",
    phone: "+92 (51) 9047580",
    location: "Mechatronics Building",
  },
  {
    title: "Department of Computer Engineering",
    category: "academic",
    official: "Chairman, Computer Engineering",
    email: "cp.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047550",
    location: "FTIE Building",
  },
  {
    title: "Department of Telecommunication Engineering",
    category: "academic",
    official: "Chairman, Telecommunication Engineering",
    email: "telecom.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047590",
    location: "FTIE Building",
  },
  {
    title: "Department of Industrial Engineering",
    category: "academic",
    official: "Chairman, Industrial Engineering",
    email: "ie.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047520",
    location: "Industrial Engineering Complex",
  },
  {
    title: "Department of Electronics Engineering",
    category: "academic",
    official: "Chairman, Electronics Engineering",
    email: "electronics@uettaxila.edu.pk",
    phone: "+92 (51) 9047515",
    location: "FEEE Building",
  },
  {
    title: "Department of Environmental Engineering",
    category: "academic",
    official: "Chairman, Environmental Engineering",
    email: "env.dept@uettaxila.edu.pk",
    phone: "+92 (51) 9047545",
    location: "Civil & Environmental Block",
  },
  {
    title: "Department of Basic Sciences & Humanities",
    category: "academic",
    official: "Chairman, Basic Sciences",
    email: "basic.sciences@uettaxila.edu.pk",
    phone: "+92 (51) 9047500",
    location: "Basic Sciences Block",
  },
];

export function CampusDirectory() {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "admin" | "academic" | "services"
  >("all");

  const filtered = useMemo(() => {
    return DIRECTORY_DATA.filter((entry) => {
      const matchesCategory = selectedCategory === "all" || entry.category === selectedCategory;
      const matchesQuery =
        query.trim() === "" ||
        entry.title.toLowerCase().includes(query.toLowerCase()) ||
        entry.official.toLowerCase().includes(query.toLowerCase()) ||
        entry.location.toLowerCase().includes(query.toLowerCase()) ||
        entry.email.toLowerCase().includes(query.toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [query, selectedCategory]);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717a]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by department, office, location, or official..."
            className="w-full rounded-xl border border-white/10 bg-[#0c0d10] py-2.5 pl-10 pr-4 text-sm text-white placeholder-[#71717a] focus:border-[#d9b451] focus:outline-none focus:ring-1 focus:ring-[#d9b451]"
          />
        </div>
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(["all", "admin", "academic", "services"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-[#d9b451] text-[#07080a]"
                  : "bg-[#14151a] text-[#a1a1aa] hover:text-white border border-white/5"
              }`}
            >
              {cat === "all" ? "All Contacts" : cat === "admin" ? "Administration" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Directory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((entry) => (
          <div
            key={entry.title}
            className="rounded-xl border border-white/10 bg-[#0c0d10] p-5 hover:border-[#d9b451]/40 transition-colors flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-white/5 text-[#d9b451] border border-white/5">
                  {entry.category}
                </span>
                <span className="text-xs text-[#71717a] font-sans">{entry.official}</span>
              </div>
              <h3 className="font-semibold text-base text-white mb-3">{entry.title}</h3>
            </div>

            <div className="space-y-2 border-t border-white/5 pt-3 text-xs">
              <div className="flex items-center gap-2.5 text-[#a1a1aa]">
                <MapPin className="h-3.5 w-3.5 text-[#d9b451] shrink-0" />
                <span>{entry.location}</span>
              </div>
              <div className="flex items-center gap-2.5 text-[#a1a1aa]">
                <Phone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <a
                  href={`tel:${entry.phone}`}
                  className="hover:text-white font-mono transition-colors"
                >
                  {entry.phone}
                </a>
              </div>
              <div className="flex items-center gap-2.5 text-[#a1a1aa]">
                <Mail className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <a
                  href={`mailto:${entry.email}`}
                  className="hover:text-[#d9b451] font-mono transition-colors truncate"
                >
                  {entry.email}
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="p-8 text-center rounded-xl border border-white/5 bg-[#0c0d10]">
          <p className="text-sm text-[#a1a1aa]">
            No contacts found matching &ldquo;{query}&rdquo;. Try another search term.
          </p>
        </div>
      )}
    </div>
  );
}
