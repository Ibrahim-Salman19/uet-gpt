"use client";

import { useId, useMemo, useState } from "react";

export interface StudentSociety {
  id: string;
  name: string;
  acronym: string;
  category: "technical" | "cultural" | "welfare" | "sports";
  department: string;
  flagshipEvents: string[];
  description: string;
  activities: string[];
  facultyAdvisor: string;
}

export const SOCIETIES_DATA: StudentSociety[] = [
  {
    id: "ieee",
    name: "Institute of Electrical and Electronics Engineers",
    acronym: "IEEE UET Taxila Student Branch",
    category: "technical",
    department: "Department of Electrical Engineering",
    flagshipEvents: [
      "IEEE TechFest",
      "PES Day Workshop",
      "WIE National Symposium",
      "Circuit Craft Competition",
    ],
    description:
      "Premier international technical professional organization on campus featuring specialized chapters: Power & Energy Society (PES), Consumer Electronics Society (CES), and Women in Engineering (WIE).",
    activities: [
      "Technical paper writing seminars",
      "Hands-on embedded systems and IoT bootcamps",
      "Industrial site visits to Tarbela Dam & WAPDA grids",
      "National robotics design contests",
    ],
    facultyAdvisor: "Chairman, Department of Electrical Engineering",
  },
  {
    id: "gdg-campus",
    name: "Google Developer Groups on Campus (formerly GDSC)",
    acronym: "GDG on Campus UET Taxila",
    category: "technical",
    department: "Department of Software Engineering",
    flagshipEvents: [
      "HackXila National Hackathon",
      "Google Cloud Study Jam",
      "Flutter & AI Bootcamp",
      "DevFest Satellite",
    ],
    description:
      "Student-led developer community focusing on Google technologies, Android, Flutter, TensorFlow, Cloud Architecture, and open-source project development.",
    activities: [
      "National hackathons with cash prizes and mentor feedback",
      "Google Solution Challenge projects solving UN SDGs",
      "Open-source GitHub collaborative workshops",
      "Tech career panels with engineers at Google & Microsoft",
    ],
    facultyAdvisor: "Dr. Kanwal Yousaf (Associate Professor, Software Engineering)",
  },
  {
    id: "softdesk",
    name: "Software Engineering Student Development Society",
    acronym: "SOFTDESK",
    category: "technical",
    department: "Department of Software Engineering",
    flagshipEvents: [
      "SoftExpo & Job Fair",
      "Speed Programming Contest",
      "UI/UX Design Sprint",
      "Code Fiesta",
    ],
    description:
      "Departmental computing society empowering students with full-stack software development skills, algorithmic problem solving, and corporate recruitment links.",
    activities: [
      "Competitive programming and LeetCode practice drives",
      "Graduating batch Final Year Project (FYP) Open House",
      "Industry mock interviews with senior tech leads",
      "Web3 and cybersecurity capture-the-flag (CTF) events",
    ],
    facultyAdvisor: "Department of Software Engineering Faculty Board",
  },
  {
    id: "asme",
    name: "American Society of Mechanical Engineers",
    acronym: "ASME UET Taxila Chapter",
    category: "technical",
    department: "Department of Mechanical Engineering",
    flagshipEvents: [
      "UET Taxila AutoShow",
      "CADathon Design Challenge",
      "Formula Student Seminar",
      "Community Service Week",
    ],
    description:
      "Dedicated mechanical and automotive engineering chapter promoting CAD/CAM simulation, thermal systems innovation, and community outreach.",
    activities: [
      "SolidWorks and ANSYS FEA simulation workshops",
      "Automotive engineering exhibitions and sports car showcases",
      "Industrial tours to Heavy Mechanical Complex (HMC) and Millat Tractors",
      "Energy conservation awareness drives",
    ],
    facultyAdvisor: "Faculty of Mechanical Engineering",
  },
  {
    id: "ice",
    name: "Institution of Civil Engineers",
    acronym: "ICE Students Chapter",
    category: "technical",
    department: "Department of Civil Engineering",
    flagshipEvents: [
      "CIVCON National Convention",
      "Spaghetti Bridge Challenge",
      "Concrete Cube Strength Contest",
      "Surveying Quest",
    ],
    description:
      "Student branch of the world-renowned Institution of Civil Engineers UK, organizing Pakistan's flagship CIVCON structural and geotechnical competitions.",
    activities: [
      "Bridge model loading and structural mechanics trials",
      "Total Station and GPS digital surveying workshops",
      "Field visits to Diamer-Bhasha and Mohmand mega-dam projects",
      "Green concrete and sustainable urbanization forums",
    ],
    facultyAdvisor: "Chairman, Department of Civil Engineering",
  },
  {
    id: "qds",
    name: "Quaid-e-Azam Debating Society",
    acronym: "QDS",
    category: "cultural",
    department: "Directorate of Student Affairs (DSA)",
    flagshipEvents: [
      "All-Pakistan Parliamentary Debates 'Jirrah'",
      "All-Punjab Declamation Contest",
      "UET Taxila Model UN (TAXIMUN)",
    ],
    description:
      "University's premier public speaking and declamation society representing UET Taxila at national debating championships in both English and Urdu.",
    activities: [
      "Parliamentary and Asian-style debate training",
      "Urdu and English speech declamations",
      "Policy analysis and Model United Nations simulations",
      "Inter-university debate league fixtures",
    ],
    facultyAdvisor: "Director Student Affairs (DSA)",
  },
  {
    id: "uacs",
    name: "University Art & Culture Society",
    acronym: "UACS",
    category: "cultural",
    department: "Directorate of Student Affairs (DSA)",
    flagshipEvents: [
      "Annual Drama & Theater Festival",
      "Art & Calligraphy Gala",
      "Spring Photographic Exhibition",
      "Cultural Heritage Night",
    ],
    description:
      "The artistic heartbeat of campus responsible for stage plays, visual arts, calligraphy, short film productions, and annual cultural celebrations.",
    activities: [
      "Stage drama scripts, directing, and live theatrical performances",
      "Oil painting, watercolor, and Islamic calligraphy exhibitions",
      "Campus photo-walks and cinematic video production",
      "Cultural pavilion setups during university welcome galas",
    ],
    facultyAdvisor: "Directorate of Student Affairs",
  },
  {
    id: "amls",
    name: "Al-Mohandis Literary Society",
    acronym: "AMLS",
    category: "cultural",
    department: "Department of Humanities & Basic Sciences",
    flagshipEvents: [
      "All-Pakistan Annual Mushaira",
      "Bait-Bazi Championship",
      "Literary Essay Competition",
      "Annual Magazine Launch",
    ],
    description:
      "Preserving and fostering Urdu literature, classical poetry recitals, book reading circles, and publication of the official student literary magazine.",
    activities: [
      "National grand poetic symposiums featuring renowned poets",
      "Inter-collegiate Bait-Bazi and poetry recitation leagues",
      "Creative writing and short story competitions",
      "Publication of the annual university magazine 'Al-Mohandis'",
    ],
    facultyAdvisor: "Department of Humanities Board",
  },
  {
    id: "cbs",
    name: "Character Building Society",
    acronym: "CBS",
    category: "welfare",
    department: "Directorate of Student Affairs in collab with NAB",
    flagshipEvents: [
      "Anti-Corruption Integrity Week",
      "Ethics & Social Responsibility Walk",
      "Youth Leadership Summit",
    ],
    description:
      "Fostering moral values, transparency, civic responsibility, and ethical leadership among students in alignment with the National Accountability Bureau guidelines.",
    activities: [
      "Integrity pledges and civic awareness seminars",
      "Anti-plagiarism and research ethics orientation",
      "Community clean-up and social responsibility drives",
      "Student counseling on conflict resolution and empathy",
    ],
    facultyAdvisor: "Director Student Affairs (DSA)",
  },
  {
    id: "ehs",
    name: "Environmental & Horticultural Society",
    acronym: "EHS",
    category: "welfare",
    department: "Faculty of Civil & Environmental Engineering",
    flagshipEvents: [
      "Green Campus Tree Plantation Drive",
      "World Water Day Symposium",
      "Eco-Design Hackathon",
    ],
    description:
      "Promoting environmental conservation, campus afforestation, plastic-free campaigns, and botanical landscaping across the 163-acre university campus.",
    activities: [
      "Plantation of 1,000+ native saplings each spring and monsoon",
      "Campus recycling drives and waste segregation workshops",
      "Water conservation and wastewater treatment awareness",
      "Eco-friendly lifestyle student campaigns",
    ],
    facultyAdvisor: "Department of Environmental Engineering",
  },
  {
    id: "umc",
    name: "UET Media Club",
    acronym: "UMC",
    category: "cultural",
    department: "Directorate of Student Affairs (DSA)",
    flagshipEvents: [
      "Short Film & Documentary Gala",
      "Campus Photography Walk",
      "Digital Media Masterclass",
    ],
    description:
      "Official campus media production wing responsible for event videography, photography, podcasts, live broadcasting, and social media coverage.",
    activities: [
      "Live multi-camera streaming of convocation and seminars",
      "Documentary production showcasing student projects and labs",
      "Graphic design, digital branding, and animation workshops",
      "Official photography coverage for all university milestones",
    ],
    facultyAdvisor: "Public Relations Officer & DSA",
  },
  {
    id: "uasc",
    name: "University Athletics & Sports Club",
    acronym: "UASC",
    category: "sports",
    department: "Directorate of Physical Education & Sports",
    flagshipEvents: [
      "Annual Inter-Departmental Sports Gala",
      "Vice Chancellor Cricket Cup",
      "UET Futsal Super League",
      "Table Tennis Championship",
    ],
    description:
      "Managing competitive sports teams, fitness centers, grounds, and inter-university HEC championships in cricket, football, basketball, badminton, and squash.",
    activities: [
      "Annual Olympic-style university sports gala spanning 10+ disciplines",
      "Training camps for HEC All-Pakistan Intervarsity Games",
      "Floodlight night cricket and futsal tournaments",
      "Athletic track and field events",
    ],
    facultyAdvisor: "Director Physical Education & Sports",
  },
];

export function SocietiesDirectory() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const searchInputId = useId();

  const filteredSocieties = useMemo(() => {
    return SOCIETIES_DATA.filter((soc) => {
      const matchesCategory = selectedCategory === "all" || soc.category === selectedCategory;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        soc.name.toLowerCase().includes(query) ||
        soc.acronym.toLowerCase().includes(query) ||
        soc.department.toLowerCase().includes(query) ||
        soc.description.toLowerCase().includes(query) ||
        soc.flagshipEvents.some((e) => e.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-xl border border-white/10 bg-[#0c0d10] p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor={searchInputId}
              className="block text-xs font-mono uppercase tracking-wider text-[#71717a] mb-1"
            >
              Search Societies, Events or Disciplines
            </label>
            <input
              id={searchInputId}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. IEEE, GDG, HackXila, AutoShow, Debates, Sports..."
              className="w-full rounded-lg border border-white/15 bg-[#07080a] px-3.5 py-2 text-xs font-mono text-white placeholder-[#71717a] focus:border-[#d9b451] focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-mono uppercase tracking-wider text-[#71717a] mb-1">
              Filter by Category
            </span>
            <div className="flex flex-wrap gap-1 font-mono text-xs">
              {[
                { id: "all", label: "All Societies" },
                { id: "technical", label: "Technical" },
                { id: "cultural", label: "Cultural" },
                { id: "welfare", label: "Welfare" },
                { id: "sports", label: "Sports" },
              ].map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setSelectedCategory(btn.id)}
                  className={`rounded-lg px-2.5 py-1.5 transition-colors ${
                    selectedCategory === btn.id
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

      {/* Societies Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredSocieties.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-white/15 p-12 text-center text-sm font-mono text-[#a1a1aa]">
            No student societies match your search. Try a broader search term.
          </div>
        ) : (
          filteredSocieties.map((soc) => (
            <div
              key={soc.id}
              className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#07080a] p-5 hover:border-[#d9b451]/40 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="inline-flex items-center rounded bg-[#d9b451]/10 px-2 py-0.5 text-[10px] font-mono font-bold text-[#d9b451]">
                    {soc.acronym}
                  </span>
                  <span className="capitalize text-[10px] font-mono text-[#71717a] bg-white/5 px-2 py-0.5 rounded">
                    {soc.category}
                  </span>
                </div>

                <h3 className="text-base font-bold text-white mb-0.5">{soc.name}</h3>
                <p className="text-xs font-mono text-emerald-400 mb-2">{soc.department}</p>

                <p className="text-xs leading-relaxed text-[#a1a1aa] mb-4">{soc.description}</p>

                {/* Flagship Events */}
                <div className="mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717a] block mb-1.5">
                    Flagship Events &amp; Competitions
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {soc.flagshipEvents.map((ev) => (
                      <span
                        key={ev}
                        className="rounded bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] font-mono text-zinc-300"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Core Activities */}
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717a] block mb-1.5">
                    Core Activities
                  </span>
                  <ul className="space-y-1 text-xs text-[#a1a1aa]">
                    {soc.activities.map((act) => (
                      <li key={act} className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#d9b451]" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 border-t border-white/5 pt-3 text-[11px] font-mono text-[#71717a]">
                Faculty Advisor: <strong className="text-zinc-300">{soc.facultyAdvisor}</strong>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
