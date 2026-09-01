# Delta label review - closes the pool-bias gap measured in
# docs/rag-store-evaluation/hybrid-retrieval-2026-08/report.md §2

Each query below lists ONLY the chunks in the hybrid system's fused top-5
that were absent from the original dense-only label pool (label_review.md) -
i.e. candidates that were never eligible to be marked relevant before now.
The query's existing relevant chunk(s) and note (if any) are echoed for
context. Mark each `[ ]` as `[x]` ONLY for chunks that genuinely, correctly
answer the query. If none of the new candidates are relevant, leave them
unchecked - the existing note already covers that case and nothing more is
needed. Add a one-line `_delta_note:_` only if something about the new
candidates specifically is worth recording. `_delta_provenance:_` defaults to
LLM_JUDGED (read against the query, no independent second source checked) -
change it to AUTHORITATIVE_SOURCE_MATCH only if a checked candidate was
actually cross-checked against independent source content (e.g. the
Prospectus PDF page image, the Rule Book, a corroborating second chunk), and
say what was cross-checked. Never mark HUMAN_VERIFIED on this file's behalf -
that provenance is reserved for the project's user reviewing in person.

When done, run `parse_delta_label_review.py` to merge your marks into
golden_set_verified.jsonl (additive: existing relevant chunks are kept,
new ones you check are appended).

---

## 1. What is the fee structure for BS Software Engineering at UET Taxila?

queryId: `8fe9e8f2dfe15d2e`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all are SED nav/PG-admission stubs (PG-fee.asp, PhD-admission.asp, or bare "Fee" link labels with no content), not the UG fee structure. The real answer (Prospectus Table 30.1, university-wide by category, not by department/program) exists in the corpus but was not retrieved for this query.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Department of Software Engineering, UET Taxila
      url: /SED/events32.asp
      heading: Department of Software Engineering, UET Taxila > Motivational Session for SE-2022 (08-05-2023)
      chunkKey: `0d1734dac162a74e4d566720f6639a2abd3ca0fed083eb3e6f78d6c138fce9dd`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/events32.asp ## Motivational Session for SE-2022 (08-05-2023)  The agenda was,  1. What is freelancing,  2. Motivation to make businesses  3. Discussion about the importance of curriculum in real-world  4. Vision story, make a vision and follow it throughout  5. Listening to your mentors, and how a teacher is your bigges...

- [x] **fused rank 4** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What is the fee structure for the first semester?
      chunkKey: `047ea82187b988440580aa7760da5ee71889c0eb0a0896d05b5c12b45a2b6183`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What is the fee structure for the first semester?  • Regular (Subsidized) ≈ Rs. 104,800 (without hostel) • Partial-Subsidized (S & X categories) ≈ Rs. 339,800+ Exact fee is mentioned in the prospectus and on the fee structure page....

_delta_note:_ FAQ candidate directly states the fee structure (Rs. 104,800 Subsidized / Rs. 339,800+ Partial-Subsidized for the first semester) - on-topic for a fee-structure query; university-wide, not SE-specific, consistent with query 5's finding that fees don't differ by program. The SED motivational-session candidate is off-topic career content, not marked.
_delta_provenance:_ LLM_JUDGED

---

## 2. How much does a student pay per semester in BS Computer Science?

queryId: `74c9b0d4368cc597`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all are curriculum/courses-of-study content (credit hours, course lists), not fee amounts. "Semester" matched on the academic-calendar sense, not the fee-payment sense. The real Table 30.1 tuition figures (38,000/130,000 per semester, Subsidized/Partial-Subsidized, same for all programs) were not retrieved.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Rule Book -2023 - A5 Final.indd
      url: /Downloads/Rule-Book-2023.pdf
      heading: RULES & REGULATIONS Undergraduate Programs > Page 20 > Examina� ons.
      chunkKey: `b7997624fbc0f7d118e045a843264c8e3e55864f573110e7f1023cb1b22887af`
      text: Document Title: Rule Book -2023 - A5 Final.indd URL Path: /Downloads/Rule-Book-2023.pdf Spring) and the contact hours also does not exceed total number of available work hours per week.  - **d.** In case of repe� � on/improvement of a course the student shall have to pay the course registra� on and examina� on fee as prescribed by the university. He will submit the registra� on form along with sub...

- [ ] **fused rank 4** - COMLEX ENGINEERING PROBLES
      url: /cped/ugsDownloads/Booklets/Booklet-Emerging-Trends.pdf
      heading: **<u>Cloud and Distributed Computing</u>** > **The Rise of Containers** > **Serverless Computing**
      chunkKey: `dffb35cff2a1ef9647a66ac914ee6a7eb47790869b434021e8d61cc465adb940`
      text: Document Title: COMLEX ENGINEERING PROBLES URL Path: /cped/ugsDownloads/Booklets/Booklet-Emerging-Trends.pdf ##### **Serverless Computing**  The basic building block of a computer network is the server. And since running a businesses without a computer network is impossible, companies had no other choice to rent or purchase servers to host their data and applications.  The problem with servers is ...

_delta_note:_ Neither candidate states a per-semester payment figure - the Rule Book passage is specifically about the repeat/improvement-course fee (a narrower, different case), not the general semester fee; the second candidate is an unrelated serverless-computing booklet excerpt.
_delta_provenance:_ LLM_JUDGED

---

## 3. What is the total tuition cost for a 4-year BS program at UET Taxila?

queryId: `fc1c0652eda046e9`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - candidate 1 is a near-empty "Discover UET Taxila" campus-life fragment (confirmed by reading the full chunk, not just the preview); candidates 2/5 (ProcedureAndRequirements2.php) are confirmed near-empty stubs (full text is just the title + source URL, checked directly); 3/4 are Basic Sciences PG/UG program pages, not fees. The Prospectus's "Grand Total of 4 years" row is itself blank in the 2025 edition's source PDF (confirmed by visual page inspection) and has real values only in the 2024 edition (654,000/1,453,000) - neither was retrieved here, and neither would be the true 2026 answer regardless.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 1** - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **Faculty of Basic Sciences and 6 Humanities** > Page 112 > **Ms. Sumaira Rashid** > **The Department** > **Programs**
      chunkKey: `9e00aa8341e63ae5e5daa87db6b19070970b5767c297beb9219378e57a2fc5b8`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf future where mathematical prowess is not only valued but serves as a catalyst for positive change.  Welcome to the BS Mathematics program at UET Taxila, where the power of mathematics meets limitless possibilities. BS Mathematics is a four-year degree program comprising of eight regular semesters.  The Department ...

- [ ] **fused rank 3** - LAB details with experiment list.pdf
      url: /MED/PG_downloads/labs/LAB%20details%20with%20experiment%20list.pdf
      heading: **Mechanics of Material Lab** > Page 11
      chunkKey: `e8b09c9efacc34306f2ab05ba6780e5be0b57ce0eedb36687652694991b936b9`
      text: Document Title: LAB details with experiment list.pdf URL Path: /MED/PG_downloads/labs/LAB%20details%20with%20experiment%20list.pdf Introduction to Excel Financial Functions.  2. Find the PW for the following cash flow @ I = 8%  |End ofyear|0|1|2|3|4| |---|---|---|---|---|---| |Cash Flow|-500|200|50|50|50|  3. A foundation gives a gift to activity to build a park and to maintain it for 5 years. Ann...

- [ ] **fused rank 5** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 118 > **Vision** > **Mission** > **Laboratories** > **BS Physics Programs**
      chunkKey: `29cfbd27b1249d1a4ef98fc52502e810bc245f241901f61a715f636cc9470401`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf **UNDERGRADUATE PROSPECTUS 2025** > Page 118 > **Vision** > **Mission** > **Laboratories** > **BS Physics Programs**  ###### **BS Physics Programs**   The BS Physics is a full–time 4 years (8 semesters) degree program.  Various core Physics courses along with interdisciplinary as well as general education courses,...

_delta_note:_ None state a total-tuition figure - two are program-description boilerplate (BS Mathematics, BS Physics) with no fee numbers, one is an unrelated Excel-financial-functions lab exercise.
_delta_provenance:_ LLM_JUDGED

---

## 4. Are there any additional charges apart from tuition in UET Taxila fee structure?

queryId: `d9ad8a444d6c7741`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - candidate 1 is a marketing blurb ("Subsidized fees with generous scholarships"), not an itemized charge list; 2/3/5 are generic admin/schedule pages with no fee content; candidate 4's "Fee Structure / Fees Engineering Programs / Fees For Technology Programs" text is nav-menu link labels, not actual charge content. The real itemized "other charges" (registration, sports, magazine, medical, lab, exam, book bank, tour, recreation, campus, digital library charges - all listed in Table 30.1) were not retrieved.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Policy for Students with Disabilities 2021- Amended.pdf
      url: /Downloads/Policies/Policy%20for%20Students%20with%20Disabilities%202021-%20Amended.pdf
      heading: **4. ADMISSIONS-RELATED MATTERS** > Page 9
      chunkKey: `6dffa71b3dc95ec8d513db321fef381e91a9a88529dee29d66eb604a4327f484`
      text: Document Title: Policy for Students with Disabilities 2021- Amended.pdf URL Path: /Downloads/Policies/Policy%20for%20Students%20with%20Disabilities%202021-%20Amended.pdf **4. ADMISSIONS-RELATED MATTERS** > Page 9  permit them to afford their educational and any additional expenses related to their needs.  The need basis of students with disabilities shall be determined in accordance with the crite...

- [ ] **fused rank 4** - Progress_Report_UETTaxila-14-15.pdf
      url: /OR/downloadFiles/reports/Progress_Report_UETTaxila-14-15.pdf
      heading: **PROGRESS REPORT** > Page 17 > 2.9 **<u>Revision in Tuition Fee Share of UET – Affiliated Institutes</u>** . Affiliated...
      chunkKey: `dc1a97efd60d1452aa96410cf7b2714da2ecbbf330c52ebca864e37fc9dc5276`
      text: Document Title: Progress_Report_UETTaxila-14-15.pdf URL Path: /OR/downloadFiles/reports/Progress_Report_UETTaxila-14-15.pdf ###### 2.9 **<u>Revision in Tuition Fee Share of UET – Affiliated Institutes</u>** . Affiliated institutes  broke the semester fee structure into components (tuition fee, lab fee, semester enrollment fee, admin charges etc) without UET consent, kept the tuition fee component ...

_delta_note:_ Neither is genuinely on-topic: the disabilities-policy chunk discusses need assessment, not itemized charges; the progress-report chunk (full text checked) is about UET's revenue-share dispute with affiliated institutes over fee components, not UET Taxila's own student-facing charges.
_delta_provenance:_ LLM_JUDGED

---

## 5. What is the fee difference between engineering and computer science programs?

queryId: `e1f643e47aede4e3`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all are plain department/program listing pages (names only), none discuss fees. The true answer, verified against Table 30.1: there is NO fee difference by program - the published fee schedule is university-wide, differentiated only by admission category (Subsidized vs Partial-Subsidized), not by Engineering vs Computer Science. None of the 5 candidates state this.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 1** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What undergraduate programs are offered?
      chunkKey: `da2ef01e083ccaf626903aeb1e54869c4ec32611820ae513c55ea992e46f0b9d`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What undergraduate programs are offered?  **Engineering:** Civil, Electrical, Mechanical, Computer, Software, Telecommunication, Electronics, Industrial, Environmental, Mechatronics **Computer Science:** BS Computer Science **Engineering Technology (Afternoon):** Cyber Security, Software **Basic Sciences:** BS Physics, BS Mat...

- [ ] **fused rank 3** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What are the eligibility criteria for admission?
      chunkKey: `49ba3a767c08218c224360e50e002c21a8732932ebd002e29da4efe34fb033e2`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What are the eligibility criteria for admission?  You must have passed F.Sc (Pre-Engineering) / ICS / DAE (relevant field) or equivalent with at least **60% marks** for Engineering programs and **50% marks** for BS Math/ Physics /Computer Science / Engineering Technology programs. You must also appear in the TCAT/ECAT/Equival...

_delta_note:_ Neither FAQ candidate discusses fees at all - one lists program names, the other lists eligibility percentages; consistent with the original finding that no fee difference by program exists.
_delta_provenance:_ LLM_JUDGED

---

## 6. How can I pay my semester fee at UET Taxila?

queryId: `6f79337e4985ea52`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - 019e75af934e...
_original note:_ Candidate 1 marked relevant: full chunk text (checked directly, not just the preview) confirms a real payment method - "Bank of Punjab (ERP Generated Challan Only)". Candidate 2 is the same document's title/date header only, no procedure - not marked despite being the same PDF. Candidate 5 (FAQ) describes the *application processing* fee's payment method (HBL Konnect/Internet Banking), not the *semester* fee the query asks about - a different, adjacent fee category, not marked. Candidates 3/4 are for a specific condensed-course fee / a bare nav link, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 3** - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **Faculty of Basic Sciences and 6 Humanities** > Page 159
      chunkKey: `1853094b29f420c4977cca082f10ebf889a9323e25f0c3b8861d67e7fd0bdee2`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf cycle then the admission charges will be adjusted in the fee of next subsequent semesters._  _3. Fees of first semester can be paid in two installments on request. In such cases; Rs. 50,000 will be paid by the subsidized categories and Rs. 1,50,000 will be paid by the partial-subsidized categories at the time of r...

- [x] **fused rank 5** - fee for Session 22 (7th) 23 (5th) 24 (3rd)
      url: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf
      heading: University of Engineering Engineering and Technology Taxila > Page 2 > DUES NOTICE
      chunkKey: `a3176eaceb0c9e8b45b05085fa5d5057dd01fa3506d41c541aaae1c9737feba5`
      text: Document Title: fee for Session 22 (7th) 23 (5th) 24 (3rd) URL Path: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf download through ERP system ofthe University.  1. The Bank of Punjab. (ERP Generated Challan Only)  i} The Bank of Punjab. (All Branches in Pakistan) (ii) i)For Non BOP— 1-Bills ii) Go to *1bill* option from any bank app/ i...

_delta_note:_ Both genuinely add real payment-procedure content: the 2024 Prospectus's two-installment plan for first-semester fees (Rs. 50,000/Rs. 1,50,000 by category), and a second chunk of the same Dues Notice PDF as the original review's already-relevant chunk, giving an additional real payment channel (1Bill option via any bank app).
_delta_provenance:_ LLM_JUDGED

---

## 7. Is there a fine for late fee submission at UET Taxila?

queryId: `a4d3227f8a1b046e`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - fc11e6092df4...
_original note:_ Candidate 5 marked relevant: Prospectus §30.4 is genuinely the closest on-topic content (late-payment extension policy), though it describes an extension process rather than stating a specific fine amount - best available, not a complete answer. Candidates 1/2 (checked in full, not just preview) are a plain dues deadline notice with NO fine/penalty language at all - not marked. 3/4 don't address fines. (The prospectus elsewhere - not in this top5 - does state an explicit "fine of Rs. 8,000/-" for a different scenario, re-admission; that chunk was not retrieved for this query.)

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 2** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 158
      chunkKey: `d19c79ab521e71936d73049c8de2d335d2138884bb3de213e58ef3c2e96667ff`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf students are advised to open their bank accounts in Habib Bank Limited at UET Taxila branch.  - **30.4** The Chairman of the concerned department may grant extension in payment of dues to the needy students on cogent reasons recorded in writing for a maximum period of 30 days beyond the schedule of the dues circul...

_delta_note:_ Same §30.4 extension-policy content as the already-relevant chunk, from the 2025 Prospectus edition instead of 2024 - marked for consistency with that existing judgment (extension process, not a specific fine amount, but the corpus's best available answer).
_delta_provenance:_ LLM_JUDGED

---

## 8. What are the eligibility criteria for admission to BS Computer Science at UET Taxila?

queryId: `379d79b1e7ee91b2`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked) near-empty nav/header stubs (department homepage boilerplate, a bare 'coursestable' placeholder, a one-line program-list link). None state actual eligibility criteria. Real eligibility content exists elsewhere in the corpus (see query 9) but was not retrieved here.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 1** - MS Data Science | Department of Computer Science, UET Taxila
      url: /cs/msDataScience-eligibilitycriteriaandadmissioprocess.asp
      heading: **MS Data Science** > Eligibility Criteria & Admission Process > **Eligibility criteria**
      chunkKey: `2bc0eb6d1fd60b8fd787663a7b58f0babfbca170f6c9b3fd3c440c41b3194368`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /cs/msDataScience-eligibilitycriteriaandadmissioprocess.asp ### **Eligibility criteria**  Students with four years of Bachelor degree in the following domains (Computer Science, Information Technology, Software Engineering, AI or equivalent are eligible for admission.  To be eligible for admission, a candidate m...

- [ ] **fused rank 2** - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-eligibilitycriteriaandadmissioprocess.asp
      heading: **MS Data Science** > Eligibility Criteria & Admission Process > **Eligibility criteria**
      chunkKey: `bc557f2f2a6ccf7a5889a166676312580f52ed91934226592a31b5ebb1a5a61e`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-eligibilitycriteriaandadmissioprocess.asp ### **Eligibility criteria**  Students with four years of Bachelor degree in the following domains (Computer Science, Information Technology, Software Engineering, AI or equivalent are eligible for admission.  To be eligible for admission, a candidate m...

- [x] **fused rank 4** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What are the eligibility criteria for admission?
      chunkKey: `49ba3a767c08218c224360e50e002c21a8732932ebd002e29da4efe34fb033e2`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What are the eligibility criteria for admission?  You must have passed F.Sc (Pre-Engineering) / ICS / DAE (relevant field) or equivalent with at least **60% marks** for Engineering programs and **50% marks** for BS Math/ Physics /Computer Science / Engineering Technology programs. You must also appear in the TCAT/ECAT/Equival...

_delta_note:_ FAQ candidate directly states BS Computer Science's real eligibility percentage (50% marks) - on-topic and correct. The two MS Data Science eligibility chunks are for a different, graduate program - not marked, consistent with query 19's precedent for excluding graduate-program candidates.
_delta_provenance:_ LLM_JUDGED

---

## 9. What is the minimum percentage required in FSc for admission to UET Taxila?

queryId: `9e51f9dc27154685`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - 5d4dc9002869...
_original note:_ Candidate 1 marked relevant: real content - 'Mathematics/Biology 30%, English 10%, Chemistry/CS/Statistics 30%' subject-weighted percentage breakdown from the actual Eligibility page (full text checked). It does not state a single overall minimum aggregate percentage, but is the corpus's best available answer to a percentage-related eligibility query. Candidates 2/3/5 confirmed near-empty stubs (full text checked); candidate 4 is a heading ('must fulfill the following requirements:') cut off before the actual list - a real chunking-boundary issue, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-faqs.asp
      heading: **MS Data Science** > Frequently Asked Questions (FAQs)
      chunkKey: `d35634ccf15fdfc9e9775827541b6019292c256c5a306c8fefa3de5c5e746726`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-faqs.asp ## Frequently Asked Questions (FAQs)  **1. What is the objective of the MS Data Science program at UET Taxila?** The program aims to produce professionals who can derive insights from large datasets, with a strong emphasis on machine learning, big data technologies, cloud computing, an...

- [ ] **fused rank 4** - MS Data Science | Department of Computer Science, UET Taxila
      url: /cs/msDataScience-faqs.asp
      heading: **MS Data Science** > Frequently Asked Questions (FAQs)
      chunkKey: `3e8c4b6a4dcaa341eaa9abb52a3c2d639926efb489c3e58af254d7301b354701`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /cs/msDataScience-faqs.asp ## Frequently Asked Questions (FAQs)  **1. What is the objective of the MS Data Science program at UET Taxila?** The program aims to produce professionals who can derive insights from large datasets, with a strong emphasis on machine learning, big data technologies, cloud computing, an...

_delta_note:_ Both MS Data Science FAQ chunks are for a different (graduate) program and state no percentage figure in view.
_delta_provenance:_ LLM_JUDGED

---

## 10. What is the last date to apply for UET Taxila undergraduate admissions?

queryId: `c5ee1c9ad958ad05`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all are the identical thin banner fragment '🚨 Undergraduate Admissions Fall 2026 | Registration Started' (full text checked), which states no actual deadline date.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 145 > **<mark>23 Categories and Symbols</mark>**
      chunkKey: `41b163937386bf57e54dd669cebb235bdd4b4f0b18ffbd687464472bb48ad12e`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf provinces (Category A1). The selection and allocation of disciplines are made according to merit.  - **23.2 Category B (Sindh Province)** The applicant should be a resident of the Sindh province. Applications for civil engineering are to be submitted to the Registrar of the Mehran UET, Jamshoro. For electrical and...

- [ ] **fused rank 4** - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **Faculty of Basic Sciences and 6 Humanities** > Page 146 > **<mark>23 Categories and Symbols</mark>**
      chunkKey: `a7c0e00c9a2dd77ccf229092702195cba3e1a3de32c9dbbd54e4e51c870ee3b6`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf and allocation of disciplines are made according to merit.  - **23.2 Category B (Sindh Province)**     - The applicant should be a resident of the Sindh province. Applications for civil engineering are to be submitted to the Registrar of the Mehran UET, Jamshoro. For electrical and mechanical engineering apply to ...

_delta_note:_ Both Prospectus candidates are about admission CATEGORIES (province-based quota rules), not deadline DATES - wrong topic despite being from the admissions section.
_delta_provenance:_ LLM_JUDGED

---

## 11. Does UET Taxila accept DAE students for lateral entry?

queryId: `928451f564ccf0a4`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked) near-empty stub pages (bare titles/source URLs, no content). None address lateral entry or DAE specifically.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 2** - UET Taxila UG Admissions
      url: /Eligiblity.php
      heading: UET Taxila Admissions > Eligibility
      chunkKey: `5d4dc9002869fa5e66bf13f54354e02d95a4a8bb6a45055dae14e75d030eca9c`
      text: Document Title: UET Taxila UG Admissions URL Path: /Eligiblity.php Mathematics / Biology  30%  iii. English 10%  iv. Chemistry / Computer Science / Statistics 30%  i. Applicants who have passed or have appeared in F.Sc/ Intermediate, B.Sc., DAE, B.Tech (Pass), or any Equivalent Examination may apply and choose the relevant combination. However, appearance in Entry Test does not confer the right to...

- [x] **fused rank 4** - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **Faculty of Basic Sciences and 6 Humanities** > Page 150 > **<mark>24 Determination of Merit</mark>** > **24.2 Weighted...
      chunkKey: `729ae8a0e4767919576f46f3ffbb285e8d4ac3ba4ae7bc6080e87ceaaab50b43`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf (Hons)/BS/BSc/Bachelors, in|30%| |EngineeringTechnology|| |HSSC/DAE|20%| |SSC|17%|  - d. For Applicants Having Diploma of Associate Engineer as the Highest Qualification:  |EntryTest|33%| |---|---| |DAE 1st & 2nd Year|50%| |SSC|17%|  |e. In case of foreign i|qualifications| |---|---| |(A-Level etc.) :|| |EntryTest...

_delta_note:_ Both genuinely address DAE: the Eligibility page explicitly lists DAE holders among eligible applicants; the Prospectus merit-weightage table gives a distinct DAE-specific weighting formula (including a dedicated 'Associate Engineer Diploma' merit path) - together a real, on-topic answer to whether DAE is accepted.
_delta_provenance:_ LLM_JUDGED

---

## 12. How many seats are available for BS Electrical Engineering at UET Taxila?

queryId: `f36e58e0f4ae2b8c`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked) near-empty EED department stubs (nav headers, bare footer fragments). None state a seat count.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.) [Start Date: 10 th June, 2024; End Date: 22 nd August, 2022]
      url: /ProcedureAndRequirement
      heading: Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I &amp; Phase-II)...
      chunkKey: `b122e45dfa9111e5a5cc30a8f618b70330957d7a2a6f6c36675eb70aeed2865a`
      text: Document Title: Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.) [Start Date: 10 th June, 2024; End Date: 22 nd August, 2022] URL Path: /ProcedureAndRequirements.php Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-202...

- [ ] **fused rank 4** - Department of Telecom Engineering, UET Taxila
      url: /EED/researchAreas.asp
      heading: Department of Telecom Engineering, UET Taxila
      chunkKey: `2595a9e6b98b0631e0f67fab26d33b8383a1e80ebffdef63a221249bd8c2094f`
      text: Document Title: Department of Telecom Engineering, UET Taxila URL Path: /EED/researchAreas.asp Opto-Electronics lab are available for PhD students.  **M.Sc. in Electrical Engineering Program**  The department started its postgraduate program in 1984 and has been offering courses for the degree of M.Sc. in Electrical Engineering. The Master of Science program is offered in the following specializat...

_delta_note:_ Neither states a seat count - one is TCAT/ECAT procedural text, the other is Telecom (not Electrical) M.Sc. program history.
_delta_provenance:_ LLM_JUDGED

---

## 13. What is the merit list procedure for UET Taxila admissions?

queryId: `fa7779e221583d3d`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked earlier, in queries 3/9/13/31/38/40) as near-empty admissions nav stubs. None describe an actual merit-list procedure.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 1** - UET Taxila UG Admissions
      url: /Bus_Route.php
      heading: UET Taxila Admissions > Official resources - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &...
      chunkKey: `6074be175431057c92bde34206c32b49be9817317043391a4364c596b7c7a693`
      text: Document Title: UET Taxila UG Admissions URL Path: /Bus_Route.php UET Taxila Admissions > Official resources - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &amp; Technology Taxila Undergraduate Admissions Home Discover Merit List Fee Structure Fees Engineering Programs Fees For Technology Programs Seats Seats Allocation Applicants From Punjab Province Partial-Subsidize...

- [ ] **fused rank 2** - UET Taxila UG Admissions
      url: /Test_Centers.php
      heading: UET Taxila Admissions > Official resources - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &...
      chunkKey: `2449fc7207c12d4667bafd09e463ec3e720ef04eba8d00c68b9f3ca335d914cd`
      text: Document Title: UET Taxila UG Admissions URL Path: /Test_Centers.php UET Taxila Admissions > Official resources - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &amp; Technology Taxila Undergraduate Admissions Home Discover Merit List Fee Structure Fees Engineering Programs Fees For Technology Programs Seats Seats Allocation Applicants From Punjab Province Partial-Subsid...

- [ ] **fused rank 4** - Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.) [Start Date: 10 th June, 2024; End Date: 22 nd August, 2022]
      url: /ProcedureAndRequirement
      heading: Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I &amp; Phase-II)...
      chunkKey: `dfcd25d71e12a936845599b6f5925e73030c33a8892dc97e815fae504374fbd3`
      text: Document Title: Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.) [Start Date: 10 th June, 2024; End Date: 22 nd August, 2022] URL Path: /ProcedureAndRequirements.php Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-202...

_delta_note:_ The two admissions-portal candidates (Bus_Route.php, Test_Centers.php) are confirmed nav-menu link listings that happen to include 'Merit List' as one of many menu labels, not a described procedure; the TCAT/ECAT candidate doesn't address merit-list mechanics.
_delta_provenance:_ LLM_JUDGED

---

## 14. When are the midterm exams held at UET Taxila?

queryId: `cb7a97774e15f4e9`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - Seminars.aspx is generic campus-life content unrelated to exam scheduling; the other 4 are confirmed near-empty admissions/explore stubs. No midterm exam dates stated anywhere in this top5.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - UET Taxila Service Statutes 2016.pdf
      url: /OR/downloads/publicinformationofficer/UET%20Taxila%20Service%20Statutes%202016.pdf
      heading: **2.1 UET TAXILA SERVICE STATUTES-2016** > Page 13
      chunkKey: `f19ca0b777765efb13d18a675e8bd437dd4f091b424f43ee4e9e86b13b2d16dc`
      text: Document Title: UET Taxila Service Statutes 2016.pdf URL Path: /OR/downloads/publicinformationofficer/UET%20Taxila%20Service%20Statutes%202016.pdf at the credit of an employee shall lapse when he leaves service of the University due to any cause.  **51. Quarantine leave** .– An employee may be granted quarantine leave outside his leave account to the extent that the District Medical Board recommen...

- [ ] **fused rank 4** - PTCL_Evo_Guide_PMNLS.pdf
      url: /PTCL_Evo_Guide_PMNLS.pdf
      heading: SSSUNIVERSITY OFVF ENGINEERINGENGINEERING ANDAND TECHNOLOGYTECHNOLOGY TAXILATAXILA EXAMINATIONS BRANCH
      chunkKey: `fc6095544026a5f41138acf894be92956d1b6f8418e655ef0558e6e0ee4134d2`
      text: Document Title: PTCL_Evo_Guide_PMNLS.pdf URL Path: /PTCL_Evo_Guide_PMNLS.pdf # SSSUNIVERSITY OFVF ENGINEERINGENGINEERING ANDAND TECHNOLOGYTECHNOLOGY TAXILATAXILA EXAMINATIONS BRANCH  No. UET/Exams/2015//4/T Dated: 11-03-2015  PRIME MINISTER NATIONAL LAPTOP SCHEME  (EVO DEVICE ACTIVATION)  It is informed that Undergraduate and Postgraduate Programme students who have received their Laptops and EVO ...

_delta_note:_ Neither addresses student exams - one is an employee leave-policy statute (quarantine leave), the other is a laptop-scheme device-activation notice.
_delta_provenance:_ LLM_JUDGED

---

## 15. What is the schedule for final exams in spring semester 2025 at UET Taxila?

queryId: `0516bcbb0e07b76d`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidate 2 (MMED dept page) has a REAL final-exam date sheet, but for 2013-2014 - 11+ years stale, naming specific calendar dates from over a decade ago that would actively mislead if presented as 'Spring 2025' - too stale to count as a reasonable best-available answer (unlike the 1-year fee-schedule drift accepted elsewhere, this is a 12-year gap in specific dates). Candidates 1/3/4 are about the ADMISSION schedule, not the exam schedule - wrong topic. Candidate 5 is a confirmed near-empty stub.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Rule Book -2023 - A5 Final.indd
      url: /Downloads/Rule-Book-2023.pdf
      heading: RULES & REGULATIONS Undergraduate Programs > Page 3 > **PREFACE**
      chunkKey: `338120a50977f439484bdd7a0ae3635a671081e8da27741b07cca84cd8c5de73`
      text: Document Title: Rule Book -2023 - A5 Final.indd URL Path: /Downloads/Rule-Book-2023.pdf Semester System of teaching and examina� on was implemented on all programs of UET Taxila in 2007.  Outcome Based Educa� on (OBE) is a student-centered approach of curriculum design and teaching that emphasize on what learners should know, understand, and demonstrate and how to adapt to life beyond formal educa...

- [ ] **fused rank 4** - CPED-Newsletter-(Spring-2021).pdf
      url: /cped/ugsDownloads/Newsletter/CPED-Newsletter-(Spring-2021).pdf
      heading: CPED NEWSLETTER > Page 2 > Newly Proposed PEOs by CPED > Five FYPs Secured IGNITE Funding
      chunkKey: `ab2ea20165b8f2eca74ebd72353f72421fd6c5f7c6e25629fdb9487b2bea996b`
      text: Document Title: CPED-Newsletter-(Spring-2021).pdf URL Path: /cped/ugsDownloads/Newsletter/CPED-Newsletter-(Spring-2021).pdf ###### Five FYPs Secured IGNITE Funding  IGNITE has approved the Funding to Final Year Projects (FYPs) 2021 for the students at Universities / DAIs across Pakistan, out of which, UET Taxila acquired the funding for 18 FYPs. It is pertinent to mention that CPED acquired fundin...

_delta_note:_ Neither states exam-schedule dates - one is Rule Book background on the semester system's history, the other is a 2021 newsletter about FYP funding.
_delta_provenance:_ LLM_JUDGED

---

## 16. When does the spring semester 2025 start at UET Taxila?

queryId: `d05381af7512b11d`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all are the identical thin admissions-banner fragment or the same off-topic admission-schedule prospectus stub as query 15. No spring 2025 start date stated.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 1** - Department of Metallurgy and Materials Engineering, UET Taxila
      url: /MMED/regSchedulePG.asp
      heading: Department of Metallurgy and Materials Engineering, UET Taxila
      chunkKey: `2e1b7b0dcb507ccf03759bcb2d95a333ea12ac5b03c1a0353fbd4f637feb28df`
      text: Document Title: Department of Metallurgy and Materials Engineering, UET Taxila URL Path: /MMED/regSchedulePG.asp # Department of Metallurgy and Materials Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/MMED/regSchedulePG.asp>  UET Taxila  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [Quick Links](<https://web.uettaxila.edu.pk/MMED/quickLinks.asp>)  ...

- [ ] **fused rank 3** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 159
      chunkKey: `e4f7886b70676f65ffbac281a976e9c71a24dac9de6092a65a0691b907fbd606`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf does not deposit the regular semester fee & charges (Defaulter Students’ List to be notified by the  Treasurer) till one month after start of semester, he will be treated as suspended from the department. The Chairman will notify his suspension to all concerned. The Chairman can lift this suspension after the paym...

- [ ] **fused rank 5** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 159
      chunkKey: `14f16e454c9752ea53cdbb67433d098a6d57789411e762db464c40f6d4c55861`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ## Page 159  or the hostel, after deduction of outstanding dues of the university, subject to the submission of clearance, completed in all respects.     - ii. The refundable university security, library security and hostel security, however, shall stand forfeited if a student withdraws from or leaves the universi...

_delta_note:_ None states a semester start date - one is a confirmed near-empty department nav stub, the other two are Prospectus passages about fee-deadline suspension consequences and hostel-security refunds, not the start date.
_delta_provenance:_ LLM_JUDGED

---

## 17. What are the important dates in the UET Taxila academic calendar?

queryId: `93971e85e247fde9`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - b5bb836b20b6...
_original note:_ Candidate 1 marked relevant: 'Admission Schedule Entry Fall 2026 - Important Dates & Deadlines' - genuinely on-topic for a broad 'important dates' query (admission dates are a real category of important dates), even though it covers admissions specifically rather than the full academic calendar. Candidates 2-5 are all the same one-off 'Youm-e-Takbeer' event notice, not a dates listing - not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements
      chunkKey: `6893701df7cf5a975de46788caf2874ae8ac5f6811b210572f39dd7340883837`
      text: Document Title: Undergraduate Admissions 2026 (Conducted by UET Taxila) View Advertisement  *Apply Now*](<http://entrytest.uettaxila.edu.pk/>)  [###### What to do next After Merit List? check FAQs.](<https://admissions.uettaxila.edu.pk/FAQS.php>)  [###### The schedule for document submission will be uploaded on the Admissions website. Applicants are advised to regularly check the website and plan ...

- [ ] **fused rank 4** - Seat Allocation
      url: /Applicants_From_Punjab_Province.php
      heading: Seat Allocation > Official resources - [Apply Now](<https://admission.uettaxila.edu.pk/application/index.php>) - [UET Ta...
      chunkKey: `51d03678b58edabf5f71a168e73456848709158bf9c3778b796b8252d9c719aa`
      text: Document Title: Seat Allocation URL Path: /Applicants_From_Punjab_Province.php Seat Allocation > Official resources - [Apply Now](<https://admission.uettaxila.edu.pk/application/index.php>) - [UET Taxila Undergraduate Admissions](<https://admissions.uettaxila.edu.pk/index.php>) - [Undergraduate Programs](<https://admissions.uettaxila.edu.pk/ProgramsOffered.php>) - [Explore Campus](<https://admissi...

_delta_note:_ Neither adds a date: the Admissions-2026 announcement links to a schedule that 'will be uploaded' (no dates in this chunk itself), and Seat Allocation is a nav-link listing.
_delta_provenance:_ LLM_JUDGED

---

## 18. When is the summer break at UET Taxila university?

queryId: `2ea89221212da31c`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked) near-empty banner/nav stubs. No summer break dates stated anywhere in this top5.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 118 > **Vision** > **Mission** > **Laboratories** > **BS Physics Programs**
      chunkKey: `29cfbd27b1249d1a4ef98fc52502e810bc245f241901f61a715f636cc9470401`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf **UNDERGRADUATE PROSPECTUS 2025** > Page 118 > **Vision** > **Mission** > **Laboratories** > **BS Physics Programs**  ###### **BS Physics Programs**   The BS Physics is a full–time 4 years (8 semesters) degree program.  Various core Physics courses along with interdisciplinary as well as general education courses,...

- [ ] **fused rank 4** - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **Faculty of Basic Sciences and 6 Humanities** > Page 119 > **The Department** > **Vision** > **Mission** > **BS Physics...
      chunkKey: `b2ce4bbe52cc1b8216e30d720f3ba535b0a6f99dbac03b2bb9d64967e4f01672`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf **Faculty of Basic Sciences and 6 Humanities** > Page 119 > **The Department** > **Vision** > **Mission** > **BS Physics Programs**  ###### **BS Physics Programs**   The BS Physics is a full–time 4 years (8 semesters) degree program.  Various core Physics courses along with interdisciplinary as well as general edu...

_delta_note:_ Both are the same BS Physics program-description boilerplate already rejected for query 3 (4-year/8-semester description) - no break/holiday dates.
_delta_provenance:_ LLM_JUDGED

---

## 19. What are the prerequisites for the Data Structures course at UET Taxila?

queryId: `7b5d19924011310c`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidate 1 (Prospectus) is just the header 'Course Title: Data Structures & Algorithms' cut off before any prerequisite text (full text checked). Candidate 3 (Computer Engineering dept) lists the course in a credit-hour table alongside Operating Systems but states no explicit prerequisite. Candidates 2/4/5 are for a different (graduate, Data Science) program. No candidate actually states a prerequisite.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-faqs.asp
      heading: **MS Data Science** > Frequently Asked Questions (FAQs)
      chunkKey: `796ec7e820929ef9216bb370273ad5c898b2f0f2234c692745a3cdb2b86104d5`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-faqs.asp CGPA of 2.0 or 60% marks and a qualifying test score (GRE/HAT/university-conducted) is required.  **3. What if I haven’t studied the required prerequisite courses?** Students missing core courses (Programming Fundamentals, Data Structures & Algorithms, Database Systems) must take defic...

- [ ] **fused rank 4** - MS Data Science | Department of Computer Science, UET Taxila
      url: /cs/msDataScience-faqs.asp
      heading: **MS Data Science** > Frequently Asked Questions (FAQs)
      chunkKey: `c0ff3c7a56f9be264faf3b8e6da422b2dd533bc25bd8fd2c07d283e24e96dd6c`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /cs/msDataScience-faqs.asp CGPA of 2.0 or 60% marks and a qualifying test score (GRE/HAT/university-conducted) is required.  **3. What if I haven’t studied the required prerequisite courses?** Students missing core courses (Programming Fundamentals, Data Structures & Algorithms, Database Systems) must take defic...

_delta_note:_ Both MS Data Science FAQ chunks name 'Data Structures & Algorithms' only as a prerequisite students must have COMPLETED before that graduate program - the inverse of what's asked (what's required before taking the BS Data Structures course itself) - not marked, a genuinely close near-miss worth flagging rather than a clean non-match.
_delta_provenance:_ LLM_JUDGED

---

## 20. How many credit hours is the Programming Fundamentals course at UET Taxila?

queryId: `28c28a292f783f28`

_already relevant (from original review, kept as-is):_ 3 chunk(s) - 8aee572b1c18..., d4ae0318d1e2..., d3b2910fc4aa...
_original note:_ Candidates 1, 3, 4 marked relevant: three different, internally consistent, real per-program credit-hour tables for 'Programming Fundamentals' - Computer Engineering (candidate 1: 3+1=4 total, cross-checked against its own table's structure), BSc Telecommunication Engineering (candidate 3: CS-102, 2 credit hours theory + 1 lab), BSc Computer Science (candidate 4: CS-101, 3 credit hours + 1 lab = 4 total, matching candidate 1's total). The query doesn't specify a program, and each is a genuine, correct, program-specific answer - cross-referenced against each other to confirm none contradicts, they're simply different real programs. Candidates 2/5 (full text checked) are nav-link listings with no actual credit-hour data, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 1** - Department of Computer Engineering, UET Taxila
      url: /cped/courses_UG.asp
      heading: Department of Computer Engineering, UET Taxila > PROGRAM SUMMARY
      chunkKey: `578b13e13b5ae05fbe9c165ccb472cd4eba32c183227a49907b00f89a5091506`
      text: Document Title: Department of Computer Engineering, UET Taxila URL Path: /cped/courses_UG.asp Semester  **Course Code**  **Course Name**  **Credit Hours**  **Part I**  **Part II**  CP-101  Applications of ICT  2  0  CP-101L  Applications of ICT (Lab)  0  1  CP-102  Circuit Analysis  3  0  CP-102L  Circuit Analysis (Lab)  0  1  NS-103  Applied Physics  3  0  NS-103L  Applied Physics (Lab)  0  1  MA...

- [ ] **fused rank 4** - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-faqs.asp
      heading: **MS Data Science** > Frequently Asked Questions (FAQs)
      chunkKey: `796ec7e820929ef9216bb370273ad5c898b2f0f2234c692745a3cdb2b86104d5`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-faqs.asp CGPA of 2.0 or 60% marks and a qualifying test score (GRE/HAT/university-conducted) is required.  **3. What if I haven’t studied the required prerequisite courses?** Students missing core courses (Programming Fundamentals, Data Structures & Algorithms, Database Systems) must take defic...

_delta_note:_ Full-text lookup (400-char preview didn't reach it) confirms this Computer Engineering 2nd-semester table lists 'CP-108 Programming Fundamentals 3 0' + 'CP-108L Programming Fundamentals (Lab) 0 1' = 4 total credit hours, corroborating the Computer Engineering figure already established in the original review's candidate 1. The MS Data Science FAQ candidate names Programming Fundamentals only as a prerequisite-course label with no credit-hour figure - not marked.
_delta_provenance:_ AUTHORITATIVE_SOURCE_MATCH (full chunk text fetched directly from the corpus to confirm the credit-hour figures appear beyond the 400-char preview, corroborating the original review's already-verified Computer Engineering total)

---

## 21. What courses are offered in the 3rd semester of BS Computer Science?

queryId: `d401ee13982062e9`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidates 1-4 (full text checked) are section headers only ('Courses Under Semester System BSc Computer Science' / 'Curriculum: Courses Under Semester System'), cut off before any semester-specific course list - a chunking-boundary issue. Candidate 5 shows Semester VI content, not the 3rd semester asked about - wrong semester.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What undergraduate programs are offered?
      chunkKey: `da2ef01e083ccaf626903aeb1e54869c4ec32611820ae513c55ea992e46f0b9d`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What undergraduate programs are offered?  **Engineering:** Civil, Electrical, Mechanical, Computer, Software, Telecommunication, Electronics, Industrial, Environmental, Mechatronics **Computer Science:** BS Computer Science **Engineering Technology (Afternoon):** Cyber Security, Software **Basic Sciences:** BS Physics, BS Mat...

- [ ] **fused rank 4** - Undergraduate Programs
      url: /PSD/UG.asp
      heading: Undergraduate Programs > Bachelor of Science (BS) in Physics > Statutes and Regulations
      chunkKey: `eb0b6db889fe65b73edd2240f67797441d90795f021ff2b63ee8eeb8659dd937`
      text: Document Title: Undergraduate Programs URL Path: /PSD/UG.asp Undergraduate Programs > Bachelor of Science (BS) in Physics > Statutes and Regulations  #### Statutes and Regulations   BS Physics is a full-time 4 years (8 semesters) degree program.  Various core physics courses along with interdisciplinary as well as general education courses are being offered to the students of BS physics degree pro...

_delta_note:_ Neither lists 3rd-semester-specific courses - one is the same undergraduate-programs FAQ listing rejected elsewhere, the other is a BS Physics statutes/regulations page for a different program.
_delta_provenance:_ LLM_JUDGED

---

## 22. Is there a lab component for Operating Systems at UET Taxila?

queryId: `32bd7727e786b6c1`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - IOT Lab and Hardware Lab are specific, different labs (not Operating Systems), all confirmed near-empty nav stubs; the 'Operational' OR department page is unrelated. No candidate addresses an Operating Systems course lab component (that fact exists elsewhere in the corpus per query 20's candidate 1, but was not retrieved here).

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Labs Infrastructure | Department of Electronics Engineering, UET Taxila
      url: /EncED/labs.asp
      heading: Labs Infrastructure > Visual resources requiring text extraction - [ComputerLab](<https://web.uettaxila.edu.pk/EncED/ima...
      chunkKey: `44b54bca0f022224ea01807d64dcf55d3fd08ceebe69b9c335ec73ce384d9974`
      text: Document Title: Labs Infrastructure | Department of Electronics Engineering, UET Taxila URL Path: /EncED/labs.asp Labs Infrastructure > Visual resources requiring text extraction - [ComputerLab](<https://web.uettaxila.edu.pk/EncED/images/labs/ComputerLab.jpg>) — The Computer Lab is an open, general-purpose and well-equipped lab providing computer technology as well as technological support for eff...

- [ ] **fused rank 4** - Labs Infrastructure | Department of Biomedical Engineering & Technology, UET Taxila
      url: /BMTD/labs.asp
      heading: Labs Infrastructure > Visual resources requiring text extraction - [ComputerLab](<https://web.uettaxila.edu.pk/BMTD/imag...
      chunkKey: `ba116d9711875f63818f8358a5725f69856fed8b919322ab9f2d2c0d926db624`
      text: Document Title: Labs Infrastructure | Department of Biomedical Engineering & Technology, UET Taxila URL Path: /BMTD/labs.asp Labs Infrastructure > Visual resources requiring text extraction - [ComputerLab](<https://web.uettaxila.edu.pk/BMTD/images/labs/ComputerLab.jpg>) — The Computer Lab is an open, general-purpose and well-equipped lab providing computer technology as well as technological suppo...

_delta_note:_ Both are generic 'Computer Lab' infrastructure blurbs for Electronics and Biomedical departments - not Operating Systems, and not the Computer Science/Engineering department this query concerns.
_delta_provenance:_ LLM_JUDGED

---

## 23. What is the course outline for Database Systems at UET Taxila?

queryId: `0a6d92d625563c42`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidates 1/2 (DataBase Technology) are confirmed near-empty nav stubs. Candidate 3 (2014 Course Management System page) says 'This course will cover the following topics:' then cuts off with no topics listed (full text checked) - and it's unclear this 2014 CMS page is even for the Database Systems course specifically. Candidate 4 describes a different course ('Introduction to computing'). Candidate 5 explicitly says 'Information will be available soon.' No usable course outline anywhere in this top5.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - CPA: Programming Essentials in C++ Overview
      url: /downloadFiles/NARC/CPA%20Programming%20Essentials%20in%20Cplusplus%20Overview.pdf
      heading: **OVERVIEW** > Page 15 > **COURSE OUTLINE (cont.)**
      chunkKey: `7200c8c09cced315c9efc4066d6143befa306501b84eb4c5b511e0dcb34c58a7`
      text: Document Title: CPA: Programming Essentials in C++ Overview URL Path: /downloadFiles/NARC/CPA%20Programming%20Essentials%20in%20Cplusplus%20Overview.pdf ### **COURSE OUTLINE (cont.)**  - **7 – Exceptions**     - **what is an exception,**     - **catching and throwing exceptions,**     - **different classes exceptions and hierarchies,**     - **defining your own exceptions.**  - **8 – Operators and...

- [ ] **fused rank 4** - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-faqs.asp
      heading: **MS Data Science** > Frequently Asked Questions (FAQs)
      chunkKey: `796ec7e820929ef9216bb370273ad5c898b2f0f2234c692745a3cdb2b86104d5`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-faqs.asp CGPA of 2.0 or 60% marks and a qualifying test score (GRE/HAT/university-conducted) is required.  **3. What if I haven’t studied the required prerequisite courses?** Students missing core courses (Programming Fundamentals, Data Structures & Algorithms, Database Systems) must take defic...

_delta_note:_ Neither is a Database Systems outline - the C++ programming course outline is a different course entirely, and the MS Data Science FAQ names Database Systems only as a prerequisite-course label.
_delta_provenance:_ LLM_JUDGED

---

## 24. How do I contact the Dean of the Faculty of Engineering at UET Taxila?

queryId: `07002b9f761478bc`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked) near-empty department contact/nav stubs (Telecom Dean Message page has no actual dean name or contact info; Civil Eng student counseling, Industrial Eng, Alumni deputy director, and Electrical Eng contact pages are all different offices, not the Faculty of Engineering Dean specifically).

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila > Visual resources requiring text extraction - [bg 2](<https://web. uettaxila. edu. pk/alu...
      chunkKey: `f365b2f41b6c8686dae1189048ad023163e77546bf053802dde49840e7a2d06b`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm Alumni Association UET Taxila > Visual resources requiring text extraction - [bg 2](<https://web. uettaxila. edu. pk/alumni/images/bg_2. gif>) — Home About The Association Registration - Get Registered Working Committee FAQs - Question &amp; Answer Alumni Search/Update your record Job Opportunities Feedback &amp; Suggestions C...

- [ ] **fused rank 4** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila > Visual resources requiring text extraction - [bg 2](<https://web. uettaxila. edu. pk/alu...
      chunkKey: `9d19d311b2784e0c5f3fd965c4e069be107fb880a635f1a7db42ee3ca2786450`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm Alumni Association UET Taxila > Visual resources requiring text extraction - [bg 2](<https://web. uettaxila. edu. pk/alumni/images/bg_2. gif>) — Home About The Association Registration - Get Registered Working Committee FAQs - Question &amp; Answer Alumni Search/Update your record Job Opportunities Feedback &amp; Suggestions C...

_delta_note:_ Both are Alumni Association FAQ nav content, unrelated to the Dean of Engineering's contact information.
_delta_provenance:_ LLM_JUDGED

---

## 25. What is the email address of the CS department head at UET Taxila?

queryId: `809427d946da55fe`

_already relevant (from original review, kept as-is):_ 5 chunk(s) - 491f704ab013..., b5f7330baeaf..., 4aa06117613a..., 0e363892f9fb..., 7a01b32a0d20...
_original note:_ All 5 marked relevant: each states the department's real official contact channel - 'Email: helpdesk.cs@uettaxila.edu.pk, Phone: +92 (51) 9047846' (identical across all 5, confirmed by reading each). This is a shared departmental helpdesk address, not necessarily the individual chairman/head's personal email, but is the corpus's best available and genuinely correct answer to how to reach CS department leadership - no more specific 'head's personal email' exists anywhere in this top5.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila
      chunkKey: `e66b2ca560e34fdb217184043b98fbd32eb7cfd74befe6a74de8bbb671e704dc`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm your information. • a permanent e-mail forwarding address in the form of yourname@uett-alumni.com  • travel and relocation advice from members around the world • business card exchange where you can advertise and search for services and products offered by alumni • career advice for current students and graduates from alumni m...

- [ ] **fused rank 4** - Computer Science
      url: /CS/soch.asp
      heading: Computer Science > **COMPTECH (Society of Computer Technology)** > 2) Event Logging Team
      chunkKey: `c8a583f5a6d6b9f25a86788ba39ee24744e9c1cfe04b317df82feda38a80484a`
      text: Document Title: Computer Science URL Path: /CS/soch.asp ### 2) Event Logging Team  Another important facet of figuring out whether something should be permitted is to determine who is doing it. Events with Passion & Innovation that what we do. Head: Sana Mushtaq Co-head: Maryum Ahmed...

_delta_note:_ The Alumni chunk describes an alumni email-forwarding service, not the department; the COMTECH society chunk's 'Head' is a student-society office holder (Sana Mushtaq), not the CS department head/chairman - a false-friend keyword match on 'head', correctly distinguished.
_delta_provenance:_ LLM_JUDGED

---

## 26. Who is the Vice Chancellor of UET Taxila?

queryId: `0a5abd0e1ccc4e3a`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - b6e2619e6c2d...
_original note:_ Candidate 1 marked relevant: the dedicated 'VC Office' page states 'Prof. Dr. Muhammad Inayatullah Khan, Vice Chancellor... Email: vc@uettaxila.edu.pk' directly. Candidate 2 (2015 Syndicate meeting minutes) names a DIFFERENT, older VC ('Prof. Dr. Niaz Ahmad Akhtar') - a real but 11-year-stale historical document that would actively mislead if presented as the current answer; not marked, per the same best-available-current-answer reasoning applied to the fee-year conflicts. Candidates 3/4/5 (full text checked) state no VC name at all.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - UET, Taxila -Act-1994_Amended_Latest-2012.pdf
      url: /OR/downloads/publicinformationofficer/UET,%20Taxila%20-Act-1994_Amended_Latest-2012.pdf
      heading: **_<mark>(Last amended - 2012)</mark>_** > Page 11 > **<mark>10. Visitation:</mark>** > **<mark>11. Pro-Chancellor:</mar...
      chunkKey: `b7bf7a051de5a04db0743bc72341f8a4c59f1a3deb3c608c6f5af64d9a27b8dd`
      text: Document Title: UET, Taxila -Act-1994_Amended_Latest-2012.pdf URL Path: /OR/downloads/publicinformationofficer/UET,%20Taxila%20-Act-1994_Amended_Latest-2012.pdf ###### [5] **[12. Vice Chancellor:**  - <mark>(1) A person, who is eligible and who is not more than sixty five years of age on the last date fixed for submission of applications for the post of the Vice Chancellor</mark> may apply for the...

- [ ] **fused rank 4** - Department of Software Engineering, UET Taxila
      url: /SED/PhD-admission.asp
      heading: Department of Software Engineering, UET Taxila
      chunkKey: `0d74f2aecbe2fca49a167b4537383c0f084b72fc67652990aa77ae50dc330953`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/PhD-admission.asp Department of Software Engineering, UET Taxila    The Dean    shall depute two faculty members with Director PGS for scrutiny of applications.      The board of Postgraduate studies shall recommend the admission of the students and name of their    Supervisor's to the Director ASR&TD who shall obtain ap...

_delta_note:_ The UET Act excerpt states VC appointment ELIGIBILITY rules (age limit, application process for the post), not who currently holds the office; the SED PhD-admission chunk names the Dean, a different role, not the VC.
_delta_provenance:_ LLM_JUDGED

---

## 27. How can I contact the registrar office at UET Taxila?

queryId: `067a5f0f244a6e34`

_already relevant (from original review, kept as-is):_ 3 chunk(s) - a7e5a404a462..., beeeaca047e6..., 73e71c7d7418...
_original note:_ Candidates 1, 2, 3 marked relevant: each states the real Registrar Office contact - 'registrar@uettaxila.edu.pk, Ph: 051-9047406' (candidate 3 additionally names the actual Registrar, 'Khalid Mahmood'). Candidates 4/5 give the ADMISSIONS office email (ug.admission@uettaxila.edu.pk) under a 'Contact details' heading - a different office, not the registrar - not marked despite the misleading generic heading.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 1** - Home | Registrar Office, UET Taxila
      url: /OR/index.asp
      heading: Home | Registrar Office, UET Taxila
      chunkKey: `7f0662ebf824910b55a9cee95b9e6637db02c80d9defbc0fefa2f17b944096f1`
      text: Document Title: Home | Registrar Office, UET Taxila URL Path: /OR/index.asp # Home | Registrar Office, UET Taxila  Source: <https://web.uettaxila.edu.pk/OR/index.asp?pageLink=link_A>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [Contact Info](<https://web.uettaxila.edu.pk/OR/contact.asp>)  Visual resource: Registrar, UET Taxila  Registrar Office.  About Office  [...

- [ ] **fused rank 4** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > How can I contact the Admission Office?
      chunkKey: `c403164d2c6f07d789bc6ea898d263bdd3cfd0b9b1638264eddcba0e965db9a0`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## How can I contact the Admission Office?  **Email:** ug.admission@uettaxila.edu.pk **Phone:** +92-51-9047400–412 Office Timing: Monday to Friday (9:00 AM – 3:00 PM)...

_delta_note:_ Full-text lookup confirms the Registrar Office homepage states direct contact info - 'Dr. Mansoor A. Baluch, Registrar, Email: mansoor.baluch@uettaxila.edu.pk, Ph: 051-9047406, Fax: 051-9047420' - corroborating the phone number (051-9047406) already established as correct in the original review. Flagging a real discrepancy for the record, not resolved here: this chunk names a different Registrar (Dr. Mansoor A. Baluch) than the original review's candidate 3 (Khalid Mahmood) - likely two different real crawl snapshots of an office-holder change, not a fabrication; both share the same phone number. The Admission-Office FAQ candidate is not marked, per the original review's already-established registrar-vs-admissions-office distinction.
_delta_provenance:_ AUTHORITATIVE_SOURCE_MATCH (full chunk text fetched to confirm real contact details and cross-check the phone number against the original review's already-verified figure)

---

## 28. What is the phone number of UET Taxila main campus?

queryId: `1e3f0c84cff8af35`

_already relevant (from original review, kept as-is):_ 5 chunk(s) - 60cfadcc37bd..., b4222c5451c5..., 4738f2e1a87b..., 418d2e122542..., 04919b8122bc...
_original note:_ All 5 marked relevant: each states a real UET Taxila institutional phone number in the 051-9047400/420 range (the general/admissions/info lines), which is the corpus's correct and best-available answer to a query about the 'main campus' phone number - no single more authoritative 'the one main number' exists to prefer among them.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Prospectus-PG-2021-onwards.pdf
      url: /Downloads/PGAdmissions/Prospectus-PG-2021-onwards.pdf
      heading: Postgraduate PROSPECTUS 2021 Onwards > Page 6
      chunkKey: `7e44552a2f9c3cf75eeaa138f72fdab78d87b76e13c066d11d386ee10ba1d929`
      text: Document Title: Prospectus-PG-2021-onwards.pdf URL Path: /Downloads/PGAdmissions/Prospectus-PG-2021-onwards.pdf Postgraduate PROSPECTUS 2021 Onwards > Page 6  of the University Act, the Statutes and the Regulations are faithfully observed and implemented.  LOCATION M a The University campus is located on the outskirts of Taxila atadistance of5 km from the city.  It is situated near z, ane¥ Ls citi...

- [ ] **fused rank 4** - Minutes of the Meeting of Academic Council-32-2017.pdf
      url: /PageContents/MinutesofMeetings/Minutes%20of%20the%20Meeting%20of%20Academic%20Council-32-2017.pdf
      heading: NOMINATIONS ON THE BOARD OF FACULTIES, FACULTY OF M&AE s T&IE > Page 7 > ANNUAL REPORTS OF ACADEMIC DEPARTMENTS OF SUB C...
      chunkKey: `317209eb7b1570f5d5e2f498723611645a6bf43967526c3595b815c3759f964f`
      text: Document Title: Minutes of the Meeting of Academic Council-32-2017.pdf URL Path: /PageContents/MinutesofMeetings/Minutes%20of%20the%20Meeting%20of%20Academic%20Council-32-2017.pdf #### ANNUAL REPORTS OF ACADEMIC DEPARTMENTS OF SUB CAMPUS CHAKWAL  The Council deliberated on the following issues raised by the Campus Director, Sub Campus Chakwal:  1. Provision of free choice to the applicants seeking...

_delta_note:_ Neither states a phone number - one is a LOCATION passage (wrong fact, not a phone number), the other is Academic Council meeting minutes about Chakwal sub-campus nominations.
_delta_provenance:_ LLM_JUDGED

---

## 29. How do I apply for the HEC need-based scholarship at UET Taxila?

queryId: `0826c56fb3e9e670`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidate 1 (Alumni FAQ) describes how to join the ALUMNI ASSOCIATION (pay Rs.1000, register) - not the HEC scholarship, a misleading link-label match (full text checked). Candidate 3 genuinely IS the real 'notice-hec-needbased-scholarship-2019.pdf' document, but this chunk's OCR extraction is fully garbled past the office header - no legible application procedure survives in this chunk (full text checked), so despite being the right source document, it conveys no usable answer to 'how do I apply'. Candidates 2/4/5 are generic nav-link listings.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - notice-hec-needbased-scholarship-2019.pdf
      url: /PageContents/ScholarshipsNotices/notice-hec-needbased-scholarship-2019.pdf
      heading: HEC NEED BASED SCHOLARSHIP SESSION 2015-2017
      chunkKey: `6782cb5608f0be8f6a9794c4c50b09bb222d563988ea2da9ae02ed1e0a363427`
      text: Document Title: notice-hec-needbased-scholarship-2019.pdf URL Path: /PageContents/ScholarshipsNotices/notice-hec-needbased-scholarship-2019.pdf # HEC NEED BASED SCHOLARSHIP SESSION 2015-2017  The students of the session 2015-17 who had been recommended for grant of HEC Need Based Scholarship are required to submit their account No.of HBL to the “Dues & Scholarship Section” for the award of subject...

- [ ] **fused rank 4** - Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf
      url: /Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf
      heading: **Application Form Check List** > **46.** Details of Family Members Earning:
      chunkKey: `3fcbf5a940f3273f7ad29e98af44762eab10806ef41ff39a5d93f446c059c34b`
      text: Document Title: Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf URL Path: /Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf Please mentioned if the Family member supporting to Family in Remarks Column (Yes/No)  - *** Family Member Occupation classification 1. Government Service (Specify the employment grade BPS/SPS/PTC etc.) 2. Private Job 3. Agriculture/Farming 4. Own Bus...

_delta_note:_ The 2019 HEC scholarship notice (now legibly OCR'd, unlike the original review's garbled candidate 3) describes a post-award bank-account submission step for students ALREADY granted the scholarship in the 2015-17 session - not the application procedure a new applicant needs; the application-form checklist chunk is a generic family-income disclosure field, not an application procedure either. Neither answers 'how do I apply'.
_delta_provenance:_ LLM_JUDGED

---

## 30. What merit scholarships are available for top students at UET Taxila?

queryId: `ed64320d24518201`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidate 2 genuinely IS the real 'MeritScholarships-Spring-Semester-2019.pdf' document, but like query 29's candidate 3, its OCR extraction is fully garbled ('wow uertanllaaduph', full text checked) - no legible scholarship information survives. Candidate 1 is a bare nav-link fragment (full text checked). Candidates 3/4/5 are generic nav-link listings (Honhaar Scholarship verification notice), not actual merit-scholarship content.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Policy for Students with Disabilities 2021- Amended.pdf
      url: /Downloads/Policies/Policy%20for%20Students%20with%20Disabilities%202021-%20Amended.pdf
      heading: **3. THE ACCESSIBILITY COMMITTEE AND DISABILITY COORDINATORS** > Page 5
      chunkKey: `9a84f832d30b1c83f103eff219ac53d684e1edd19cf5d4e23747159e618b338b`
      text: Document Title: Policy for Students with Disabilities 2021- Amended.pdf URL Path: /Downloads/Policies/Policy%20for%20Students%20with%20Disabilities%202021-%20Amended.pdf Accessibility Committee: The Accessibility Committee shall</u> be responsible for the following:     - a. determining what accommodations are needed for students with disabilities at the HEI including, where necessary, arranging f...

- [ ] **fused rank 4** - UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA
      url: /OR/downloadFiles/Final_ANNUAL_REPORT_13-14.pdf
      heading: **4.5 Achievements of Foreign Faculty** > Page 77 > **Chapter 15 Health Centre/Medical Facilities**
      chunkKey: `e37fa5390558479b461e45817852fe83c5178ed1aaf240d3db72f8908cdb05e0`
      text: Document Title: UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA URL Path: /OR/downloadFiles/Final_ANNUAL_REPORT_13-14.pdf keeping registers. Yearly audit of clinic was done by internal and external audit committees.  Activities regarding health awareness programmes are planned to be arranged in collaboration with world renowned organizations at regular intervals. Following facilitation services ar...

_delta_note:_ Neither addresses merit scholarships - one is the Disabilities Policy's Accessibility Committee responsibilities (a different, disability-specific support structure), the other is a 2013-14 annual report's health-centre/medical-facilities section (topic mismatch, no merit-scholarship content).
_delta_provenance:_ LLM_JUDGED

---

## 31. Is there a fee waiver program for financially needy students at UET Taxila?

queryId: `4b515ce39511ff1b`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - 9e8723a93be0...
_original note:_ Candidate 2 marked relevant: a real official notice from the Dues & Financial Aid Services Office, subject "WAIVER OFF TUITION FEE TO THE STUDENTS BELONGING TO FLOOD HIT AREAS" (confirmed via full chunk text) - genuinely on-topic, though the OCR/table extraction is badly garbled (a separate extraction-quality issue, not a relevance issue) and it's a category-specific 2023 waiver (flood-hit areas), not a general need-based program - narrower than what "financially needy" asks for. Candidate 1 (annual report noting ~20% of budget comes from tuition) describes institutional funding, not a student-facing waiver program - not marked. 3/4/5 are nav-link/advertisement stubs, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 2** - Progress_Report_UETTaxila-14-15.pdf
      url: /OR/downloadFiles/reports/Progress_Report_UETTaxila-14-15.pdf
      heading: **PROGRESS REPORT** > Page 29
      chunkKey: `73c5f654fd6fd7482328b06e7a819dbddae7cf3791f2e760a0cd4585c3db601d`
      text: Document Title: Progress_Report_UETTaxila-14-15.pdf URL Path: /OR/downloadFiles/reports/Progress_Report_UETTaxila-14-15.pdf ## Page 29  5.2 **<u>Students Scholarship</u>** . Rs. 10,000/- and 6,000 were paid to 1<sup>st</sup> and 2<sup>nd</sup> position holders in a semester however, this was found to be very meager amount for appreciation. Therefore, fee waiver has been revised as under:-:-  i. 1<...

- [ ] **fused rank 4** - Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf
      url: /Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf
      heading: **Deed of agreement For Undertaking a Course of Studies**
      chunkKey: `3d5128c75c3faf9fe0fca44e704b7a4dac1fd6998d6e61cecd13af8a2f818083`
      text: Document Title: Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf URL Path: /Application-Form-for-HEC-Needs-Based-Scholarship-Program.pdf **Deed of agreement For Undertaking a Course of Studies**  at any other scholarship scheme the student will immediately report the same at the university. ** iv) In case the scholar fails to qualify the course/degree for which he/she was awarded schol...

_delta_note:_ Full-text lookup confirms this 2014-15 progress report describes a real, general need-based fee-concession program - '100%/75%/50% tuition fee waiver' for top position holders plus 'fee concession to needy students enhanced from 10% to 20% of total class strength' and Rs. 53.674 million paid to 729 needy students - a genuinely on-topic, arguably broader answer than the original review's narrower flood-specific 2023 waiver notice. The HEC application-form checklist candidate is unrelated boilerplate, not marked.
_delta_provenance:_ LLM_JUDGED

---

## 32. Where is the UET Taxila main campus located?

queryId: `92caae0e08262a70`

_already relevant (from original review, kept as-is):_ 4 chunk(s) - fb432fb00678..., da2a62794a68..., 28656442d346..., f6007caa2525...
_original note:_ Candidates 1, 2, 4, 5 marked relevant: four independent documents (Prospectus 2024, Prospectus 2025, Discover.php, and a 2013-14 annual report) all state consistent, corroborating location facts - '5 km from Taxila city, near Mohra Shah Wali Shah railway station on the Taxila-Havelian branch line, 35 km from Islamabad/Rawalpindi on the Rawalpindi-Peshawar highway' - cross-checked against each other, unlike fee figures this kind of geographic fact does not go stale year to year. Candidate 3 (CEOtalks) is a confirmed near-empty stub, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 5** - About us
      url: /AboutUs
      heading: About us > Visual resources requiring text extraction - [Advertisements](<https://web.uettaxila.edu.pk/images/Menu/menuA...
      chunkKey: `981573423e72d2aeffa1425b345bb294051d0c751ac1bb9d87ee05d1187636ac`
      text: Document Title: About us URL Path: /AboutUs About us > Visual resources requiring text extraction - [Advertisements](<https://web.uettaxila.edu.pk/images/Menu/menuAdvertisement.jpg>) — Advertisements — Admissions - [pageImg1](<https://web.uettaxila.edu.pk/PageContents/aboutus/pageImg1.jpg>) — The University campus is located on the outskirts of Taxila at a distance of 5 km from the city. It is sit...

_delta_note:_ The AboutUs page states the identical core location fact already cross-corroborated in the original review - '5 km from the city' - from a fifth independent page.
_delta_provenance:_ AUTHORITATIVE_SOURCE_MATCH (corroborates the distance figure already cross-checked across 4 independent sources in the original review)

---

## 33. Does UET Taxila have a student hostel on campus?

queryId: `e1d169833b2c6fe2`

_already relevant (from original review, kept as-is):_ 5 chunk(s) - ecb02a527482..., 5a235ddd3d18..., 1471c5193327..., f535f741a88a..., e5a1a739dcb8...
_original note:_ All 5 marked relevant: five independent pages all confirm hostels exist on campus ('hostels, library, sports...', 'Hostel accommodation is available at campus for students' x2, 'student hostels, guesthouse... are housed on campus', 'Discover departments, hostels...') - cross-checked against each other, all consistent, a simple yes/no fact well-supported across the corpus.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 2** - Progress_Report_UETTaxila-14-15.pdf
      url: /OR/downloadFiles/reports/Progress_Report_UETTaxila-14-15.pdf
      heading: **PROGRESS REPORT** > Page 30 > 5.8 **<u>Purchase of New Transport</u>** . Following vehicles are in the purchase proces...
      chunkKey: `12649df966b6d49c0cab78818792affc237db9ae391381f0992a322e20bb1c1a`
      text: Document Title: Progress_Report_UETTaxila-14-15.pdf URL Path: /OR/downloadFiles/reports/Progress_Report_UETTaxila-14-15.pdf at UET Taxila and Chakwal Campus to overcome the residential problem of faculty and students:-     - i. 300 Boys Hostel at UET Taxila     - ii. 24 x Faculty Flats at UET Taxila     - iii. 100 Boys Hostel at Chakwal Campus     - iv. Faculty Hostel at Chakwal Campus  5.11 **<u>...

- [ ] **fused rank 4** - Prospectus-PG-2021-onwards.pdf
      url: /Downloads/PGAdmissions/Prospectus-PG-2021-onwards.pdf
      heading: Postgraduate PROSPECTUS 2021 Onwards > Page 6
      chunkKey: `7e44552a2f9c3cf75eeaa138f72fdab78d87b76e13c066d11d386ee10ba1d929`
      text: Document Title: Prospectus-PG-2021-onwards.pdf URL Path: /Downloads/PGAdmissions/Prospectus-PG-2021-onwards.pdf Postgraduate PROSPECTUS 2021 Onwards > Page 6  of the University Act, the Statutes and the Regulations are faithfully observed and implemented.  LOCATION M a The University campus is located on the outskirts of Taxila atadistance of5 km from the city.  It is situated near z, ane¥ Ls citi...

_delta_note:_ The 2014-15 progress report states a specific, real hostel fact - '300 Boys Hostel at UET Taxila' plus a planned '100 Boys Hostel at Chakwal Campus' - corroborating and specifying the already-established 'yes, hostels exist' fact. The Postgraduate Prospectus candidate is about campus location (same LOCATION chunk seen elsewhere), not hostels - not marked.
_delta_provenance:_ LLM_JUDGED

---

## 34. What transport facilities does UET Taxila provide for students?

queryId: `bb92759aba56e8f6`

_already relevant (from original review, kept as-is):_ 2 chunk(s) - d2fcfbfa12f8..., 02fd6588dc61...
_original note:_ Candidates 1, 2 marked relevant: both state real, detailed transport information - 'Adequate transport facility is provided for students and the busses are plying between Rawalpindi, Islamabad, Hassan Abdal, Wah Cantt...'. Candidate 3 (full text checked) is the HOSTEL/library facilities chunk of the same document, not the transport-specific chunk - wrong facility, not marked. Candidate 4 (Bus_Route.php) is confirmed (full text checked) a near-empty header stub despite the document itself genuinely being about bus routes (see query 35's candidate 2, a different chunk of this same page, which does have real timing content) - this specific chunk has no content. Candidate 5 is a generic explore.php stub.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila
      chunkKey: `5f17ce948b89dcdb2e49f7f8f95d99feab050f70a1b2a551d029dacf7c0d67bf`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm - Frequently Asked Questions**  **• [What is the Alumni Assciation of UET Taxila?](<#1>)  • [How do I become a member of the Alumni Association?](<#2>)  • [What can the Association do for me?](<#3>)  • [What is an Alumni Benefits Card?](<#4>)  • [How can I get involved with my Alumni Association?](<#5>)  • [How does the Alumni...

- [ ] **fused rank 4** - Policy for Students with Disabilities 2021- Amended.pdf
      url: /Downloads/Policies/Policy%20for%20Students%20with%20Disabilities%202021-%20Amended.pdf
      heading: **4. ADMISSIONS-RELATED MATTERS** > Page 8
      chunkKey: `a865a1229fd572763d7ecf401247258c9d338894a90059a29a6f8a1cb15597a4`
      text: Document Title: Policy for Students with Disabilities 2021- Amended.pdf URL Path: /Downloads/Policies/Policy%20for%20Students%20with%20Disabilities%202021-%20Amended.pdf for students with disabilities on their prospectus, website, and advertisement for admission.     - f. In case, the HEI does not have appropriate facilities to provide reasonable accommodations for students with disabilities to st...

_delta_note:_ Neither addresses transport - the Alumni chunk is a bare FAQ topic-link list, the Disabilities Policy chunk is about accommodations disclosure, not general student transport.
_delta_provenance:_ LLM_JUDGED

---

## 35. What is the library timing at UET Taxila?

queryId: `f86cfd8aa6d35c49`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidate 1 (Library Rules) and candidate 3 (Library page) are confirmed (full text checked) nav-link listings with no timing stated. Candidate 2 (Bus_Route.php) has a real timing TABLE, but it's a bus schedule, not library hours - wrong topic despite containing times. Candidate 4 is a confirmed near-empty stub. Candidate 5 (AskLibrarian) is confirmed (full text checked) a nav-link listing, no hours stated. No candidate states actual library opening hours.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Department of Mechanical Engineering, UET Taxila
      url: /MED/news26.asp
      heading: Department of Mechanical Engineering, UET Taxila
      chunkKey: `7b56e94dae60576c388bc8f74c77f5739e9a64b6bb7d1dbaa6c4133575d519b2`
      text: Document Title: Department of Mechanical Engineering, UET Taxila URL Path: /MED/news26.asp in Pakistan manufacturing industry and has become synonymous with the word quality assurance.  Keeping in view the epidemic, IMechE organized this seminar by following the SOPs. Initially Students displayed their machine design projects and industrial expert gave valuable feedback. Later Mr.Asim delivered a ...

- [ ] **fused rank 4** - About
      url: /iat/index.asp
      heading: About > Cadence University Program Member
      chunkKey: `a15694659884f9b2aefc0c9a1779026e8e3f7355fc5010d02f5ce5aaa110353b`
      text: Document Title: About URL Path: /iat/index.asp and low-voltage design, leakage management, impact of PVT variations on timing and robustness.  The faculty of Telecommunication & Information Engineering in UET, Taxila has taken an initiative to become part of 21st century IC design revolution by establishing Institute of Applied Technologies IC Design Centre whose sole purpose is to prepare the stu...

_delta_note:_ Neither states library hours - one is a Mechanical Engineering seminar recap (SOPs, machine-design projects), the other is an IC-design-centre About page.
_delta_provenance:_ LLM_JUDGED

---

## 36. Where do I submit form 17-B for clearance at UET Taxila?

queryId: `136c2516eded904b`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidates 1/2 (Examination FAQ) describe a general 'Degree-Transcript-SGS-Provisional' form submission process, not confirmed to be specifically 'Form 17-B' - the query names a specific form number this corpus gives no way to independently verify, so matching a generic form-submission answer to it risks being wrong rather than merely incomplete. Candidates 3/5 are broken 'POST form destination' link fragments. Candidate 4 is about visa/residence-permit timing, unrelated.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Admission_Guidelines_2023.pdf
      url: /Downloads/Admission_Guidelines_2023.pdf
      heading: Admission_Guidelines_2023.pdf > **28** **<u>How to Complete and Submit the Application Form (F-I)?</u>**
      chunkKey: `1e5e1ef3488fd2bd561db76f2ddfeff9ff9d33d00c049eab6014fd81e3b51da1`
      text: Document Title: Admission_Guidelines_2023.pdf URL Path: /Downloads/Admission_Guidelines_2023.pdf ## **28** **<u>How to Complete and Submit the Application Form (F-I)?</u>**  Only online filled application forms will be accepted. A candidate can fill in the application form.  (F-I), available online at: admissions.uettaxila.edu.pk  While filling the FORM (F-I) please read the following instructions...

- [ ] **fused rank 4** - Admission_Guidelines_2023.pdf
      url: /Downloads/Admission_Guidelines_2023.pdf
      heading: Admission_Guidelines_2023.pdf > Page 1
      chunkKey: `675a37c274a3a4b4510d2e311ae6284455f90bc2403360edff1519667ed507b0`
      text: Document Title: Admission_Guidelines_2023.pdf URL Path: /Downloads/Admission_Guidelines_2023.pdf ## Page 1  The online application should be submitted as early as possible. Please do not wait for the last date.  The merit lists will be displayed showing the percentage of the applicants admitted in different disciplines against different categories on the notified date and time.  All documents to b...

_delta_note:_ Both Admission_Guidelines_2023 candidates describe the ONLINE ADMISSION APPLICATION form (F-I) - a different form from the '17-B clearance' form the query names - not marked, consistent with the original review's caution against confidently matching a specific named form this corpus can't independently verify.
_delta_provenance:_ LLM_JUDGED

---

## 37. Is CS-301 equivalent to SE-301 at UET Taxila?

queryId: `c6d36166ce93efaf`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - none of the 5 (explore.php nav stub, an SED registration-schedule stub, an unrelated MoU announcement, a 'Why UET Taxila' accreditation blurb, and a near-empty Discover fragment) address course-code equivalence between CS-301 and SE-301 at all. This may genuinely not be answerable from this corpus.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - The University is organizing its 21 st Convocation-2024 on 05-06 January-2024 at UET Taxila.
      url: /21stConvocation2024
      heading: The University is organizing its 21 st Convocation-2024 on 05-06 January-2024 at UET Taxila. > University Medalists
      chunkKey: `4fe51670bece41e5b3e602c2a1a65f931d68e8fa8fdf64d6f1d5d5fc8c74d19a`
      text: Document Title: The University is organizing its 21 st Convocation-2024 on 05-06 January-2024 at UET Taxila. URL Path: /21stConvocation2024 Silver Medal  Visual resource: 19 CP 49  7  2019-UET/SE-22  Abdullah  UET Taxila Silver Medal  8  2019-UET/TE-17  Maisa Rasool Khan  UET Taxila Silver Medal  9  2019-UET/CS-30  Laraib Fatima  UET Taxila Silver Medal  Visual resource: 19 CS 30  Sr. No.  Reg. No...

- [ ] **fused rank 4** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 93
      chunkKey: `3e6fcac011b60dc7979e094d8257081db0295a4aeee40816d3480f86066fbd53`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf Architecture Lab|1| **Semester Total**|**17**| **Total for Second Year**|**33**|  **Semester - V**  |**Course Code**|**Course Title**|**Credit Hours**| |---|---|---| |MA-301|Numeric and Symbolic Computing|3| |SE-302|Software Construction and Development|2| |SE-302-L|Software Construction and Development Lab|1| |SE...

_delta_note:_ Neither addresses CS-301/SE-301 equivalence - the convocation medalist list only shows student registration-number prefixes (SE-22, CS-30 etc., unrelated to course-code equivalence), and the Prospectus semester-V table lists SE-302 through SE-305, not CS-301 or SE-301 at all. This still appears genuinely unanswerable from this corpus, consistent with the original review's note.
_delta_provenance:_ LLM_JUDGED

---

## 38. What is the procedure to apply for a degree certificate at UET Taxila?

queryId: `21ce9642f1250090`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - a79924742cd7...
_original note:_ Candidate 2 marked relevant: Examination FAQ states directly - 'How to apply for the Degree? A Degree can be received from Examination Branch UET Taxila by submitting Degree-Transcript-SGS-Provisional etc. Form...'. Candidate 1 is a confirmed near-empty stub. Candidate 3 (FAQ 'How can I apply for Undergraduate Admissions') is about ADMISSION application, not the degree certificate - wrong topic despite the keyword overlap on 'apply'. Candidates 4/5 are confirmed nav stubs/link listings.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `608165094f6c8b23bab789c81b280cb897327318fb66cf10476a953badea8176`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  paying prescribed fee @ per semester.   - [How to apply for a particular Bonafied Certificate?  ](<#questionul>) - A Bonafied Certificate can be received from Examination Branch UET Taxila by submitting “Degree-Transcript- SGS-Provisio...

- [ ] **fused rank 4** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila
      chunkKey: `916b1b237f7cb8369eceeffdc956ec1dcc1d1b2c5579a7cbfe38c24e80026f34`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm of the university, and inspire feelings of loyalty and pride among alumni and current students.  **How do I become a member of the Alumni Association?**  Once you graduate from UET Taxila with a degree, certificate or diploma, you are automatically a lifetime member of the Alumni Association of UET Taxila. There is no annual f...

_delta_note:_ Full-text lookup shows this Examination FAQ chunk's own heading is specifically 'How to apply for a particular Bonafied Certificate' - a different certificate from the DEGREE certificate the query asks about, despite reusing similar Form-H submission mechanics text; not marked, applying the same certificate-type precision the original review used to distinguish admission vs. degree applications. The Alumni FAQ candidate ('once you graduate... automatically a lifetime member') is about alumni membership, not a certificate application procedure.
_delta_provenance:_ LLM_JUDGED

---

## 39. Can I freeze my semester at UET Taxila and what is the procedure?

queryId: `9a07498d5501476c`

_already relevant (from original review, kept as-is):_ 3 chunk(s) - 132cc45bfc91..., 1bfe40dd95c2..., f5ec67ad032d...
_original note:_ Candidates 2, 3, 4 marked relevant: candidate 2 (Examination FAQ) states 'If student has some valid reasons and want to get freeze one or Two Consecutive Semesters then Student can apply for...'; candidate 3 (FORM UG-V) states the form is 'To be submitted to the Chairman of Concerned Department'; candidate 4 (a different chunk of the same freezing-form PDF as candidate 1) states the actual rules ('Students will be allowed to freeze a semester only once...'). Candidate 1 (full text checked) is a header-only chunk of that same PDF with no rules content, not marked. Candidate 5 (Seminars.aspx) is unrelated campus-life content.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila
      chunkKey: `5f17ce948b89dcdb2e49f7f8f95d99feab050f70a1b2a551d029dacf7c0d67bf`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm - Frequently Asked Questions**  **• [What is the Alumni Assciation of UET Taxila?](<#1>)  • [How do I become a member of the Alumni Association?](<#2>)  • [What can the Association do for me?](<#3>)  • [What is an Alumni Benefits Card?](<#4>)  • [How can I get involved with my Alumni Association?](<#5>)  • [How does the Alumni...

- [ ] **fused rank 4** - Alumni Association UET Taxila
      url: /alumni/faq.htm
      heading: Alumni Association UET Taxila > Visual resources requiring text extraction - [bg 2](<https://web. uettaxila. edu. pk/alu...
      chunkKey: `f365b2f41b6c8686dae1189048ad023163e77546bf053802dde49840e7a2d06b`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/faq.htm Alumni Association UET Taxila > Visual resources requiring text extraction - [bg 2](<https://web. uettaxila. edu. pk/alumni/images/bg_2. gif>) — Home About The Association Registration - Get Registered Working Committee FAQs - Question &amp; Answer Alumni Search/Update your record Job Opportunities Feedback &amp; Suggestions C...

_delta_note:_ Both Alumni FAQ candidates are topic-link lists (membership, benefits card, involvement), unrelated to the semester-freeze procedure.
_delta_provenance:_ LLM_JUDGED

---

## 40. What is the grading system used at UET Taxila?

queryId: `6988aa3c5815e338`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidate 1 is a confirmed near-empty Discover fragment. Candidate 2 ('Evaluation System') is a teaching/course feedback system contact stub, not the academic grading system - wrong topic despite the 'evaluation' keyword overlap. Candidates 3/4/5 are confirmed near-empty admissions stubs. No candidate states the actual grading system used.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Annual Report Cover Pages(2022-2023).pdf
      url: /MED/technicalsocieties/IMeche/Annual%20Report%20Cover%20Pages(2022-2023).pdf
      heading: **<u>Industrial Visit to Coronet Food Limited</u>** > **<u>Date: 06-06-2022</u>**
      chunkKey: `3c37fba0004a0c89c90cb91d58a83bad0c47f791b31c627d1b3c58a1194add9c`
      text: Document Title: Annual Report Cover Pages(2022-2023).pdf URL Path: /MED/technicalsocieties/IMeche/Annual%20Report%20Cover%20Pages(2022-2023).pdf #### **<u>Date: 06-06-2022</u>**  **IMechE Student Chapter** at UET Taxila organized a tour at **Coronet Foods Limited o** n **6**<sup>**th**</sup> **June 2023.** The main aim of this industrial visit is to provide exposure to students about practical wor...

- [ ] **fused rank 4** - Course Management System
      url: /CMS/AUT2013/ieWSMEbs/index.asp
      heading: **UET Taxila**
      chunkKey: `9c20c86e98a4b6e65d50dd5b1e44e3bc412a736e443d006369ff999131d0be71`
      text: Document Title: Course Management System URL Path: /CMS/AUT2013/ieWSMEbs/index.asp # **UET Taxila**  http://www.uettaxila.edu.pk  **Welcome to the course website.**  Visual resource: 0  Course Management System - UET Taxila  **COURSE DESCRIPTION**  Course gives fundamental concepts and techniques to analyze the work and find ways to improve the methods used.  Visual resource: 0  **Course Links**  ...

_delta_note:_ Neither states the grading system - one is an IMechE industrial-visit recap, the other is a 2013 Course Management System's generic welcome/description page.
_delta_provenance:_ LLM_JUDGED

---

## 41. daakhila ki akhri tarikh kab hai UET Taxila mein?

queryId: `d9fc562f95137dc3`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked in query 42/43's identical candidates, or directly here) near-empty stub pages. No admission deadline date stated.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Aqsa ki Pukar
      url: /DSA/SocietyEventDetails
      heading: Aqsa ki Pukar
      chunkKey: `600a24fc072266a4e03fd3ad8c1de1d49a1f7eac27c10dc4752eb6cd6207bfe5`
      text: Document Title: Aqsa ki Pukar URL Path: /DSA/SocietyEventDetails # Aqsa ki Pukar  Source: <https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=44>  **University of Engineering and Technology, Taxila**  Directorate Of Student Affairs...

- [ ] **fused rank 4** - AQSA KI PUKAR (Palestine Walk)
      url: /DSA/SocietyEventDetails
      heading: AQSA KI PUKAR (Palestine Walk)
      chunkKey: `02e43b61eaec86257686ff74cf61bc9fab23ad96fdfde6040857eae3490824f3`
      text: Document Title: AQSA KI PUKAR (Palestine Walk) URL Path: /DSA/SocietyEventDetails # AQSA KI PUKAR (Palestine Walk)  Source: <https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=30>  **University of Engineering and Technology, Taxila**  Directorate Of Student Affairs...

_delta_note:_ Both are unrelated Directorate of Student Affairs society-event pages (a Palestine solidarity walk), consistent with this query's cross-lingual retrieval-gap pattern.
_delta_provenance:_ LLM_JUDGED

---

## 42. fees jama karwane ka tariqa kya hai UET Taxila mein?

queryId: `b87404f973dbea76`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all are near-empty navigation stub pages (title + source URL + a bare "Visual resource" line, no substantive content), confirmed by reading the chunk text directly. Likely a cross-lingual gap: this Roman Urdu query embeds/matches poorly against these thin English stub pages rather than against any real payment-procedure content in the corpus.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Admission_Guidelines_2023.pdf
      url: /Downloads/Admission_Guidelines_2023.pdf
      heading: Admission_Guidelines_2023.pdf > **22 Seats Allocation Chart**
      chunkKey: `97a7d36f1467e07c0b16fc66de0547cfa257b06eb82243d8c3ce5f2ea765f256`
      text: Document Title: Admission_Guidelines_2023.pdf URL Path: /Downloads/Admission_Guidelines_2023.pdf Admission_Guidelines_2023.pdf > **22 Seats Allocation Chart**  Admission is granted in each category on merit, subject to eligibility under relevant Section. **Categories**|**Civil**|**Electrical**|**Mechanical**|**Computer**|**Software**|**Telecom**|**Electronics**|**Industrial**|**Environmental**|**C...

- [ ] **fused rank 4** - Discover UET Taxila
      url: /Discover.php
      heading: UET Taxila Admissions > Official resources - [Discover UET Taxila UET Taxila Admissions University of Engineering &amp; ...
      chunkKey: `d335472b52f99caf8d8d7a0d35c8906939b9b18c7c7d981626c096782530dc38`
      text: Document Title: Discover UET Taxila URL Path: /Discover.php UET Taxila Admissions > Official resources - [Discover UET Taxila UET Taxila Admissions University of Engineering &amp; Technology Taxila Undergraduate Admissions Home Discover Merit List Fee Structure Fees Engineering Programs Fees For Technology Programs Seats Seats Allocation Applicants From Punjab Province Partial-Subsidized Applicant...

_delta_note:_ Neither states a payment procedure - the Admission Guidelines candidate is a seat-allocation-by-category chart, and the Discover.php candidate is a nav-menu link list ('Fee Structure', 'Fees Engineering Programs' as labels only, no actual procedure text) - consistent with the original review's cross-lingual-stub finding for this query.
_delta_provenance:_ LLM_JUDGED

---

## 43. chuttiyan kab hongi UET Taxila mein?

queryId: `1591838299e34517`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all confirmed (full text checked) near-empty stub pages or a one-off event page (CEOtalks, PEC_visit_env index stubs, Convocations 'Life at UET Taxila' fragment). No holiday/break dates stated.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Prospectus 2026 onward 16-7-26.cdr
      url: /Downloads/PGAdmissions/Prospectus-PG-2026-onward.pdf
      heading: Prospectus 2026 onward 16-7-26.cdr > Page 16
      chunkKey: `22d9801ec2a5cf97cc3502140454c5b83f67a2e5a3029a1cd937e5ca32485b52`
      text: Document Title: Prospectus 2026 onward 16-7-26.cdr URL Path: /Downloads/PGAdmissions/Prospectus-PG-2026-onward.pdf (UET Taxila) M.Sc. Engg. (UET Taxila) PhD (UET Taxila)  Water Resources & Irrigation Engineering  Dr. Kashif Riaz B.Sc. Engg. (UET Taxila) M.Sc. Engg. (UET Taxila) PhD (UET Taxila) Dr. Rana Muhammad Waqas B.Sc. Engg. (UET Taxila) M.Sc. Engg. (UET Taxila) PhD (UET Taxila) Dr. Hammad Ra...

- [ ] **fused rank 4** - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 31 > **Assistant Professors** > **Dr. Aamir Rashid** > **Lecturers** > **Dr. M....
      chunkKey: `bcd24ad51165e062d1e5ef98a49aea70869c6d03b6396ad2a109df8f3afe0f4f`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Dr. M. Mansoor Ashraf**  BSc Eng. (UET, Taxila) MSc Eng. (UET, Taxila) PhD (UET, Taxila)  **Engr. Abubakar Waqas** BSc Eng. (UET, Taxila) MSc Eng. (UET, Taxila)  **Dr. Faisal Siddiq** BSc Eng. (UET, Taxila) MSc Eng. (UET, Taxila) PhD (UET, Taxila)  **Dr. Nouman Qamar** BSc Eng. (UET, Taxila) MSc Eng. (UET...

_delta_note:_ Both are faculty-CV listing pages from postgraduate prospectuses, unrelated to holiday/break dates.
_delta_provenance:_ LLM_JUDGED

---

## 44. UET Taxila mein hostel ki fees kitni hai?

queryId: `57aa4c0c6221f855`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - these are hostel administration/facilities pages and an alumni-event page, none state a hostel fee amount. The real hostel charges (Hostel Security 8,000, Mess Security 8,000, Room Rent 5,000, etc. - Prospectus Table 30.1's "Additional for Hostel Resident" section) exist in the corpus but were not retrieved for this query.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 1** - Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students
      url: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students
      heading: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Official resources - [Under Implementation](<http...
      chunkKey: `03d37693a9f4e8bb803034436c1add5df9474cd6c9b87d1847b64a9d9905fe1b`
      text: Document Title: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students URL Path: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (documen...

- [ ] **fused rank 2** - Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students
      url: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students
      heading: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Official resources - [Under Implementation](<http...
      chunkKey: `bad3d7685f3b66873c9e29c05af72e143ef67c9aa57dffa57636749109fc8523`
      text: Document Title: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students URL Path: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (documen...

- [ ] **fused rank 3** - Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students
      url: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students
      heading: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Official resources - [Under Implementation](<http...
      chunkKey: `8dc76acb131cb67942db2677b1893a9b26cda339b787e0fd4557948be73c37ba`
      text: Document Title: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students URL Path: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (documen...

- [ ] **fused rank 5** - SocietyDetails
      url: /DSA/societydetails
      heading: SocietyDetails > Character Building Society (CBS)
      chunkKey: `cb587c85f079a9730d0945e5488585b5666b2d850509ced8d46ff1ad61cabbe3`
      text: Document Title: SocietyDetails URL Path: /DSA/societydetails | --- | | Society Faculty Body | | --- | | Events | | | --- | | [Visit to HEC Auditorium for recording of HUM TV show "Subha se Agey"](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=7>)  11-01-2024 | | [Al-Aqsa ki Pukar aur Hamara Kirdar - Solidarity Walk](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societ...

_delta_note:_ All three Iftar-Dinner-event chunks (same event page) and the Character Building Society events list are unrelated to hostel FEES specifically - none states a charge amount. The real hostel charges (Table 30.1's 'Additional for Hostel Resident' section) still were not retrieved by any channel for this query.
_delta_provenance:_ LLM_JUDGED

---

## 45. admission k liye zaruri documents kya hain?

queryId: `a670a78c21212bf6`

_already relevant (from original review, kept as-is):_ 2 chunk(s) - 72dfb5b6f233..., 1030850755a8...
_original note:_ Candidates 1, 4 marked relevant: candidate 1 (FAQ) states the real general UG document list directly - 'Original + attested photocopies of SSC, HSSC/DAE, TCAT/ECAT result card, CNIC/Form-B, Father's CNIC, Domicile, photographs'. Candidate 4 (condensed maths admission form) states a real, substantively similar document list for that specific program - 'Photocopy of SSC & HSSC, ID card/Form B, Passport-Sized Photograph, Original Paid Bank Challan', corroborating candidate 1's core list. Candidates 2/3/5 (Admission_Guidelines_2023.pdf, full text checked) are section headers cut off before any actual document list - a chunking-boundary issue, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 1** - Documents_Submission_Schedule_2026_Session.pdf
      url: /Downloads/Documents_Submission_Schedule_2026_Session.pdf
      heading: **<u>SCHEDULE FOR ORIGINAL DOCUMENTS SUBMISSION / HOSTEL ACCOMODATION (FALL - 2026 ADMISSION)</u>** > Page 2
      chunkKey: `04a9ad0b6370a0b4fed776e31b26a97d88cee12bb5f25e02b019d37a4603aaac`
      text: Document Title: Documents_Submission_Schedule_2026_Session.pdf URL Path: /Downloads/Documents_Submission_Schedule_2026_Session.pdf ## Page 2  Note –  1: - The following documents must be submitted along with the original documents. Failure to provide any of the documents listed below may result in the cancellation of your admission offer.  Note – 2: -  - i. Set – I (Get it verified from window 4 o...

- [ ] **fused rank 3** - Rules_Regulations_PhD_ProspectusPG.pdf
      url: /PageContents/Rules/Rules_Regulations_PhD_ProspectusPG.pdf
      heading: <mark>5</mark> > Page 2
      chunkKey: `7cccd5d43ef84b4703dec04e2da3058c5e99d9526f43a389bd47eb08a9847042`
      text: Document Title: Rules_Regulations_PhD_ProspectusPG.pdf URL Path: /PageContents/Rules/Rules_Regulations_PhD_ProspectusPG.pdf to fulfill the requirement for PhD admission only. He will pay prescribed fee for the course/s.     - k. A PhD scholar is required to complete 18 credit hours of PhD level course work in consent with his supervisor after registration in PhD.     - l. The university shall coll...

_delta_note:_ Full-text lookup confirms this Documents_Submission_Schedule_2026 chunk is a real, detailed itemized post-merit document checklist (Application form print, CNIC/B-Form, Matric certificate, HSSC/DAE result, Domicile certificate, Entry Test result, Call letter, Father's CNIC) - directly on-topic and corroborates/extends the already-established document list from the original review's two relevant candidates. The PhD Rules candidate is about PhD-specific credit-hour/fee rules, not a document checklist, and not the general-admission scope this query asks about - not marked.
_delta_provenance:_ AUTHORITATIVE_SOURCE_MATCH (full chunk text fetched to confirm the itemized document list, corroborating the original review's already-verified document requirements)

---

## 46. eligibility criteria

queryId: `26e877048af0f6ee`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - 7b6c2da68f14...
_original note:_ Candidate 5 marked relevant: although this chunk's body text is just a nav link, its own DOCUMENT TITLE field (as crawled) states real, correct eligibility information directly - 'Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.)' - a genuine eligibility fact a retrieval system would surface as the source title. Candidates 1-4 (full text checked) are headers/nav links/narrow category footnotes with no general eligibility criteria stated.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Department of Software Engineering, UET Taxila
      url: /SED/events13.asp
      heading: Department of Software Engineering, UET Taxila > Visual resources requiring text extraction - [001](<https://web.uettaxi...
      chunkKey: `0e2158efe612dd1cb090ff32dcafff31b05359924cd8e44349e283bc5dfa2c53`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/events13.asp Department of Software Engineering, UET Taxila > Visual resources requiring text extraction - [001](<https://web.uettaxila.edu.pk/SED/images/events/event13/001.jpg>) — Intrasols pvt ltd visited software dept on 5th April 2018. They conducted interviews for following post. Job type : Paid internship leading t...

- [ ] **fused rank 4** - Department of Software Engineering, UET Taxila
      url: /SED/events13.asp
      heading: Department of Software Engineering, UET Taxila > Visual resources requiring text extraction - [001](<https://web.uettaxi...
      chunkKey: `1e7297fd0bcc2b0445f716ffff3ecd3668fd23d15310972a8d5db7d8bcd4dbbb`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/events13.asp Department of Software Engineering, UET Taxila > Visual resources requiring text extraction - [001](<https://web.uettaxila.edu.pk/SED/images/events/event13/001.jpg>) — Intrasols pvt ltd visited software dept on 5th April 2018. They conducted interviews for following post. Job type : Paid internship leading t...

_delta_note:_ Both SED events13.asp chunks (same internship-recruitment posting) are unrelated to admission eligibility criteria.
_delta_provenance:_ LLM_JUDGED

---

## 47. important dates

queryId: `f3d60458e68e2e86`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant - all 5 are specific student-society or campus-event date listings (Auto Show, Culture Day, blood donation drives, an inauguration ceremony), not academic-calendar or admission 'important dates' - a bare 2-word query like this most plausibly means academic/admission deadlines, which none of these candidates address, consistent with how query 17's and 43's near-identical event-page candidates were treated.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 2** - UET Taxila Undergraduate Admissions
      url: /Schedule.php
      heading: UET Taxila Undergraduate Admissions > Admission Schedule
      chunkKey: `b5bb836b20b655ec592639db601c090fc0d896de48ab0a4e34f6b7eee7b6f246`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Schedule.php ### Admission Schedule  Entry Fall 2026 – Important Dates & Deadlines...

- [ ] **fused rank 4** - Purple Photography Workshop Trifold Brochure
      url: /PageContents/1stICACEE/1stICACEE-Brochure.pdf
      heading: CONTACT US > Page 2 > <u>IMPORTANT DATES</u>
      chunkKey: `1a2a0ad826897420566df1326844e431a9e3752b14dfeded507a619be162355e`
      text: Document Title: Purple Photography Workshop Trifold Brochure URL Path: /PageContents/1stICACEE/1stICACEE-Brochure.pdf ### <u>IMPORTANT DATES</u>  SUBMISSION OF PAPER  (MAXIMUM 05 PAGES):  **31ST DECEMBER, 2021**  NOTIFICATION OF ACCEPTANCE:  **25TH JANUARY, 2022**...

_delta_note:_ Same 'Admission Schedule Entry Fall 2026 - Important Dates & Deadlines' chunk already marked relevant for query 17's identical broad 'important dates' interpretation - marked here too for consistency. The conference-paper-submission-deadline candidate (ICACEE Brochure) has an 'IMPORTANT DATES' heading but is for an unrelated academic conference's own 2021/2022 paper deadlines, not university dates - a false keyword match, not marked.
_delta_provenance:_ LLM_JUDGED

---

## 48. contact number

queryId: `a694cc1c788c4df0`

_already relevant (from original review, kept as-is):_ 5 chunk(s) - 15aa1d8d47c0..., 3c2c9d32d949..., fe430112f351..., 08267cc90657..., c2faac008d55...
_original note:_ All 5 marked relevant: each states the real UET Taxila general contact number, 'Phone: +92 51-9047-400' (several also list +92 51-9047-420), consistently across five independent pages - a correct, well-supported answer to a bare 'contact number' query.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 2** - Untitled-1
      url: /techJournal/2017/No4/TECHNICAL_JOURNAL_VOL_22_NO_4.pdf
      heading: ~~<u>Section B</u> ELECTRICAL AND ELECTRONICS~~ <u>ENGINEERING</u> > Page 91 > <u>Instruction for authors for publishing...
      chunkKey: `803c4e7251b17bad938dbc02d6a5eed6dec61d58be1b159e99540d27824d8677`
      text: Document Title: Untitled-1 URL Path: /techJournal/2017/No4/TECHNICAL_JOURNAL_VOL_22_NO_4.pdf ###### **<u>Tables</u>**  <u>Tables should be typed in a separate file using M.S.</u> Word 'table' option. All tables should be numbered in ~~Roman numerals consecutively. Tables should have a~~ caption in Upper Case, must be centered and in 8 pt. consisting of the table number and brief title. This ~~numb...

- [ ] **fused rank 4** - Untitled-1
      url: /techJournal/2017/No4/TECHNICAL_JOURNAL_VOL_22_NO_4.pdf
      heading: ~~<u>Section B</u> ELECTRICAL AND ELECTRONICS~~ <u>ENGINEERING</u> > Page 91 > <u>Instruction for authors for publishing...
      chunkKey: `11258309726bdf5146c070e97d47a66c2f7364934b1dd71a9c16e93b48ffdc22`
      text: Document Title: Untitled-1 URL Path: /techJournal/2017/No4/TECHNICAL_JOURNAL_VOL_22_NO_4.pdf Use zero before decimal places: “0.24” not ~~“.24”.~~  - Avoid contractions; for example, write “do  ~~All figures should be at least 300 dpi in JPG format. It is~~ to be also ensured that lines are thick enough to be reproduced conveniently after size reduction at the ~~stage of composing. All figures (gr...

_delta_note:_ Both Technical Journal candidates are author-formatting instructions (table/figure conventions), unrelated to any contact number.
_delta_provenance:_ LLM_JUDGED

---

## 49. how to apply

queryId: `876b5dc3e98c81ea`

_already relevant (from original review, kept as-is):_ none
_original note:_ None of the 5 relevant. Candidates 1/2 (full text checked) are bare section-title fragments with no procedural content. Candidates 3/4/5 (Examination FAQ) list real 'how to apply for X' links, but all for exam-related services (Re-Mid, I-Grade, grade sheets, transcripts) - a bare 'how to apply' query from a prospective student's perspective most plausibly means the UG admission application, which none of these address; treated consistently with query 47's genericquery judgment.

New candidates (rank in fused top-5, never shown to a labeler before):

- [ ] **fused rank 5** - Microsoft Word - IEEE Student Branch UET Taxila Annual Report 2018.docx
      url: /ieee/Downloads/IEEE_branch_2018_Annual_Report.pdf
      heading: **EVENT DETAILS IEEE Student Branch UET Taxila** > Page 6 > **Event:** **<u><mark>Seminar on Application, Guidance & Opp...
      chunkKey: `bd0e7da4063f867918c891fd9c682982821e797175336f633f1f30cffbecb193`
      text: Document Title: Microsoft Word - IEEE Student Branch UET Taxila Annual Report 2018.docx URL Path: /ieee/Downloads/IEEE_branch_2018_Annual_Report.pdf ##### **General Information:**  |**Event Scopes**|**Branch**| |---|---| |**Event Type**|**Non-Technical**| |**Total Participants**|**50**| |**Total IEEE Members Participated**|**50**| |**Dates**|**23, 25/01/18**| |**Goals / Milestones achieved by orga...

_delta_note:_ Full-text lookup confirms this IEEE annual-report chunk is a 2018 seminar event summary about applying for study-abroad opportunities/scholarships - a specific student-society event, not the UG admission application procedure this query most plausibly asks about, consistent with query 47's generic-query interpretation.
_delta_provenance:_ LLM_JUDGED

---

## 50. fee structure

queryId: `2dfb5097fc1ca481`

_already relevant (from original review, kept as-is):_ 1 chunk(s) - f6c98d25d491...
_original note:_ Candidate 2 marked relevant: real fee-structure content (refund-policy rules from the Rule Book's "Fees and other Charges" section) - broad "fee structure" query, this genuinely qualifies. Candidate 1 is the section heading only (chunk cuts off before any numbers - a real chunking-boundary issue, not a relevance call). Candidate 3 has real but 11-year-stale (2014) and badly OCR-garbled figures, not marked given how outdated/unreliable. Candidate 4 is a conference-registration fee tutorial, wrong topic. Candidate 5 is a dues-notice listing stub, not marked.

New candidates (rank in fused top-5, never shown to a labeler before):

- [x] **fused rank 2** - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What is the fee structure for the first semester?
      chunkKey: `047ea82187b988440580aa7760da5ee71889c0eb0a0896d05b5c12b45a2b6183`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What is the fee structure for the first semester?  • Regular (Subsidized) ≈ Rs. 104,800 (without hostel) • Partial-Subsidized (S & X categories) ≈ Rs. 339,800+ Exact fee is mentioned in the prospectus and on the fee structure page....

- [ ] **fused rank 4** - 1stICACEE-2022_Proceedings.pdf
      url: /PageContents/1stICACEE/1stICACEE-2022_Proceedings.pdf
      heading: Conference Proceedings > Page 119 > **Economization of Stiffeners Considering Near- Fault Ground Motion Effects on Confi...
      chunkKey: `44322626d94f0977d9103331b9e003897f50c40b370dedd25f90f5c4891743d1`
      text: Document Title: 1stICACEE-2022_Proceedings.pdf URL Path: /PageContents/1stICACEE/1stICACEE-2022_Proceedings.pdf Conference Proceedings > Page 119 > **Economization of Stiffeners Considering Near- Fault Ground Motion Effects on Confined Brick Masonry Structures** > **ABSTRACT** > **1 INTRODUCTION**  ###### **1 INTRODUCTION**   Masonry structures are mostly used in the world for residential purposes...

_delta_note:_ Same FAQ fee-structure chunk marked relevant for query 1 (Rs. 104,800/Rs. 339,800+ first-semester figures) - directly on-topic for this broader 'fee structure' query too. The conference-proceedings candidate (masonry-structures research abstract) is an unrelated civil-engineering paper, a coincidental keyword match on 'structure', not marked.
_delta_provenance:_ LLM_JUDGED

---
