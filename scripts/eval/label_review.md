# Label review - mandate §47 real HUMAN_VERIFIED query/label set

For each query, the top 5 candidates are nearest-neighbor matches from exact
cosine search (HEURISTIC provenance - not a relevance judgment). Mark each `[ ]`
as `[x]` ONLY for chunks that genuinely, correctly answer the query. Leave `[ ]`
for irrelevant ones. If NONE of the 5 are correct, say so in a note rather than
checking one anyway - a missing answer is more honest than a wrong one. Add a
one-line note under any query where something is off (ambiguous query, all
candidates wrong, etc.) so it carries into the final set.

When done, run `parse_label_review.py` to produce the real, provenance-labeled
golden set from your marks.

**2026-08-31 addendum - the 11 fee/charges queries (nos. 1-7, 31, 42, 44, 50)
were reviewed by the AI, not the user.** The user could not answer most of
these from personal knowledge ("most of the answer I dont know It is very
difficult task for me") and asked the AI to carry this. Rule applied
uniformly: **relevant = this chunk is the corpus's best available answer**,
not "states the currently-correct 2026 figure" - the true 2026 fee page is
behind an applicant-portal login this project cannot and should not reach, so
almost nothing in the corpus can be judged against it. A chunk citing 2025's
or 2024's real, correctly-extracted figures is marked relevant on that basis;
a chunk that is off-topic, empty, or wrong-fee-category is not, regardless of
its similarity score. Each of these 11 queries carries an explicit
`_provenance:_` line: `AUTHORITATIVE_SOURCE_MATCH` where the judgment came
from cross-checking a second, independent source (the visually-verified
Prospectus PDF page image, the 2024/2025 table comparison, the FAQ figures);
`LLM_JUDGED` where it came from reading the one candidate chunk against the
query with no independent cross-check practical or available - the weaker
category, used honestly rather than dressed up. These 11 do NOT count toward
a HUMAN_VERIFIED set and should not be described as such in any downstream
report. The remaining 39 queries are still open for the user's own review,
default provenance HUMAN_VERIFIED, no rule change.

---

## 1. What is the fee structure for BS Software Engineering at UET Taxila?

queryId: `8fe9e8f2dfe15d2e`

- [ ] **candidate 1** (score 0.7988) - Department of Software Engineering, UET Taxila
      url: /SED/PG-fee.asp
      heading: Department of Software Engineering, UET Taxila
      chunkKey: `73013e45ac0a8d6d271f6d29a459152945d83a69536abe113ef847b35135d5c5`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/PG-fee.asp # Department of Software Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/SED/PG-fee.asp>  Untitled Document  **University of Engineering and Technology, Taxila**  Visual resource: UET Taxila  [Quick Links](<https://web.uettaxila.edu.pk/SED/quickLinks.asp>)  [Contact Info](<https://web.uettaxila....

- [ ] **candidate 2** (score 0.7653) - Department of Software Engineering, UET Taxila
      url: /SED/PhD-admission.asp
      heading: Department of Software Engineering, UET Taxila
      chunkKey: `08e11f9fada79dceb862bb6253e69dc60c96854b0bb9ac0f300e6fb78afbe0b3`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/PhD-admission.asp by the Director ASR&TD by paying full fee on semester basis as prescribed by the university.   10....

- [ ] **candidate 3** (score 0.7626) - Department of Software Engineering, UET Taxila
      url: /SED/newssestic.asp
      heading: Department of Software Engineering, UET Taxila > Official resources - [Fee](<https://web.uettaxila.edu.pk/SED/UG-fee.asp...
      chunkKey: `538f04e55d143eab5ca5ca549d9a686fe1feb6c24e847be75b43b9f99779aacc`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/newssestic.asp Department of Software Engineering, UET Taxila > Official resources - [Fee](<https://web.uettaxila.edu.pk/SED/UG-fee.asp>) - [Results](<https://web.uettaxila.edu.pk/Results.aspx>) - [Registration](<https://web.uettaxila.edu.pk/UETsub/examination/examViewDtSregS.asp?frm_cate=Registration%20Schedule%20BSc>) ...

- [ ] **candidate 4** (score 0.7625) - Department of Software Engineering, UET Taxila
      url: /SED/newssestic2.asp
      heading: Department of Software Engineering, UET Taxila > Official resources - [Fee](<https://web.uettaxila.edu.pk/SED/UG-fee.asp...
      chunkKey: `c2da4330d73b7080e7efd4380521b422aa9f5678dcffc6eb7ef6d0c426fdcebd`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/newssestic2.asp Department of Software Engineering, UET Taxila > Official resources - [Fee](<https://web.uettaxila.edu.pk/SED/UG-fee.asp>) - [Results](<https://web.uettaxila.edu.pk/Results.aspx>) - [Registration](<https://web.uettaxila.edu.pk/UETsub/examination/examViewDtSregS.asp?frm_cate=Registration%20Schedule%20BSc>)...

- [ ] **candidate 5** (score 0.7624) - Department of Software Engineering, UET Taxila
      url: /SED/newssew1.asp
      heading: Department of Software Engineering, UET Taxila > Official resources - [Fee](<https://web.uettaxila.edu.pk/SED/UG-fee.asp...
      chunkKey: `562d4ff2db8c3e53fd51c833210cf9b8aeec45ca568bd970d43a263c321bfd41`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/newssew1.asp Department of Software Engineering, UET Taxila > Official resources - [Fee](<https://web.uettaxila.edu.pk/SED/UG-fee.asp>) - [Results](<https://web.uettaxila.edu.pk/Results.aspx>) - [Registration](<https://web.uettaxila.edu.pk/UETsub/examination/examViewDtSregS.asp?frm_cate=Registration%20Schedule%20BSc>) - ...

_note:_ None of the 5 relevant - all are SED nav/PG-admission stubs (PG-fee.asp, PhD-admission.asp, or bare "Fee" link labels with no content), not the UG fee structure. The real answer (Prospectus Table 30.1, university-wide by category, not by department/program) exists in the corpus but was not retrieved for this query.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (checked against the Prospectus 2024/2025 Table 30.1 content, visually verified against the source PDF page image earlier this session)

---

## 2. How much does a student pay per semester in BS Computer Science?

queryId: `74c9b0d4368cc597`

- [ ] **candidate 1** (score 0.6621) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 107 > **Courses Under Semester System BSc Computer Science**
      chunkKey: `a482af051ae78e23b79ab75d79e663a46f56575855be4cf5f4fb1ef0343d3c1e`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Courses Under Semester System BSc Computer Science**...

- [ ] **candidate 2** (score 0.6568) - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **4 Faculty of Industrial Engineering** > Page 107 > **Courses Under Semester System BSc Computer Science**
      chunkKey: `594948699286e930bfef8b9b8ae5bd6ffdd98e13c8ee997821c5bd665e88824f`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf ###### **Courses Under Semester System BSc Computer Science**...

- [ ] **candidate 3** (score 0.6449) - Bachelor of Science in Computer Science
      url: /cs/bsCS.asp
      heading: **Bachelor of Science in Computer Science** > **Job Market for Computer Scientists** > **Curriculum:**
      chunkKey: `c34064eaf9ed88a349b2021f2e3cb2e3116936715fc0dc6a22eb423164565bc1`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /cs/bsCS.asp ### **Curriculum:**  **Courses Under Semester System**...

- [ ] **candidate 4** (score 0.6437) - Bachelor of Science in Computer Science
      url: /CS/bsCS.asp
      heading: **Bachelor of Science in Computer Science** > **Job Market for Computer Scientists** > **Curriculum:**
      chunkKey: `949279a6fb6616a837cfd94f54e76cdc3239a1ee9958275d6e2db44dbf64988e`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /CS/bsCS.asp ### **Curriculum:**  **Courses Under Semester System**...

- [ ] **candidate 5** (score 0.6415) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 106 > **Laboratories** > **Society Mission & Objectives** > **Events Organized*...
      chunkKey: `d370f50c85e6d3ff17a335282486c2d2a65f36859567a877d05eb0a06f3f84a3`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Courses of Study**  - To complete the BS Computer Science degree:     - 1) The minimum credit hours shall be 134 including computing related courses.     - 2) The program shall comprise 8 semesters spread over 4 year with two semesters a year.  In all matters regarding courses of study and others, the dep...

_note:_ None of the 5 relevant - all are curriculum/courses-of-study content (credit hours, course lists), not fee amounts. "Semester" matched on the academic-calendar sense, not the fee-payment sense. The real Table 30.1 tuition figures (38,000/130,000 per semester, Subsidized/Partial-Subsidized, same for all programs) were not retrieved.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (checked against Prospectus 2024/2025 Table 30.1, visually verified against the source PDF page image earlier this session)

---

## 3. What is the total tuition cost for a 4-year BS program at UET Taxila?

queryId: `fc1c0652eda046e9`

- [ ] **candidate 1** (score 0.6788) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

- [ ] **candidate 2** (score 0.6700) - UET Taxila UG Admissions
      url: /ProcedureAndRequirements2.php
      heading: UET Taxila UG Admissions
      chunkKey: `7a3156675bf22e1742af21f2f38ad80ac867d7794a3b549e92a188f95e00433f`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProcedureAndRequirements2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ProcedureAndRequirements2.php>...

- [ ] **candidate 3** (score 0.6696) - Department of Basic Sciences, UET Taxila
      url: /bsd/teachingSchedulePG.asp
      heading: Department of Basic Sciences, UET Taxila
      chunkKey: `ca96eb44be062baa26fe7390c779d7492579fea25fd10dcd92e7a210a28b0935`
      text: Document Title: Department of Basic Sciences, UET Taxila URL Path: /bsd/teachingSchedulePG.asp # Department of Basic Sciences, UET Taxila  Source: <https://web.uettaxila.edu.pk/bsd/teachingSchedulePG.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [UET  [Contact Info](<https://web.uettaxila.edu.pk/bsd/contact.asp>)  **POSTGRADUATE PROGRAM**  Information will be...

- [ ] **candidate 4** (score 0.6673) - Department of Basic Sciences, UET Taxila
      url: /BSD/UG.asp
      heading: Department of Basic Sciences, UET Taxila
      chunkKey: `9ccf8e2fa1c1bfb2e1f7d60fcf5ad599f738fb89d7171e9021cf32c4b3f2dd8a`
      text: Document Title: Department of Basic Sciences, UET Taxila URL Path: /BSD/UG.asp # Department of Basic Sciences, UET Taxila  Source: <https://web.uettaxila.edu.pk/BSD/UG.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [UET  [Contact Info](<https://web.uettaxila.edu.pk/BSD/contact.asp>)  **UNDERGRADUATE PROGRAM**  - BS Mathematics[Semester-wise Plan](<https://web....

- [ ] **candidate 5** (score 0.6672) - UET Taxila UG Admissions
      url: /ProcedureAndRequirements2.php
      heading: UET Taxila Admissions > University of Engineering & Technology Taxila
      chunkKey: `b7ca5395d472fffbce9a5b7f2877b08c86814a80337f49ce9080cbe5fcb610c5`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProcedureAndRequirements2.php ## University of Engineering & Technology Taxila...

_note:_ None of the 5 relevant - candidate 1 is a near-empty "Discover UET Taxila" campus-life fragment (confirmed by reading the full chunk, not just the preview); candidates 2/5 (ProcedureAndRequirements2.php) are confirmed near-empty stubs (full text is just the title + source URL, checked directly); 3/4 are Basic Sciences PG/UG program pages, not fees. The Prospectus's "Grand Total of 4 years" row is itself blank in the 2025 edition's source PDF (confirmed by visual page inspection) and has real values only in the 2024 edition (654,000/1,453,000) - neither was retrieved here, and neither would be the true 2026 answer regardless.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (checked against Prospectus 2024/2025 Table 30.1, visually verified against the source PDF page image earlier this session)

---

## 4. Are there any additional charges apart from tuition in UET Taxila fee structure?

queryId: `d9ad8a444d6c7741`

- [ ] **candidate 1** (score 0.6835) - Why UET Taxila?
      url: /whyus.php
      heading: Why UET Taxila? > Global Recognition > Why Students Choose UET Taxila > Affordable Excellence
      chunkKey: `73ce047edb4008ce197d3c5cf14012f5daf0e7dd4ca38d60a9efe47f2ce2aa39`
      text: Document Title: Why UET Taxila? URL Path: /whyus.php #### Affordable Excellence  Subsidized fees with generous scholarships including Honhaar Scholarship. Best value engineering education in Pakistan....

- [ ] **candidate 2** (score 0.6696) - UET Taxila UG Admissions
      url: /ContactUs.php
      heading: UET Taxila UG Admissions
      chunkKey: `6cac46287dd7852d3bda0f66a760a2d7e606807ce57fee80d9286b4d08541b94`
      text: Document Title: UET Taxila UG Admissions URL Path: /ContactUs.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ContactUs.php>...

- [ ] **candidate 3** (score 0.6696) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 4** (score 0.6691) - Discover UET Taxila
      url: /Discover.php
      heading: UET Taxila Admissions > Official resources - [Discover UET Taxila UET Taxila Admissions University of Engineering &amp; ...
      chunkKey: `d335472b52f99caf8d8d7a0d35c8906939b9b18c7c7d981626c096782530dc38`
      text: Document Title: Discover UET Taxila URL Path: /Discover.php UET Taxila Admissions > Official resources - [Discover UET Taxila UET Taxila Admissions University of Engineering &amp; Technology Taxila Undergraduate Admissions Home Discover Merit List Fee Structure Fees Engineering Programs Fees For Technology Programs Seats Seats Allocation Applicants From Punjab Province Partial-Subsidized Applicant...

- [ ] **candidate 5** (score 0.6649) - UET Taxila UG Admissions
      url: /ContactUs.php
      heading: UET Taxila Admissions > University of Engineering & Technology Taxila
      chunkKey: `8e1fc606c5ec5ff5d1d6c9d89ff8bac34b7cfaa7c7544f1309505d6527621116`
      text: Document Title: UET Taxila UG Admissions URL Path: /ContactUs.php ## University of Engineering & Technology Taxila...

_note:_ None of the 5 relevant - candidate 1 is a marketing blurb ("Subsidized fees with generous scholarships"), not an itemized charge list; 2/3/5 are generic admin/schedule pages with no fee content; candidate 4's "Fee Structure / Fees Engineering Programs / Fees For Technology Programs" text is nav-menu link labels, not actual charge content. The real itemized "other charges" (registration, sports, magazine, medical, lab, exam, book bank, tour, recreation, campus, digital library charges - all listed in Table 30.1) were not retrieved.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (checked against Prospectus 2024/2025 Table 30.1, visually verified against the source PDF page image earlier this session)

---

## 5. What is the fee difference between engineering and computer science programs?

queryId: `e1f643e47aede4e3`

- [ ] **candidate 1** (score 0.6246) - Programs
      url: /Programs.aspx
      heading: Programs > **Academics** > Undergraduate Programs > Doctoral Programs > Taxila Campus
      chunkKey: `02a83a101cbda158371defb21a7584acacc4b239154bd2ea1c86a6995164fb22`
      text: Document Title: Programs URL Path: /Programs.aspx ##### Taxila Campus  > **»** Civil Engineering > > **»** Computer Engineering > > **»** Electrical Engineering > > **»** Electronics Engineering > > **»** Mechanical Engineering > > **»** Telecommunication Engineering  Images courtesy: [https://www.freepik.com/](<https://www.freepik.com/>)  [Scroll](<#>)...

- [ ] **candidate 2** (score 0.6245) - Choose Your Program Category
      url: /My_UET.php
      heading: Choose Your Program Category > BSc Engineering & BS Computer Science
      chunkKey: `2886ef826a6586ce1557d404ddd43f22a3ae1ae1277d35b3d96551cb8cfd7a4d`
      text: Document Title: Choose Your Program Category URL Path: /My_UET.php #### BSc Engineering & BS Computer Science  For candidates who have appeared in ECAT/ TCAT / Equilant Entry Test  Action: Apply Now (Group 01)...

- [ ] **candidate 3** (score 0.6184) - Programs
      url: /programs/
      heading: Programs > **Academics** > Undergraduate Programs > Doctoral Programs > Taxila Campus
      chunkKey: `951802928a97f125d12e4dc981296336af34a3de2c56ca1a102977694c5e96ec`
      text: Document Title: Programs URL Path: /programs/ ##### Taxila Campus  > **»** Civil Engineering > > **»** Computer Engineering > > **»** Electrical Engineering > > **»** Electronics Engineering > > **»** Mechanical Engineering > > **»** Telecommunication Engineering  Images courtesy: [https://www.freepik.com/](<https://www.freepik.com/>)  [Scroll](<#>)...

- [ ] **candidate 4** (score 0.5983) - Programs
      url: /Programs.aspx
      heading: Programs > **Academics** > Undergraduate Programs > Taxila Campus
      chunkKey: `f688c1d459c2b1c3e1729729b71ad35db9ef2073f8396b029ff7aec58223d397`
      text: Document Title: Programs URL Path: /Programs.aspx ##### Taxila Campus  > **»** Civil Engineering > > **»** Environmental Engineering > > **»** Computer Engineering > > **»** Electrical Engineering > > **»** Electronics Engineering > > **»** Mechanical Engineering > > **»** Industrial Engineering > > **»** Software Engineering > > **»** Telecommunication Engineering > > **»** Metallurgy and Materia...

- [ ] **candidate 5** (score 0.5961) - Programs
      url: /Programs.aspx
      heading: Programs > **Academics** > Undergraduate Programs > Master Degree Programs > Taxila Campus
      chunkKey: `cb6a315433b42b34711471fac967067a62c08a0e5bb2e7dc917664cb9a6c7276`
      text: Document Title: Programs URL Path: /Programs.aspx ##### Taxila Campus  > **Civil Engineering** > > **»** Structural Engineering > > **»** Water Resources & Irrigation Engineering > > **»** Transportation Engineering > > **»** Soil Mechanics & Foundation Engineering  > **Computer Engineering** > > **»** Digital Image Processing > > **»** Computer Engineering  > **Engineering Management**  > **Elect...

_note:_ None of the 5 relevant - all are plain department/program listing pages (names only), none discuss fees. The true answer, verified against Table 30.1: there is NO fee difference by program - the published fee schedule is university-wide, differentiated only by admission category (Subsidized vs Partial-Subsidized), not by Engineering vs Computer Science. None of the 5 candidates state this.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (checked against Prospectus 2024/2025 Table 30.1's category structure, visually verified against the source PDF page image earlier this session)

---

## 6. How can I pay my semester fee at UET Taxila?

queryId: `6f79337e4985ea52`

- [x] **candidate 1** (score 0.7373) - fee for Session 22 (7th) 23 (5th) 24 (3rd)
      url: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf
      heading: University of Engineering Engineering and Technology Taxila > Page 2 > DUES NOTICE
      chunkKey: `019e75af934e50252dcf8498a967749e5bed789308421c6372ba6bd9026df7d2`
      text: Document Title: fee for Session 22 (7th) 23 (5th) 24 (3rd) URL Path: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf #### DUES NOTICE  It is hereby informed to all students of UET Taxila of 2023-Session (5"" Semester) that please deposits their dues upto 29.08.2025 (Friday) in the following Bank/Branch, System generated fee Challan can be...

- [ ] **candidate 2** (score 0.6937) - fee for Session 22 (7th) 23 (5th) 24 (3rd)
      url: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf
      heading: University of Engineering Engineering and Technology Taxila
      chunkKey: `ac2f10660ca28a0e47ad7e26b9e88ec591faaf063e2a86baa846feec024be561`
      text: Document Title: fee for Session 22 (7th) 23 (5th) 24 (3rd) URL Path: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf # University of Engineering Engineering and Technology Taxila  Noi UET/D&FASO2S/_ O96 Dated: 28.07.2025...

- [ ] **candidate 3** (score 0.6928) - Condensed_Course_Ad_2026.pdf
      url: /Downloads/Condensed_Course_Ad_2026.pdf
      heading: FORM LINK: > PROCEDURE FOR ONLINE REGISTRATION:
      chunkKey: `28596a605f45070c7b9541ffdbf656b726ce18fbbf1ed66ae44af4cacbe830b0`
      text: Document Title: Condensed_Course_Ad_2026.pdf URL Path: /Downloads/Condensed_Course_Ad_2026.pdf ### PROCEDURE FOR ONLINE REGISTRATION:  4. Applicants are advised to download the form UET Taxila websiteadmissions.uettaxila.edu.pk, Course fee Rs: 20,500/deposited HBL, UET Taxila branch university main account, title; “UET Taxila Recurring (1916790021 3601). Submit the completed form along with fee de...

- [ ] **candidate 4** (score 0.6921) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Four Days Workshop on Wireless Communications > Official resources - [Under Implementation](<https://web.uettaxila.edu.p...
      chunkKey: `018ff629cf095f6f32bbb18f70fd9877b8b56215be63547cd4424064228e7be4`
      text: - [How to Apply](<https://admissions.  uettaxila.  edu.  pk/ProcedureAndRequirements.  php>) - [Online Admissions](<https://admissions.  uettaxila.  edu.  pk/My_UET.  php>) - [Categories &amp; Seats](<https://admissions.  uettaxila.  edu.  pk/Seats_Allocation.  php>) - [Fee](<https://admissions.  uettaxila.  edu.  pk/Fees....

- [ ] **candidate 5** (score 0.6906) - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > How can I apply for Undergraduate Admissions at UET Taxila?
      chunkKey: `549036e9c37315e68fec9ae6c06d62c1a0a05d7e9fb50f4aaa9b25a5c14995f1`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## How can I apply for Undergraduate Admissions at UET Taxila?  Visit the official admission portal **admissions.uettaxila.edu.pk** and click on “MY UET”. Register using your CNIC/Form-B number, fill the online application form, and deposit the Rs. 4000 application processing fee through HBL Konnect or Internet Banking....

_note:_ Candidate 1 marked relevant: full chunk text (checked directly, not just the preview) confirms a real payment method - "Bank of Punjab (ERP Generated Challan Only)". Candidate 2 is the same document's title/date header only, no procedure - not marked despite being the same PDF. Candidate 5 (FAQ) describes the *application processing* fee's payment method (HBL Konnect/Internet Banking), not the *semester* fee the query asks about - a different, adjacent fee category, not marked. Candidates 3/4 are for a specific condensed-course fee / a bare nav link, not marked.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked for this specific procedural fact)

---

## 7. Is there a fine for late fee submission at UET Taxila?

queryId: `a4d3227f8a1b046e`

- [ ] **candidate 1** (score 0.7087) - fee for Session 22 (7th) 23 (5th) 24 (3rd)
      url: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf
      heading: University of Engineering Engineering and Technology Taxila > Page 2 > DUES NOTICE
      chunkKey: `019e75af934e50252dcf8498a967749e5bed789308421c6372ba6bd9026df7d2`
      text: Document Title: fee for Session 22 (7th) 23 (5th) 24 (3rd) URL Path: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf #### DUES NOTICE  It is hereby informed to all students of UET Taxila of 2023-Session (5"" Semester) that please deposits their dues upto 29.08.2025 (Friday) in the following Bank/Branch, System generated fee Challan can be...

- [ ] **candidate 2** (score 0.6685) - fee for Session 22 (7th) 23 (5th) 24 (3rd)
      url: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf
      heading: University of Engineering Engineering and Technology Taxila
      chunkKey: `ac2f10660ca28a0e47ad7e26b9e88ec591faaf063e2a86baa846feec024be561`
      text: Document Title: fee for Session 22 (7th) 23 (5th) 24 (3rd) URL Path: /PageContents/DuesSection/Dues-Notice-(2024%203rd-Semester),(2023%205th-Semester),(2022%207th-Semester).pdf # University of Engineering Engineering and Technology Taxila  Noi UET/D&FASO2S/_ O96 Dated: 28.07.2025...

- [ ] **candidate 3** (score 0.6639) - UET Taxila Undergraduate Admissions
      url: /Downloads.php
      heading: UET Taxila Undergraduate Admissions > Prospectus > Admission Forms
      chunkKey: `5dc5996c2be8011b3546106233b998c3fc3f412f3c0f20defe046a3c5c1c2407`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Downloads.php permit / visa must be valid at least up till the closing date of submission of applications)...

- [ ] **candidate 4** (score 0.6611) - UET Taxila UG Admissions
      url: /ProspectusAvailability.php
      heading: UET Taxila Admissions > Availability of the Prospectus
      chunkKey: `c45444bc7b602c7c32149b74f1ad1e207869a7fa2d971ce89fb92e633490ebda`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProspectusAvailability.php + Processing Fee)  | **Sr.#** | **Location** | | --- | --- | | 1 | Admission Office, UET Taxila |  **TCS Centers :**  Click the link below to find the nearest TCS center for submission of application processing fee RS.1500/- (Rs. 1450/- Application Processing Fee + Rs. 50/- TCS Charges) and obtain computerized deposit s...

- [x] **candidate 5** (score 0.6591) - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **Faculty of Basic Sciences and 6 Humanities** > Page 159
      chunkKey: `fc11e6092df4b89ebbfee2575a4a56dcb7e5c096a5b09cc4441a847d56f48d5c`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf students are advised to open their bank accounts in Habib Bank Limited at UET Taxila branch.  - **30.4** The Chairman of the concerned department may grant extension in payment of dues to the needy students on cogent reasons recorded in writing for a maximum period of 30 days beyond the schedule of the dues circul...

_note:_ Candidate 5 marked relevant: Prospectus §30.4 is genuinely the closest on-topic content (late-payment extension policy), though it describes an extension process rather than stating a specific fine amount - best available, not a complete answer. Candidates 1/2 (checked in full, not just preview) are a plain dues deadline notice with NO fine/penalty language at all - not marked. 3/4 don't address fines. (The prospectus elsewhere - not in this top5 - does state an explicit "fine of Rs. 8,000/-" for a different scenario, re-admission; that chunk was not retrieved for this query.)
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked for this specific procedural fact)

---

## 8. What are the eligibility criteria for admission to BS Computer Science at UET Taxila?

queryId: `379d79b1e7ee91b2`

- [ ] **candidate 1** (score 0.7446) - Bachelor of Science in Computer Science
      url: /cs/bsCS.asp
      heading: Bachelor of Science in Computer Science
      chunkKey: `cf3fc98f2f04452f2395a23e123b64c55b7b7f5167ccb49b00cb3baf2af3ba2c`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /cs/bsCS.asp # Bachelor of Science in Computer Science  Source: <https://web.uettaxila.edu.pk/cs/bsCS.asp>  coursestable  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/cs/index.asp>)...

- [ ] **candidate 2** (score 0.7438) - Bachelor of Science in Computer Science
      url: /CS/bsCS.asp
      heading: Bachelor of Science in Computer Science
      chunkKey: `6326985b139fce911b7846fa022b5d5230f29144e3366871c3a16d4979769b25`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /CS/bsCS.asp # Bachelor of Science in Computer Science  Source: <https://web.uettaxila.edu.pk/CS/bsCS.asp>  coursestable  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/CS/index.asp>)...

- [ ] **candidate 3** (score 0.7361) - UG Program
      url: /UGprogram.aspx
      heading: UG Program > **Admissions** > Undergraduate Programs > Taxila Campus > BSc Engineering Programs > BS Programs
      chunkKey: `024526b3e1752da66899b578ee7f0639326761826489756a2d552eb0da57e076`
      text: Document Title: UG Program URL Path: /UGprogram.aspx ###### BS Programs  > **»** [Computer Science](<https://web.uettaxila.edu.pk/CS/index.asp>)...

- [ ] **candidate 4** (score 0.7258) - Department of Computer Science, UET Taxila
      url: /cs/index.asp
      heading: Department of Computer Science, UET Taxila
      chunkKey: `e1a69ffd3cb7ce4d542126dc92ce497d3896829d21ccdea0dbeefc90b1da6e9a`
      text: Document Title: Department of Computer Science, UET Taxila URL Path: /cs/index.asp Department is offering following degree programs;  Visual resource: degreeCape  BS Computer Science  The main objective of BSCS is to produce the talented graduates within 4 years that will impact the local, national, and global communities and hit the job market as Software Developers, IT Professionals, entrepreneu...

- [ ] **candidate 5** (score 0.7217) - Department of Computer Science, UET Taxila
      url: /CS/index.asp
      heading: Department of Computer Science, UET Taxila
      chunkKey: `1ecef200c005d0eb891cc53c082a7bef33e93a762a719e2c048c3d9e8758c38c`
      text: Document Title: Department of Computer Science, UET Taxila URL Path: /CS/index.asp Department is offering following degree programs;  Visual resource: degreeCape  BS Computer Science  The main objective of BSCS is to produce the talented graduates within 4 years that will impact the local, national, and global communities and hit the job market as Software Developers, IT Professionals, entrepreneu...

_note:_ None of the 5 relevant - all confirmed (full text checked) near-empty nav/header stubs (department homepage boilerplate, a bare 'coursestable' placeholder, a one-line program-list link). None state actual eligibility criteria. Real eligibility content exists elsewhere in the corpus (see query 9) but was not retrieved here.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 9. What is the minimum percentage required in FSc for admission to UET Taxila?

queryId: `9e51f9dc27154685`

- [x] **candidate 1** (score 0.6775) - UET Taxila UG Admissions
      url: /Eligiblity.php
      heading: UET Taxila Admissions > Eligibility
      chunkKey: `5d4dc9002869fa5e66bf13f54354e02d95a4a8bb6a45055dae14e75d030eca9c`
      text: Document Title: UET Taxila UG Admissions URL Path: /Eligiblity.php Mathematics / Biology  30%  iii. English 10%  iv. Chemistry / Computer Science / Statistics 30%  i. Applicants who have passed or have appeared in F.Sc/ Intermediate, B.Sc., DAE, B.Tech (Pass), or any Equivalent Examination may apply and choose the relevant combination. However, appearance in Entry Test does not confer the right to...

- [ ] **candidate 2** (score 0.6759) - UET Taxila UG Admissions
      url: /ProcedureAndRequirements2.php
      heading: UET Taxila UG Admissions
      chunkKey: `7a3156675bf22e1742af21f2f38ad80ac867d7794a3b549e92a188f95e00433f`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProcedureAndRequirements2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ProcedureAndRequirements2.php>...

- [ ] **candidate 3** (score 0.6749) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

- [ ] **candidate 4** (score 0.6686) - Admission Eligibility
      url: /Admission_Eligibility.php
      heading: Admission Eligibility
      chunkKey: `3872fe48e0c7cf4b2d209e1aa17e743d44f1392b4edddce31e14e6f2686b313f`
      text: Document Title: Admission Eligibility URL Path: /Admission_Eligibility.php # Admission Eligibility  Undergraduate Programs — UET Taxila  **a.** An applicant for admission to any Bachelor’s degree program must fulfill the following requirements:...

- [ ] **candidate 5** (score 0.6680) - UET Taxila UG Admissions
      url: /Advertisement_admission.php
      heading: UET Taxila Admissions > Official resources - [Fall 2025](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) (im...
      chunkKey: `abf448db72516de55d5d0fa51a82ab400daff990e839a74db94c67d91dba596c`
      text: Document Title: UET Taxila UG Admissions URL Path: /Advertisement_admission.php UET Taxila Admissions > Official resources - [Fall 2025](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) (image) - [2Cycle Fall 2025](<https://admissions.uettaxila.edu.pk/images/2Cycle-Fall-2025.jpg>) (image) - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &amp; Technology Taxila...

_note:_ Candidate 1 marked relevant: real content - 'Mathematics/Biology 30%, English 10%, Chemistry/CS/Statistics 30%' subject-weighted percentage breakdown from the actual Eligibility page (full text checked). It does not state a single overall minimum aggregate percentage, but is the corpus's best available answer to a percentage-related eligibility query. Candidates 2/3/5 confirmed near-empty stubs (full text checked); candidate 4 is a heading ('must fulfill the following requirements:') cut off before the actual list - a real chunking-boundary issue, not marked.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 10. What is the last date to apply for UET Taxila undergraduate admissions?

queryId: `c5ee1c9ad958ad05`

- [ ] **candidate 1** (score 0.8312) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 2** (score 0.8257) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `d061d7a5b2d027bd5a061f726ffcc6334195e235956d24d6720422e10bce9846`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Source: <https://admissions.uettaxila.edu.pk/explore.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 3** (score 0.8203) - UET Taxila Undergraduate Admissions
      url: /Schedule.php
      heading: UET Taxila Undergraduate Admissions
      chunkKey: `ad5b591a08fd654d8d0848113523bffbf10fe8f395daf511e1bf3d635ad7497b`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Schedule.php # UET Taxila Undergraduate Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 4** (score 0.8203) - UET Taxila Undergraduate Admissions
      url: /Downloads.php
      heading: UET Taxila Undergraduate Admissions
      chunkKey: `70491f1163e21db561b5d5a715c8b2a23d11d96d155369b603362640ba00441e`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Downloads.php # UET Taxila Undergraduate Admissions  Source: <https://admissions.uettaxila.edu.pk/Downloads.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 5** (score 0.8185) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

_note:_ None of the 5 relevant - all are the identical thin banner fragment '🚨 Undergraduate Admissions Fall 2026 | Registration Started' (full text checked), which states no actual deadline date.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 11. Does UET Taxila accept DAE students for lateral entry?

queryId: `928451f564ccf0a4`

- [ ] **candidate 1** (score 0.7409) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 2** (score 0.7322) - UET Taxila UG Admissions
      url: /ProspectusAvailability.php
      heading: UET Taxila UG Admissions
      chunkKey: `2c8a045e6ae52c325883ea73ea10be83e111a176bfc504fc2092a46c41d7adf8`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProspectusAvailability.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ProspectusAvailability.php>...

- [ ] **candidate 3** (score 0.7312) - UET Taxila UG Admissions
      url: /Test_Centers.php
      heading: UET Taxila UG Admissions
      chunkKey: `c4a06785c311d32cdf5f3a8609813e9fbf77ffb46a6b24e30f929f454aa08cfd`
      text: Document Title: UET Taxila UG Admissions URL Path: /Test_Centers.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Test_Centers.php>...

- [ ] **candidate 4** (score 0.7301) - UET Taxila UG Admissions
      url: /Result.php
      heading: UET Taxila UG Admissions
      chunkKey: `8a5f1523621f157e26d7aed08a88f9fe485eb074f5d329acc96ae0bcf73af90d`
      text: Document Title: UET Taxila UG Admissions URL Path: /Result.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Result.php>...

- [ ] **candidate 5** (score 0.7289) - UET Taxila UG Admissions
      url: /ContactUs.php
      heading: UET Taxila UG Admissions
      chunkKey: `6cac46287dd7852d3bda0f66a760a2d7e606807ce57fee80d9286b4d08541b94`
      text: Document Title: UET Taxila UG Admissions URL Path: /ContactUs.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ContactUs.php>...

_note:_ None of the 5 relevant - all confirmed (full text checked) near-empty stub pages (bare titles/source URLs, no content). None address lateral entry or DAE specifically.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 12. How many seats are available for BS Electrical Engineering at UET Taxila?

queryId: `f36e58e0f4ae2b8c`

- [ ] **candidate 1** (score 0.7480) - Department of Electrical Engineering, UET Taxila
      url: /EED/BSCElectricalEngineering.asp
      heading: Department of Electrical Engineering, UET Taxila
      chunkKey: `710589581d3ee752264e3491f7a2fdae2431b19fdd2c9e33f1dbe5e933f0405d`
      text: Document Title: Department of Electrical Engineering, UET Taxila URL Path: /EED/BSCElectricalEngineering.asp # Department of Electrical Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/EED/BSCElectricalEngineering.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [Quick Links](<https://web.uettaxila.edu.pk/EED/quickLinks.asp>)  [Contact Info](<https...

- [ ] **candidate 2** (score 0.7224) - Department of electrical Engineering, UET Taxila
      url: /EED/CLO_UG.asp
      heading: Department of electrical Engineering, UET Taxila > Official resources - [Applied Physics NS-115](<https://web.uettaxila....
      chunkKey: `0ef4202b67630015fde6bd94df556225ce1dc636ba8fbaf347e0af4420e99169`
      text: Document Title: Department of electrical Engineering, UET Taxila URL Path: /EED/CLO_UG.asp q=&submit=Search>) - [© 2026, www. uettaxila. edu. pk](<https://www. uettaxila. edu. pk/>)...

- [ ] **candidate 3** (score 0.7224) - Department of electrical Engineering, UET Taxila
      url: /EED/CLO_UG.asp
      heading: Department of electrical Engineering, UET Taxila > Official resources - [Applied Physics NS-115](<https://web.uettaxila....
      chunkKey: `577f26d758be5b04a4686ca6ab2a82c9aed1639a83a2a79a0b1928f1c9945305`
      text: Document Title: Department of electrical Engineering, UET Taxila URL Path: /EED/CLO_UG.asp q=&submit=Search>) - [© 2026, www. uettaxila. edu. pk](<https://www. uettaxila. edu. pk/>)...

- [ ] **candidate 4** (score 0.7191) - Department of Electrical Engineering, UET Taxila
      url: /EED/courses_UG.asp
      heading: Department of Electrical Engineering, UET Taxila > Official resources - [Courses OF UnderGraduate](<https://web.uettaxil...
      chunkKey: `b41ec1462a25be808621378807e29439b08b502b57c4bdc6ebb8283dd83e0904`
      text: Document Title: Department of Electrical Engineering, UET Taxila URL Path: /EED/courses_UG.asp q=&submit=Search>) - [© 2026, www. uettaxila. edu. pk](<https://www. uettaxila. edu. pk/>)...

- [ ] **candidate 5** (score 0.7185) - Department of Electrical Engineering, UET Taxila
      url: /EED/BSCElectricalEngineeringPLO.asp
      heading: Department of Electrical Engineering, UET Taxila
      chunkKey: `a0d513a9b801349b7596d0b9d7329d7b21ae74b6d3e349151a17d4ad3ee51d8f`
      text: Document Title: Department of Electrical Engineering, UET Taxila URL Path: /EED/BSCElectricalEngineeringPLO.asp Taxila  [Quick Links](<https://web.uettaxila.edu.pk/EED/quickLinks.asp>)  [Contact Info](<https://web.uettaxila.edu.pk/EED/contact.asp>)...

_note:_ None of the 5 relevant - all confirmed (full text checked) near-empty EED department stubs (nav headers, bare footer fragments). None state a seat count.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 13. What is the merit list procedure for UET Taxila admissions?

queryId: `fa7779e221583d3d`

- [ ] **candidate 1** (score 0.8341) - UET Taxila UG Admissions
      url: /ProcedureAndRequirements2.php
      heading: UET Taxila UG Admissions
      chunkKey: `7a3156675bf22e1742af21f2f38ad80ac867d7794a3b549e92a188f95e00433f`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProcedureAndRequirements2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ProcedureAndRequirements2.php>...

- [ ] **candidate 2** (score 0.8212) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 3** (score 0.8133) - UET Taxila UG Admissions
      url: /Result.php
      heading: UET Taxila UG Admissions
      chunkKey: `8a5f1523621f157e26d7aed08a88f9fe485eb074f5d329acc96ae0bcf73af90d`
      text: Document Title: UET Taxila UG Admissions URL Path: /Result.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Result.php>...

- [ ] **candidate 4** (score 0.8122) - UET Taxila UG Admissions
      url: /ProspectusAvailability.php
      heading: UET Taxila UG Admissions
      chunkKey: `2c8a045e6ae52c325883ea73ea10be83e111a176bfc504fc2092a46c41d7adf8`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProspectusAvailability.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ProspectusAvailability.php>...

- [ ] **candidate 5** (score 0.8110) - UET Taxila UG Admissions
      url: /Test_Centers.php
      heading: UET Taxila UG Admissions
      chunkKey: `c4a06785c311d32cdf5f3a8609813e9fbf77ffb46a6b24e30f929f454aa08cfd`
      text: Document Title: UET Taxila UG Admissions URL Path: /Test_Centers.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Test_Centers.php>...

_note:_ None of the 5 relevant - all confirmed (full text checked earlier, in queries 3/9/13/31/38/40) as near-empty admissions nav stubs. None describe an actual merit-list procedure.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 14. When are the midterm exams held at UET Taxila?

queryId: `cb7a97774e15f4e9`

- [ ] **candidate 1** (score 0.6851) - Seminars
      url: /Seminars.aspx
      heading: Seminars > **Life at UET Taxila**
      chunkKey: `e732a12e5e3d98b57b66144df505e94284caf4f229db44e1cf9a09ecd6f013cb`
      text: Document Title: Seminars URL Path: /Seminars.aspx ### **Life at UET Taxila**...

- [ ] **candidate 2** (score 0.6819) - UET Taxila UG Admissions
      url: /Test_Centers.php
      heading: UET Taxila UG Admissions
      chunkKey: `c4a06785c311d32cdf5f3a8609813e9fbf77ffb46a6b24e30f929f454aa08cfd`
      text: Document Title: UET Taxila UG Admissions URL Path: /Test_Centers.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Test_Centers.php>...

- [ ] **candidate 3** (score 0.6795) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 4** (score 0.6729) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

- [ ] **candidate 5** (score 0.6624) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `d061d7a5b2d027bd5a061f726ffcc6334195e235956d24d6720422e10bce9846`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Source: <https://admissions.uettaxila.edu.pk/explore.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

_note:_ None of the 5 relevant - Seminars.aspx is generic campus-life content unrelated to exam scheduling; the other 4 are confirmed near-empty admissions/explore stubs. No midterm exam dates stated anywhere in this top5.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 15. What is the schedule for final exams in spring semester 2025 at UET Taxila?

queryId: `0516bcbb0e07b76d`

- [ ] **candidate 1** (score 0.7372) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 163 > **<mark>IMPORTANT NOTICE: ADMISSION POLICY</mark>** > **ADMISSION SCHEDUL...
      chunkKey: `617275529fb23360479ef650cf4bb7765a9bf3b38d0d8009aa2af41139665968`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **ADMISSION SCHEDULE**  For updated admission schedule please keep visiting admissions.uettaxila.edu.pk...

- [ ] **candidate 2** (score 0.7281) - Department of Metallurgy and Materials Engineering, UET Taxila
      url: /MMED/regSchedulePG.asp
      heading: Department of Metallurgy and Materials Engineering, UET Taxila
      chunkKey: `765c1849d2d385542b47eb2c0ebae3fd8eedcb00c200e8830e1487759c54e92c`
      text: Document Title: Department of Metallurgy and Materials Engineering, UET Taxila URL Path: /MMED/regSchedulePG.asp Final Examination Date Sheet by Controller of Examinations  **8**  20.12.2013 Classes Terminate  **9**  21.12.2013 to 24.12.2013 Make-up classes  **10**  25.12.2013 to 31.12.2013 Final Examinations  **11**  15.01.2014 Start of Spring Semester  Visual resource: home fullbar  Untitled Doc...

- [ ] **candidate 3** (score 0.7122) - UET Taxila Undergraduate Admissions
      url: /Schedule.php
      heading: UET Taxila Undergraduate Admissions > Admission Schedule
      chunkKey: `b5bb836b20b655ec592639db601c090fc0d896de48ab0a4e34f6b7eee7b6f246`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Schedule.php ### Admission Schedule  Entry Fall 2026 – Important Dates & Deadlines...

- [ ] **candidate 4** (score 0.7095) - UET Taxila UG Admissions
      url: /Advertisement_admission.php
      heading: UET Taxila Admissions > Advertisements
      chunkKey: `0fff3651ff9810bec8fc5ab1a89b4aa963dace600116a47902e9043c7c7ff21b`
      text: Document Title: UET Taxila UG Admissions URL Path: /Advertisement_admission.php ## Advertisements  | Sr. No | Title | Date | Direct link | | --- | --- | --- | --- | | 1 | Admissions Fall-2025 Advertisement Cycle-I | -- | [View](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) | | 2 | Admissions Fall-2025 Advertisement Cycle-II | -- | [View](<https://admissions.uettaxila.edu.pk/images/2C...

- [ ] **candidate 5** (score 0.7013) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

_note:_ None of the 5 relevant. Candidate 2 (MMED dept page) has a REAL final-exam date sheet, but for 2013-2014 - 11+ years stale, naming specific calendar dates from over a decade ago that would actively mislead if presented as 'Spring 2025' - too stale to count as a reasonable best-available answer (unlike the 1-year fee-schedule drift accepted elsewhere, this is a 12-year gap in specific dates). Candidates 1/3/4 are about the ADMISSION schedule, not the exam schedule - wrong topic. Candidate 5 is a confirmed near-empty stub.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 16. When does the spring semester 2025 start at UET Taxila?

queryId: `d05381af7512b11d`

- [ ] **candidate 1** (score 0.7274) - UET Taxila Undergraduate Admissions
      url: /Schedule.php
      heading: UET Taxila Undergraduate Admissions
      chunkKey: `ad5b591a08fd654d8d0848113523bffbf10fe8f395daf511e1bf3d635ad7497b`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Schedule.php # UET Taxila Undergraduate Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 2** (score 0.7176) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `d061d7a5b2d027bd5a061f726ffcc6334195e235956d24d6720422e10bce9846`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Source: <https://admissions.uettaxila.edu.pk/explore.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 3** (score 0.7124) - UET Taxila Undergraduate Admissions
      url: /Downloads.php
      heading: UET Taxila Undergraduate Admissions
      chunkKey: `70491f1163e21db561b5d5a715c8b2a23d11d96d155369b603362640ba00441e`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Downloads.php # UET Taxila Undergraduate Admissions  Source: <https://admissions.uettaxila.edu.pk/Downloads.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 4** (score 0.7061) - UET Taxila UG Admissions
      url: /Advertisement_admission.php
      heading: UET Taxila Admissions > Advertisements
      chunkKey: `0fff3651ff9810bec8fc5ab1a89b4aa963dace600116a47902e9043c7c7ff21b`
      text: Document Title: UET Taxila UG Admissions URL Path: /Advertisement_admission.php ## Advertisements  | Sr. No | Title | Date | Direct link | | --- | --- | --- | --- | | 1 | Admissions Fall-2025 Advertisement Cycle-I | -- | [View](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) | | 2 | Admissions Fall-2025 Advertisement Cycle-II | -- | [View](<https://admissions.uettaxila.edu.pk/images/2C...

- [ ] **candidate 5** (score 0.6991) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 163 > **<mark>IMPORTANT NOTICE: ADMISSION POLICY</mark>** > **ADMISSION SCHEDUL...
      chunkKey: `617275529fb23360479ef650cf4bb7765a9bf3b38d0d8009aa2af41139665968`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **ADMISSION SCHEDULE**  For updated admission schedule please keep visiting admissions.uettaxila.edu.pk...

_note:_ None of the 5 relevant - all are the identical thin admissions-banner fragment or the same off-topic admission-schedule prospectus stub as query 15. No spring 2025 start date stated.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 17. What are the important dates in the UET Taxila academic calendar?

queryId: `93971e85e247fde9`

- [x] **candidate 1** (score 0.8013) - UET Taxila Undergraduate Admissions
      url: /Schedule.php
      heading: UET Taxila Undergraduate Admissions > Admission Schedule
      chunkKey: `b5bb836b20b655ec592639db601c090fc0d896de48ab0a4e34f6b7eee7b6f246`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Schedule.php ### Admission Schedule  Entry Fall 2026 – Important Dates & Deadlines...

- [ ] **candidate 2** (score 0.7993) - UET Taxila is observing Youm-e-Takbeer
      url: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer
      heading: UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageC...
      chunkKey: `3d8bdb58e0a89b17ea9266de4d07c045c9188ce22e67a987814842dcad227234`
      text: Document Title: UET Taxila is observing Youm-e-Takbeer URL Path: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (document) - [Approved for Year 2015-16](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_...

- [ ] **candidate 3** (score 0.7964) - UET Taxila is observing Youm-e-Takbeer
      url: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer
      heading: UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageC...
      chunkKey: `a9bf73c6816855aa2d6f5b695b8cc64733b614cfb7ac15ad3a4e8b6cb8fba955`
      text: Document Title: UET Taxila is observing Youm-e-Takbeer URL Path: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (document) - [Approved for Year 2015-16](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_...

- [ ] **candidate 4** (score 0.7964) - UET Taxila is observing Youm-e-Takbeer
      url: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer
      heading: UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageC...
      chunkKey: `948c11e8a9508af7a9fec13ae72dece5f30f3b2e44d0379c14ba4402163cdec9`
      text: Document Title: UET Taxila is observing Youm-e-Takbeer URL Path: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (document) - [Approved for Year 2015-16](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_...

- [ ] **candidate 5** (score 0.7948) - UET Taxila is observing Youm-e-Takbeer
      url: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer
      heading: UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageC...
      chunkKey: `6fa4f408d2be30043d3d8a4b011002ffba9ee0f13cd33f2eb94a13541675a44e`
      text: Document Title: UET Taxila is observing Youm-e-Takbeer URL Path: /EventDetails/UET-Taxila-is-observing-Youm-e-Takbeer UET Taxila is observing Youm-e-Takbeer > Official resources - [Under Implementation](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_Research_grants_finacial_year_14-15.doc>) (document) - [Approved for Year 2015-16](<https://web.uettaxila.edu.pk/PageContents/ASRTD/Faculty_...

_note:_ Candidate 1 marked relevant: 'Admission Schedule Entry Fall 2026 - Important Dates & Deadlines' - genuinely on-topic for a broad 'important dates' query (admission dates are a real category of important dates), even though it covers admissions specifically rather than the full academic calendar. Candidates 2-5 are all the same one-off 'Youm-e-Takbeer' event notice, not a dates listing - not marked.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 18. When is the summer break at UET Taxila university?

queryId: `2ea89221212da31c`

- [ ] **candidate 1** (score 0.7279) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `d061d7a5b2d027bd5a061f726ffcc6334195e235956d24d6720422e10bce9846`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Source: <https://admissions.uettaxila.edu.pk/explore.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 2** (score 0.7150) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 3** (score 0.7132) - Why UET Taxila?
      url: /whyus.php
      heading: Why UET Taxila?
      chunkKey: `9dab977457b9e7d209975d1b699efc862a3da0c33dd63f88e24ae4ea0e5a733b`
      text: Document Title: Why UET Taxila? URL Path: /whyus.php # Why UET Taxila?  Source: <https://admissions.uettaxila.edu.pk/whyus.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started  Visual resource: Enterance  Visual resource: 1  Visual resource: 2  Visual resource: Campus View  Visual resource: Advanced Labs  Visual resource: Central Library...

- [ ] **candidate 4** (score 0.7067) - UET Taxila Undergraduate Admissions
      url: /Schedule.php
      heading: UET Taxila Undergraduate Admissions
      chunkKey: `ad5b591a08fd654d8d0848113523bffbf10fe8f395daf511e1bf3d635ad7497b`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Schedule.php # UET Taxila Undergraduate Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 5** (score 0.7061) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

_note:_ None of the 5 relevant - all confirmed (full text checked) near-empty banner/nav stubs. No summer break dates stated anywhere in this top5.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 19. What are the prerequisites for the Data Structures course at UET Taxila?

queryId: `7b5d19924011310c`

- [ ] **candidate 1** (score 0.6954) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 40 > **FACULTY OF ELECTRONICS AND ELECTRICAL ENGINEERING** > **Arts and Humanit...
      chunkKey: `eed14e184563be44581747a3e524e09ee0eb4a323479a423db43d177967acfb7`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Course Title**  Data Structures & Algorithms...

- [ ] **candidate 2** (score 0.6650) - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-programstructureandcurriculum.asp
      heading: MS Data Science | Department of Computer Science, UET Taxila
      chunkKey: `eb13f7856abb78eef69d637b8c3af6f8973401679dfa0769c083d801c0869cf2`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-programstructureandcurriculum.asp edu. pk/CS/Info. asp>)   - [Announcements](<https://web. uettaxila. edu. pk/CS/Announcements. asp>)...

- [ ] **candidate 3** (score 0.6571) - Department of Computer Engineering, UET Taxila
      url: /cped/courses_UG.asp
      heading: Department of Computer Engineering, UET Taxila > PROGRAM SUMMARY
      chunkKey: `07739da427051d379d0df9c502326240f3960e9174343fe0a8742152a86beff3`
      text: Document Title: Department of Computer Engineering, UET Taxila URL Path: /cped/courses_UG.asp Hours**  **Part I**  **Part II**  CP-207  Data Structures and Algorithms  3  0  CP-207L  Data Structures and Algorithms (LAB)  0  1  CP-208  Operating Systems  3  0...

- [ ] **candidate 4** (score 0.6382) - MS Data Science | Department of Computer Science, UET Taxila
      url: /cs/msDataScience-faqs.asp
      heading: MS Data Science | Department of Computer Science, UET Taxila
      chunkKey: `0f2c7544eac5866250d873674047d2bb9169ace30cdf856c5d66f0d78fe8bba0`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /cs/msDataScience-faqs.asp edu. pk/cs/Info. asp>)   - [Announcements](<https://web. uettaxila. edu. pk/cs/Announcements. asp>)...

- [ ] **candidate 5** (score 0.6381) - MS Data Science | Department of Computer Science, UET Taxila
      url: /CS/msDataScience-programstructureandcurriculum.asp
      heading: MS Data Science | Department of Computer Science, UET Taxila
      chunkKey: `5e1206eb07d99d5e1876888f3298a77860ee61ec128d0bd4a408ecfa332828bc`
      text: Document Title: MS Data Science | Department of Computer Science, UET Taxila URL Path: /CS/msDataScience-programstructureandcurriculum.asp # MS Data Science | Department of Computer Science, UET Taxila  Source: <https://web.uettaxila.edu.pk/CS/msDataScience-programstructureandcurriculum.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Com...

_note:_ None of the 5 relevant. Candidate 1 (Prospectus) is just the header 'Course Title: Data Structures & Algorithms' cut off before any prerequisite text (full text checked). Candidate 3 (Computer Engineering dept) lists the course in a credit-hour table alongside Operating Systems but states no explicit prerequisite. Candidates 2/4/5 are for a different (graduate, Data Science) program. No candidate actually states a prerequisite.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 20. How many credit hours is the Programming Fundamentals course at UET Taxila?

queryId: `28c28a292f783f28`

- [x] **candidate 1** (score 0.6531) - Department of Computer Engineering, UET Taxila
      url: /cped/courses_UG.asp
      heading: Department of Computer Engineering, UET Taxila > PROGRAM SUMMARY
      chunkKey: `8aee572b1c180b8dedf84fbf270625f30f5733972c4d6917b2f8c3070c6ea499`
      text: Document Title: Department of Computer Engineering, UET Taxila URL Path: /cped/courses_UG.asp Area**  **Sub Area**  **Course Title**  **Theory**  **Lab**  **Total**  WK-1 to WK- 8  **Credit Hours**  **Engineering Domain**  WK-5/ WK-6  Computer and Information Science  ICT/AI/Dat a Science/Cy ber Security  Programming Fundamentals  3  1  4  Discrete Structures  3  0  3  WK-3/ WK-2  Engineering Foun...

- [ ] **candidate 2** (score 0.6469) - Department of Computer Engineering, UET Taxila
      url: /cped/Courses_UG_Latest.asp
      heading: Department of Computer Engineering, UET Taxila > Fall Semester Courses > 1st Semester Courses
      chunkKey: `9b2669acf19154abfe3d441d4b939e378f731b05792bc588faa394348946b3bf`
      text: Document Title: Department of Computer Engineering, UET Taxila URL Path: /cped/Courses_UG_Latest.asp ### 1st Semester Courses  Academics  [**Undergraduate Program**](<https://web.uettaxila.edu.pk/cped/UG.asp>)  [**Undergraduate Time Table**](<https://web.uettaxila.edu.pk/cped/timeTable_UG.asp>)  [**Spring Semester Courses**](<https://web.uettaxila.edu.pk/cped/Courses_UG_Spring.asp>)  [**Fall Semes...

- [x] **candidate 3** (score 0.6429) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 100 > **Courses Under Semester System BSc Telecommunication Engineering** > **S...
      chunkKey: `d4ae0318d1e26573e9ce22e8fe62d04faf7a092d21b1beec84dcc85e11037b4e`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Semester - I**  |**Course Code**|**Course Title**||**Credit Hours**| |---|---|---|---| |HU-101|Functional English||3| |CS-102|ProgrammingFundamentals||2| |CS-102-L|ProgrammingFundamentals Lab||1| |MA-103|Calculus and Analytic Geometry||3| |EE-104|Circuit Analysis||3| |EE-104-L|Circuit Analysis Lab||1| |MA...

- [x] **candidate 4** (score 0.6416) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 107 > **Courses Under Semester System BSc Computer Science** > **Semester - I**
      chunkKey: `d3b2910fc4aa9b58c44ae8e608b6c37841be7950ccc0220971fd7a5ad0739b6a`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Semester - I**  |**Course Code**|**Course Title**|**Credit Hours**| |---|---|---| |GE-01|Application of Information and Communication Technologies|3| |GE-101-L|Application of Information and Communication Technologies Lab|1| |CS-101|ProgrammingFundamentals|3| |CS-101-L|ProgrammingFundamentals Lab|1| |GE-1...

- [ ] **candidate 5** (score 0.6377) - COURSES (Undergraduate Program) | Department of Telecommunication Engineering, UET Taxila
      url: /telecom/courses_UG.asp
      heading: COURSES (Undergraduate Program) | Department of Telecommunication Engineering, UET Taxila
      chunkKey: `a7926abdeca8986d513af1d32fef27994899b477c6c0d398b92043b7aaa63aea`
      text: Document Title: COURSES (Undergraduate Program) | Department of Telecommunication Engineering, UET Taxila URL Path: /telecom/courses_UG.asp # COURSES (Undergraduate Program) | Department of Telecommunication Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/telecom/courses_UG.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [Quick Links](<https://we...

_note:_ Candidates 1, 3, 4 marked relevant: three different, internally consistent, real per-program credit-hour tables for 'Programming Fundamentals' - Computer Engineering (candidate 1: 3+1=4 total, cross-checked against its own table's structure), BSc Telecommunication Engineering (candidate 3: CS-102, 2 credit hours theory + 1 lab), BSc Computer Science (candidate 4: CS-101, 3 credit hours + 1 lab = 4 total, matching candidate 1's total). The query doesn't specify a program, and each is a genuine, correct, program-specific answer - cross-referenced against each other to confirm none contradicts, they're simply different real programs. Candidates 2/5 (full text checked) are nav-link listings with no actual credit-hour data, not marked.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (cross-checked against multiple independent corroborating chunks in the corpus, not just the one candidate)

---

## 21. What courses are offered in the 3rd semester of BS Computer Science?

queryId: `d401ee13982062e9`

- [ ] **candidate 1** (score 0.7532) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 107 > **Courses Under Semester System BSc Computer Science**
      chunkKey: `a482af051ae78e23b79ab75d79e663a46f56575855be4cf5f4fb1ef0343d3c1e`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Courses Under Semester System BSc Computer Science**...

- [ ] **candidate 2** (score 0.7525) - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: **4 Faculty of Industrial Engineering** > Page 107 > **Courses Under Semester System BSc Computer Science**
      chunkKey: `594948699286e930bfef8b9b8ae5bd6ffdd98e13c8ee997821c5bd665e88824f`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf ###### **Courses Under Semester System BSc Computer Science**...

- [ ] **candidate 3** (score 0.7421) - Bachelor of Science in Computer Science
      url: /cs/bsCS.asp
      heading: **Bachelor of Science in Computer Science** > **Job Market for Computer Scientists** > **Curriculum:**
      chunkKey: `c34064eaf9ed88a349b2021f2e3cb2e3116936715fc0dc6a22eb423164565bc1`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /cs/bsCS.asp ### **Curriculum:**  **Courses Under Semester System**...

- [ ] **candidate 4** (score 0.7412) - Bachelor of Science in Computer Science
      url: /CS/bsCS.asp
      heading: **Bachelor of Science in Computer Science** > **Job Market for Computer Scientists** > **Curriculum:**
      chunkKey: `949279a6fb6616a837cfd94f54e76cdc3239a1ee9958275d6e2db44dbf64988e`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /CS/bsCS.asp ### **Curriculum:**  **Courses Under Semester System**...

- [ ] **candidate 5** (score 0.7112) - Bachelor of Science in Computer Science
      url: /CS/bsCS.asp
      heading: **Bachelor of Science in Computer Science** > **Job Market for Computer Scientists** > **Curriculum:** > BSc Computer Sc...
      chunkKey: `1058fb810aaaa2c4fab3a0c09d590a76243f03edbf69ef270e85ca8cdb01f14e`
      text: Document Title: Bachelor of Science in Computer Science URL Path: /CS/bsCS.asp | **18** | **0** | | --- | --- | --- | --- | **Semester Total** | **18** | |  **Semester- VI**  | **Course Code** | **Course Title** | **Theory** | **Lab** | | --- | --- | --- | --- | | CS-307 | CS Elective – I | 3 | 0 | | CS-308 | CS Elective - II | 3 | 0 | | UE-302 | University Elective –III | 3 | 0 | | CS-309 | Compu...

_note:_ None of the 5 relevant. Candidates 1-4 (full text checked) are section headers only ('Courses Under Semester System BSc Computer Science' / 'Curriculum: Courses Under Semester System'), cut off before any semester-specific course list - a chunking-boundary issue. Candidate 5 shows Semester VI content, not the 3rd semester asked about - wrong semester.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 22. Is there a lab component for Operating Systems at UET Taxila?

queryId: `32bd7727e786b6c1`

- [ ] **candidate 1** (score 0.6838) - IOT Lab
      url: /cs/IOT_Lab.asp
      heading: IOT Lab
      chunkKey: `c384d5aef64d7bf75753e0c1d97a80846e55d79bd6558f95a3a64c9306e25741`
      text: Document Title: IOT Lab URL Path: /cs/IOT_Lab.asp # IOT Lab  Source: <https://web.uettaxila.edu.pk/cs/IOT_Lab.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/cs/index.asp>)...

- [ ] **candidate 2** (score 0.6829) - IOT Lab
      url: /CS/IOT_Lab.asp
      heading: IOT Lab
      chunkKey: `91854c6927fe41f96894c56159a350c3174ba234eb16e25a7c1567a6c766ae0c`
      text: Document Title: IOT Lab URL Path: /CS/IOT_Lab.asp # IOT Lab  Source: <https://web.uettaxila.edu.pk/CS/IOT_Lab.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/CS/index.asp>)...

- [ ] **candidate 3** (score 0.6790) - Hardware Lab
      url: /CS/Hardware_Lab.asp
      heading: Hardware Lab
      chunkKey: `cc6379e6eae7df51f5c553852f5cb7b87065da0ac92d8d4f4608ff3dc6b7c174`
      text: Document Title: Hardware Lab URL Path: /CS/Hardware_Lab.asp # Hardware Lab  Source: <https://web.uettaxila.edu.pk/CS/Hardware_Lab.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/CS/index.asp>)...

- [ ] **candidate 4** (score 0.6760) - Hardware Lab
      url: /cs/Hardware_Lab.asp
      heading: Hardware Lab
      chunkKey: `525bb7339c45c0d85d3edeaf85482d46f6fa05a90f615c5b03c1a3a0ac040051`
      text: Document Title: Hardware Lab URL Path: /cs/Hardware_Lab.asp # Hardware Lab  Source: <https://web.uettaxila.edu.pk/cs/Hardware_Lab.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/cs/index.asp>)...

- [ ] **candidate 5** (score 0.6678) - Operational
      url: /OR/operational.asp
      heading: Operational
      chunkKey: `a96cb0885502224d7b3ef3548ec8ee5d6b68691245d46ef7854cf2260093a19c`
      text: Document Title: Operational URL Path: /OR/operational.asp # Operational  Source: <https://web.uettaxila.edu.pk/OR/operational.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [Contact Info](<https://web.uettaxila.edu.pk/OR/contact.asp>)...

_note:_ None of the 5 relevant - IOT Lab and Hardware Lab are specific, different labs (not Operating Systems), all confirmed near-empty nav stubs; the 'Operational' OR department page is unrelated. No candidate addresses an Operating Systems course lab component (that fact exists elsewhere in the corpus per query 20's candidate 1, but was not retrieved here).
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 23. What is the course outline for Database Systems at UET Taxila?

queryId: `0a6d92d625563c42`

- [ ] **candidate 1** (score 0.6919) - DataBase Technology
      url: /CS/database.asp
      heading: DataBase Technology
      chunkKey: `44e8c771bed986eda978af142abf1c245b81b1456dc890d7217130c9b3568ffd`
      text: Document Title: DataBase Technology URL Path: /CS/database.asp # DataBase Technology  Source: <https://web.uettaxila.edu.pk/CS/database.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/CS/index.asp>)...

- [ ] **candidate 2** (score 0.6877) - DataBase Technology
      url: /cs/database.asp
      heading: DataBase Technology
      chunkKey: `996adc4698031cce609f542d946190b5cddb96e70cdd5e6a5a6d4b0a9155c9a2`
      text: Document Title: DataBase Technology URL Path: /cs/database.asp # DataBase Technology  Source: <https://web.uettaxila.edu.pk/cs/database.asp>  University of Engineering and Technology Taxila  Call us: +92 051 9047 846  Follow us:  [Department of Computer Science](<https://web.uettaxila.edu.pk/cs/index.asp>)...

- [ ] **candidate 3** (score 0.6853) - Course Management System
      url: /CMS/AUT2014/mmeAPbs/index.asp
      heading: **UET Taxila**
      chunkKey: `2d14c52d812f952df62092e58d1d4ffb523b2c8ced2d38511130cc8ac34e7795`
      text: Document Title: Course Management System URL Path: /CMS/AUT2014/mmeAPbs/index.asp # **UET Taxila**  http://www.uettaxila.edu.pk  Visual resource: back dots long  **Welcome to the course website.**  Visual resource: 0  Course Management System - UET Taxila  **COURSE DESCRIPTION**  This course will cover the following topics:...

- [ ] **candidate 4** (score 0.6792) - Course Management System
      url: /CMS/AUT2014/mmeICbs/index.asp
      heading: Course Management System
      chunkKey: `a4f84c633ef42c65cacd7beaf6c11562c042772bfc556cb0f9781b02fae3c0f7`
      text: Document Title: Course Management System URL Path: /CMS/AUT2014/mmeICbs/index.asp # Course Management System  Source: <https://web.uettaxila.edu.pk/CMS/AUT2014/mmeICbs/index.asp>  Course Management System - UET Taxila  **Introduction to computing**...

- [ ] **candidate 5** (score 0.6783) - Course Management System
      url: /CMS/SP2014/ieCADbs/index.asp
      heading: **UET Taxila** > Official resources - [Course Schedule](<https://web.uettaxila.edu.pk/CMS/SP2014/ieCADbs/Sched_CMS.asp>)...
      chunkKey: `d2cbff227c8b159c159fa344098f6c86bd0d5982dca5a3b27148857b5518f4b4`
      text: Document Title: Course Management System URL Path: /CMS/SP2014/ieCADbs/index.asp ## Official resources - [Course Schedule](<https://web.uettaxila.edu.pk/CMS/SP2014/ieCADbs/Sched_CMS.asp>) - [UET Taxila http://www.uettaxila.edu.pk W elcome to the course website. Course Management System - UET Taxila COURSE DESCRIPTION Information will be available soon.](<http://www.uettaxila.edu.pk/>) - [www.uetta...

_note:_ None of the 5 relevant. Candidates 1/2 (DataBase Technology) are confirmed near-empty nav stubs. Candidate 3 (2014 Course Management System page) says 'This course will cover the following topics:' then cuts off with no topics listed (full text checked) - and it's unclear this 2014 CMS page is even for the Database Systems course specifically. Candidate 4 describes a different course ('Introduction to computing'). Candidate 5 explicitly says 'Information will be available soon.' No usable course outline anywhere in this top5.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 24. How do I contact the Dean of the Faculty of Engineering at UET Taxila?

queryId: `07002b9f761478bc`

- [ ] **candidate 1** (score 0.8139) - Dean Message | Department of Telecommunication Engineering, UET Taxila
      url: /telecom/Dean_Message.asp
      heading: Dean Message | Department of Telecommunication Engineering, UET Taxila
      chunkKey: `588534697690840a24d8ee703c4c4227123fe383b2365488570873796ff82310`
      text: Document Title: Dean Message | Department of Telecommunication Engineering, UET Taxila URL Path: /telecom/Dean_Message.asp # Dean Message | Department of Telecommunication Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/telecom/Dean_Message.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [Quick Links](<https://web.uettaxila.edu.pk/telecom/quickLi...

- [ ] **candidate 2** (score 0.7966) - Student Counseling | Department of Civil Engineering, UET Taxila
      url: /CED/StudentCounseling.asp
      heading: Student Counseling | Department of Civil Engineering, UET Taxila
      chunkKey: `b32bfe9efac3b71971cab8b36f666022f33df2fce0e0d128713f3bf9bb870fbe`
      text: Document Title: Student Counseling | Department of Civil Engineering, UET Taxila URL Path: /CED/StudentCounseling.asp # Student Counseling | Department of Civil Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/CED/StudentCounseling.asp>  University of Engineering and Technology, Taxila  Visual resource: UET Taxila  [UET  [Contact Info](<https://web.uettaxila.edu.pk/CED/contact.asp>)...

- [ ] **candidate 3** (score 0.7925) - Department of Industrial Engineering, UET Taxila
      url: /IE/contact.asp
      heading: Department of Industrial Engineering, UET Taxila
      chunkKey: `33a09249f4a587412bbc9355c75c98f8fc46a7cd0eecd435caf44317d9b04707`
      text: Document Title: Department of Industrial Engineering, UET Taxila URL Path: /IE/contact.asp # Department of Industrial Engineering, UET Taxila  Source: <https://web.uettaxila.edu.pk/IE/contact.asp>  University of Engineering and Technology, Taxila  [Quick Links](<https://web.uettaxila.edu.pk/IE/quickLinks.asp>) [Contact Info](<https://web.uettaxila.edu.pk/IE/contact.asp>)  Visual resource: Departme...

- [ ] **candidate 4** (score 0.7906) - Alumni Association UET Taxila
      url: /alumni/contactUs.htm
      heading: Alumni Association UET Taxila
      chunkKey: `80c5e48964adb28b1253d0949dc388fe8440592f0215181841f1a36c2a12d1c8`
      text: Document Title: Alumni Association UET Taxila URL Path: /alumni/contactUs.htm resource: h line  Visual resource: zw menue  Visual resource: students  **Contact Us**  **Ms.Sadia Shahbaz** Deputy Director (Alumni) University of Engineering and Technology,Taxila  **Phone:** 92-51-9047444 **email:** [sadia.shahbaz@uettaxila.edu.pk](<https://web.uettaxila.edu.pk/cdn-cgi/l/email-protection>)...

- [ ] **candidate 5** (score 0.7885) - Department of Electrical Engineering, UET Taxila
      url: /EED/contact.asp
      heading: Department of Electrical Engineering, UET Taxila
      chunkKey: `77028e777a28646f13aee2cc26bb51b0b1d9004ad05fbe9665e5a26eff5c9ac7`
      text: Document Title: Department of Electrical Engineering, UET Taxila URL Path: /EED/contact.asp Department of Electrical Engineering, UET Taxila  Info](<https://web.uettaxila.edu.pk/EED/contact.asp>)...

_note:_ None of the 5 relevant - all confirmed (full text checked) near-empty department contact/nav stubs (Telecom Dean Message page has no actual dean name or contact info; Civil Eng student counseling, Industrial Eng, Alumni deputy director, and Electrical Eng contact pages are all different offices, not the Faculty of Engineering Dean specifically).
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 25. What is the email address of the CS department head at UET Taxila?

queryId: `809427d946da55fe`

- [x] **candidate 1** (score 0.8133) - Department of Computer Science, UET Taxila
      url: /CS/index.asp
      heading: Department of Computer Science, UET Taxila > Contact details
      chunkKey: `491f704ab01374604892239079710fc86fa76abecf9733eb382e5b93fa2c2e77`
      text: Document Title: Department of Computer Science, UET Taxila URL Path: /CS/index.asp ## Contact details  - Email: helpdesk.cs@uettaxila.edu.pk - Phone: +92 (51) 9047846...

- [x] **candidate 2** (score 0.8121) - Department of Computer Science, UET Taxila
      url: /cs/index.asp
      heading: Department of Computer Science, UET Taxila > Contact details
      chunkKey: `b5f7330baeafd71f6b577fcd878ba4a66aaf1790b5cc4e40e44c8f03a8614cd6`
      text: Document Title: Department of Computer Science, UET Taxila URL Path: /cs/index.asp ## Contact details  - Email: helpdesk.cs@uettaxila.edu.pk - Phone: +92 (51) 9047846...

- [x] **candidate 3** (score 0.8069) - Department of Computer Science, UET Taxila
      url: /cs/haina_Event.asp
      heading: Department of Computer Science, UET Taxila > Contact details
      chunkKey: `4aa06117613a1655c388c91d83e14270da1473e9feb433963a40735e0771fe56`
      text: Document Title: Department of Computer Science, UET Taxila URL Path: /cs/haina_Event.asp ## Contact details  - Email: helpdesk.cs@uettaxila.edu.pk - Phone: +92 (51) 9047846...

- [x] **candidate 4** (score 0.8064) - Department of Computer Science, UET Taxila
      url: /CS/haina_Event.asp
      heading: Department of Computer Science, UET Taxila > Contact details
      chunkKey: `0e363892f9fb7860989c238d4d217efc3cdbd9d6ae340315d74e97d316bdd3e2`
      text: Document Title: Department of Computer Science, UET Taxila URL Path: /CS/haina_Event.asp ## Contact details  - Email: helpdesk.cs@uettaxila.edu.pk - Phone: +92 (51) 9047846...

- [x] **candidate 5** (score 0.7819) - MS Computer Science | Department of Computer Science, UET Taxila
      url: /CS/msCS.asp
      heading: **MS Computer Science** > Contact details
      chunkKey: `7a01b32a0d203f122fee8037219953fa39dd800b85079de8a043d9a4c838bbf1`
      text: Document Title: MS Computer Science | Department of Computer Science, UET Taxila URL Path: /CS/msCS.asp ## Contact details  - Email: helpdesk.cs@uettaxila.edu.pk - Phone: +92 (51) 9047846...

_note:_ All 5 marked relevant: each states the department's real official contact channel - 'Email: helpdesk.cs@uettaxila.edu.pk, Phone: +92 (51) 9047846' (identical across all 5, confirmed by reading each). This is a shared departmental helpdesk address, not necessarily the individual chairman/head's personal email, but is the corpus's best available and genuinely correct answer to how to reach CS department leadership - no more specific 'head's personal email' exists anywhere in this top5.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 26. Who is the Vice Chancellor of UET Taxila?

queryId: `0a5abd0e1ccc4e3a`

- [x] **candidate 1** (score 0.7248) - VC Office
      url: /VCOffice.aspx
      heading: VC Office > **Administration** > Vice Chancellor Office
      chunkKey: `b6e2619e6c2d615ad3a14f1240af0141f169274b77f093ed4b760cbcf1a6e136`
      text: Document Title: VC Office URL Path: /VCOffice.aspx ### Vice Chancellor Office  **[Prof. Dr. Muhammad Inayatullah Khan](<#>)**  **Vice Chancellor** University of Engineering and Technology, Taxila Pakistan Email: vc@uettaxila.edu.pk Ph: 051- 9047401 Fax: 051- 9047420  **Basharat A. Shah** **Secretary to VC** University of Engineering and Technology, Taxila Pakistan Ph: 051- 9047403 Fax: 051- 904742...

- [ ] **candidate 2** (score 0.7136) - UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA
      url: /PageContents/MinutesofMeetings/Minutes_41-2015_Final.pdf
      heading: **<u>THE UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA - PAKISTAN</u>** > **_MINUTES OF 41/2015 MEETING OF THE SYNDIC...
      chunkKey: `c78c4846fd4f669b198e160246b71bc43c19e46cda1ec74c08ffd8b9f30a63d7`
      text: Document Title: UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA URL Path: /PageContents/MinutesofMeetings/Minutes_41-2015_Final.pdf |**1.**|**Prof. Dr. Niaz Ahmad Akhtar**<br>Vice-Chancellor/ChairmanSyndicate,The UET,Taxila|**In Chair**| |---|---|---| |**8.**|**Mr. Gulzar Ahmad**<br>Director, Local Fund Audit<br>Nominee ofthe SecretaryFinance,FinanceDepartment, Govt.of Punjab,Lahore|**_Member_**|...

- [ ] **candidate 3** (score 0.7110) - Worthy Vice Chancellor meeting with Honorable Chancellor at the Governor House, Lahore
      url: /EventDetails/Worthy-Vice-Chancellor-meeting-with-Honorable-Chancellor-at-the-Governor-House,-Lahore
      heading: Worthy Vice Chancellor meeting with Honorable Chancellor at the Governor House, Lahore > Visual resources requiring text...
      chunkKey: `ecdabef613f5cd5d2d5fa1f2ddad45ef598d399190c849c82f59540f4b39dd3f`
      text: Document Title: Worthy Vice Chancellor meeting with Honorable Chancellor at the Governor House, Lahore URL Path: /EventDetails/Worthy-Vice-Chancellor-meeting-with-Honorable-Chancellor-at-the-Governor-House,-Lahore [Students](<https://web. uettaxila. edu. pk/images/Menu/menuLifetUETT. jpg>) — At UET Taxila...

- [ ] **candidate 4** (score 0.7086) - University of Engineering and Technology Taxila, Pakistan
      url: /oldWeb.asp
      heading: University of Engineering and Technology Taxila, Pakistan
      chunkKey: `ffa96c516dc58306d28ece9733e1562a3f698bb4be220094f6c729b9e266cbd2`
      text: Document Title: University of Engineering and Technology Taxila, Pakistan URL Path: /oldWeb.asp # University of Engineering and Technology Taxila, Pakistan  Source: <https://web.uettaxila.edu.pk/oldWeb.asp>  Untitled Document  Visual resource: uettNSb 01  Select Theme  ****University of Engineering and Technology, Taxila****  **»[About Us](<https://web.uettaxila.edu.pk/uet/uetSub/aboutUs.htm>)** *...

- [ ] **candidate 5** (score 0.7067) - CEOtalks
      url: /CEOtalks.aspx
      heading: CEOtalks > **Life at UET Taxila**
      chunkKey: `366a04b4a44519c2a78810de048fe934bdec6db0dd1d6d76a904d2f129a3a4e3`
      text: Document Title: CEOtalks URL Path: /CEOtalks.aspx ### **Life at UET Taxila**...

_note:_ Candidate 1 marked relevant: the dedicated 'VC Office' page states 'Prof. Dr. Muhammad Inayatullah Khan, Vice Chancellor... Email: vc@uettaxila.edu.pk' directly. Candidate 2 (2015 Syndicate meeting minutes) names a DIFFERENT, older VC ('Prof. Dr. Niaz Ahmad Akhtar') - a real but 11-year-stale historical document that would actively mislead if presented as the current answer; not marked, per the same best-available-current-answer reasoning applied to the fee-year conflicts. Candidates 3/4/5 (full text checked) state no VC name at all.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 27. How can I contact the registrar office at UET Taxila?

queryId: `067a5f0f244a6e34`

- [x] **candidate 1** (score 0.8284) - Home | Registrar Office, UET Taxila
      url: /OR/index.asp
      heading: Home | Registrar Office, UET Taxila > Visual resources requiring text extraction - [bgSlideBlue](<https://web.uettaxila....
      chunkKey: `a7e5a404a4626b95fd9b5a7ab0772cffd03fad7765d1a965fac01d8fe35a2212`
      text: Document Title: Home | Registrar Office, UET Taxila URL Path: /OR/index.asp ahmad. noor@uettaxila. edu. pk Ph: 051-9047410 Email: registrar@uettaxila. edu. pk Ph: 051-9047406...

- [x] **candidate 2** (score 0.8182) - ContactUs
      url: /ContactUs.aspx
      heading: ContactUs > **Contact Information** > Registrar Office
      chunkKey: `beeeaca047e6dd4b662a414b0ae5369d9633da1a6ea984c9bbb61c4d278ecdc5`
      text: Document Title: ContactUs URL Path: /ContactUs.aspx #### Registrar Office  - **University of Engineering and Technology Taxila, Pakistan**   Telephone: +92 51-9047-406   FAX: +92 51-9047-420   E-mail: [registrar@uettaxila.edu.pk](<https://web.uettaxila.edu.pk/cdn-cgi/l/email-protection>)   Website: [Registrar Office](<https://web.uettaxila.edu.pk/RegistrarOffice.aspx>)...

- [x] **candidate 3** (score 0.8160) - Home | Registrar Office, UET Taxila
      url: /OR/index.asp
      heading: Home | Registrar Office, UET Taxila
      chunkKey: `73e71c7d7418ac1d6d5560e1840c1c31e9072a4237bd0fb6fd005186ca993390`
      text: Document Title: Home | Registrar Office, UET Taxila URL Path: /OR/index.asp 051- 9047420  Visual resource: Ehsaan Ahmad  **Ehsaan Ahmad**  Deputy Registrar(Establishment)  Email: ehsan.ahmad@uettaxila.edu.pk Ph: 051- 9047408  **Khalid Mahmood**  Registrar  Email: registrar@uettaxila.edu.pk Ph: 051-9047406  Visual resource: Ahmad Noor  **Ahmad Noor**  Deputy Registrar(A&R)  Email: ahmad.noor@uettax...

- [ ] **candidate 4** (score 0.8130) - Why UET Taxila?
      url: /whyus.php
      heading: Why UET Taxila? > Contact details
      chunkKey: `b4222c5451c5548d9374f082fed820cbf141f95c0f458960bddefca535b8743d`
      text: Document Title: Why UET Taxila? URL Path: /whyus.php ## Contact details  - Email: ug.admission@uettaxila.edu.pk - Phone: +92-51-9047400-412...

- [ ] **candidate 5** (score 0.8124) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila > Contact details
      chunkKey: `60cfadcc37bdc013aab7547d2bb8c43d73a1e195c5883aa9289e3e32d7c37037`
      text: Document Title: Explore UET Taxila URL Path: /explore.php ## Contact details  - Email: ug.admission@uettaxila.edu.pk - Phone: +92-51-9047400-412...

_note:_ Candidates 1, 2, 3 marked relevant: each states the real Registrar Office contact - 'registrar@uettaxila.edu.pk, Ph: 051-9047406' (candidate 3 additionally names the actual Registrar, 'Khalid Mahmood'). Candidates 4/5 give the ADMISSIONS office email (ug.admission@uettaxila.edu.pk) under a 'Contact details' heading - a different office, not the registrar - not marked despite the misleading generic heading.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 28. What is the phone number of UET Taxila main campus?

queryId: `1e3f0c84cff8af35`

- [x] **candidate 1** (score 0.8587) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila > Contact details
      chunkKey: `60cfadcc37bdc013aab7547d2bb8c43d73a1e195c5883aa9289e3e32d7c37037`
      text: Document Title: Explore UET Taxila URL Path: /explore.php ## Contact details  - Email: ug.admission@uettaxila.edu.pk - Phone: +92-51-9047400-412...

- [x] **candidate 2** (score 0.8516) - Why UET Taxila?
      url: /whyus.php
      heading: Why UET Taxila? > Contact details
      chunkKey: `b4222c5451c5548d9374f082fed820cbf141f95c0f458960bddefca535b8743d`
      text: Document Title: Why UET Taxila? URL Path: /whyus.php ## Contact details  - Email: ug.admission@uettaxila.edu.pk - Phone: +92-51-9047400-412...

- [x] **candidate 3** (score 0.8500) - Training Calendar UET Taxila for year 2018
      url: /facultystaffdevelopment.aspx
      heading: Downloads > Contact details
      chunkKey: `4738f2e1a87b10b3da3ffc8ad21214fb3f322c788b6c87b1d5b6527f3013cd2b`
      text: Document Title: Training Calendar UET Taxila for year 2018 URL Path: /facultystaffdevelopment.aspx ## Contact details  - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

- [x] **candidate 4** (score 0.8316) - UET Taxila Undergraduate Admissions
      url: /Downloads.php
      heading: UET Taxila Undergraduate Admissions > Contact details
      chunkKey: `418d2e122542a48d18531232b69153673a9f6724bb6640ed6e4c00fb5eb1819d`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Downloads.php ## Contact details  - Email: ug.admission@uettaxila.edu.pk - Phone: +92-51-9047400-412...

- [x] **candidate 5** (score 0.8254) - University of Engineering and Technology, Taxila
      url: /Minutes_of_Meetings.asp
      heading: University of Engineering and Technology, Taxila > Contact details
      chunkKey: `04919b8122bc402334fb9351d73e12430f60bbf5ee2ecbde4bedb8f29bab4b95`
      text: Document Title: University of Engineering and Technology, Taxila URL Path: /Minutes_of_Meetings.asp ## Contact details  - Email: info@uettaxila.edu.pk - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

_note:_ All 5 marked relevant: each states a real UET Taxila institutional phone number in the 051-9047400/420 range (the general/admissions/info lines), which is the corpus's correct and best-available answer to a query about the 'main campus' phone number - no single more authoritative 'the one main number' exists to prefer among them.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 29. How do I apply for the HEC need-based scholarship at UET Taxila?

queryId: `0826c56fb3e9e670`

- [ ] **candidate 1** (score 0.7315) - FAQs
      url: /Alumni/FAQs
      heading: FAQs > Official resources - [Scholarships](<https://web.uettaxila.edu.pk/Misc/Projects>) - [Tenders](<https://web.uettax...
      chunkKey: `f120e2b0134997c65d4ec381b7e3398e0da42861cff2454a70cb1aae5ec293ca`
      text: Document Title: FAQs URL Path: /Alumni/FAQs ## Official resources - [Scholarships](<https://web.uettaxila.edu.pk/Misc/Projects>) - [Tenders](<https://web.uettaxila.edu.pk/Home/Tenders>) - [HEC](<http://hec.gov.pk/english/Pages/Home.aspx>) - [PEC](<http://www.pec.org.pk/>) - [PEEF](<http://www.peef.org.pk/>) - [The process is very simple. Just visit alumni webpage under the heading of main sites at...

- [ ] **candidate 2** (score 0.7271) - University of Engineering and Technology Taxila, Pakistan
      url: /oldWeb.asp
      heading: University of Engineering and Technology Taxila, Pakistan > Official resources - [Laptop Distribution Notice for Prime M...
      chunkKey: `4784abffdbb2aa0013cbc77f8c7422bf36ac10f5676e1422537782021b5b2062`
      text: Document Title: University of Engineering and Technology Taxila, Pakistan URL Path: /oldWeb.asp University of Engineering and Technology Taxila, Pakistan > Official resources - [Laptop Distribution Notice for Prime Minister’s Laptop Scheme](<https://web. uettaxila. edu. pk/laptopDistribution_9March. jpg>) (image) - [; Download: APPLICATION FORM](<https://web. uettaxila. edu. pk/proforma_WELFARE_SC...

- [ ] **candidate 3** (score 0.7251) - notice-hec-needbased-scholarship-2019.pdf
      url: /PageContents/ScholarshipsNotices/notice-hec-needbased-scholarship-2019.pdf
      heading: notice-hec-needbased-scholarship-2019.pdf > Page 1
      chunkKey: `7a7bcbb014628245b76babc9e0c6038d39718551fc37df1fa85f0549f6e80565`
      text: Document Title: notice-hec-needbased-scholarship-2019.pdf URL Path: /PageContents/ScholarshipsNotices/notice-hec-needbased-scholarship-2019.pdf ## Page 1  NeneeeoOOrrorororr———r—ae  iif > \  Phone: (051) 9047422421,Fax: (051)9047420 University of Engineering and Technology Taxila  Noe Dues & Scholarship Section  Dated:19.04.19  ~...

- [ ] **candidate 4** (score 0.7161) - (not found in chunk text)
      url: (not found in chunk text)
      heading: ScholarshipsNotices > Official resources - [Notice for Physical Verification of Applicants of Honhaar Scholarship Phase ...
      chunkKey: `2803d6854ca2291f76374bab92d04edfc70673f93b14c8f0210b56fed4517b79`
      text: - [Research &amp; Publications](<http://publications.uettaxila.edu.pk/>) - [File Tracking System](<http://e-filing.uettaxila.edu.pk/>) - [Career Development](<http://uettaxila.rozee.pk/>) - [Higher Education Department](<http://hed.punjab.gov.pk/>) - [The Punjab Educational Endowment Fund](<http://www.peef.org.pk/>)  ScholarshipsNotices > Official resources - [Notice for Physical Verification of A...

- [ ] **candidate 5** (score 0.7161) - (not found in chunk text)
      url: (not found in chunk text)
      heading: ScholarshipsNotices > Official resources - [Notice for Physical Verification of Applicants of Honhaar Scholarship Phase ...
      chunkKey: `ebe092c436eb0ea3a1048e9c1b77d10822bc6c432f6352a6fb3801e16999b33f`
      text: - [Research &amp; Publications](<http://publications.uettaxila.edu.pk/>) - [File Tracking System](<http://e-filing.uettaxila.edu.pk/>) - [Career Development](<http://uettaxila.rozee.pk/>) - [Higher Education Department](<http://hed.punjab.gov.pk/>) - [The Punjab Educational Endowment Fund](<http://www.peef.org.pk/>)  ScholarshipsNotices > Official resources - [Notice for Physical Verification of A...

_note:_ None of the 5 relevant. Candidate 1 (Alumni FAQ) describes how to join the ALUMNI ASSOCIATION (pay Rs.1000, register) - not the HEC scholarship, a misleading link-label match (full text checked). Candidate 3 genuinely IS the real 'notice-hec-needbased-scholarship-2019.pdf' document, but this chunk's OCR extraction is fully garbled past the office header - no legible application procedure survives in this chunk (full text checked), so despite being the right source document, it conveys no usable answer to 'how do I apply'. Candidates 2/4/5 are generic nav-link listings.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 30. What merit scholarships are available for top students at UET Taxila?

queryId: `ed64320d24518201`

- [ ] **candidate 1** (score 0.7728) - ScholarshipsNotices
      url: /ScholarshipsNotices.aspx
      heading: ScholarshipsNotices > Visual resources requiring text extraction - [Merit Cum Need Based Scholarship By Alumni Associati...
      chunkKey: `8a5297c4ba7b5ae51968230851b72f698fed7ed162f3015f5ce3fe752fa17eee`
      text: Document Title: ScholarshipsNotices URL Path: /ScholarshipsNotices.aspx [Students](<https://web. uettaxila. edu. pk/images/Menu/menuLifetUETT. jpg>) — At UET Taxila...

- [ ] **candidate 2** (score 0.7325) - MeritScholarships-Spring-Semester-2019.pdf
      url: /PageContents/ScholarshipsNotices/MeritScholarships-Spring-Semester-2019.pdf
      heading: MeritScholarships-Spring-Semester-2019.pdf > Page 1
      chunkKey: `5c5de983dab13e98508832098b9ee7aa1fcb40ad4fe7c85c5ef5e64d5ee6c549`
      text: Document Title: MeritScholarships-Spring-Semester-2019.pdf URL Path: /PageContents/ScholarshipsNotices/MeritScholarships-Spring-Semester-2019.pdf ## Page 1  University of Engineering and Technology Taxila . . . wow uertanllaaduph DUES & SCHOLARSHIP SECTION  No. UETT/_3é/ Date: /§-o/-20L©...

- [ ] **candidate 3** (score 0.7244) - (not found in chunk text)
      url: (not found in chunk text)
      heading: ScholarshipsNotices > Official resources - [Notice for Physical Verification of Applicants of Honhaar Scholarship Phase ...
      chunkKey: `85f018173dfc3a5429a83b35978c896f0bd5cdc35bd7240c7eb671bcdd48e8fb`
      text: - [Research &amp; Publications](<http://publications.uettaxila.edu.pk/>) - [File Tracking System](<http://e-filing.uettaxila.edu.pk/>) - [Career Development](<http://uettaxila.rozee.pk/>) - [Higher Education Department](<http://hed.punjab.gov.pk/>) - [The Punjab Educational Endowment Fund](<http://www.peef.org.pk/>)  ScholarshipsNotices > Official resources - [Notice for Physical Verification of A...

- [ ] **candidate 4** (score 0.7244) - (not found in chunk text)
      url: (not found in chunk text)
      heading: ScholarshipsNotices > Official resources - [Notice for Physical Verification of Applicants of Honhaar Scholarship Phase ...
      chunkKey: `2803d6854ca2291f76374bab92d04edfc70673f93b14c8f0210b56fed4517b79`
      text: - [Research &amp; Publications](<http://publications.uettaxila.edu.pk/>) - [File Tracking System](<http://e-filing.uettaxila.edu.pk/>) - [Career Development](<http://uettaxila.rozee.pk/>) - [Higher Education Department](<http://hed.punjab.gov.pk/>) - [The Punjab Educational Endowment Fund](<http://www.peef.org.pk/>)  ScholarshipsNotices > Official resources - [Notice for Physical Verification of A...

- [ ] **candidate 5** (score 0.7244) - (not found in chunk text)
      url: (not found in chunk text)
      heading: ScholarshipsNotices > Official resources - [Notice for Physical Verification of Applicants of Honhaar Scholarship Phase ...
      chunkKey: `ebe092c436eb0ea3a1048e9c1b77d10822bc6c432f6352a6fb3801e16999b33f`
      text: - [Research &amp; Publications](<http://publications.uettaxila.edu.pk/>) - [File Tracking System](<http://e-filing.uettaxila.edu.pk/>) - [Career Development](<http://uettaxila.rozee.pk/>) - [Higher Education Department](<http://hed.punjab.gov.pk/>) - [The Punjab Educational Endowment Fund](<http://www.peef.org.pk/>)  ScholarshipsNotices > Official resources - [Notice for Physical Verification of A...

_note:_ None of the 5 relevant. Candidate 2 genuinely IS the real 'MeritScholarships-Spring-Semester-2019.pdf' document, but like query 29's candidate 3, its OCR extraction is fully garbled ('wow uertanllaaduph', full text checked) - no legible scholarship information survives. Candidate 1 is a bare nav-link fragment (full text checked). Candidates 3/4/5 are generic nav-link listings (Honhaar Scholarship verification notice), not actual merit-scholarship content.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 31. Is there a fee waiver program for financially needy students at UET Taxila?

queryId: `4b515ce39511ff1b`

- [ ] **candidate 1** (score 0.7250) - UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA
      url: /OR/downloadFiles/Final_ANNUAL_REPORT_13-14.pdf
      heading: UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA > Page 6
      chunkKey: `51bdbc92a4674d7c23a251cdf084f6c0d78dea87f675677a925191fe2ba7b7dc`
      text: Document Title: UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA URL Path: /OR/downloadFiles/Final_ANNUAL_REPORT_13-14.pdf ## Page 6  students living in the twin cities of Rawalpindi and Islamabad and of surrounding areas.  UET Taxila is not a for-profit organization. We meet approximately only 20 % of our annual expenses through tuition fees. For the rest of our expenses, both provincial and feder...

- [x] **candidate 2** (score 0.7147) - Waiver-off-Tuition -fee-2023.pdf
      url: /PageContents/DuesSection/Waiver-off-Tuition%20-fee-2023.pdf
      heading: Waiver-off-Tuition -fee-2023.pdf > Page 1
      chunkKey: `9e8723a93be0ccacc05877d21901d82e6d7b0b48f01131590d3337cf1afb8e05`
      text: Document Title: Waiver-off-Tuition -fee-2023.pdf URL Path: /PageContents/DuesSection/Waiver-off-Tuition%20-fee-2023.pdf |NEERY<br>(=O<br>a\“<br>|N<br>Phone: (051)9047422,421, Fax:(051)904<br>2<br>Js)_UniversityofEngineeringandTechnologyTaxila<br>  <br>| |---|---| |<br>Neerp<br>Nan|<br>y— — ——~_SSS<br>vwa.uettanila.edu.pk<br><br>(Dues& Financial Aid Services Office)<br>NO.UETT/D&FASO/23/465<br>Date...

- [ ] **candidate 3** (score 0.7123) - UET Taxila UG Admissions
      url: /Advertisement_admission.php
      heading: UET Taxila Admissions > Official resources - [Fall 2025](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) (im...
      chunkKey: `abf448db72516de55d5d0fa51a82ab400daff990e839a74db94c67d91dba596c`
      text: Document Title: UET Taxila UG Admissions URL Path: /Advertisement_admission.php UET Taxila Admissions > Official resources - [Fall 2025](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) (image) - [2Cycle Fall 2025](<https://admissions.uettaxila.edu.pk/images/2Cycle-Fall-2025.jpg>) (image) - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &amp; Technology Taxila...

- [ ] **candidate 4** (score 0.7123) - UET Taxila UG Admissions
      url: /Advertisement_admission.php
      heading: UET Taxila Admissions > Official resources - [Fall 2025](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) (im...
      chunkKey: `b73269d761d764eb0ea619d0297d51e54dc16671ef743731824393737c9c08bb`
      text: Document Title: UET Taxila UG Admissions URL Path: /Advertisement_admission.php UET Taxila Admissions > Official resources - [Fall 2025](<https://admissions.uettaxila.edu.pk/images/Fall_2025.jpg>) (image) - [2Cycle Fall 2025](<https://admissions.uettaxila.edu.pk/images/2Cycle-Fall-2025.jpg>) (image) - [UET Taxila UG Admissions UET Taxila Admissions University of Engineering &amp; Technology Taxila...

- [ ] **candidate 5** (score 0.7120) - Discover UET Taxila
      url: /Discover.php
      heading: UET Taxila Admissions > Official resources - [Discover UET Taxila UET Taxila Admissions University of Engineering &amp; ...
      chunkKey: `d335472b52f99caf8d8d7a0d35c8906939b9b18c7c7d981626c096782530dc38`
      text: Document Title: Discover UET Taxila URL Path: /Discover.php UET Taxila Admissions > Official resources - [Discover UET Taxila UET Taxila Admissions University of Engineering &amp; Technology Taxila Undergraduate Admissions Home Discover Merit List Fee Structure Fees Engineering Programs Fees For Technology Programs Seats Seats Allocation Applicants From Punjab Province Partial-Subsidized Applicant...

_note:_ Candidate 2 marked relevant: a real official notice from the Dues & Financial Aid Services Office, subject "WAIVER OFF TUITION FEE TO THE STUDENTS BELONGING TO FLOOD HIT AREAS" (confirmed via full chunk text) - genuinely on-topic, though the OCR/table extraction is badly garbled (a separate extraction-quality issue, not a relevance issue) and it's a category-specific 2023 waiver (flood-hit areas), not a general need-based program - narrower than what "financially needy" asks for. Candidate 1 (annual report noting ~20% of budget comes from tuition) describes institutional funding, not a student-facing waiver program - not marked. 3/4/5 are nav-link/advertisement stubs, not marked.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked for this specific document)

---

## 32. Where is the UET Taxila main campus located?

queryId: `92caae0e08262a70`

- [x] **candidate 1** (score 0.8091) - UET-Prospectus-2024.pdf
      url: /Downloads/UET-Prospectus-2024.pdf
      heading: UET-Prospectus-2024.pdf > Page 9 > **Administration** > **Location**
      chunkKey: `fb432fb00678ad965cf9952186b747a88f68722d3867aca276df63794348d909`
      text: Document Title: UET-Prospectus-2024.pdf URL Path: /Downloads/UET-Prospectus-2024.pdf ###### **Location**  The University campus is located on the outskirts of Taxila at a distance of 5 km from the city. It is situated near railway station Mohra Shahwali Shah on Taxila-Havelian branch line. The city of Taxila is 35 km from the twin cities of Islamabad and Rawalpindi on the main RawalpindiPeshawar h...

- [x] **candidate 2** (score 0.8012) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 9 > **Administration** > **Location**
      chunkKey: `da2a62794a68ea8a34da9db9169c3a06d43136da0cd644a65fabd4549e2ed820`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### **Location**  The University campus is located on the outskirts of Taxila at a distance of 5 km from the city. It is situated near railway station Mohra Shahwali Shah on Taxila-Havelian branch line. The city of Taxila is 35 km from the twin cities of Islamabad and Rawalpindi on the main RawalpindiPeshawar h...

- [ ] **candidate 3** (score 0.7873) - CEOtalks
      url: /CEOtalks.aspx
      heading: CEOtalks > **Life at UET Taxila**
      chunkKey: `366a04b4a44519c2a78810de048fe934bdec6db0dd1d6d76a904d2f129a3a4e3`
      text: Document Title: CEOtalks URL Path: /CEOtalks.aspx ### **Life at UET Taxila**...

- [x] **candidate 4** (score 0.7843) - Discover UET Taxila
      url: /Discover.php
      heading: UET Taxila Admissions > Undergraduate Admissions
      chunkKey: `28656442d346a1b2858b9abb79ce05f3d28335b4b6b7748298dea5dc181f926a`
      text: Document Title: Discover UET Taxila URL Path: /Discover.php slide image 3](<#>)  [Visual resource: slide image 4](<#>)  [Visual resource: slide image 5](<#>)  The University campus is located on the outskirts of Taxila at a distance of 5 km from the city. It is situated near railway station Mohra Shah Wali Shah on Taxila-Havelian branch line. The city of Taxila is 35 km from the twin cities of Isl...

- [x] **candidate 5** (score 0.7824) - UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA
      url: /OR/downloadFiles/Final_ANNUAL_REPORT_13-14.pdf
      heading: UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA > Page 9 > **ABOUT THE UNIVESITY**
      chunkKey: `f6007caa25253ff95e277886d05326ce68225991347d4ffc0dd17a425e18118f`
      text: Document Title: UNIRERSITY OF ENGINEERING AND TECHNOLOGY TAXILA URL Path: /OR/downloadFiles/Final_ANNUAL_REPORT_13-14.pdf #### **ABOUT THE UNIVESITY**  The University of Engineering and Technology (UET), Taxila is located in the ancient city of Taxila, about 35 km north-west of the capital city of Islamabad on the main Rawalpindi-Peshawar highway. It is located near the historical site of Julian U...

_note:_ Candidates 1, 2, 4, 5 marked relevant: four independent documents (Prospectus 2024, Prospectus 2025, Discover.php, and a 2013-14 annual report) all state consistent, corroborating location facts - '5 km from Taxila city, near Mohra Shah Wali Shah railway station on the Taxila-Havelian branch line, 35 km from Islamabad/Rawalpindi on the Rawalpindi-Peshawar highway' - cross-checked against each other, unlike fee figures this kind of geographic fact does not go stale year to year. Candidate 3 (CEOtalks) is a confirmed near-empty stub, not marked.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (cross-checked against multiple independent corroborating chunks in the corpus, not just the one candidate)

---

## 33. Does UET Taxila have a student hostel on campus?

queryId: `e1d169833b2c6fe2`

- [x] **candidate 1** (score 0.7925) - Why UET Taxila?
      url: /whyus.php
      heading: Why UET Taxila? > Global Recognition > Why Students Choose UET Taxila > Vibrant Campus Life
      chunkKey: `ecb02a527482f3183fac55c355b7e6843c1841514a0b7b7c1df24e10e1a890a2`
      text: Document Title: Why UET Taxila? URL Path: /whyus.php #### Vibrant Campus Life  Beautiful green campus with excellent facilities — hostels, library, sports, mosque, and active student societies....

- [x] **candidate 2** (score 0.7925) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `5a235ddd3d18ae323581977fa2de347228b4789f62efccf08416aa751aae8b05`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Discover departments, hostels, and world-class campus facilities...

- [x] **candidate 3** (score 0.7751) - (not found in chunk text)
      url: (not found in chunk text)
      heading: [Digital Learning and Skill Enrichment Initiative](<https://web.uettaxila.edu.pk/dlsei>) > Facilities & **Services**
      chunkKey: `1471c51933271a97c105c46f55583809d72b89a12fdcca157bf9533659920e6c`
      text: Document Title: Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited ## Facilities & **Services**  - [Visual resource: Hostels  Student Hostels  Hostel accommodation is available at campus for students.](<https://web.uettaxila.edu.pk/Hostels.aspx>) - [Visual resource: Central Library  Library  The Central Library of the University plays a vital role in dissemination...

- [x] **candidate 4** (score 0.7701) - University of Engineering and Technology Taxila, Pakistan
      url: /UETsub/about.htm
      heading: University of Engineering and Technology Taxila, Pakistan
      chunkKey: `f535f741a88abc79e86cfc4e700f0424ff021c28c7a046451d435d5ad55af39b`
      text: Document Title: University of Engineering and Technology Taxila, Pakistan URL Path: /UETsub/about.htm for teachers/ employees, student hostels, guesthouse, post office and bank are housed on campus.  Site developed by NARC UET Taxila Copyright © 2007 University of Engineering and Technology, Taxila . All Rights Reserved....

- [x] **candidate 5** (score 0.7628) - Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited
      url: /UETsub/examination/examViewDtSregS.asp
      heading: [Digital Learning and Skill Enrichment Initiative](<https://web.uettaxila.edu.pk/dlsei>) > Facilities & **Services**
      chunkKey: `e5a1a739dcb84b4ce5bdaca8d29bed6bda97165754deddba58c41b50d1f07ac8`
      text: Document Title: Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited URL Path: /UETsub/examination/examViewDtSregS.asp ## Facilities & **Services**  - [Visual resource: Hostels  Student Hostels  Hostel accommodation is available at campus for students.](<https://web.uettaxila.edu.pk/Hostels.aspx>) - [Visual resource: Central Library  Library  The Central Library of ...

_note:_ All 5 marked relevant: five independent pages all confirm hostels exist on campus ('hostels, library, sports...', 'Hostel accommodation is available at campus for students' x2, 'student hostels, guesthouse... are housed on campus', 'Discover departments, hostels...') - cross-checked against each other, all consistent, a simple yes/no fact well-supported across the corpus.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (cross-checked against multiple independent corroborating chunks in the corpus, not just the one candidate)

---

## 34. What transport facilities does UET Taxila provide for students?

queryId: `bb92759aba56e8f6`

- [x] **candidate 1** (score 0.7930) - (not found in chunk text)
      url: (not found in chunk text)
      heading: [Digital Learning and Skill Enrichment Initiative](<https://web.uettaxila.edu.pk/dlsei>) > Facilities & **Services**
      chunkKey: `d2fcfbfa12f8f0c3effd969ec4b7f9de01269fbaa05010a801c5615eeb3f3cfd`
      text: Document Title: Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited [Visual resource: Cafeteria  Cafeteria  Main Cafeteria facility for students.](<https://web.uettaxila.edu.pk/Cafeteria.aspx>) - [Visual resource: Transport  Transport  Adequate transport facility is provided for students and the busses are plying between Rawalpindi, Islamabad, Hassan Abdal, Wah Can...

- [x] **candidate 2** (score 0.7926) - Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited
      url: /UETsub/examination/examViewDtSregS.asp
      heading: [Digital Learning and Skill Enrichment Initiative](<https://web.uettaxila.edu.pk/dlsei>) > Facilities & **Services**
      chunkKey: `02fd6588dc612d043caf6ba9f51ce49b1bbf2fdfd45ac68a1ff62bed30297a65`
      text: Document Title: Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited URL Path: /UETsub/examination/examViewDtSregS.asp [Visual resource: Cafeteria  Cafeteria  Main Cafeteria facility for students.](<https://web.uettaxila.edu.pk/Cafeteria.aspx>) - [Visual resource: Transport  Transport  Adequate transport facility is provided for students and the busses are plying be...

- [ ] **candidate 3** (score 0.7552) - (not found in chunk text)
      url: (not found in chunk text)
      heading: [Digital Learning and Skill Enrichment Initiative](<https://web.uettaxila.edu.pk/dlsei>) > Facilities & **Services**
      chunkKey: `1471c51933271a97c105c46f55583809d72b89a12fdcca157bf9533659920e6c`
      text: Document Title: Strategic Academia-Industry Collaboration Between UET Taxila and Fast Cables Limited ## Facilities & **Services**  - [Visual resource: Hostels  Student Hostels  Hostel accommodation is available at campus for students.](<https://web.uettaxila.edu.pk/Hostels.aspx>) - [Visual resource: Central Library  Library  The Central Library of the University plays a vital role in dissemination...

- [ ] **candidate 4** (score 0.7504) - UET Taxila UG Admissions
      url: /Bus_Route.php
      heading: UET Taxila UG Admissions
      chunkKey: `937ad17feac70bec38a2b707e2606a1e76bdafd88390df95c5009a932f8f4764`
      text: Document Title: UET Taxila UG Admissions URL Path: /Bus_Route.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Bus_Route.php>...

- [ ] **candidate 5** (score 0.7428) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `5a235ddd3d18ae323581977fa2de347228b4789f62efccf08416aa751aae8b05`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Discover departments, hostels, and world-class campus facilities...

_note:_ Candidates 1, 2 marked relevant: both state real, detailed transport information - 'Adequate transport facility is provided for students and the busses are plying between Rawalpindi, Islamabad, Hassan Abdal, Wah Cantt...'. Candidate 3 (full text checked) is the HOSTEL/library facilities chunk of the same document, not the transport-specific chunk - wrong facility, not marked. Candidate 4 (Bus_Route.php) is confirmed (full text checked) a near-empty header stub despite the document itself genuinely being about bus routes (see query 35's candidate 2, a different chunk of this same page, which does have real timing content) - this specific chunk has no content. Candidate 5 is a generic explore.php stub.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 35. What is the library timing at UET Taxila?

queryId: `f86cfd8aa6d35c49`

- [ ] **candidate 1** (score 0.7389) - Library Rules
      url: /LibraryRules.aspx
      heading: Library Rules > **Central Library UET Taxila**
      chunkKey: `dd23ce96a8aa1d8ab769eeade44c4eb6018a603730c4dce12f9f26b89f6cfd0c`
      text: Document Title: Library Rules URL Path: /LibraryRules.aspx ### **Central Library UET Taxila**...

- [ ] **candidate 2** (score 0.7241) - UET Taxila UG Admissions
      url: /Bus_Route.php
      heading: UET Taxila Admissions > Wah Cantt/Taxila
      chunkKey: `a428769fbf99509e45a47972b0ada96d693df2fd66cacdce5edd104acf678a45`
      text: Document Title: UET Taxila UG Admissions URL Path: /Bus_Route.php ## Wah Cantt/Taxila  | Sr.# | Starting Point | **Via** | **Time** | | --- | --- | --- | --- | | 1. | Taxila Bus Stand | Taxila Bus Stand to Campus | 7:00 AM | | 2. | Taxila Bus Stand | Taxila Bus Stand to Campus | 7:45 AM | | 3. | Taxila By Pass (Tank Chowk) | Taxila By Pass to Campus | 7:15 AM | | 4. | Taxila By Pass (Tank Chowk) |...

- [ ] **candidate 3** (score 0.7241) - Library
      url: /library.aspx
      heading: Library > **Central Library UET Taxila**
      chunkKey: `f046789127bd9414ae00f7676a0ebb4135617b5fb96b2dba1484b4c0ce2e0289`
      text: Document Title: Library URL Path: /library.aspx ### **Central Library UET Taxila**  [About](<https://web.uettaxila.edu.pk/Library.aspx>)  [Search Books (OPAC)](<http://opac.uettaxila.edu.pk/>)  [HEC Digital Library](<http://www.digitallibrary.edu.pk/uettaxila.html>)  Services  FAQs  [Ask Librarian](<https://web.uettaxila.edu.pk/AskLibrarian.aspx>)  [Library Committee](<https://web.uettaxila.edu.pk...

- [ ] **candidate 4** (score 0.7236) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 5** (score 0.7227) - AskLibrarian
      url: /AskLibrarian.aspx
      heading: AskLibrarian > **Central Library UET Taxila**
      chunkKey: `ec69b56ed39f02239ee746dc38896baea2453b82fc8020a471a0adbb51b628e8`
      text: Document Title: AskLibrarian URL Path: /AskLibrarian.aspx ### **Central Library UET Taxila**  [About](<https://web.uettaxila.edu.pk/Library.aspx>)  [OPAC](<http://library.uettaxila.edu.pk:8000/>)  [HEC Digital Library](<http://www.digitallibrary.edu.pk/uettaxila.html>)  Services  FAQs  [Ask Librarian](<https://web.uettaxila.edu.pk/AskLibrarian.aspx>)  [Library Committee](<https://web.uettaxila.edu...

_note:_ None of the 5 relevant. Candidate 1 (Library Rules) and candidate 3 (Library page) are confirmed (full text checked) nav-link listings with no timing stated. Candidate 2 (Bus_Route.php) has a real timing TABLE, but it's a bus schedule, not library hours - wrong topic despite containing times. Candidate 4 is a confirmed near-empty stub. Candidate 5 (AskLibrarian) is confirmed (full text checked) a nav-link listing, no hours stated. No candidate states actual library opening hours.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 36. Where do I submit form 17-B for clearance at UET Taxila?

queryId: `136c2516eded904b`

- [ ] **candidate 1** (score 0.6857) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `a79924742cd764cb0a73daa2a6957e57ad7e463c4fb5cc09373b93e716618f76`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  has been attached along with all other necessary documents.   - [How to apply for the Degree?  ](<#questionul>) - A Degree can be received from Examination Branch UET Taxila by submitting “Degree-Transcript- SGS-Provisional etc. Form (...

- [ ] **candidate 2** (score 0.6779) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `026accb5be0716971521c037d9821484c57fdce03b3ff4a8a8e85a6f5632855a`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  on UET website in Examinations Download Section and depositing prescribed fee in the bank.   A completely filled Form along with required documents be submitted at **Student Facilitation Center opposite to HBL Bank UET Taxila** during ...

- [ ] **candidate 3** (score 0.6768) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila > Official resources - [POST form destination](<https://web.uettaxila.edu.pk/uetSub/$url>)
      chunkKey: `14e94df4164e484950e4dbce3f5654e8b27e2e2358cd63819d0fbba6cff3548f`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm ## Official resources - [POST form destination](<https://web.uettaxila.edu.pk/uetSub/$url>)...

- [ ] **candidate 4** (score 0.6733) - UET Taxila Undergraduate Admissions
      url: /Downloads.php
      heading: UET Taxila Undergraduate Admissions > Prospectus > Admission Forms
      chunkKey: `5dc5996c2be8011b3546106233b998c3fc3f412f3c0f20defe046a3c5c1c2407`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Downloads.php permit / visa must be valid at least up till the closing date of submission of applications)...

- [ ] **candidate 5** (score 0.6732) - UET Taxila
      url: /uetSub/PG_seminar/index.htm
      heading: UET Taxila > Official resources - [POST form destination](<https://web.uettaxila.edu.pk/uetSub/$url>)
      chunkKey: `ef00f8eee0c19ad46896456d290d97e89976d3bbc3db9735a6430742f8e344ac`
      text: Document Title: UET Taxila URL Path: /uetSub/PG_seminar/index.htm ## Official resources - [POST form destination](<https://web.uettaxila.edu.pk/uetSub/$url>)...

_note:_ None of the 5 relevant. Candidates 1/2 (Examination FAQ) describe a general 'Degree-Transcript-SGS-Provisional' form submission process, not confirmed to be specifically 'Form 17-B' - the query names a specific form number this corpus gives no way to independently verify, so matching a generic form-submission answer to it risks being wrong rather than merely incomplete. Candidates 3/5 are broken 'POST form destination' link fragments. Candidate 4 is about visa/residence-permit timing, unrelated.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 37. Is CS-301 equivalent to SE-301 at UET Taxila?

queryId: `c6d36166ce93efaf`

- [ ] **candidate 1** (score 0.6283) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila > Visual resources requiring text extraction - [Software Engineering](<https://admissions.uettaxila.e...
      chunkKey: `746919df0544c48487bd1e89f8fd05aebff1ea7a02be638e00d488c824b93dce`
      text: Document Title: Explore UET Taxila URL Path: /explore.php uettaxila. edu. pk/assets/images/UniPics/Departments/CS. jpg>) — Computer Science 🏫 Departments...

- [ ] **candidate 2** (score 0.6145) - Department of Software Engineering, UET Taxila
      url: /SED/regSchedulePG.asp
      heading: Department of Software Engineering, UET Taxila > Official resources - [Results](<https://web.uettaxila.edu.pk/SED/result...
      chunkKey: `d8f448402ae71fa80b1e69ef8cd605bc4883af8c02a57493a5e8c267a292b77a`
      text: Document Title: Department of Software Engineering, UET Taxila URL Path: /SED/regSchedulePG.asp q=&submit=Search>) - [© 2024, www. uettaxila. edu. pk](<https://www. uettaxila. edu. pk/>)...

- [ ] **candidate 3** (score 0.6143) - Memorandum of Understanding (MoU) between UET, Taxila Ihsan Trust Karachi
      url: /EventDetails/Memorandum-of-Understanding-(MoU)-between-UET,-Taxila-Ihsan-Trust-Karachi
      heading: Memorandum of Understanding (MoU) between UET, Taxila Ihsan Trust Karachi > Alhamdolillah, one more University being add...
      chunkKey: `87af7841a9e856c9d2163452063374701f00ea02cc495ad1ff31075e4ebed971`
      text: Document Title: Memorandum of Understanding (MoU) between UET, Taxila Ihsan Trust Karachi URL Path: /EventDetails/Memorandum-of-Understanding-(MoU)-between-UET,-Taxila-Ihsan-Trust-Karachi to carry on and complete their Undergraduate, Graduate, MS, Phd Programs from UET Taxila.  Images courtesy: [https://www.freepik.com/](<https://www.freepik.com/>)  [Scroll](<#>)...

- [ ] **candidate 4** (score 0.6138) - Why UET Taxila?
      url: /whyus.php
      heading: Why UET Taxila? > Global Recognition > Research Excellence > Strategic Location > OBE-Level PEC & NCEAC Accredited Progr...
      chunkKey: `ccc9fe69fabdd7deda55f1a1cfc7f30fd478d24f6c908e6e9a548081093bbf97`
      text: Document Title: Why UET Taxila? URL Path: /whyus.php ##### OBE-Level PEC & NCEAC Accredited Programs...

- [ ] **candidate 5** (score 0.6118) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

_note:_ None of the 5 relevant - none of the 5 (explore.php nav stub, an SED registration-schedule stub, an unrelated MoU announcement, a 'Why UET Taxila' accreditation blurb, and a near-empty Discover fragment) address course-code equivalence between CS-301 and SE-301 at all. This may genuinely not be answerable from this corpus.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 38. What is the procedure to apply for a degree certificate at UET Taxila?

queryId: `21ce9642f1250090`

- [ ] **candidate 1** (score 0.7848) - UET Taxila UG Admissions
      url: /ProcedureAndRequirements2.php
      heading: UET Taxila UG Admissions
      chunkKey: `7a3156675bf22e1742af21f2f38ad80ac867d7794a3b549e92a188f95e00433f`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProcedureAndRequirements2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ProcedureAndRequirements2.php>...

- [x] **candidate 2** (score 0.7678) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `a79924742cd764cb0a73daa2a6957e57ad7e463c4fb5cc09373b93e716618f76`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  has been attached along with all other necessary documents.   - [How to apply for the Degree?  ](<#questionul>) - A Degree can be received from Examination Branch UET Taxila by submitting “Degree-Transcript- SGS-Provisional etc. Form (...

- [ ] **candidate 3** (score 0.7646) - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > How can I apply for Undergraduate Admissions at UET Taxila?
      chunkKey: `549036e9c37315e68fec9ae6c06d62c1a0a05d7e9fb50f4aaa9b25a5c14995f1`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## How can I apply for Undergraduate Admissions at UET Taxila?  Visit the official admission portal **admissions.uettaxila.edu.pk** and click on “MY UET”. Register using your CNIC/Form-B number, fill the online application form, and deposit the Rs. 4000 application processing fee through HBL Konnect or Internet Banking....

- [ ] **candidate 4** (score 0.7636) - UET Taxila UG Admissions
      url: /ContactUs.php
      heading: UET Taxila UG Admissions
      chunkKey: `6cac46287dd7852d3bda0f66a760a2d7e606807ce57fee80d9286b4d08541b94`
      text: Document Title: UET Taxila UG Admissions URL Path: /ContactUs.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/ContactUs.php>...

- [ ] **candidate 5** (score 0.7623) - UET Taxila UG Admissions
      url: /ProspectusAvailability.php
      heading: UET Taxila Admissions > Official resources - [Admission 2023 Guidelines](<https://admissions. uettaxila. edu. pk/Downloa...
      chunkKey: `3f76c3ea700d3862d2411e5d8b2e19423d9d1785c0c2ef0ea1a4c120a9102bf6`
      text: Document Title: UET Taxila UG Admissions URL Path: /ProspectusAvailability.php uettaxila.  edu.  pk/Calculator.  php>) - [Procedure &amp; Requirements](<https://admissions....

_note:_ Candidate 2 marked relevant: Examination FAQ states directly - 'How to apply for the Degree? A Degree can be received from Examination Branch UET Taxila by submitting Degree-Transcript-SGS-Provisional etc. Form...'. Candidate 1 is a confirmed near-empty stub. Candidate 3 (FAQ 'How can I apply for Undergraduate Admissions') is about ADMISSION application, not the degree certificate - wrong topic despite the keyword overlap on 'apply'. Candidates 4/5 are confirmed nav stubs/link listings.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 39. Can I freeze my semester at UET Taxila and what is the procedure?

queryId: `9a07498d5501476c`

- [ ] **candidate 1** (score 0.7173) - Price Rs
      url: /IE/downloads/ug/Freezing-Semester-Form-FS1.pdf
      heading: **UNIVERSITY OF ENGINEERING AND TECHNOLOGY TAXILA**
      chunkKey: `f68a8c83695e81f4f16d850438d104a99aa0730f194667eaca73e7918c643067`
      text: Document Title: Price Rs URL Path: /IE/downloads/ug/Freezing-Semester-Form-FS1.pdf # **UNIVERSITY OF ENGINEERING AND TECHNOLOGY TAXILA**...

- [x] **candidate 2** (score 0.7105) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `132cc45bfc91bd0fee26227bd1790990dba64825b93d0de035fe3e077713ed98`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  on form and prevailing Policy of the University will apply.   - [How to get freezing of a Semester?  ](<#questionul>) - If student has some valid reasons and want to get freeze one or Two Consecutive Semesters then Student can apply fo...

- [x] **candidate 3** (score 0.6989) - FORM UG-V (Semester Freeze).pdf
      url: /Downloads/ExamBranch/UG/FORM%20UG-V%20(Semester%20Freeze).pdf
      heading: **<u>FORM UG-V</u>** <u>(Semester Freeze)</u> **UNIVERSITY OF ENGINEERING AND TECHNOLOGY TAXILA** **<u>APPLICATION FORM ...
      chunkKey: `1bfe40dd95c20fd48bade917418dbb39ec24eacb80fb23200b3204fb709bd542`
      text: Document Title: FORM UG-V (Semester Freeze).pdf URL Path: /Downloads/ExamBranch/UG/FORM%20UG-V%20(Semester%20Freeze).pdf # **<u>FORM UG-V</u>** <u>(Semester Freeze)</u> **UNIVERSITY OF ENGINEERING AND TECHNOLOGY TAXILA** **<u>APPLICATION FORM FOR FREEZING OF SEMESTER</u>**  (To be submitted to the Chairman of Concerned Department)...

- [x] **candidate 4** (score 0.6894) - Price Rs
      url: /IE/downloads/ug/Freezing-Semester-Form-FS1.pdf
      heading: **UNIVERSITY OF ENGINEERING AND TECHNOLOGY TAXILA** > **<u>APPLICATION FORM FOR FREEZING OF SEMESTER</u>** > **<u>UNIVER...
      chunkKey: `f5ec67ad032d40a574afd5710573f5e66455941833bc41cdc6cd8534a1879ade`
      text: Document Title: Price Rs URL Path: /IE/downloads/ug/Freezing-Semester-Form-FS1.pdf ### **<u>UNIVERSITY RULES GOVERNING FREEZING OF SEMESTER(S)</u>**  1. Students will be allowed to freeze a semester only once during the entire degree programme owing to some extreme and genuine reason to be determined by the Departmental Semester Committee.  2. Students shall not be allowed to freeze their First an...

- [ ] **candidate 5** (score 0.6879) - Seminars
      url: /Seminars.aspx
      heading: Seminars > **Life at UET Taxila**
      chunkKey: `e732a12e5e3d98b57b66144df505e94284caf4f229db44e1cf9a09ecd6f013cb`
      text: Document Title: Seminars URL Path: /Seminars.aspx ### **Life at UET Taxila**...

_note:_ Candidates 2, 3, 4 marked relevant: candidate 2 (Examination FAQ) states 'If student has some valid reasons and want to get freeze one or Two Consecutive Semesters then Student can apply for...'; candidate 3 (FORM UG-V) states the form is 'To be submitted to the Chairman of Concerned Department'; candidate 4 (a different chunk of the same freezing-form PDF as candidate 1) states the actual rules ('Students will be allowed to freeze a semester only once...'). Candidate 1 (full text checked) is a header-only chunk of that same PDF with no rules content, not marked. Candidate 5 (Seminars.aspx) is unrelated campus-life content.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 40. What is the grading system used at UET Taxila?

queryId: `6988aa3c5815e338`

- [ ] **candidate 1** (score 0.7602) - (not found in chunk text)
      url: (not found in chunk text)
      heading: Undergraduate Admissions 2026 > 📢 Important Announcements > 🌍 Discover UET Taxila
      chunkKey: `8a6badf336c6f4718678dd324f003349789299bd686a7bd425c393b462658141`
      text: Document Title: Undergraduate Admissions 2026 ### 🌍 Discover UET Taxila...

- [ ] **candidate 2** (score 0.7570) - Evaluation System UET Taxila
      url: /evs/EED_ES/FeedBack/evaluations.asp
      heading: Evaluation System UET Taxila
      chunkKey: `feb75c0c6f30c59bf07ab501c622c727cf2cd2b8ba90e42a92bda679986ffdae`
      text: Document Title: Evaluation System UET Taxila URL Path: /evs/EED_ES/FeedBack/evaluations.asp # Evaluation System UET Taxila  Source: <https://web.uettaxila.edu.pk/evs/EED_ES/FeedBack/evaluations.asp?Tech=PG>  Visual resource: TOP  Please contact us. [Evaluation System UET Taxila] Ph# 051-9047467/ Email:narc@uettaxila.edu.pk...

- [ ] **candidate 3** (score 0.7530) - UET Taxila UG Admissions
      url: /Result.php
      heading: UET Taxila UG Admissions
      chunkKey: `8a5f1523621f157e26d7aed08a88f9fe485eb074f5d329acc96ae0bcf73af90d`
      text: Document Title: UET Taxila UG Admissions URL Path: /Result.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Result.php>...

- [ ] **candidate 4** (score 0.7518) - UET Taxila UG Admissions
      url: /Test_Centers.php
      heading: UET Taxila UG Admissions
      chunkKey: `c4a06785c311d32cdf5f3a8609813e9fbf77ffb46a6b24e30f929f454aa08cfd`
      text: Document Title: UET Taxila UG Admissions URL Path: /Test_Centers.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Test_Centers.php>...

- [ ] **candidate 5** (score 0.7512) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

_note:_ None of the 5 relevant. Candidate 1 is a confirmed near-empty Discover fragment. Candidate 2 ('Evaluation System') is a teaching/course feedback system contact stub, not the academic grading system - wrong topic despite the 'evaluation' keyword overlap. Candidates 3/4/5 are confirmed near-empty admissions stubs. No candidate states the actual grading system used.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 41. daakhila ki akhri tarikh kab hai UET Taxila mein?

queryId: `d9fc562f95137dc3`

- [ ] **candidate 1** (score 0.7336) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila
      chunkKey: `d61dec49b36d2653f743c4036a034104c9424800c828caac8650f46b4e3bf7bb`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PEC_visit_env/index.htm>  Visual resource: uetH UETsb 01...

- [ ] **candidate 2** (score 0.7336) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila
      chunkKey: `3a22ea073b800dff443977207583d48d95a36c8f5aea6c3edb522cdc65167f1c`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PEC_visit_env/index.htm>  Visual resource: uetH UETsb 01...

- [ ] **candidate 3** (score 0.7154) - CEOtalks
      url: /CEOtalks.aspx
      heading: CEOtalks > **Life at UET Taxila**
      chunkKey: `366a04b4a44519c2a78810de048fe934bdec6db0dd1d6d76a904d2f129a3a4e3`
      text: Document Title: CEOtalks URL Path: /CEOtalks.aspx ### **Life at UET Taxila**...

- [ ] **candidate 4** (score 0.7077) - Discover UET Taxila
      url: /Discover.php
      heading: Discover UET Taxila
      chunkKey: `078c315352e10e413eb33c7de77919bd1986b5a2011036c2c0d0ddfada3050c1`
      text: Document Title: Discover UET Taxila URL Path: /Discover.php # Discover UET Taxila  Source: <https://admissions.uettaxila.edu.pk/Discover.php>...

- [ ] **candidate 5** (score 0.7005) - Convocations
      url: /Convocations.aspx
      heading: Convocations > **Life at UET Taxila**
      chunkKey: `501aeb0bba903003520af603e1351c877baa2dc3d6fbc33874b4056a8f12ae08`
      text: Document Title: Convocations URL Path: /Convocations.aspx ### **Life at UET Taxila**...

_note:_ None of the 5 relevant - all confirmed (full text checked in query 42/43's identical candidates, or directly here) near-empty stub pages. No admission deadline date stated.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 42. fees jama karwane ka tariqa kya hai UET Taxila mein?

queryId: `b87404f973dbea76`

- [ ] **candidate 1** (score 0.6896) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila
      chunkKey: `3a22ea073b800dff443977207583d48d95a36c8f5aea6c3edb522cdc65167f1c`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PEC_visit_env/index.htm>  Visual resource: uetH UETsb 01...

- [ ] **candidate 2** (score 0.6896) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila
      chunkKey: `d61dec49b36d2653f743c4036a034104c9424800c828caac8650f46b4e3bf7bb`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PEC_visit_env/index.htm>  Visual resource: uetH UETsb 01...

- [ ] **candidate 3** (score 0.6765) - CEOtalks
      url: /CEOtalks.aspx
      heading: CEOtalks > **Life at UET Taxila**
      chunkKey: `366a04b4a44519c2a78810de048fe934bdec6db0dd1d6d76a904d2f129a3a4e3`
      text: Document Title: CEOtalks URL Path: /CEOtalks.aspx ### **Life at UET Taxila**...

- [ ] **candidate 4** (score 0.6753) - UET Taxila UG Admissions
      url: /Schedule2.php
      heading: UET Taxila UG Admissions
      chunkKey: `33f4179c6c4036574fda1b0417bb3f62f3d26220356b361f23b0eb57cdc35e1e`
      text: Document Title: UET Taxila UG Admissions URL Path: /Schedule2.php # UET Taxila UG Admissions  Source: <https://admissions.uettaxila.edu.pk/Schedule2.php>...

- [ ] **candidate 5** (score 0.6731) - UET Taxila
      url: /uetSub/PG_seminar/index.htm
      heading: UET Taxila
      chunkKey: `b1f66bcd4cef6138b5cdcac02649a193e4c0e18bfa6c507493bc48ba3e10856b`
      text: Document Title: UET Taxila URL Path: /uetSub/PG_seminar/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PG_seminar/index.htm>  Visual resource: uetH UETsb 01...

_note:_ None of the 5 relevant - all are near-empty navigation stub pages (title + source URL + a bare "Visual resource" line, no substantive content), confirmed by reading the chunk text directly. Likely a cross-lingual gap: this Roman Urdu query embeds/matches poorly against these thin English stub pages rather than against any real payment-procedure content in the corpus.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source needed - these chunks are objectively near-empty)

---

## 43. chuttiyan kab hongi UET Taxila mein?

queryId: `1591838299e34517`

- [ ] **candidate 1** (score 0.7199) - CEOtalks
      url: /CEOtalks.aspx
      heading: CEOtalks > **Life at UET Taxila**
      chunkKey: `366a04b4a44519c2a78810de048fe934bdec6db0dd1d6d76a904d2f129a3a4e3`
      text: Document Title: CEOtalks URL Path: /CEOtalks.aspx ### **Life at UET Taxila**...

- [ ] **candidate 2** (score 0.7054) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila
      chunkKey: `d61dec49b36d2653f743c4036a034104c9424800c828caac8650f46b4e3bf7bb`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PEC_visit_env/index.htm>  Visual resource: uetH UETsb 01...

- [ ] **candidate 3** (score 0.7054) - UET Taxila
      url: /uetSub/PEC_visit_env/index.htm
      heading: UET Taxila
      chunkKey: `3a22ea073b800dff443977207583d48d95a36c8f5aea6c3edb522cdc65167f1c`
      text: Document Title: UET Taxila URL Path: /uetSub/PEC_visit_env/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PEC_visit_env/index.htm>  Visual resource: uetH UETsb 01...

- [ ] **candidate 4** (score 0.6826) - Convocations
      url: /Convocations.aspx
      heading: Convocations > **Life at UET Taxila**
      chunkKey: `501aeb0bba903003520af603e1351c877baa2dc3d6fbc33874b4056a8f12ae08`
      text: Document Title: Convocations URL Path: /Convocations.aspx ### **Life at UET Taxila**...

- [ ] **candidate 5** (score 0.6801) - UET Taxila
      url: /uetSub/PG_seminar/index.htm
      heading: UET Taxila
      chunkKey: `b1f66bcd4cef6138b5cdcac02649a193e4c0e18bfa6c507493bc48ba3e10856b`
      text: Document Title: UET Taxila URL Path: /uetSub/PG_seminar/index.htm # UET Taxila  Source: <https://web.uettaxila.edu.pk/uetSub/PG_seminar/index.htm>  Visual resource: uetH UETsb 01...

_note:_ None of the 5 relevant - all confirmed (full text checked) near-empty stub pages or a one-off event page (CEOtalks, PEC_visit_env index stubs, Convocations 'Life at UET Taxila' fragment). No holiday/break dates stated.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 44. UET Taxila mein hostel ki fees kitni hai?

queryId: `57aa4c0c6221f855`

- [ ] **candidate 1** (score 0.6829) - Hostels
      url: /hostels/
      heading: Hostels > HOSTEL ADMINISTRATION OF UET,TAXILA
      chunkKey: `2a22b33fbe225ae2e2b21e257306422447d88759050bdd2a6d76a3ac2d1a8bb3`
      text: Document Title: Hostels URL Path: /hostels/ ## HOSTEL ADMINISTRATION OF UET,TAXILA...

- [ ] **candidate 2** (score 0.6336) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila > 🏫 Departments > 🏠 Boys Hostels > Girls Hostels
      chunkKey: `dd07c8de833a42a30de0ac141458e9770d9718381c65c2a585c37cfdbcb5fca9`
      text: Document Title: Explore UET Taxila URL Path: /explore.php ##### Girls Hostels  Visual resource: Girls Hostel...

- [ ] **candidate 3** (score 0.6280) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila > 🏫 Departments > 🏠 Boys Hostels
      chunkKey: `6179a97b2494db2aca3135acb3b8280304cbbf367e5221a3bccbc2fd7563d53c`
      text: Document Title: Explore UET Taxila URL Path: /explore.php ### 🏠 Boys Hostels  Visual resource: Boys Hostel...

- [ ] **candidate 4** (score 0.6222) - Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students
      url: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students
      heading: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students > Contact details
      chunkKey: `503f5da3ef8fd3790ac8fe4c589c69441779335e3a947fdfb40a77307ad830bc`
      text: Document Title: Alumni Association UET Taxila Hosts Iftar Dinner for Hostel Students URL Path: /EventDetails/Alumni-Association-UET-Taxila-Hosts-Iftar-Dinner-for-Hostel-Students ## Contact details  - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

- [ ] **candidate 5** (score 0.6115) - Explore UET Taxila
      url: /explore.php
      heading: Explore UET Taxila
      chunkKey: `5a235ddd3d18ae323581977fa2de347228b4789f62efccf08416aa751aae8b05`
      text: Document Title: Explore UET Taxila URL Path: /explore.php # Explore UET Taxila  Discover departments, hostels, and world-class campus facilities...

_note:_ None of the 5 relevant - these are hostel administration/facilities pages and an alumni-event page, none state a hostel fee amount. The real hostel charges (Hostel Security 8,000, Mess Security 8,000, Room Rent 5,000, etc. - Prospectus Table 30.1's "Additional for Hostel Resident" section) exist in the corpus but were not retrieved for this query.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (checked against Prospectus 2024/2025 Table 30.1's hostel-charges section, visually verified against the source PDF page image earlier this session)

---

## 45. admission k liye zaruri documents kya hain?

queryId: `a670a78c21212bf6`

- [x] **candidate 1** (score 0.6412) - Frequently Asked Questions (FAQs)
      url: /FAQS.php
      heading: Frequently Asked Questions (FAQs) > What documents are required at the time of admission?
      chunkKey: `72dfb5b6f2334d9edc6744468f9e445e5c4810a7960c7a200346c279227b2b6b`
      text: Document Title: Frequently Asked Questions (FAQs) URL Path: /FAQS.php ## What documents are required at the time of admission?  Original + attested photocopies of 1. SSC 2. HSSC/DAE / Equivalent 3. TCAT/ECAT/Equivalent result card 4. CNIC/Form-B 5. Father’s CNIC 6. Domicile 7. recent passport size photographs For More Information kindly read the propectus available online to check the needed docum...

- [ ] **candidate 2** (score 0.5626) - Admission_Guidelines_2023.pdf
      url: /Downloads/Admission_Guidelines_2023.pdf
      heading: Admission_Guidelines_2023.pdf > **27** **<u>Documents to be attached with Form (F-I)</u>**
      chunkKey: `bb2312c31951d094f3ce123c99acf430957c2280c42d92651c466931efedc6d1`
      text: Document Title: Admission_Guidelines_2023.pdf URL Path: /Downloads/Admission_Guidelines_2023.pdf ## **27** **<u>Documents to be attached with Form (F-I)</u>**  An applicant must exercise great care in ensuring that his application form (F-I) is complete and submitted online on or before the closing date. If an applicant secures admission in a particular merit list, he will have to submit the follo...

- [ ] **candidate 3** (score 0.5542) - Admission_Guidelines_2023.pdf
      url: /Downloads/Admission_Guidelines_2023.pdf
      heading: Admission_Guidelines_2023.pdf > **27** **<u>Documents to be attached with Form (F-I)</u>** > **27.2 Additional Documents...
      chunkKey: `1efadc56fc54d052aece13664c1a911d674b2cc6d31fb2b53d40bd3fce5458bc`
      text: Document Title: Admission_Guidelines_2023.pdf URL Path: /Downloads/Admission_Guidelines_2023.pdf ### **27.2 Additional Documents (Mandatory)**...

- [x] **candidate 4** (score 0.5495) - condenced_maths_admission_form.pdf
      url: /Downloads/condenced_maths_admission_form.pdf
      heading: **ADMISSION FORM-2026** > **4. Documents Required**
      chunkKey: `1030850755a855894136841cc7cc5e1c07305c8f5fa6e3f8047518e0dab8f150`
      text: Document Title: condenced_maths_admission_form.pdf URL Path: /Downloads/condenced_maths_admission_form.pdf ## **4. Documents Required**  - □ One Photocopy of SSC & HSSC  - □ One Photocopy of ID card/Form B  - □ One Passport-Sized Photograph  - □ Original Paid Bank Challan _(Make Photocopy for your Record)_...

- [ ] **candidate 5** (score 0.5444) - Admission_Guidelines_2023.pdf
      url: /Downloads/Admission_Guidelines_2023.pdf
      heading: Admission_Guidelines_2023.pdf > Page 13 > **Notes:**
      chunkKey: `ac15d4eb308ecf1d300bd220ed1eb0fd9f04b23d43d724c3b043a4269f8a0068`
      text: Document Title: Admission_Guidelines_2023.pdf URL Path: /Downloads/Admission_Guidelines_2023.pdf be accepted. Only original attested copies from the concerned Pakistani embassy will be accepted.  3. The residence permit / visa must be valid at least up till the closing date of submission of applications....

_note:_ Candidates 1, 4 marked relevant: candidate 1 (FAQ) states the real general UG document list directly - 'Original + attested photocopies of SSC, HSSC/DAE, TCAT/ECAT result card, CNIC/Form-B, Father's CNIC, Domicile, photographs'. Candidate 4 (condensed maths admission form) states a real, substantively similar document list for that specific program - 'Photocopy of SSC & HSSC, ID card/Form B, Passport-Sized Photograph, Original Paid Bank Challan', corroborating candidate 1's core list. Candidates 2/3/5 (Admission_Guidelines_2023.pdf, full text checked) are section headers cut off before any actual document list - a chunking-boundary issue, not marked.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 46. eligibility criteria

queryId: `26e877048af0f6ee`

- [ ] **candidate 1** (score 0.6950) - Admission Eligibility
      url: /Admission_Eligibility.php
      heading: Admission Eligibility > Eligibility Criteria by Program
      chunkKey: `3d21e74897c9edc70e38f3456bbc3a317ae81f546d087cca503b465eaa7bf78f`
      text: Document Title: Admission Eligibility URL Path: /Admission_Eligibility.php ##### Eligibility Criteria by Program...

- [ ] **candidate 2** (score 0.6554) - Admission Eligibility
      url: /Admission_Eligibility.php
      heading: Admission Eligibility
      chunkKey: `fae958328bf81721bcb44749642c8e352e0d7899acb58bbb16394f75bd6079a8`
      text: Document Title: Admission Eligibility URL Path: /Admission_Eligibility.php # Admission Eligibility  Source: <https://admissions.uettaxila.edu.pk/Admission_Eligibility.php>  🚨 Undergraduate Admissions Fall 2026 | Registration Started...

- [ ] **candidate 3** (score 0.6086) - UET Taxila Undergraduate Admissions
      url: /Downloads.php
      heading: UET Taxila Undergraduate Admissions > Official resources - [Admission 2023 Guidelines](<https://admissions.uettaxila.edu...
      chunkKey: `10d1c684ad96d6ad45f265a91c10351dd07f5a696f319ed6c37f844ccacd2159`
      text: Document Title: UET Taxila Undergraduate Admissions URL Path: /Downloads.php [Admission Eligibility](<https://admissions. uettaxila. edu. pk/Admission_Eligibility. php>)...

- [ ] **candidate 4** (score 0.6024) - UET-Prospectus-2025.pdf
      url: /Downloads/UET-Prospectus-2025.pdf
      heading: **UNDERGRADUATE PROSPECTUS 2025** > Page 145 > **<mark>23 Categories and Symbols</mark>** > eligible to apply in this ca...
      chunkKey: `6d0c1b163d3c089d1d3d5149299fcb2d605f6f0fddd6a93f2dcb1931b4bf2f45`
      text: Document Title: UET-Prospectus-2025.pdf URL Path: /Downloads/UET-Prospectus-2025.pdf ###### eligible to apply in this category....

- [x] **candidate 5** (score 0.5874) - Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.) [Start Date: 10 th June, 2024; End Date: 22 nd August, 2022]
      url: /ProcedureAndRequirement
      heading: Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I &amp; Phase-II)...
      chunkKey: `7b6c2da68f148c00a079606f2385e748b51ac18d215d8df968aa29750c079980`
      text: Document Title: Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.) [Start Date: 10 th June, 2024; End Date: 22 nd August, 2022] URL Path: /ProcedureAndRequirements.php php>) - [Percentage Calculator](<https://admissions. uettaxila. edu. pk/Calculator. php>)...

_note:_ Candidate 5 marked relevant: although this chunk's body text is just a nav link, its own DOCUMENT TITLE field (as crawled) states real, correct eligibility information directly - 'Admission Procedure (Only those candidates are eligible to apply who appeared in TCAT/ECAT-2025 (Phase-I & Phase-II)/Equivalent. Entry Test is not required for BS Physics and Mathematics.)' - a genuine eligibility fact a retrieval system would surface as the source title. Candidates 1-4 (full text checked) are headers/nav links/narrow category footnotes with no general eligibility criteria stated.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 47. important dates

queryId: `f3d60458e68e2e86`

- [ ] **candidate 1** (score 0.6177) - SocietyDetails
      url: /DSA/societydetails
      heading: SocietyDetails > University Art & Culture Society (UACS)
      chunkKey: `389efc32203242a95150e0939f0f92bd49e6fd1a1fd4024d58517184d348df20`
      text: Document Title: SocietyDetails URL Path: /DSA/societydetails | --- | | Society Faculty Body | | --- | | Events | | | --- | | [Auto Show](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=56>)  15-02-2024 | | [Culture Day](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=54>)  15-02-2024 | | [Fun un Nisa](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?s...

- [ ] **candidate 2** (score 0.6175) - SocietyDetails
      url: /DSA/societydetails
      heading: SocietyDetails > Adventure Club Society (ACS)
      chunkKey: `fa6b0ad6b3c47608e0e6cd55f98a78b47d0c45c0fb46f4e88b0933b5712b7397`
      text: Document Title: SocietyDetails URL Path: /DSA/societydetails | --- | | Society Faculty Body | | --- | | Events | | | --- | | [Trip to Toli Peer](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=18>)  24-02-2024 | | [Marathon Race II](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=19>)  15-02-2024 | | [Marathon Race I](<https://web.uettaxila.edu.pk/DSA/Soci...

- [ ] **candidate 3** (score 0.6045) - SocietyDetails
      url: /DSA/societydetails
      heading: SocietyDetails > Rashid Cheema Health and Blood Donors Society (RCHBDS)
      chunkKey: `3bc4e45f0beb7fbffb2934ce916a502d9af8b8929445589ce0be3f4e54cc0bd6`
      text: Document Title: SocietyDetails URL Path: /DSA/societydetails | --- | | Society Faculty Body | | --- | | Events | | | --- | | [Diabetes Awareness Seminar](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=49>)  07-12-2023 | | [Diabetes Awareness Walk](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=48>)  07-12-2023 | | [Blood Camp' 2023](<https://web.uettaxil...

- [ ] **candidate 4** (score 0.6023) - Events
      url: /Events/All
      heading: Events > All
      chunkKey: `2eec8b3009225e3542021d7f998a0f2d3cd04c477e26bd182f9bda5601fb783a`
      text: Document Title: Events URL Path: /Events/All | Event | Date | | --- | --- | | [Inauguration of AMSYS Academic Transcript & Provisional Certificate Module](<https://web.uettaxila.edu.pk/EventDetails/Inauguration-of-AMSYS-Academic-Transcript-Provisional-Certificate-Module>) | 25-07-2024 | | [PEC FYDP Cheque Distribution by Chairman PEC May 2024](<https://web.uettaxila.edu.pk/EventDetails/PEC-FYDP-Ch...

- [ ] **candidate 5** (score 0.5992) - SocietyDetails
      url: /DSA/societydetails
      heading: SocietyDetails > Almohandis Literary Society (AMLS)
      chunkKey: `bff595c14fc058fffd51fa100167b05c7160039925f05ba1092bd61177af6e1a`
      text: Document Title: SocietyDetails URL Path: /DSA/societydetails | --- | | Society Faculty Body | | --- | | Events | | | --- | | [Bayyad-e-Faiz Ahmed Faiz Mushaira 2024](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=14>)  22-04-2024 | | [All Pakistan Literary Competition](<https://web.uettaxila.edu.pk/DSA/SocietyEventDetails?societyEventId=13>)  22-04-2024 | | [Bazm-e-Iqbal](<ht...

_note:_ None of the 5 relevant - all 5 are specific student-society or campus-event date listings (Auto Show, Culture Day, blood donation drives, an inauguration ceremony), not academic-calendar or admission 'important dates' - a bare 2-word query like this most plausibly means academic/admission deadlines, which none of these candidates address, consistent with how query 17's and 43's near-identical event-page candidates were treated.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 48. contact number

queryId: `a694cc1c788c4df0`

- [x] **candidate 1** (score 0.7081) - ContactUs
      url: /ContactUs.aspx
      heading: ContactUs > Contact details
      chunkKey: `15aa1d8d47c0ea7aa35e2ce33f796c9fb3b1a56b9b00cf2a67230170122bf974`
      text: Document Title: ContactUs URL Path: /ContactUs.aspx ## Contact details  - Phone: +92 51-9047-400...

- [x] **candidate 2** (score 0.6989) - CEOtalks
      url: /CEOtalks.aspx
      heading: CEOtalks > Contact details
      chunkKey: `3c2c9d32d949e3b3159d8f811239c9bd6f67e234c45a08a96c86bb6039f09f3a`
      text: Document Title: CEOtalks URL Path: /CEOtalks.aspx ## Contact details  - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

- [x] **candidate 3** (score 0.6880) - VC Message
      url: /VCMessage
      heading: VC Message > Contact details
      chunkKey: `fe430112f351b69fd0cd98cc44e83a75dd5c58833b73881a533194035288bac6`
      text: Document Title: VC Message URL Path: /VCMessage ## Contact details  - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

- [x] **candidate 4** (score 0.6793) - Budget
      url: /Budget
      heading: Budget > Contact details
      chunkKey: `08267cc9065712031986fcf0a7a4b150fbf1045d9961bfab133b004becb06a5f`
      text: Document Title: Budget URL Path: /Budget ## Contact details  - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

- [x] **candidate 5** (score 0.6708) - About us
      url: /AboutUs
      heading: About us > Contact details
      chunkKey: `c2faac008d55d4d4057b08263597fa9d40df8e9f0fa509b8ae68fabdb1503cf5`
      text: Document Title: About us URL Path: /AboutUs ## Contact details  - Phone: +92 51-9047-400 - Phone: +92 51-9047-420...

_note:_ All 5 marked relevant: each states the real UET Taxila general contact number, 'Phone: +92 51-9047-400' (several also list +92 51-9047-420), consistently across five independent pages - a correct, well-supported answer to a bare 'contact number' query.
_provenance:_ AUTHORITATIVE_SOURCE_MATCH (cross-checked against multiple independent corroborating chunks in the corpus, not just the one candidate)

---

## 49. how to apply

queryId: `876b5dc3e98c81ea`

- [ ] **candidate 1** (score 0.6131) - HOW TO COMPLETE THE APPLICATION FORM.cdr
      url: /Downloads/HOW%20TO%20COMPLETE%20THE%20APPLICATION%20FORM.pdf
      heading: HOW TO COMPLETE THE APPLICATION FORM.cdr
      chunkKey: `8930881db0743fead108036573f599141139e347ce49591a9a113adda5cba127`
      text: Document Title: HOW TO COMPLETE THE APPLICATION FORM.cdr URL Path: /Downloads/HOW%20TO%20COMPLETE%20THE%20APPLICATION%20FORM.pdf # HOW TO COMPLETE THE APPLICATION FORM.cdr...

- [ ] **candidate 2** (score 0.5711) - HOW TO COMPLETE THE APPLICATION FORM.cdr
      url: /Downloads/HOW%20TO%20COMPLETE%20THE%20APPLICATION%20FORM.pdf
      heading: **<u>Consideration in Next Merit Lists</u>**
      chunkKey: `ef511e4b7d337e12a720eafc5bf87ac4944256934d4913aaf3bdd3c3aa7eddc4`
      text: Document Title: HOW TO COMPLETE THE APPLICATION FORM.cdr URL Path: /Downloads/HOW%20TO%20COMPLETE%20THE%20APPLICATION%20FORM.pdf # **<u>Consideration in Next Merit Lists</u>**...

- [ ] **candidate 3** (score 0.5680) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `c71f7c04013c92e551c6000cddf11989103a3d5d7043670221b6779ab0bf4c84`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  [How to apply for Re-Mid?](<#q11>) - [How to get freezing of a Semester?](<#q12>) - [How to apply for I-Grade?](<#q13>) - [How to get Relegation to Lower Entry?](<#q14>) - [How to apply for Rechecking of Paper(s)?](<#q15>) - [How to ap...

- [ ] **candidate 4** (score 0.5662) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `3f178a632717313aa7f6d0a5db08173822b8225a5db271daa926ae47f3f70cd5`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  for Re-Mid? ](<#q11>) - [How to get freezing of a Semester? ](<#q12>) - [How to apply for I-Grade? ](<#q13>) - [How to get Relegation to Lower Entry? ](<#q14>) - [How to apply for Rechecking of Paper(s)? ](<#q15>) - [How to apply for C...

- [ ] **candidate 5** (score 0.5612) - Examination Frequently Asked Questions
      url: /ExamsFAQ.aspx
      heading: Examination Frequently Asked Questions > **Examination Frequently Asked Questions**
      chunkKey: `4f6fc8cb0adaff68d94b8251629abd642a102d296b44a63af3c4fa0c19848e20`
      text: Document Title: Examination Frequently Asked Questions URL Path: /ExamsFAQ.aspx Examination Frequently Asked Questions > **Examination Frequently Asked Questions**  ### **Examination Frequently Asked Questions**   - [How to apply for Semester Grade Sheets? ](<#q1>) - [How to apply for a particular Bonafied Certificate? ](<#q2>) - [How to apply for an Incomplete Transcript? ](<#q3>) - [How to apply...

_note:_ None of the 5 relevant. Candidates 1/2 (full text checked) are bare section-title fragments with no procedural content. Candidates 3/4/5 (Examination FAQ) list real 'how to apply for X' links, but all for exam-related services (Re-Mid, I-Grade, grade sheets, transcripts) - a bare 'how to apply' query from a prospective student's perspective most plausibly means the UG admission application, which none of these address; treated consistently with query 47's genericquery judgment.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked)

---

## 50. fee structure

queryId: `2dfb5097fc1ca481`

- [ ] **candidate 1** (score 0.6530) - Rule Book -2023 - A5 Final.indd
      url: /Downloads/Rule-Book-2023.pdf
      heading: RULES & REGULATIONS Undergraduate Programs > **3 FEES AND OTHER CHARGES**
      chunkKey: `acce89ad270f648d56934e32ec5f230b264628c896cb86f0038c8c6d3a4389c9`
      text: Document Title: Rule Book -2023 - A5 Final.indd URL Path: /Downloads/Rule-Book-2023.pdf ## **3 FEES AND OTHER CHARGES**...

- [x] **candidate 2** (score 0.6200) - Rule Book -2023 - A5 Final.indd
      url: /Downloads/Rule-Book-2023.pdf
      heading: RULES & REGULATIONS Undergraduate Programs > Page 48 > **3.5 Fee Refund Policy for Admission Withdrawal case** > **_Note...
      chunkKey: `f6c98d25d4918bf272b2a5a07ff75e88e23aa9135b5aee0b8664c290bbc53abb`
      text: Document Title: Rule Book -2023 - A5 Final.indd URL Path: /Downloads/Rule-Book-2023.pdf ##### **_Note:_**  - **_i. Percentage of Fee shall be applicable on all components of fee, except for security and admission charges._**  - **_ii. Timeline shall be calculated con� nuously covering both weekdays and weekend._**...

- [ ] **candidate 3** (score 0.6148) - 2014-Session-4th-Semester.pdf
      url: /PageContents/DuesSection/2014-Session-4th-Semester.pdf
      heading: a > UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA DUESSCHOLARSHIPAND SECTION > DUES NOTICE
      chunkKey: `6273ddf24a205a5108e701ef282f78b1d99ef90e71cd451c5dd739a48f98841c`
      text: Document Title: 2014-Session-4th-Semester.pdf URL Path: /PageContents/DuesSection/2014-Session-4th-Semester.pdf |Sr.#<br>|Detailofdues<br>|“me<br>|ee |<br>|Catego<br><br>|ry“x”<br>| |---|---|---|---|---|---| <br><br>|<br>|<br>||| |__1[<br><br>|<br>uitionFee<br>___|<br><br>|<br>2600.00<br>|<br>"26000.00 <br>|90000.00|<br><br>|0000.00<br>| |[2<br>__<br><br>|<br> <br> <br><br>TutorialFee<br><br>|<br>...

- [ ] **candidate 4** (score 0.6100) - International Conference On Advances In Civil And Environmental Engineering (ICACEE-2024)
      url: /icacee2024
      heading: International Conference On Advances In Civil And Environmental Engineering (ICACEE-2024) > Tutorial for fee submission ...
      chunkKey: `cc116ad650d868f087a5c6b8eeb24d89ea6519b755f0a83c83fd01ffd31ee71b`
      text: Document Title: International Conference On Advances In Civil And Environmental Engineering (ICACEE-2024) URL Path: /icacee2024 ## Tutorial for fee submission from other bank to HBL Konnect...

- [ ] **candidate 5** (score 0.6014) - DuesSection
      url: /duessection
      heading: DuesSection > Visual resources requiring text extraction - [Dues Notice for Session 2015, 8th Semester](<https://web.uet...
      chunkKey: `3ce7afdc2fd7803b1f51d30d2867dc654475b352ba97fc59087443d0fb91ec67`
      text: Document Title: DuesSection URL Path: /duessection belonging to flood hit areas 19-12-2023 Dues Notice for Digital Library Service Fee &amp; Dues Not...

_note:_ Candidate 2 marked relevant: real fee-structure content (refund-policy rules from the Rule Book's "Fees and other Charges" section) - broad "fee structure" query, this genuinely qualifies. Candidate 1 is the section heading only (chunk cuts off before any numbers - a real chunking-boundary issue, not a relevance call). Candidate 3 has real but 11-year-stale (2014) and badly OCR-garbled figures, not marked given how outdated/unreliable. Candidate 4 is a conference-registration fee tutorial, wrong topic. Candidate 5 is a dues-notice listing stub, not marked.
_provenance:_ LLM_JUDGED (read against the query directly; no independent second source checked for this specific document)

---
