/**
 * Authoritative program data for UET Taxila 14 undergraduate degree programs.
 * Grounded in the official UET Taxila Undergraduate Prospectus and department curriculums.
 */

export interface SemesterCourse {
  code: string;
  title: string;
  creditHours: string; // e.g. "3+0" or "3+1"
}

export interface SemesterPlan {
  semesterNumber: number;
  courses: SemesterCourse[];
  totalCredits: number;
}

export interface ProgramDetail {
  slug: string;
  name: string;
  degreeType: "BSc Engineering" | "BS Computing" | "BS Basic Sciences";
  department: string;
  faculty: string;
  duration: string;
  totalCreditHours: number;
  accreditation: string;
  accreditationBody: "PEC" | "NCEAC" | "HEC";
  obeLevel: string;
  benchmarkClosingMerit: string;
  lead: string;
  overview: string[];
  labs: string[];
  careerProspects: string[];
  semesters: SemesterPlan[];
  faqs: { q: string; a: string }[];
}

export const PROGRAMS_DATA: ProgramDetail[] = [
  {
    slug: "computer-science",
    name: "BS Computer Science",
    degreeType: "BS Computing",
    department: "Department of Computer Science",
    faculty: "Faculty of Telecommunication & Information Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 133,
    accreditation: "Accredited Category 'W' (Highest Ranking)",
    accreditationBody: "NCEAC",
    obeLevel: "Outcome-Based Education (OBE) Aligned",
    benchmarkClosingMerit: "80.450%",
    lead: "The BS Computer Science program at UET Taxila provides rigorous theoretical computer science foundations coupled with advanced artificial intelligence, distributed systems, and software engineering competencies.",
    overview: [
      "The Department of Computer Science at UET Taxila is one of the most competitive computing faculties in Pakistan, offering state-of-the-art curriculum compliant with ACM/IEEE and NCEAC guidelines.",
      "Students undertake comprehensive study in algorithm analysis, operating systems, database architectures, machine learning, cloud computing, and computer networks.",
      "The program features a mandatory 2-semester Final Year Design Project (FYDP) addressing industry problems, alongside competitive programming training.",
    ],
    labs: [
      "Artificial Intelligence & Machine Learning Lab",
      "Software Development & Web Engineering Lab",
      "Computer Networks & Cyber Security Lab",
      "High Performance Computing (HPC) Cluster",
      "Database Systems Lab",
    ],
    careerProspects: [
      "Software Engineer / Full-Stack Developer",
      "AI / Machine Learning Engineer",
      "Data Scientist / Analytics Specialist",
      "Cloud Solutions Architect / DevOps Engineer",
      "Cybersecurity Analyst",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "CS-101", title: "Programming Fundamentals", creditHours: "3+1" },
          { code: "CS-102", title: "Application of Information Technologies", creditHours: "2+1" },
          { code: "MT-101", title: "Calculus & Analytical Geometry", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "IS-101", title: "Islamic / Pakistan Studies", creditHours: "2+0" },
          { code: "PH-101", title: "Applied Physics", creditHours: "2+0" },
        ],
      },
      {
        semesterNumber: 2,
        totalCredits: 17,
        courses: [
          { code: "CS-103", title: "Object Oriented Programming", creditHours: "3+1" },
          { code: "CS-104", title: "Discrete Structures", creditHours: "3+0" },
          { code: "MT-102", title: "Linear Algebra & Differential Equations", creditHours: "3+0" },
          { code: "EN-102", title: "Communication & Technical Writing", creditHours: "3+0" },
          { code: "EE-101", title: "Digital Logic Design", creditHours: "3+1" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the eligibility criteria for BS Computer Science at UET Taxila?",
        a: "Applicants must have passed Intermediate (F.Sc Pre-Engineering, ICS with Math/Physics/CS, or General Science with Math) or equivalent with at least 50% unadjusted marks and appeared in ECAT.",
      },
      {
        q: "What was the closing merit for BS Computer Science at UET Taxila?",
        a: "The benchmark closing merit for BS Computer Science on regular subsidized open-merit (Category A) is approximately 80.450%.",
      },
    ],
  },
  {
    slug: "software-engineering",
    name: "BS Software Engineering",
    degreeType: "BS Computing",
    department: "Department of Software Engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 134,
    accreditation: "Accredited Category 'W'",
    accreditationBody: "NCEAC",
    obeLevel: "Outcome-Based Education (OBE) Aligned",
    benchmarkClosingMerit: "79.820%",
    lead: "The BS Software Engineering program prepares students to design, develop, test, and maintain large-scale software systems using modern Agile methodologies, microservices, and enterprise architectures.",
    overview: [
      "The Department of Software Engineering focuses on software requirements engineering, software architecture, quality assurance, formal verification, and automated testing.",
      "Graduates enter the global software industry with hands-on mastery of full-stack ecosystems, mobile computing, cloud microservices, and continuous integration/continuous deployment (CI/CD) pipelines.",
    ],
    labs: [
      "Software Quality Assurance & Testing Lab",
      "Mobile Computing & Web Engineering Lab",
      "Software Design & Architecture Lab",
      "Usability & Human-Computer Interaction Lab",
    ],
    careerProspects: [
      "Senior Software Engineer",
      "Software Architect",
      "QA Automation Engineer",
      "DevOps / Site Reliability Engineer",
      "Product Manager / Scrum Master",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "SE-101", title: "Introduction to Software Engineering", creditHours: "3+0" },
          { code: "CS-101", title: "Programming Fundamentals", creditHours: "3+1" },
          { code: "MT-101", title: "Calculus & Analytical Geometry", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "PH-101", title: "Applied Physics", creditHours: "3+1" },
        ],
      },
    ],
    faqs: [
      {
        q: "How does Software Engineering differ from Computer Science at UET Taxila?",
        a: "Computer Science focuses on theoretical computing, algorithm complexity, AI, and systems programming. Software Engineering focuses on the engineering lifecycle, requirements, design patterns, testing, and enterprise project management.",
      },
    ],
  },
  {
    slug: "electrical-engineering",
    name: "BSc Electrical Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Electrical Engineering",
    faculty: "Faculty of Electronics & Electrical Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord Substantial Equivalence)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "74.150%",
    lead: "The BSc Electrical Engineering program at UET Taxila is one of Pakistan's flagship engineering curricula, covering power systems, renewable energy, electrical machines, control systems, and high-voltage transmission.",
    overview: [
      "Accredited under PEC OBE Level-II, graduates enjoy direct international professional equivalence in 20+ Washington Accord signatory countries (USA, UK, Canada, Australia, Japan).",
      "Students choose major specializations in Power Systems Engineering or Electronics & Control Systems.",
    ],
    labs: [
      "High Voltage Engineering Laboratory",
      "Power Systems Simulation & Protection Lab",
      "Electrical Machines & Drives Lab",
      "Control Systems & Automation Lab",
      "Power Electronics Lab",
    ],
    careerProspects: [
      "Power Generation & Transmission Engineer (WAPDA, NTDC, DISCOs)",
      "Renewable Energy Systems Designer (Solar, Wind)",
      "Industrial Automation & Control Engineer",
      "Substation & Protection Engineer",
      "Electrical Design Consultant",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 18,
        courses: [
          { code: "EE-101", title: "Linear Circuit Analysis", creditHours: "3+1" },
          { code: "MT-101", title: "Calculus & Analytical Geometry", creditHours: "3+0" },
          { code: "ME-101", title: "Engineering Drawing & Workshop", creditHours: "1+2" },
          { code: "CS-101", title: "Computer Programming", creditHours: "2+1" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "IS-101", title: "Islamic Studies / Ethics", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "Is UET Taxila Electrical Engineering degree recognized internationally?",
        a: "Yes, it is accredited under PEC Level-II (Washington Accord), making it globally recognized for professional engineering practice abroad.",
      },
    ],
  },
  {
    slug: "mechanical-engineering",
    name: "BSc Mechanical Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Mechanical Engineering",
    faculty: "Faculty of Mechanical & Aeronautical Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "73.890%",
    lead: "BSc Mechanical Engineering at UET Taxila equips students with mastery over thermodynamics, fluid mechanics, CAD/CAM manufacturing, machine design, HVAC, and automotive engineering.",
    overview: [
      "Equipped with extensive heavy engineering workshops, CNC machining centers, and wind tunnel aerodynamic facilities.",
      "The program features comprehensive student participation in Formula Student and Shell Eco-marathon racing vehicle designs.",
    ],
    labs: [
      "Thermodynamics & Heat Transfer Lab",
      "Fluid Mechanics & Aerodynamics Wind Tunnel",
      "CNC Machining & Advanced Manufacturing Lab",
      "Materials Testing & Metallurgy Lab",
      "Automotive Engineering Lab",
    ],
    careerProspects: [
      "Thermal Power Plant Engineer",
      "Automotive & Aerospace Systems Engineer",
      "HVAC & Refrigeration Design Consultant",
      "Manufacturing & Production Engineer",
      "Oil & Gas Pipeline Engineer",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 18,
        courses: [
          { code: "ME-111", title: "Engineering Statics", creditHours: "3+0" },
          { code: "ME-112", title: "Engineering Drawing & Graphics", creditHours: "1+2" },
          { code: "ME-113", title: "Workshop Practice", creditHours: "0+2" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "PH-101", title: "Applied Physics", creditHours: "2+1" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "IS-101", title: "Islamic / Pak Studies", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What are the core industries hiring UET Taxila Mechanical Engineers?",
        a: "Graduates are hired across Heavy Mechanical Complex (HMC), Fauji Fertilizer (FFC), OGDCL, PARCO, Honda, Toyota, NESPAK, and nuclear energy commissions.",
      },
    ],
  },
  {
    slug: "civil-engineering",
    name: "BSc Civil Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Civil Engineering",
    faculty: "Faculty of Civil & Environmental Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "71.420%",
    lead: "BSc Civil Engineering at UET Taxila delivers comprehensive expertise in structural engineering, geotechnical analysis, highway design, hydraulics, water resources, and construction management.",
    overview: [
      "One of the oldest and most prestigious departments, hosting a mandatory 4-week Survey Camp at Abbottabad / Ghora Gali.",
      "Graduates lead mega-infrastructure projects across CPEC highways, dams, high-rise skyscrapers, and metro transport systems.",
    ],
    labs: [
      "Heavy Structures & Concrete Testing Lab",
      "Geotechnical & Soil Mechanics Lab",
      "Hydraulics & Water Resources Lab",
      "Transportation Engineering & Asphalt Lab",
      "Environmental Engineering Lab",
    ],
    careerProspects: [
      "Structural Design Engineer",
      "Geotechnical Consultant",
      "Highway & Transportation Planner",
      "Construction Project Manager",
      "Water Resource & Dam Engineer",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "CE-101", title: "Civil Engineering Materials", creditHours: "3+1" },
          { code: "CE-102", title: "Engineering Mechanics", creditHours: "3+1" },
          { code: "CE-103", title: "Engineering Drawing", creditHours: "1+2" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the Survey Camp in UET Taxila Civil Engineering?",
        a: "It is a mandatory 4-week field practical training camp held in hilly terrain where students perform topographic mapping, contouring, and road alignment design.",
      },
    ],
  },
  {
    slug: "mechatronics-engineering",
    name: "BSc Mechatronics Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Mechatronics Engineering",
    faculty: "Faculty of Mechanical & Aeronautical Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "72.840%",
    lead: "Mechatronics Engineering integrates mechanical engineering, electronics, computer science, and control theory to create intelligent autonomous robotics and smart automation systems.",
    overview: [
      "Hosts the prestigious National Center of Robotics and Automation (NCRA) Swarm Robotics Lab.",
      "Curriculum covers industrial robotics, PLC programming, embedded microcontrollers, machine vision, and drone flight controllers.",
    ],
    labs: [
      "Swarm Robotics & Artificial Intelligence Lab (NCRA)",
      "Industrial Automation & PLC Lab",
      "Microcontrollers & Embedded Systems Lab",
      "Machine Vision & Image Processing Lab",
    ],
    careerProspects: [
      "Robotics & Automation Engineer",
      "Embedded Systems Developer",
      "Control Systems Specialist",
      "IoT & Smart Factory Architect",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 18,
        courses: [
          { code: "MC-101", title: "Electric Circuits", creditHours: "3+1" },
          { code: "MC-102", title: "Engineering Statics", creditHours: "3+0" },
          { code: "CS-101", title: "Computer Programming", creditHours: "2+1" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "ME-101", title: "Workshop Practice", creditHours: "0+2" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the role of NCRA Swarm Robotics lab at UET Taxila?",
        a: "The NCRA lab is a national center of excellence conducting funded research in multi-robot cooperation, autonomous navigation, and unmanned aerial vehicles (UAVs).",
      },
    ],
  },
  {
    slug: "computer-engineering",
    name: "BSc Computer Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Computer Engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "76.900%",
    lead: "BSc Computer Engineering bridges hardware and software, focusing on computer architecture, FPGA hardware design, embedded IoT, VLSI design, and operating systems.",
    overview: [
      "Accredited under PEC Level-II OBE framework, providing dual competency in low-level microchip design and high-level software development.",
    ],
    labs: [
      "FPGA & Digital Systems Design Lab",
      "Microprocessors & Interfacing Lab",
      "VLSI & Embedded Systems Lab",
      "Computer Networks Lab",
    ],
    careerProspects: [
      "FPGA / ASIC Design Engineer",
      "Embedded Firmware Engineer",
      "Computer Architecture Specialist",
      "Hardware-Software Co-design Engineer",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "CP-101", title: "Linear Circuit Analysis", creditHours: "3+1" },
          { code: "CP-102", title: "Programming Fundamentals", creditHours: "3+1" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "IS-101", title: "Islamic / Pak Studies", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the difference between Computer Engineering and Computer Science?",
        a: "Computer Engineering is an engineering program (PEC accredited) emphasizing digital hardware, microprocessors, and circuit design along with software. Computer Science (NCEAC accredited) focuses primarily on software theory, algorithms, and applications.",
      },
    ],
  },
  {
    slug: "telecommunication-engineering",
    name: "BSc Telecommunication Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Telecommunication Engineering",
    faculty: "Faculty of Telecommunication & Information Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "70.150%",
    lead: "BSc Telecommunication Engineering trains engineers in 5G/6G cellular networks, optical fiber communication, satellite links, RF & antenna design, and digital signal processing.",
    overview: [
      "Equipped with advanced microwave and RF testing laboratories.",
      "Strong placement record across mobile telecom operators (Jazz, Telenor, Zong), PTCL, and defense telecom agencies.",
    ],
    labs: [
      "RF & Microwave Engineering Lab",
      "Optical Fiber Communications Lab",
      "Digital Signal Processing (DSP) Lab",
      "Wireless & Cellular Networks Lab",
    ],
    careerProspects: [
      "Wireless & 5G Network Engineer",
      "RF Planning & Optimization Engineer",
      "Optical Transmission Engineer",
      "Telecom Systems Specialist",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "TE-101", title: "Linear Circuit Analysis", creditHours: "3+1" },
          { code: "CS-101", title: "Computer Programming", creditHours: "2+1" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "PH-101", title: "Applied Physics", creditHours: "3+1" },
        ],
      },
    ],
    faqs: [
      {
        q: "Are telecom engineers eligible for computer networking and IT jobs?",
        a: "Yes, telecom engineers have strong foundations in TCP/IP networking, routing, switching, and network security, qualifying them for CCNA/CCNP network engineering roles.",
      },
    ],
  },
  {
    slug: "industrial-engineering",
    name: "BSc Industrial Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Industrial Engineering",
    faculty: "Faculty of Industrial Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "69.800%",
    lead: "Industrial Engineering optimizes complex manufacturing and service systems, focusing on operations research, supply chain logistics, quality management, ergonomics, and lean production.",
    overview: [
      "Combines mathematical optimization with engineering principles and management science.",
      "Graduates drive productivity improvements in multinational FMCGs, automotive manufacturing, and logistics companies.",
    ],
    labs: [
      "Human Factors & Ergonomics Lab",
      "Operations Research & Simulation Lab",
      "Quality Control & Metrology Lab",
      "Manufacturing Systems & CNC Lab",
    ],
    careerProspects: [
      "Supply Chain & Logistics Specialist",
      "Quality Assurance / Six Sigma Black Belt",
      "Operations & Production Manager",
      "Process Optimization Consultant",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "IE-101", title: "Engineering Mechanics", creditHours: "3+1" },
          { code: "IE-102", title: "Engineering Drawing", creditHours: "1+2" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "ME-101", title: "Workshop Practice", creditHours: "0+2" },
          { code: "IS-101", title: "Islamic / Pak Studies", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What makes Industrial Engineering unique?",
        a: "It is the only engineering discipline focused directly on reducing production costs, eliminating waste, optimizing supply chains, and maximizing operational efficiency.",
      },
    ],
  },
  {
    slug: "electronics-engineering",
    name: "BSc Electronics Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Electronics Engineering",
    faculty: "Faculty of Electronics & Electrical Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "71.100%",
    lead: "BSc Electronics Engineering focuses on semiconductor devices, analog and digital IC design, biomedical instrumentation, microelectronics, and signal processing.",
    overview: [
      "Offers state-of-the-art electronics design automation (EDA) software suites.",
      "Prepares engineers for chip design, IoT sensors, medical devices, and consumer electronics.",
    ],
    labs: [
      "Analog & Digital Electronics Lab",
      "Integrated Circuit (IC) Design Lab",
      "Biomedical Engineering & Sensors Lab",
      "Power Electronics Lab",
    ],
    careerProspects: [
      "Electronics Design Engineer",
      "Biomedical Equipment Engineer",
      "Semiconductor & IC Layout Engineer",
      "Hardware QA Specialist",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "EL-101", title: "Linear Circuit Analysis", creditHours: "3+1" },
          { code: "CS-101", title: "Computer Programming", creditHours: "2+1" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "PH-101", title: "Applied Physics", creditHours: "3+1" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What are the career prospects for electronics engineers?",
        a: "Graduates work across defense R&D organizations (NESCOM, KRL, POF), consumer electronics companies, medical equipment suppliers, and telecom hardware vendors.",
      },
    ],
  },
  {
    slug: "environmental-engineering",
    name: "BSc Environmental Engineering",
    degreeType: "BSc Engineering",
    department: "Department of Environmental Engineering",
    faculty: "Faculty of Civil & Environmental Engineering",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 136,
    accreditation: "Level-II (Washington Accord)",
    accreditationBody: "PEC",
    obeLevel: "OBE Level-II",
    benchmarkClosingMerit: "68.500%",
    lead: "Environmental Engineering tackles climate change, air & water pollution, solid waste management, renewable resource conservation, and environmental impact assessments (EIA).",
    overview: [
      "Addresses critical United Nations Sustainable Development Goals (SDGs).",
      "Graduates lead water filtration plant designs, industrial wastewater treatment, and carbon footprint reduction audits.",
    ],
    labs: [
      "Environmental Chemistry & Microbiology Lab",
      "Water & Wastewater Treatment Plant Simulator",
      "Air Pollution Monitoring & Noise Lab",
      "Solid Waste Management Lab",
    ],
    careerProspects: [
      "Environmental Consultant & EIA Specialist",
      "Water & Wastewater Treatment Plant Engineer",
      "Health, Safety & Environment (HSE) Officer",
      "Sustainability Analyst",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 17,
        courses: [
          { code: "EN-101", title: "Environmental Chemistry", creditHours: "3+1" },
          { code: "CE-102", title: "Engineering Mechanics", creditHours: "3+1" },
          { code: "MT-101", title: "Calculus", creditHours: "3+0" },
          { code: "EN-101", title: "Functional English", creditHours: "3+0" },
          { code: "CE-103", title: "Engineering Drawing", creditHours: "1+2" },
        ],
      },
    ],
    faqs: [
      {
        q: "Is Environmental Engineering recognized by PEC?",
        a: "Yes, it is fully recognized and accredited by PEC under OBE Level-II.",
      },
    ],
  },
  {
    slug: "mathematics",
    name: "BS Mathematics",
    degreeType: "BS Basic Sciences",
    department: "Department of Basic Sciences & Humanities",
    faculty: "Faculty of Basic Sciences & Humanities",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 130,
    accreditation: "Recognized by HEC",
    accreditationBody: "HEC",
    obeLevel: "HEC Quality Standards",
    benchmarkClosingMerit: "65.200%",
    lead: "BS Mathematics delivers deep mathematical rigor in pure and applied mathematics, numerical computing, differential equations, fluid dynamics, and statistical modeling.",
    overview: [
      "Prepares students for quantitative roles in data science, cryptography, financial mathematics, and doctoral research.",
    ],
    labs: ["Computational Mathematics & MATLAB Lab", "Statistical Software & Data Analysis Lab"],
    careerProspects: [
      "Quantitative Analyst / Financial Modeler",
      "Data Scientist / Cryptographer",
      "Mathematics Lecturer / Researcher",
      "Operations Analyst",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 16,
        courses: [
          { code: "MA-101", title: "Calculus-I", creditHours: "3+0" },
          { code: "MA-102", title: "Algebra & Trigonometry", creditHours: "3+0" },
          { code: "CS-101", title: "Introduction to Computing", creditHours: "2+1" },
          { code: "EN-101", title: "English-I", creditHours: "3+0" },
          { code: "IS-101", title: "Islamic / Pak Studies", creditHours: "2+0" },
          { code: "PH-101", title: "Physics-I", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the entry test requirement for BS Mathematics?",
        a: "Applicants can appear in ECAT, NAT, or university admission test with a minimum 50% intermediate aggregate.",
      },
    ],
  },
  {
    slug: "physics",
    name: "BS Physics",
    degreeType: "BS Basic Sciences",
    department: "Department of Basic Sciences & Humanities",
    faculty: "Faculty of Basic Sciences & Humanities",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 130,
    accreditation: "Recognized by HEC",
    accreditationBody: "HEC",
    obeLevel: "HEC Quality Standards",
    benchmarkClosingMerit: "64.800%",
    lead: "BS Physics explores quantum mechanics, electrodynamics, solid-state physics, optics, nanotechnology, and nuclear energy applications.",
    overview: [
      "Provides hands-on laboratory experimentation alongside theoretical derivations.",
      "Prepares graduates for research careers in atomic energy commissions, optics laboratories, and semiconductor fabrication.",
    ],
    labs: [
      "Modern Physics & Optics Lab",
      "Solid State & Nanotechnology Lab",
      "Computational Physics Lab",
    ],
    careerProspects: [
      "Scientific Officer (PAEC, NESCOM, KRL)",
      "Optics & Laser Specialist",
      "Physics Lecturer / Educator",
      "Materials Researcher",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 16,
        courses: [
          { code: "PH-101", title: "Mechanics", creditHours: "3+1" },
          { code: "MA-101", title: "Calculus-I", creditHours: "3+0" },
          { code: "CS-101", title: "Computing", creditHours: "2+1" },
          { code: "EN-101", title: "English-I", creditHours: "3+0" },
          { code: "IS-101", title: "Islamic Studies", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "What is the fee for BS Physics at UET Taxila?",
        a: "Tuition is charged at the regular subsidized rate of approximately PKR 48,000 per semester.",
      },
    ],
  },
  {
    slug: "chemistry",
    name: "BS Chemistry",
    degreeType: "BS Basic Sciences",
    department: "Department of Basic Sciences & Humanities",
    faculty: "Faculty of Basic Sciences & Humanities",
    duration: "4 Years (8 Semesters)",
    totalCreditHours: 130,
    accreditation: "Recognized by HEC",
    accreditationBody: "HEC",
    obeLevel: "HEC Quality Standards",
    benchmarkClosingMerit: "64.500%",
    lead: "BS Chemistry covers organic synthesis, physical chemistry, analytical instrumentation, polymer chemistry, and industrial chemical quality assurance.",
    overview: [
      "Equipped with modern spectroscopy and chemical analysis instruments.",
      "Graduates enter pharmaceutical manufacturing, petrochemical refineries, and chemical testing laboratories.",
    ],
    labs: [
      "Organic Synthesis Lab",
      "Physical Chemistry & Thermodynamics Lab",
      "Analytical Spectroscopy Lab",
    ],
    careerProspects: [
      "Chemical Quality Assurance Specialist",
      "Pharmaceutical Chemist",
      "Materials & Polymers Scientist",
      "Environmental Chemical Analyst",
    ],
    semesters: [
      {
        semesterNumber: 1,
        totalCredits: 16,
        courses: [
          { code: "CH-101", title: "General Chemistry", creditHours: "3+1" },
          { code: "MA-101", title: "Mathematics-I", creditHours: "3+0" },
          { code: "EN-101", title: "English-I", creditHours: "3+0" },
          { code: "CS-101", title: "Computing", creditHours: "2+1" },
          { code: "IS-101", title: "Islamic Studies", creditHours: "2+0" },
        ],
      },
    ],
    faqs: [
      {
        q: "Are pre-medical students eligible for BS Chemistry at UET Taxila?",
        a: "Yes, students with F.Sc Pre-Medical are eligible for BS Chemistry and BS Basic Sciences programs.",
      },
    ],
  },
];

export function getProgramBySlug(slug: string): ProgramDetail | undefined {
  return PROGRAMS_DATA.find((p) => p.slug === slug);
}

export function getAllProgramSlugs(): string[] {
  return PROGRAMS_DATA.map((p) => p.slug);
}
