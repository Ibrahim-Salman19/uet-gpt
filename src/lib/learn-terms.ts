/**
 * Single-source data file for /learn/[term] glossary pages.
 * All content is grounded in the UET Taxila Undergraduate Prospectus 2025
 * and web.uettaxila.edu.pk — do NOT add unverified figures.
 *
 * Adding a term: append a new entry to LEARN_TERMS. The slug is the URL path
 * segment used at /learn/[slug]. Keep it lowercase with hyphens.
 */

import { LEARN_TERMS_DATE_MODIFIED } from "@/lib/dates";

export interface TermFaq {
  q: string;
  a: string;
}

export interface LearnTerm {
  slug: string;
  title: string;
  /** Used in <title> tag */
  pageTitle: string;
  /** 150-160 chars for meta description */
  metaDescription: string;
  /** 40-60 word lead paragraph — defines the term */
  lead: string;
  /** Body sections: heading + paragraphs */
  sections: { heading: string; paragraphs: string[] }[];
  /** FAQ items (also drives FAQPage JSON-LD) */
  faqs: TermFaq[];
  /** Related hub page(s) this term links to */
  hubLinks: { label: string; href: string }[];
  datePublished: string;
  dateModified: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://uet-gpt.vercel.app";

export const LEARN_TERMS: LearnTerm[] = [
  {
    slug: "ecat",
    title: "ECAT (Engineering College Admission Test)",
    pageTitle: "What is ECAT? UET Entry Test Explained | UET GPT",
    metaDescription:
      "Understand the ECAT entry test for UET Taxila: format, 33% merit weightage, scoring, eligibility, and preparation guidance from official sources.",
    lead: "ECAT — Engineering College Admission Test — is the standardized entry test that applicants to undergraduate engineering and computing programs at UET Taxila must sit before their admission merit can be calculated. Conducted annually by UET Lahore for Punjab-domicile students, ECAT is mandatory for engineering programs and BS Computer Science.",
    sections: [
      {
        heading: "What ECAT tests",
        paragraphs: [
          "ECAT assesses aptitude and subject knowledge in Mathematics, Physics, Chemistry, and English. Students from an FSc Pre-Engineering background are tested in all four subjects. The paper is multiple-choice, timed, and held at designated centres across Punjab.",
          "For BS Computer Science, BS Mathematics, and BS Physics applicants, ECAT is still required but the eligibility threshold on board marks is 50% (versus 60% for engineering programs), and the accepted subject combinations are broader — any HSSC combination that includes Mathematics or Physics, plus FSc Pre-Medical with Mathematics as an additional subject.",
        ],
      },
      {
        heading: "How ECAT contributes to UET Taxila merit",
        paragraphs: [
          "In the UET Taxila merit formula, ECAT carries 33% of the weighted admission marks. The remaining 67% comes from previous academic results: HSSC Part-I (or the equivalent higher qualification) at 50% and SSC at 17%. This means a strong ECAT score can significantly lift an applicant whose earlier academic percentages were modest — and vice versa.",
          "Example from the official prospectus: an applicant with 300/400 in ECAT, 700/1100 in SSC, 500/550 in HSSC Part-I, and a Hifz-e-Quran certificate scores [33 × (300/400) + 17 × (700/1100) + 50 × (500 + 20)/550] = 82.841% admission marks.",
        ],
      },
      {
        heading: "Who organizes ECAT and when",
        paragraphs: [
          "For Punjab-domicile students, the combined engineering entry test is conducted by UET Lahore. UET Taxila also accepts any other entry test for engineering programs that is designated as acceptable to PEC (Pakistan Engineering Council) and the university. Applicants are responsible for registering for ECAT through UET Lahore's admissions portal and sitting the test before the UET Taxila admissions deadline.",
          "Students from other provinces or with foreign qualifications may use equivalent tests acceptable to PEC. A-Level applicants must also attach an IBCC equivalence certificate showing at least 60% (or 50% for CS/Mathematics/Physics) in the relevant subjects.",
        ],
      },
      {
        heading: "Common mistakes around ECAT for UET Taxila",
        paragraphs: [
          "1. Sitting ECAT after the UET Taxila application deadline — without a valid entry-test score your merit cannot be computed and your application will not be considered.",
          "2. Assuming a high ECAT score alone guarantees admission — ECAT is 33% of merit; board marks still matter. Conversely, a weak ECAT score cannot be offset by strong board marks alone.",
          "3. Rounding up board marks to meet the 60% eligibility threshold — the prospectus explicitly states that rounding off to reach 60% (or 50%) is not accepted.",
        ],
      },
    ],
    faqs: [
      {
        q: "Is ECAT mandatory for all UET Taxila admissions?",
        a: "Yes, for undergraduate engineering programs and BS Computer Science, a valid ECAT (or an equivalent entry test acceptable to PEC and UET Taxila) score is mandatory. Without it, an applicant's merit cannot be calculated and the application is not considered.",
      },
      {
        q: "How much does ECAT count in the UET Taxila merit formula?",
        a: "ECAT carries 33% of the weighted admission marks. HSSC Part-I (or equivalent) contributes 50% and SSC contributes 17%.",
      },
      {
        q: "What score is needed in ECAT for UET Taxila?",
        a: "There is no published minimum ECAT score for eligibility; what matters is your aggregate admission percentage (ECAT 33% + HSSC 50% + SSC 17%) relative to the closing merit in your chosen discipline and category. Higher is better.",
      },
      {
        q: "Who conducts ECAT for UET Taxila?",
        a: "For Punjab-domicile students the combined ECAT is conducted by UET Lahore. UET Taxila also accepts entry tests for engineering programs approved by PEC.",
      },
    ],
    hubLinks: [
      { label: "UET Taxila Admissions Guide", href: `${siteUrl}/uet-taxila/admissions` },
      { label: "UET Taxila Hub", href: `${siteUrl}/uet-taxila` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "merit-formula",
    title: "UET Taxila Merit Formula (Aggregate Marks)",
    pageTitle: "UET Taxila Merit Formula: Calculation Guide | UET GPT",
    metaDescription:
      "Calculate your UET Taxila admission aggregate: ECAT (33%), HSSC (50%), SSC (17%), plus Hifz-e-Quran/NCC bonus marks with official worked examples.",
    lead: "The UET Taxila merit formula — officially called the admission marks formula — calculates a weighted percentage from three components: the ECAT entry test (33%), the HSSC or equivalent higher qualification (50%), and the SSC or equivalent (17%). This aggregate determines where an applicant stands on the merit list for their chosen discipline and category.",
    sections: [
      {
        heading: "The three components and their weights",
        paragraphs: [
          "For HSSC Pre-Engineering applicants (the most common case): Entry Test (ECAT) = 33%, HSSC Part-I = 50%, SSC = 17%. The percentages are applied to the marks obtained relative to total marks: (ECAT% × 33) + (HSSC% × 50) + (SSC% × 17).",
          "For DAE (Diploma of Associate Engineer) holders: Entry Test (ECAT) = 33%, DAE 1st and 2nd year combined = 50%, SSC = 17%. The same formula structure applies with DAE results replacing HSSC.",
          "A credit of 20 marks is added in the highest-qualification component (HSSC or DAE) for NCC (National Cadet Corps) training and for Hifz-e-Quran (memorization of the Holy Quran). These credits count toward merit, not toward eligibility.",
        ],
      },
      {
        heading: "Worked example from the UET Taxila prospectus",
        paragraphs: [
          "Applicant data: ECAT 300/400, SSC 700/1100, HSSC Part-I 500/550, Hifz-e-Quran (20-mark credit in HSSC component).",
          "Calculation: [33 × (300/400)] + [17 × (700/1100)] + [50 × (500 + 20)/550] = 24.75 + 10.818 + 47.273 = 82.841% admission marks.",
          "This worked example is taken directly from Table 18 of the UET Taxila Undergraduate Prospectus 2025. Always use your actual marks; do not round up any component to reach an eligibility threshold.",
        ],
      },
      {
        heading: "Other qualification tracks",
        paragraphs: [
          "BSc/BASc and B.Tech holders who apply for higher studies use a different split: ECAT 33%, Degree result 30%, HSSC or DAE 20%, SSC 17%.",
          "Foreign (A-Level etc.) applicants use O-Level 67% in the SSC/HSSC portion. They must also provide an IBCC equivalence certificate.",
          "The formula is applied consistently across all categories (Open Merit, reserved district, overseas, etc.) — only the pool of applicants you compete against differs by category, not the formula itself.",
        ],
      },
      {
        heading: "How merit lists are determined",
        paragraphs: [
          "After computing admission marks for every applicant, the university prepares category-wise merit lists on the notified date and time. The lists show the percentage of applicants admitted per discipline and category. If two or more applicants have identical admission marks to three decimal places, they are treated at par and may all be admitted to the last seat.",
          "Unfilled seats in reserved categories are transferred to open-merit seats over the admission cycle. Applicants may be moved to a higher-preference discipline if a seat opens, or may freeze their allocation in writing.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the UET Taxila merit formula?",
        a: "Admission marks = (ECAT% × 33) + (HSSC Part-I% × 50) + (SSC% × 17). For DAE holders, DAE replaces HSSC. A 20-mark credit is added in the highest-qualification component for NCC or Hifz-e-Quran.",
      },
      {
        q: "How do I calculate my UET Taxila aggregate marks?",
        a: "Divide each result by its total marks, multiply by the weight (ECAT × 33, HSSC × 50, SSC × 17), then add the three values. Example: ECAT 300/400, HSSC 500/550, SSC 700/1100 gives [33×0.75 + 50×0.909 + 17×0.636] = 82.841%.",
      },
      {
        q: "Does a high ECAT score guarantee admission to UET Taxila?",
        a: "No. ECAT is 33% of merit. Your board marks (50% HSSC + 17% SSC) collectively carry more weight. Your aggregate must exceed the closing merit in your chosen discipline and category.",
      },
      {
        q: "What is the NCC or Hifz-e-Quran merit credit?",
        a: "A credit of 20 marks is added to the highest-qualification component (HSSC or DAE) of the merit formula for NCC training or for Hifz-e-Quran. This credit counts toward merit only, not toward eligibility.",
      },
    ],
    hubLinks: [
      { label: "UET Taxila Admissions Guide", href: `${siteUrl}/uet-taxila/admissions` },
      { label: "UET Taxila Hub", href: `${siteUrl}/uet-taxila` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "eligibility-criteria",
    title: "UET Taxila Eligibility Criteria",
    pageTitle: "UET Taxila Eligibility Criteria Explained | UET GPT",
    metaDescription:
      "UET Taxila eligibility criteria: 60% marks for engineering, 50% for CS/Math/Physics. Learn HSSC, ECAT, residency, and medical requirements from the official prospectus.",
    lead: "To be eligible for undergraduate admission at UET Taxila, an applicant must meet three requirements: a valid ECAT entry-test score, a minimum of 60% unadjusted marks in HSSC or equivalent (50% for BS Computer Science, BS Mathematics, and BS Physics), and domicile in the area from which they seek admission. Medical standards (physique and eyesight) must also be met.",
    sections: [
      {
        heading: "Minimum board marks requirement",
        paragraphs: [
          "An applicant must have passed — or expect to pass — their HSSC (or equivalent) up to the latest annual examination with at least 60% unadjusted marks. This applies to all engineering programs. For BS Computer Science, BS Mathematics, and BS Physics the minimum is 50% unadjusted marks.",
          "The prospectus is explicit: rounding off a percentage figure to reach 60% (or 50% for CS/Mathematics/Physics) is NOT accepted towards eligibility. If your marks calculate to 59.9%, you do not meet the 60% threshold.",
          "A-Level and other foreign-qualification applicants must attach an IBCC (Inter Board Committee of Chairmen) equivalence certificate demonstrating the required percentage in the relevant subjects (Pre-Engineering combination for engineering programs).",
        ],
      },
      {
        heading: "ECAT entry-test requirement",
        paragraphs: [
          "Every applicant to engineering programs and BS Computer Science must have appeared in the ECAT or an equivalent engineering entry test acceptable to PEC and UET Taxila. Without a valid entry-test score, merit cannot be computed.",
          "There is no published minimum ECAT score for eligibility — the test result feeds into the merit formula (33% weight) rather than acting as a binary pass/fail gate on its own.",
        ],
      },
      {
        heading: "Residency and domicile",
        paragraphs: [
          "An applicant should be a resident of the area from which they seek admission. A domicile certificate (attested photocopy) is mandatory with the application; without it the application is not considered.",
          "The university allocates seats across categories including Open Merit (all-Punjab), reserved district quotas, children of government servants posted outside Punjab, overseas Pakistanis (Category X), tribal areas, and others. Each category has its own domicile and proof requirements.",
        ],
      },
      {
        heading: "Medical and physique standards",
        paragraphs: [
          "All applicants must meet the physique and eyesight standards set out in the university's medical certificate requirements. These standards exist because engineering programs involve laboratory and fieldwork that require adequate physical ability and vision.",
          "NCC training and Hifz-e-Quran credit (20 marks added to the highest-qualification component) count toward merit calculation but do not substitute for or modify the eligibility threshold.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the minimum percentage required for UET Taxila admission?",
        a: "For engineering programs: at least 60% unadjusted marks in HSSC or equivalent. For BS Computer Science, BS Mathematics, and BS Physics: at least 50% unadjusted marks. Rounding up to reach these thresholds is not accepted.",
      },
      {
        q: "Can I apply to UET Taxila with FSc Pre-Medical?",
        a: "Yes, for BS Computer Science and BS Mathematics/Physics, FSc Pre-Medical with Mathematics as an additional subject is an eligible combination. Engineering programs require FSc Pre-Engineering (Mathematics, Physics, Chemistry/Computer Science) or an equivalent DAE.",
      },
      {
        q: "Is a domicile certificate mandatory for UET Taxila admission?",
        a: "Yes. All applicants must submit an attested photocopy of their domicile certificate. Without it the application is not considered, regardless of merit.",
      },
      {
        q: "Do NCC or Hifz-e-Quran marks count toward eligibility?",
        a: "No. The 20-mark NCC and Hifz-e-Quran credit is added to the highest-qualification component of the merit formula only. It does not count toward the 60% (or 50%) eligibility threshold.",
      },
    ],
    hubLinks: [
      { label: "UET Taxila Admissions Guide", href: `${siteUrl}/uet-taxila/admissions` },
      { label: "UET Taxila Programs", href: `${siteUrl}/uet-taxila/programs` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "hostel-allotment",
    title: "UET Taxila Hostel Allotment",
    pageTitle: "UET Taxila Hostel Allotment: Rules & Charges | UET GPT",
    metaDescription:
      "UET Taxila hostel allotment: how hostel rooms are allocated, hostel charges, security deposits, and refund rules from the official UET Taxila prospectus.",
    lead: "UET Taxila provides on-campus hostel accommodation for students. Hostel allotment is managed by the university on the basis of merit and availability. Students pay hostel charges in addition to their regular tuition and other fees; refundable security deposits are collected at admission and returned when a student leaves.",
    sections: [
      {
        heading: "Hostel charges at UET Taxila",
        paragraphs: [
          "Hostel residents pay additional charges on top of tuition. For the first semester, non-refundable hostel charges total Rs. 24,000, broken down as: services and contingencies Rs. 3,000, room rent Rs. 5,000, masjid fund Rs. 500, electricity Rs. 10,000, and Sui gas Rs. 1,500.",
          "Two refundable security deposits are also collected at admission: hostel security (Rs. 8,000) and mess security (Rs. 8,000). These are returned on clearance when a student leaves the university or hostel, subject to deduction of any outstanding dues.",
          "Electricity and gas charges can change from semester to semester based on government-fixed utility rates. UET GPT provides current figures grounded in official documents rather than outdated static numbers.",
        ],
      },
      {
        heading: "How hostel rooms are allotted",
        paragraphs: [
          "Hostel allotment at UET Taxila is handled by the university administration on the basis of merit and room availability. Preference is generally given to students from districts farther from Taxila who have no feasible commute option.",
          "Students who wish to live in the hostel should express their interest through the official admissions process. Hostel capacity is limited relative to total enrollment, so not all applicants who request accommodation may be allotted a room in their first semester.",
        ],
      },
      {
        heading: "Refund of hostel security",
        paragraphs: [
          "The hostel security (Rs. 8,000) and mess security (Rs. 8,000) are refundable when a student completes their degree or formally leaves the university, provided they have cleared all outstanding dues. Non-refundable hostel charges (room rent, utilities, etc.) are not returned.",
          "UET Taxila follows the National Level Fee-Refund Policy for HEIs of Pakistan for the refund of admission and tuition fees (100% up to day 7, 50% days 8-15, 0% from day 16 onward). This timeline applies to fee components, not to the hostel security deposits, which are refunded on clearance.",
        ],
      },
    ],
    faqs: [
      {
        q: "How much are UET Taxila hostel charges per semester?",
        a: "Non-refundable hostel charges total Rs. 24,000 for the first semester: services & contingencies Rs. 3,000, room rent Rs. 5,000, masjid fund Rs. 500, electricity Rs. 10,000, Sui gas Rs. 1,500. Refundable deposits: hostel security Rs. 8,000 and mess security Rs. 8,000.",
      },
      {
        q: "Is hostel accommodation guaranteed for all UET Taxila students?",
        a: "No. Hostel capacity is limited. Allotment is based on merit and availability; students from distant districts are generally prioritized. Not all students who request a hostel room may receive one in their first semester.",
      },
      {
        q: "Are hostel security deposits refundable?",
        a: "Yes. The hostel security (Rs. 8,000) and mess security (Rs. 8,000) are refundable on clearance when a student leaves the university or hostel, minus any outstanding dues.",
      },
      {
        q: "Do hostel charges change every semester?",
        a: "Electricity and gas charges are revised based on government-fixed utility rates and may change each semester. Other charges such as room rent are fixed. The university notifies the fee schedule about one month before each semester.",
      },
    ],
    hubLinks: [
      { label: "UET Taxila Fee Structure", href: `${siteUrl}/uet-taxila/fee-structure` },
      { label: "UET Taxila Hub", href: `${siteUrl}/uet-taxila` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "scholarships",
    title: "UET Taxila Scholarships",
    pageTitle: "UET Taxila Scholarships: Types & Application | UET GPT",
    metaDescription:
      "UET Taxila scholarships include need-based, merit-based, HEC, and government schemes. Learn what scholarships are available for UET Taxila students and how UET GPT helps.",
    lead: "UET Taxila students have access to multiple scholarship and financial-assistance schemes. These include need-based and merit-based awards administered by the university, scholarships from the Higher Education Commission (HEC), provincial government schemes, and external awards. Students with financial need may also request a fee-payment extension or installment plan.",
    sections: [
      {
        heading: "Need-based financial assistance",
        paragraphs: [
          "Students with genuine financial need may request a two-installment payment plan for their semester fees, or a payment extension, by applying to their department chairman. The university's Treasurer publishes the fee schedule about one month before each semester, giving students time to arrange payment.",
          "Beyond payment flexibility, UET Taxila and the broader Pakistani higher-education system offer need-based scholarships to cover tuition and other charges for students who cannot otherwise afford to continue. Eligibility criteria and application deadlines vary by scheme.",
        ],
      },
      {
        heading: "HEC and government scholarships",
        paragraphs: [
          "The Higher Education Commission (HEC) of Pakistan runs several scholarship programs available to UET Taxila students, including the HEC Need-Based Scholarship, the Prime Minister's Laptop Scheme (merit-based), and various indigenous fellowships for graduate students.",
          "The Punjab government also administers merit and need-based scholarships for students enrolled at public universities, including UET Taxila. Eligibility is typically based on family income, academic performance, and domicile.",
        ],
      },
      {
        heading: "Merit-based and other university awards",
        paragraphs: [
          "Top-performing students may be eligible for merit-based awards from the university itself. These are typically awarded based on semester GPA or aggregate results. The university periodically announces awards for students who achieve the highest grades in their department or faculty.",
          "External scholarships from private foundations, industry partners, and NGOs are also available to UET Taxila students. Students are advised to check the university's scholarship notice board and official portal regularly for announcements.",
        ],
      },
      {
        heading: "How to apply for scholarships at UET Taxila",
        paragraphs: [
          "Most scholarship applications are submitted through the university's student affairs or financial services office. For HEC scholarships, students register on the HEC scholarship portal (hec.gov.pk) and submit supporting documents including income certificate, academic transcripts, and domicile.",
          "Ask UET GPT for guidance on which scholarship schemes are open, the current application deadlines, and what documents are typically required. UET GPT answers from official sources and can help you identify the most relevant scheme for your situation.",
        ],
      },
    ],
    faqs: [
      {
        q: "What scholarships are available for UET Taxila students?",
        a: "UET Taxila students can access HEC need-based and merit scholarships, Punjab government schemes, university merit awards, and external private scholarships. The university also allows need-based fee payment in two installments.",
      },
      {
        q: "How do I apply for a scholarship at UET Taxila?",
        a: "Apply through the university's student affairs or financial services office for internal scholarships. For HEC scholarships, register on hec.gov.pk. Application windows and required documents vary by scheme — ask UET GPT for current deadlines.",
      },
      {
        q: "Can I get a fee waiver at UET Taxila?",
        a: "There is no general fee waiver. Students with financial hardship may apply for a payment extension or a two-installment plan. For partial-subsidized categories (S and X), the prospectus explicitly states no relaxation, concession, or waiver is provided.",
      },
      {
        q: "Is the HEC Need-Based Scholarship available at UET Taxila?",
        a: "Yes. UET Taxila is a recognized HEC university, so eligible students can apply for HEC need-based and other HEC scholarship programs through the hec.gov.pk portal.",
      },
    ],
    hubLinks: [
      { label: "UET Taxila Fee Structure", href: `${siteUrl}/uet-taxila/fee-structure` },
      { label: "UET Taxila Hub", href: `${siteUrl}/uet-taxila` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "fee-structure",
    title: "UET Taxila Fee Structure",
    pageTitle: "What is UET Taxila Fee Structure? - Glossary | UET GPT",
    metaDescription:
      "UET Taxila fee structure: subsidized tuition Rs. 38,000/semester, partial-subsidized Rs. 130,000, hostel charges, and refund policy. Grounded in the 2025 prospectus.",
    lead: "The UET Taxila fee structure for undergraduate students consists of non-recurring charges (paid once at admission) and recurring per-semester charges. Most students pay subsidized tuition of Rs. 38,000 per semester; students in the partial-subsidized Category S or Category X pay Rs. 130,000 per semester. Hostel, mess, and utility charges are additional for residents.",
    sections: [
      {
        heading: "Subsidized vs. partial-subsidized categories",
        paragraphs: [
          "The key distinction in UET Taxila's fee structure is between subsidized seats (the majority) and partial-subsidized seats (Category S — All Pakistan, and Category X — children of overseas Pakistanis). Subsidized students pay Rs. 38,000 tuition per semester and Rs. 7,000 in admission charges. Category S and X students pay Rs. 130,000 tuition per semester and Rs. 300,000 in admission charges.",
          "The prospectus explicitly states there is no relaxation, concession, or waiver in fee for Category S and X students. The higher rate reflects the reduced subsidy from the university.",
        ],
      },
      {
        heading: "Non-recurring charges (paid once at admission)",
        paragraphs: [
          "These include: admission charges (Rs. 7,000 subsidized / Rs. 300,000 partial-subsidized), re-admission charges, student identity card fee, document verification fee, and a refundable library security deposit.",
          "Hostel residents also pay two refundable security deposits at admission: hostel security (Rs. 8,000) and mess security (Rs. 8,000).",
        ],
      },
      {
        heading: "Recurring per-semester charges",
        paragraphs: [
          "Every semester, students pay: registration, tuition (Rs. 38,000 or Rs. 130,000), sports, magazine, medical, laboratory, examination, book bank rent, instructional tour, recreation, Smart and Safe Campus, and digital library fees. Bus fare is charged where applicable, and survey camp charges apply in relevant disciplines.",
          "Hostel residents pay additional non-refundable hostel charges each semester (services, room rent, masjid fund, electricity, gas). Electricity and gas rates are revised by the government and may change each semester.",
        ],
      },
      {
        heading: "Fee payment schedule and late fees",
        paragraphs: [
          "The Treasurer notifies the fee schedule approximately one month before each semester. Registration and fee submission must be completed at least ten days before the semester begins. Late deposit attracts a fine of Rs. 100 per day for up to one month after the commencement of classes; beyond that, admission or registration may be suspended or cancelled.",
          "Need-based students may apply to their department chairman for a payment extension or to pay in two installments.",
        ],
      },
      {
        heading: "Fee refund policy",
        paragraphs: [
          "UET Taxila follows the National Level Fee-Refund Policy for HEIs of Pakistan: 100% refund up to the 7th day of commencement of classes, 50% from the 8th to the 15th day, and 0% from the 16th day onward. The timeline covers both weekdays and weekends. The refund percentage applies to fee components only — not to security deposits (which are refunded separately on clearance) or admission charges.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the tuition fee at UET Taxila?",
        a: "Subsidized category: Rs. 38,000 per semester. Partial-subsidized categories (S and X): Rs. 130,000 per semester. Additional charges (lab, sports, medical, etc.) apply in both categories.",
      },
      {
        q: "What are the total first-semester fees at UET Taxila?",
        a: "Subsidized students pay Rs. 7,000 admission charges plus Rs. 38,000 tuition plus additional per-semester charges. Hostel residents add non-refundable hostel charges (Rs. 24,000) plus refundable hostel and mess securities (Rs. 16,000 total). See Table 30.1 of the prospectus for the complete schedule.",
      },
      {
        q: "Can I get a refund if I withdraw from UET Taxila?",
        a: "Yes, subject to the National Level Fee-Refund Policy: 100% within the first 7 days of commencement, 50% on days 8-15, and 0% from day 16 onward. Refundable securities (library, hostel, mess) are returned separately on clearance.",
      },
      {
        q: "What is the difference between Category S and subsidized fees?",
        a: "Category S (All Pakistan partial-subsidized) students pay Rs. 300,000 admission charges and Rs. 130,000 per-semester tuition — significantly higher than subsidized students who pay Rs. 7,000 and Rs. 38,000 respectively. There is no concession or waiver for Category S.",
      },
    ],
    hubLinks: [
      {
        label: "UET Taxila Fee Structure (Full Page)",
        href: `${siteUrl}/uet-taxila/fee-structure`,
      },
      { label: "UET Taxila Hub", href: `${siteUrl}/uet-taxila` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "obe-framework",
    title: "OBE Framework & Washington Accord",
    pageTitle: "What is OBE Framework at UET Taxila? | UET GPT",
    metaDescription:
      "Explore the Outcome-Based Education (OBE) Level-II accreditation and Washington Accord recognition for UET Taxila engineering graduates.",
    lead: "The Outcome-Based Education (OBE) framework is an international accreditation standard adopted by Pakistan Engineering Council (PEC) under the Washington Accord. UET Taxila delivers its undergraduate engineering curriculum under OBE Level-II, guaranteeing global equivalence and mobility for its graduates.",
    sections: [
      {
        heading: "What OBE Level-II Means for Graduates",
        paragraphs: [
          "Under the OBE model, student performance is assessed against predefined Program Learning Outcomes (PLOs) including Engineering Knowledge, Problem Analysis, Design of Solutions, Ethics, and Lifelong Learning. Rather than measuring rote recall, OBE evaluates complex engineering problem solving.",
          "Graduating from a PEC Level-II accredited program means the degree is directly recognized in all 20+ Washington Accord signatory countries (including the USA, UK, Canada, Australia, Japan, and Singapore) without requiring foreign qualification equivalence exams.",
        ],
      },
      {
        heading: "Continuous Quality Improvement (CQI)",
        paragraphs: [
          "Each academic department at UET Taxila operates a Continuous Quality Improvement (CQI) cycle with Course Learning Outcomes (CLOs) mapped to departmental PLOs. Assessments, laboratory experiments, and Final Year Projects (FYDP) are rigorously audited.",
        ],
      },
    ],
    faqs: [
      {
        q: "Are UET Taxila engineering degrees recognized internationally?",
        a: "Yes. UET Taxila is fully accredited under PEC OBE Level-II, making its engineering degrees recognized across all Washington Accord signatory nations for professional engineer (PE) licensing.",
      },
      {
        q: "What is the difference between PEC Level-I and Level-II?",
        a: "Level-I indicates traditional non-OBE accreditation valid only within Pakistan. Level-II signifies full OBE compliance with international substantial equivalence under the Washington Accord.",
      },
    ],
    hubLinks: [
      { label: "UET Taxila Programs", href: `${siteUrl}/uet-taxila/programs` },
      { label: "University Comparison", href: `${siteUrl}/compare` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
  {
    slug: "cgpa-system",
    title: "Semester Grading & CGPA System",
    pageTitle: "UET Taxila CGPA & Grading Scale Explained | UET GPT",
    metaDescription:
      "Official UET Taxila 4.00 grading scale, SGPA and CGPA computation formulas, academic probation rules, and Dean's Honors List criteria.",
    lead: "The UET Taxila semester grading system calculates student academic performance on a 4.00 Grade Point Average (GPA) scale. Quality points are computed by multiplying course grade points with credit hours, determining semester SGPA and cumulative CGPA.",
    sections: [
      {
        heading: "Grading Scale & Letter Grades",
        paragraphs: [
          "Letter grades range from A (4.00, 85%+) down to D (1.00, 50-53%) and F (0.00, <50%). Intermediate grades include A- (3.70), B+ (3.30), B (3.00), B- (2.70), C+ (2.30), C (2.00), and C- (1.70).",
          "A minimum passing grade of D (1.00) is required for individual subjects, but a cumulative CGPA of at least 2.00 is required to remain in good academic standing and earn the Bachelor of Science degree.",
        ],
      },
      {
        heading: "Academic Probation and Dismissal",
        paragraphs: [
          "If a student's SGPA falls below 2.00, they are placed on Academic Probation. If the CGPA remains below 2.00 for two consecutive semesters, the university initiates academic dismissal procedures according to semester regulations.",
        ],
      },
    ],
    faqs: [
      {
        q: "What is the minimum CGPA to graduate from UET Taxila?",
        a: "A cumulative CGPA of at least 2.00 out of 4.00 across all 8 semesters (130-136 credit hours) is mandatory to receive the BSc Engineering / BS Computing degree.",
      },
      {
        q: "What is the criteria for the Dean's Honors List?",
        a: "An undergraduate student who scores an SGPA of 3.70 or above in a regular semester with a minimum of 12 credit hours is placed on the Dean's Honors List.",
      },
    ],
    hubLinks: [
      { label: "GPA & CGPA Calculator", href: `${siteUrl}/gpa-calculator` },
      { label: "Admissions Guide", href: `${siteUrl}/uet-taxila/admissions` },
      { label: "Ask UET GPT", href: siteUrl },
    ],
    datePublished: "2026-07-16",
    dateModified: LEARN_TERMS_DATE_MODIFIED,
  },
];

/** Returns a single term by slug, or undefined if not found. */
export function getTermBySlug(slug: string): LearnTerm | undefined {
  return LEARN_TERMS.find((t) => t.slug === slug);
}

/** Returns all slugs — used to generate static params. */
export function getAllSlugs(): string[] {
  return LEARN_TERMS.map((t) => t.slug);
}
