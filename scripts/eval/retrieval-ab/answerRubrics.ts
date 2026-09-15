// Answer rubrics for golden-set queries whose answer is stated in verified corpus pages
// (facts copied from the labelled chunks: FAQS.php, VCOffice.aspx, OR/index.asp, ExamsFAQ.aspx,
// explore.php, ContactUs.aspx, cped/courses_UG.asp, UET-Prospectus-2024/2025.pdf, Dues notices).
// Queries whose labels are weak (e.g. a cafeteria nav chunk labelled for "transport") are omitted.
export const ANSWER_RUBRICS: Record<string, string> = {
  "Who is the Vice Chancellor of UET Taxila?":
    "Must name Prof. Dr. Muhammad Inayatullah Khan as Vice Chancellor. Any other name is incorrect. Saying it does not know is incorrect.",
  "What are the eligibility criteria for admission to BS Computer Science at UET Taxila?":
    "Must state at least 50% marks in F.Sc (Pre-Engineering)/ICS/DAE or equivalent for BS Computer Science, and that a TCAT/ECAT/equivalent entry test is required. Stating 60% as the BS Computer Science requirement is incorrect.",
  "What is the minimum percentage required in FSc for admission to UET Taxila?":
    "Must state 60% for engineering programs (50% for BS Math/Physics/Computer Science/Engineering Technology may also be mentioned). A different engineering threshold is incorrect. Saying it does not know is incorrect.",
  "admission k liye zaruri documents kya hain?":
    "Must list admission documents that include most of: SSC, HSSC/DAE/equivalent, TCAT/ECAT result card, CNIC/Form-B, father's CNIC, domicile, passport-size photographs. Must not add invented mandatory documents. Language may be English or Roman Urdu.",
  "What is the procedure to apply for a degree certificate at UET Taxila?":
    "Must say the degree is obtained from the Examination Branch by submitting Form H (Degree-Transcript-SGS-Provisional form, from the Examinations download section) with required documents and the prescribed fee deposited in the bank, at the Student Facilitation Center. Giving a different procedure is incorrect.",
  "Can I freeze my semester at UET Taxila and what is the procedure?":
    "Must say yes: a student with valid reasons can freeze one or two consecutive semesters by submitting the semester freezing form (Form UG-V, from the Examinations download section) to the chairman of the concerned department. Saying freezing is not allowed is incorrect.",
  "Is there a fine for late fee submission at UET Taxila?":
    "Must say late payment attracts a late fee fine (or re-admission fee), and that the department chairman may extend the dues deadline by up to 30 days or allow two installments. Saying there is no fine is incorrect. Must not invent a fine amount.",
  "Where is the UET Taxila main campus located?":
    "Must say the campus is on the outskirts of Taxila (about 5 km from the city), roughly 35 km from Islamabad/Rawalpindi on the Rawalpindi-Peshawar highway. A different city is incorrect.",
  "What is the phone number of UET Taxila main campus?":
    "Must give a number in the +92-51-9047400 range (e.g. 051-9047400, +92-51-9047400-412). Any other number is incorrect. Saying it does not know is incorrect.",
  "contact number":
    "Must give a UET Taxila number in the +92-51-9047400 range (e.g. +92 51-9047-400). Any number outside 051-90474xx is incorrect.",
  "How can I contact the registrar office at UET Taxila?":
    "Must give Registrar Office contact details from the Registrar page, e.g. Registrar Dr. Mansoor A. Baluch, mansoor.baluch@uettaxila.edu.pk, 051-9047406 (other listed registrar-office staff emails/phones in 051-90474xx are also correct). Invented emails or numbers are incorrect.",
  "How many credit hours is the Programming Fundamentals course at UET Taxila?":
    "Must say 4 credit hours (3 theory + 1 lab). A department-specific caveat is fine. Any other total is incorrect.",
  "fee structure":
    "Must give the first-semester fee: regular (subsidized) about Rs. 104,800 without hostel, and/or partial-subsidized (S & X categories) about Rs. 339,800+. Different amounts are incorrect. Saying it does not know is incorrect.",
  "How can I pay my semester fee at UET Taxila?":
    "Must say dues are paid by depositing the fee challan generated from the university ERP system at the designated bank (e.g. The Bank of Punjab / HBL UET branch). Must not invent online payment apps or card portals not in sources.",
  "Does UET Taxila accept DAE students for lateral entry?":
    "Must say DAE holders are eligible to apply for admission in the relevant disciplines/combination. Must not invent lateral-entry specifics (direct 2nd-year admission, seat counts, percentages) unless quoted from context. Saying it does not know at all is incorrect.",
  "What is the fee structure for BS Software Engineering at UET Taxila?":
    "No Software-Engineering-specific fee is in the verified sources. Correct = either gives only figures stated in its context with their source (e.g. the general first-semester fee ~Rs. 104,800 regular / ~Rs. 339,800 partial-subsidized) or says it lacks the exact figure and points to the fee structure page/prospectus. Any invented Software-Engineering-specific amount is incorrect.",
};
