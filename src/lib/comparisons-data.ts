/**
 * Authoritative UET Taxila vs. peer-university comparison data.
 * Figures are drawn from each university's official admissions/fee pages and
 * cross-checked against the 2026 fee tables already shipped in
 * src/components/admissions/admissions-hub.tsx. Keep both in sync when either changes.
 */

export interface ComparisonRow {
  feature: string;
  uetTaxila: string;
  peer: string;
}

export interface ComparisonFaq {
  q: string;
  a: string;
}

export interface ComparisonEntry {
  slug: string;
  /** Full official name of the peer institution */
  peerName: string;
  /** Short name used in headings/UI, e.g. "NUST" */
  peerShortName: string;
  peerLocation: string;
  /** 40-60 word neutral intro defining the two institutions being compared */
  lead: string;
  /** What the peer institution does better or differently — kept factual, not disparaging */
  peerStrengths: string[];
  /** Where UET Taxila has an edge in this comparison */
  uetTaxilaStrengths: string[];
  rows: ComparisonRow[];
  faqs: ComparisonFaq[];
}

export const COMPARISONS: ComparisonEntry[] = [
  {
    slug: "uet-lahore",
    peerName: "University of Engineering and Technology, Lahore",
    peerShortName: "UET Lahore",
    peerLocation: "Lahore, Punjab",
    lead: "UET Taxila was originally a campus of UET Lahore before becoming an independent, chartered university in 1975. Both share the same ECAT entry test and Punjab-wide merit system, making this the closest apples-to-apples comparison for FSc Pre-Engineering students choosing between Punjab's two founding engineering universities.",
    peerStrengths: [
      "Older, larger alumni network as Pakistan's founding engineering university (est. 1921)",
      "Wider range of postgraduate and specialized research programs",
      "Located in Lahore with denser industry and internship access",
    ],
    uetTaxilaStrengths: [
      "Smaller batch sizes per department than UET Lahore's main campus",
      "Closer to Islamabad/Rawalpindi's tech and public-sector job market",
      "Comparable subsidized tuition with a dedicated 25+ route commuter bus network",
    ],
    rows: [
      {
        feature: "Entry Test",
        uetTaxila: "ECAT (33% aggregate weight)",
        peer: "ECAT (33% aggregate weight)",
      },
      {
        feature: "Merit Formula",
        uetTaxila: "17% Matric + 50% FSc + 33% ECAT",
        peer: "17% Matric + 50% FSc + 33% ECAT",
      },
      {
        feature: "Tuition / Semester (Subsidized)",
        uetTaxila: "PKR 55,000 - 68,000",
        peer: "PKR 58,000 - 72,000",
      },
      {
        feature: "Founded",
        uetTaxila: "1975 (independent charter)",
        peer: "1921 (as Mughalpura Technical College)",
      },
      {
        feature: "Accreditation",
        uetTaxila: "PEC Washington Accord Level-II",
        peer: "PEC Washington Accord Level-II",
      },
    ],
    faqs: [
      {
        q: "Is UET Taxila the same as UET Lahore?",
        a: "No. UET Taxila began as a sub-campus of UET Lahore but was granted an independent university charter in 1975. Today they are two separate universities with separate admissions, faculty, and campuses, though both still use the same ECAT entry test and Punjab merit formula.",
      },
      {
        q: "Which is easier to get into, UET Taxila or UET Lahore?",
        a: "Both draw from the same ECAT merit pool, so closing merits move together year to year. UET Lahore's main campus programs (especially Computer Science and Electrical Engineering) typically close at a slightly higher aggregate than the equivalent UET Taxila program because more high-scoring candidates list it as their first preference.",
      },
      {
        q: "Do UET Taxila and UET Lahore share the same fee structure?",
        a: "The two universities set fees independently, but because both are public-sector, PEC-accredited institutions on Punjab's subsidized tuition model, their per-semester tuition for BSc Engineering programs is close (roughly PKR 55,000-72,000 for 2026).",
      },
    ],
  },
  {
    slug: "nust",
    peerName: "National University of Sciences and Technology",
    peerShortName: "NUST",
    peerLocation: "Islamabad",
    lead: "NUST is a federally chartered university and Pakistan's top-ranked institution for engineering and technology in QS World University Rankings. It runs its own entry test (NET) independent of ECAT, and its tuition is roughly 3x UET Taxila's subsidized rate — the trade-off students weigh is NUST's ranking and campus resources against UET Taxila's affordability and Punjab-wide subsidized-seat access.",
    peerStrengths: [
      "Higher global ranking (QS Top 400, #1 in Pakistan for Engineering & Technology)",
      "Larger endowment, research funding, and industry-linked labs",
      "Federally chartered with campuses/schools across multiple disciplines under one university",
    ],
    uetTaxilaStrengths: [
      "Tuition roughly one-third of NUST's per-semester fee",
      "Uses the same ECAT test most Punjab pre-engineering students already prepare for, instead of a separate NET",
      "Subsidized-seat quota system keeps costs predictable across all 4 years",
    ],
    rows: [
      {
        feature: "Entry Test",
        uetTaxila: "ECAT (33% aggregate weight)",
        peer: "NET (75% aggregate weight)",
      },
      {
        feature: "Merit Formula",
        uetTaxila: "17% Matric + 50% FSc + 33% ECAT",
        peer: "10% Matric + 15% HSSC + 75% NET",
      },
      {
        feature: "Tuition / Semester",
        uetTaxila: "PKR 55,000 - 68,000",
        peer: "≈ PKR 197,050 (Engineering/Computing)",
      },
      {
        feature: "Admission Processing Fee",
        uetTaxila: "Included in application fee",
        peer: "PKR 35,000 + PKR 10,000 refundable deposit",
      },
      {
        feature: "Ranking (Pakistan, Engineering)",
        uetTaxila: "Top regional engineering university",
        peer: "#1 (QS World University Rankings)",
      },
    ],
    faqs: [
      {
        q: "Is NUST better than UET Taxila?",
        a: "NUST ranks higher globally (QS Top 400) and has larger research funding, which matters most for students prioritizing brand recognition or postgraduate research pathways. UET Taxila offers PEC-accredited engineering degrees with the same industry recognition for licensing purposes, at roughly a third of NUST's tuition — the better fit depends on budget and career goals, not a single 'better' answer.",
      },
      {
        q: "Can I use my ECAT score to apply to NUST?",
        a: "No. NUST requires its own NET (NUST Entry Test) and does not accept ECAT scores for undergraduate engineering admission. You would need to register for and sit NET separately from ECAT.",
      },
      {
        q: "How much more expensive is NUST than UET Taxila?",
        a: "For 2026, NUST's engineering/computing tuition is approximately PKR 197,050 per semester versus UET Taxila's PKR 55,000-68,000 for subsidized seats — roughly 3x higher across a 4-year degree.",
      },
    ],
  },
  {
    slug: "fast",
    peerName: "National University of Computer and Emerging Sciences (FAST-NUCES)",
    peerShortName: "FAST-NUCES",
    peerLocation: "Islamabad, Lahore, Karachi, Peshawar, Chiniot-Faisalabad (multi-campus)",
    lead: "FAST-NUCES is a private, computing-focused university and Pakistan's top-ranked institution for Computer Science by P@SHA. It only offers a narrow band of programs (mainly CS, Software Engineering, and Business) versus UET Taxila's 14 full engineering, computing, and basic-science departments, and its private-sector tuition runs several times higher.",
    peerStrengths: [
      "#1 P@SHA-ranked Computer Science program in Pakistan",
      "Strong software-industry placement pipeline and multi-city campus network",
      "Faster, single-sitting NU Entry Test admission cycle",
    ],
    uetTaxilaStrengths: [
      "Public-sector subsidized tuition, roughly a quarter of FAST's per-semester fee",
      "14 PEC/HEC-accredited departments spanning civil, mechanical, electrical, and computing — not computing-only",
      "On-campus hostels and a 25+ route commuter bus network for a residential engineering-campus experience",
    ],
    rows: [
      {
        feature: "Entry Test",
        uetTaxila: "ECAT (33% aggregate weight)",
        peer: "NU Entry Test / NTS-NAT",
      },
      {
        feature: "Merit Formula",
        uetTaxila: "17% Matric + 50% FSc + 33% ECAT",
        peer: "10% Matric + 40% FSc + 50% NU Test",
      },
      {
        feature: "Tuition / Semester",
        uetTaxila: "PKR 55,000 - 68,000",
        peer: "≈ PKR 195,000 - 240,000 (≈ PKR 12,000/credit hour)",
      },
      {
        feature: "Program Breadth",
        uetTaxila: "14 departments (Engineering, Computing, Sciences)",
        peer: "Primarily Computer Science, Software Engineering, Business",
      },
      {
        feature: "Sector",
        uetTaxila: "Public (Govt. of Punjab chartered)",
        peer: "Private (Section 3-A chartered)",
      },
    ],
    faqs: [
      {
        q: "Is FAST better than UET Taxila for Computer Science?",
        a: "FAST-NUCES is ranked #1 for Computer Science in Pakistan by P@SHA and has a strong software-industry placement track record. UET Taxila's Computer Science department is PEC/NCEAC accredited and costs roughly a quarter of FAST's tuition — students weighing brand-name CS recognition against affordability and a broader engineering-campus environment should compare both on those specific axes.",
      },
      {
        q: "Does UET Taxila accept the NU Entry Test?",
        a: "No. UET Taxila admissions run entirely on the ECAT and Punjab's centralized merit formula. FAST's NU Entry Test (or NTS-NAT) is a separate test accepted only for FAST-NUCES's own admissions.",
      },
      {
        q: "Is FAST cheaper than UET Taxila?",
        a: "No — FAST is a private university and its per-semester tuition (roughly PKR 195,000-240,000) is several times higher than UET Taxila's subsidized public-sector rate (PKR 55,000-68,000).",
      },
    ],
  },
  {
    slug: "pieas",
    peerName: "Pakistan Institute of Engineering and Applied Sciences",
    peerShortName: "PIEAS",
    peerLocation: "Nilore, Islamabad",
    lead: "PIEAS is a specialized public university under the Pakistan Atomic Energy Commission, known for small cohorts and a strong nuclear/applied-sciences research focus. It runs its own entry test rather than ECAT, and its subsidized tuition is close to UET Taxila's — the practical difference is program breadth and campus scale rather than cost.",
    peerStrengths: [
      "Very small class sizes and high faculty-to-student research exposure",
      "Strong applied-physics, nuclear engineering, and reactor-technology specializations",
    ],
    uetTaxilaStrengths: [
      "14 departments across mainstream civil, mechanical, electrical, and computing engineering versus PIEAS's narrower specialization",
      "Accepts ECAT, the test most Punjab pre-engineering students already prepare for, as well as its own TCAT",
      "Larger campus with 5 residential halls and a dedicated commuter bus network",
    ],
    rows: [
      {
        feature: "Entry Test",
        uetTaxila: "TCAT (UET Taxila) or ECAT (UET Lahore: 100 MCQs, no negative marking)",
        peer: "PIEAS Entry Test (≈100 MCQs, no negative marking)",
      },
      {
        feature: "Merit Formula",
        uetTaxila: "17% Matric + 50% FSc + 33% ECAT",
        peer: "60% Test + 25% HSSC + 15% SSC",
      },
      {
        feature: "Tuition / Semester",
        uetTaxila: "PKR 55,000 - 68,000",
        peer: "≈ PKR 52,000",
      },
      {
        feature: "Minimum Eligibility",
        uetTaxila: "60% FSc Pre-Engineering",
        peer: "60% Matric (Science) and 60% FSc Pre-Engineering",
      },
      {
        feature: "Program Breadth",
        uetTaxila: "14 departments (Engineering, Computing, Sciences)",
        peer: "Narrow: Nuclear/Applied Physics, Electronics, Chemical, Computer Engineering",
      },
    ],
    faqs: [
      {
        q: "Can I use my ECAT score to get into PIEAS?",
        a: "No. PIEAS conducts its own separate entry test (roughly 100 MCQs with no negative marking) and does not accept ECAT scores for undergraduate admission.",
      },
      {
        q: "Is PIEAS more affordable than UET Taxila?",
        a: "They're close. PIEAS's 2026 per-semester tuition is approximately PKR 52,000, slightly below UET Taxila's PKR 55,000-68,000 subsidized range — the bigger difference between the two is program breadth and campus size, not cost.",
      },
      {
        q: "Which has more engineering programs, UET Taxila or PIEAS?",
        a: "UET Taxila offers 14 departments spanning civil, mechanical, electrical, mechatronics, and computing engineering. PIEAS is intentionally narrower, concentrating on nuclear/applied physics, electronics, chemical, and computer engineering with much smaller cohorts.",
      },
    ],
  },
  {
    slug: "comsats",
    peerName: "COMSATS University Islamabad",
    peerShortName: "COMSATS",
    peerLocation: "Islamabad (plus Lahore, Abbottabad, Wah, Attock, Sahiwal, Vehari campuses)",
    lead: "COMSATS is a multi-campus public university admitting through the NTS-NAT test rather than ECAT. Its tuition runs higher than UET Taxila's subsidized rate, and its campus network spans computing, engineering, and business across several cities — useful for students who want a COMSATS campus in their home city rather than a single centralized engineering university.",
    peerStrengths: [
      "Multiple campuses across Pakistan, including regional cities without a dedicated engineering university",
      "Broad program mix spanning engineering, computing, business, and social sciences on one admission cycle",
      "HEC-recognized with an established distance/virtual-campus track record",
    ],
    uetTaxilaStrengths: [
      "Lower subsidized tuition than COMSATS's PKR 70,000-100,000 per-semester range",
      "Single-campus, engineering-focused environment with dedicated engineering labs across 14 departments",
      "Uses ECAT, avoiding a second, separate NTS-NAT registration and fee",
    ],
    rows: [
      {
        feature: "Entry Test",
        uetTaxila: "ECAT (33% aggregate weight)",
        peer: "NTS-NAT (category-specific, e.g. NAT-IE for engineering)",
      },
      {
        feature: "Tuition / Semester",
        uetTaxila: "PKR 55,000 - 68,000",
        peer: "≈ PKR 70,000 - 100,000 (varies by campus)",
      },
      {
        feature: "Minimum Eligibility",
        uetTaxila: "60% FSc Pre-Engineering",
        peer: "60% in Matric/FSc for Engineering & CS programs",
      },
      {
        feature: "Campus Model",
        uetTaxila: "Single main campus (Taxila)",
        peer: "Multi-campus (Islamabad, Lahore, Abbottabad, Wah, Attock, and more)",
      },
      {
        feature: "Sector",
        uetTaxila: "Public (Govt. of Punjab chartered)",
        peer: "Public (federally chartered)",
      },
    ],
    faqs: [
      {
        q: "Does UET Taxila accept the COMSATS NTS-NAT test?",
        a: "No. UET Taxila admissions are based solely on ECAT and Punjab's merit formula. COMSATS's NTS-NAT is a separate test used only for COMSATS's own campuses and is not interchangeable with ECAT.",
      },
      {
        q: "Is COMSATS cheaper than UET Taxila?",
        a: "No — COMSATS's 2026 per-semester tuition (roughly PKR 70,000-100,000, depending on campus) runs higher than UET Taxila's subsidized PKR 55,000-68,000 range.",
      },
      {
        q: "Which is better for engineering, COMSATS or UET Taxila?",
        a: "UET Taxila is a dedicated, single-campus engineering university with 14 PEC-accredited departments and residential halls built around engineering cohorts. COMSATS spans multiple cities and disciplines (engineering, computing, and business) on one admission cycle, which suits students who want a COMSATS campus specifically in their home city.",
      },
    ],
  },
];

export function getComparisonBySlug(slug: string): ComparisonEntry | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}

export function getAllComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug);
}
