// Fixture questions over real crawled pages in local_corpus_pilot/documents.jsonl.
// Rubrics were written from the page text itself (crawled 2026-08-20).

export type EvalCase = {
  id: string;
  kind: "answerable" | "not_in_sources" | "stale_value" | "no_context" | "refuse_directive";
  question: string;
  intent: string;
  pages: string[];
  directive?: "refuse";
  rubric: string;
};

const SEATS = "https://admissions.uettaxila.edu.pk/Seats_Allocation.php";
const SCHEDULE = "https://admissions.uettaxila.edu.pk/Schedule.php";
const PROSPECTUS = "https://admissions.uettaxila.edu.pk/ProspectusAvailability.php";
const CIVIL = "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=1";

export const CASES: EvalCase[] = [
  // ---- Answerable from the pages ----
  {
    id: "seats-se-punjab",
    kind: "answerable",
    question: "How many Punjab open merit seats are there for Software Engineering?",
    intent: "admissions",
    pages: [SEATS, SCHEDULE],
    rubric: "Must state 66 seats (category A, Punjab open merit, Software). Any other number is incorrect.",
  },
  {
    id: "seats-cs-total",
    kind: "answerable",
    question: "What is the total number of seats in BS Computer Science?",
    intent: "admissions",
    pages: [SEATS],
    rubric: "Must state 150 total seats for Computer Science.",
  },
  {
    id: "cs-premedical",
    kind: "answerable",
    question: "Are any Computer Science seats reserved for pre-medical students?",
    intent: "admissions",
    pages: [SEATS, PROSPECTUS],
    rubric:
      "Must say one third of seats in every category of Computer Science are reserved for Pre-Medical candidates (unfilled seats transfer to the other group).",
  },
  {
    id: "fee-subsidy-categories",
    kind: "answerable",
    question: "Which admission categories do not get the subsidized fee?",
    intent: "admissions",
    pages: [SEATS],
    rubric:
      "Must identify categories S (All Pakistan, Partial-Subsidized) and X (Overseas Pakistanis, Partial-Subsidized) as not subsidized. Must not quote a fee amount (none is given).",
  },
  {
    id: "classes-start",
    kind: "answerable",
    question: "When do regular classes of the first semester start for Fall 2026?",
    intent: "admissions",
    pages: [SCHEDULE, SEATS],
    rubric: "Must state 31st August 2026 (Monday).",
  },
  {
    id: "hifz-test",
    kind: "answerable",
    question: "When and where is the Hifz-e-Quran test?",
    intent: "admissions",
    pages: [SCHEDULE],
    rubric: "Must state 24th May 2026 (Sunday) at 10:00 AM, at Jamia Masjid Bilal, UET Taxila.",
  },
  {
    id: "merit-list-1",
    kind: "answerable",
    question: "When will the first merit list be displayed?",
    intent: "admissions",
    pages: [SCHEDULE],
    rubric: "Must state 4th June 2026 (Thursday) for the 1st merit list (Cycle I).",
  },
  {
    id: "prospectus-charge",
    kind: "answerable",
    question: "How much does the prospectus cost at UET centers?",
    intent: "admissions",
    pages: [PROSPECTUS],
    rubric: "Must state Rs. 1500 per copy (prospectus charges plus processing fee).",
  },
  {
    id: "admissions-contact",
    kind: "answerable",
    question: "How can I contact the undergraduate admissions office?",
    intent: "administrative",
    pages: [SCHEDULE],
    rubric: "Must give email ug.admission@uettaxila.edu.pk and/or phone +92-51-9047400-412, with no invented contact details.",
  },
  {
    id: "roman-urdu-classes",
    kind: "answerable",
    question: "Fall 2026 mein classes kab shuru hongi?",
    intent: "admissions",
    pages: [SCHEDULE],
    rubric: "Must state 31 August 2026. Should reply in Roman Urdu or Urdu (an English reply is still correct if the date is right).",
  },

  // ---- The pages do not contain the answer: must say so, not guess ----
  {
    id: "last-date-missing",
    kind: "not_in_sources",
    question: "What is the last date for online submission of admission forms?",
    intent: "admissions",
    pages: [SCHEDULE],
    rubric:
      "The schedule lists this event with '--' (no date). Correct only if the answer says the date is not given/announced and does not state any specific last date.",
  },
  {
    id: "hostel-fee",
    kind: "not_in_sources",
    question: "What is the hostel fee per semester at UET Taxila?",
    intent: "campus_life",
    pages: [SEATS, PROSPECTUS],
    rubric: "No hostel fee appears in the pages. Correct only if the answer says it could not find it and states no hostel fee amount.",
  },
  {
    id: "tuition-se",
    kind: "not_in_sources",
    question: "What is the semester tuition fee for BS Software Engineering?",
    intent: "admissions",
    pages: [SEATS, PROSPECTUS],
    rubric:
      "No tuition amount appears in the pages (Rs. 1500 is the prospectus/processing charge, not tuition). Correct only if the answer states no tuition amount and says it is not available in the information.",
  },
  {
    id: "closing-merit",
    kind: "not_in_sources",
    question: "What was the closing merit for Electrical Engineering last year?",
    intent: "admissions",
    pages: [SCHEDULE, SEATS],
    rubric: "No closing merit appears in the pages. Correct only if the answer states no merit percentage/aggregate.",
  },
  {
    id: "civil-dept-fee",
    kind: "not_in_sources",
    question: "What is the admission fee for the Civil Engineering department?",
    intent: "admissions",
    pages: [CIVIL],
    rubric: "The page is a department faculty page with no fee. Correct only if the answer states no fee amount.",
  },

  // ---- Stale value in a current-looking table ----
  {
    id: "entry-test-2025-row",
    kind: "stale_value",
    question: "When is the UET Taxila entry test for Computer Science for Fall 2026 admissions?",
    intent: "admissions",
    pages: [SCHEDULE],
    rubric:
      "The Fall 2026 schedule's only entry-test row says '3rd Test - 15th July, 2025', a 2025 date. Correct only if the answer does NOT present 15 July 2025 (or any date) as the Fall 2026 test date without flagging that the listed date is from 2025 / not confirmed for 2026.",
  },

  // ---- No retrieved context ----
  {
    id: "no-context-vc",
    kind: "no_context",
    question: "Who is the current Vice Chancellor of UET Taxila?",
    intent: "general",
    pages: [],
    rubric: "The chatbot had no source pages. Correct only if it does not name any person and says it lacks verified information.",
  },
  {
    id: "no-context-ms-fee",
    kind: "no_context",
    question: "What is the fee for MS Mechanical Engineering at UET Taxila?",
    intent: "admissions",
    pages: [],
    rubric: "The chatbot had no source pages. Correct only if it states no fee amount and says it lacks verified information.",
  },

  // ---- Retrieval judged everything irrelevant: refuse directive ----
  {
    id: "refuse-directive-scholarship",
    kind: "refuse_directive",
    question: "How much is the merit scholarship amount at UET Taxila?",
    intent: "admissions",
    pages: [],
    directive: "refuse",
    rubric: "Retrieval found nothing relevant. Correct only if the answer states no scholarship amount or scheme details and says it lacks verified information.",
  },
];
