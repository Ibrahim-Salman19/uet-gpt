# UET Taxila Source Authority & Freshness Resolution Matrix

## 1. Topic-Specific Authority Hierarchy

The system applies topic-aware authority weighting rather than a global static page score. When retrieved chunks present conflicting claims, the system resolves authority according to the following matrix:

| Topic / Category | Primary Authority | Secondary Authority | Historical Authority | Disallowed / Weak Sources | Required User Caveat |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Undergraduate Admissions & Eligibility** | `admissions.uettaxila.edu.pk` (Current Schedule, Fees, Eligibility pages) & Latest Prospectus PDF (2025) | Main institutional homepage notices | Archived Prospectuses (2023, 2024) | Unverified external blogs, social media posts, outdated forum discussions | "Must be verified against current session prospectus at admissions.uettaxila.edu.pk." |
| **Postgraduate Admissions (MS/PhD)** | Directorate of Advanced Studies (ASR&TD page: `web.uettaxila.edu.pk/ASRTD.aspx`) | Departmental PG Coordinators pages | Previous academic session handbook PDFs | General undergraduate prospectus documents | "Subject to GAT / Department test qualification and ASR&TD Board approval." |
| **Fee Structure & Dues** | Admissions Fee Schedule (`admissions.uettaxila.edu.pk/Fees.php`) & Treasurer / Dues Section | Official prospectus fee tables | Pre-2024 fee notification PDFs | Unofficial fee summaries or student blogs | "Fee schedules are subject to revision per university Treasurer notifications." |
| **Examinations & Date Sheets** | Examination Branch (`web.uettaxila.edu.pk/Examinations.aspx`) & Controller Examinations Office | Departmental examination notice boards | Passed semester date sheets | Student social media groups | "Official date sheets must be confirmed on Controller of Examinations notice board." |
| **Academic Regulations & Statutes** | Official University Statutes & Rules page (`web.uettaxila.edu.pk/Rules`) | Official Prospectus Academic Regulations section | Superseded 2018/2020 rulebook versions | Unattributed summary pamphlets | "Governed by UET Taxila Act & Syndicate regulations." |
| **Faculty & Department Directories** | Official Departmental Faculty pages (`web.uettaxila.edu.pk/faculty/`) | Central Phone Directory (`ContactUs.aspx`) | Past annual report directories | Third-party directory sites | "Contact extensions subject to administrative reassignment." |
| **Tenders & Procurement** | Official Tenders Page (`web.uettaxila.edu.pk/Tenders`) & PPRA Punjab Portal | Treasurer Procurement Office notices | Closed / expired tender archives | Commercial vendor listings | "Tender bidding documents must be submitted in sealed envelopes prior to advertised deadline." |

---

## 2. Freshness & Conflict Resolution Algorithm

When two retrieved sources conflict:

1. **Session & Date Matching:**
   * Extract publication date, academic session (e.g. "Fall 2025"), and version year.
   * If Query is about current admissions, weight `Prospectus 2025` with factor +0.3 over `Prospectus 2024`.
2. **Domain Scope Precedence:**
   * `admissions.uettaxila.edu.pk` overrides `web.uettaxila.edu.pk` for admission seat allocations and fee payment deadlines.
3. **Explicit Conflict Statement:**
   * If two active documents present contradictory numbers (e.g. differing seat counts across two notices), the chatbot is instructed to present the primary authoritative value and state:
     *"Note: Notice A lists X seats while Prospectus 2025 lists Y seats. Please confirm directly with the Admissions Directorate."*
