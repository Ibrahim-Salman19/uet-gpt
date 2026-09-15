// Static campus data shared by client components and server-rendered SEO pages.
// It must live outside "use client" modules: a server component importing a
// non-component export from a client module gets a client reference, not the
// array (the /uet-taxila/* pages failed to prerender with ".map is not a function").

export const CALENDAR_EVENTS = [
  {
    category: "admissions",
    date: "July 15 - August 10, 2026",
    title: "ECAT 2026 Registration Window",
    desc: "Online registration for the combined engineering entrance exam on the admission portal.",
  },
  {
    category: "admissions",
    date: "August 15 - August 22, 2026",
    title: "ECAT Examination Conduction",
    desc: "Computer-based testing across multiple designated testing centers across Pakistan.",
  },
  {
    category: "admissions",
    date: "August 28, 2026",
    title: "ECAT Official Results Announcement",
    desc: "Publication of computerized scores and individual percentile ranks.",
  },
  {
    category: "admissions",
    date: "September 05, 2026",
    title: "First Merit List Announcement",
    desc: "Display of 1st merit list for Category A (Subsidized) and Category S (Self-Finance).",
  },
  {
    category: "classes",
    date: "September 28, 2026",
    title: "Freshmen Orientation & Classes Commence",
    desc: "Official orientation day and commencement of regular Fall 2026 undergraduate classes.",
  },
  {
    category: "exams",
    date: "November 23 - November 28, 2026",
    title: "Mid-Semester Examination Week",
    desc: "Centralized 9th-week written assessments mapped directly to course CLOs.",
  },
  {
    category: "exams",
    date: "January 25 - February 06, 2027",
    title: "End-Semester Final Examinations",
    desc: "Comprehensive 18th-week final theory exams and Open-Ended Lab (OEL) assessments.",
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
