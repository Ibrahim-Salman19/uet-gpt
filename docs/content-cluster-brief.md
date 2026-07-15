# Content Cluster Brief — UET GPT (uet-gpt.vercel.app)

**Subject:** UET GPT — open-source AI chatbot, the intelligent guide to UET Taxila (Taxila campus, Pakistan).
**Live:** https://uet-gpt.vercel.app · **Code:** https://github.com/devhms/uet_gpt
**Brief date:** 2026-07-15 · **Built on:** `docs/serp-gap-analysis.md`
**Method:** Live `websearch` per target long-tail query (infsh CLI unavailable).

---

## 1. SERP Reality-Check

Verdicts: **W** = Winnable (no intent-matched conversational result) · **C** = Contested (real content rivals rank) · **B** = Brand-contested (other projects share the name).

| # | Query | Top result(s) today | Conversational AI answer? | Verdict |
|---|---|---|---|---|
| 1 | UET Taxila AI chatbot | Official CS "Artificial Intelligence" page; faculty profiles; UmerAbbasi658 RAG repo; HudaRaja HF Space | **No** Taxila chatbot result | **W** |
| 2 | UET Taxila AI assistant | Official dept pages; AICP & AI R&D society; Agentic AI Summit | **No** assistant, only dept "AI" | **W** |
| 3 | UET Taxila prospectus assistant | `UndergraduateProspectus` index; `UET-Prospectus-2025.pdf` (unreadable scan) | **No** readable explainer | **W** |
| 4 | UET Taxila admission chatbot | `admissions.uettaxila.edu.pk` portal + FAQ; gotest.com.pk; eduinfopedia | Form-based only | **W** |
| 5 | UET Taxila student chatbot | Admissions FAQ; DSA/societies; Facebook "UET Taxila Help Desk" | **No** student-life bot | **W** |
| 6 | UET Taxila programs chatbot | Official `Programs.aspx`; **blog.maqsad.io "Full Guide on UET Taxila Programs 2026"** (rival) | List only, no AI explorer | **W** (modifier) |
| 7 | UET Taxila fee structure chatbot | `admissions.../Fees.php`; **gotest, maqsad/uet-fee-structure, paklearningspot, result.pk, ilmkidunya** | Tables/PDFs, no chat | **C** bare / **W** modifier |
| 8 | open source UET Taxila chatbot | UmerAbbasi658, HaseebQaisar145, adeebamubarak, Areeba391391 repos; generic RAG articles | devhms/uet_gpt **not** ranking | **W** (phrase) |
| 9 | UET GPT (brand) | Hamas-ur-Rehman/UETGPT, tahirmanj398-byte/the-uet-gpt, MuhammadQasim111/UETGPT, ChatGPT | devhms **absent** | **B** |
| 10 | UET Taxila hostel/transport chatbot | Official `Hostels.aspx`, `Transport.aspx`; AlishbaMudassar "Ayesha Hall" repo | PDFs/pages, no bot | **W** |
| 11 | UET Taxila vs UET Lahore | **blog.maqsad.io** 3-way comparison table; separate Wikipedia pages | No neutral comparison page | **W** |
| 12 | ask UET Taxila anything / Q&A AI | Generic Ask-AI tools (edusolver, easyai, piax); official ContactUs | **No** Taxila-specific AI | **W** |

**Update vs. gap analysis:** The field is **hotter than assumed** for program/fee/eligibility — `blog.maqsad.io` is now a polished rival for "UET Taxila programs" and "UET Taxila fee structure," and aggregators (gotest, paklearningspot, result.pk, ilmkidunya, eduinfopedia) rank for admission/fee/merit. **But the conversational/chatbot modifier is wide open on every query.** Win the *modifier*, not the head term.

---

## 2. Content Cluster Brief (satellite pages)

**Global rules:** embed the live chat widget; put exact target phrase in `<title>` + H1; add `FAQPage` + `SoftwareApplication` schema; link official sources (`uettaxila.edu.pk`, prospectus PDFs); cite the 2025 prospectus as knowledge base; internal-link `/`, `/uet-taxila`, siblings.

### P0 — Hubs

**1. `/uet-gpt`** (brand + intent hub)
- Title: *UET GPT — AI Chatbot for UET Taxila Students* · H1: *UET GPT: The AI Chatbot for UET Taxila*
- Primary: `UET GPT Taxila` · Secondary: `UET Taxila AI chatbot`, `UET Taxila AI assistant`
- FAQ: What is UET GPT? · Is it officially affiliated with UET Taxila? · What can I ask? · Is it free/open source? · How accurate are answers? · How is my data handled?
- Links: `/`, `/uet-taxila`, `/uet-taxila/ai-chatbot`, `/uet-gpt/open-source`
- Winnable: "UET GPT" SERP contested by 3+ unrelated repos + ChatGPT; devhms unindexed. A brand+campus page captures the exact query.

**2. `/uet-taxila/ai-chatbot`**
- Title: *UET Taxila AI Chatbot — Ask Anything About the Campus* · H1: *UET Taxila AI Chatbot*
- Primary: `UET Taxila AI chatbot` · Secondary: `UET Taxila AI assistant`, `UET Taxila chatbot`
- FAQ: What is it? · What topics? · How differs from official site? · Free? · Where does info come from? · Can it help with admission/fee?
- Links: `/`, `/uet-gpt`, `/uet-taxila`, `/uet-taxila/admissions-helper`, `/uet-taxila/prospectus-assistant`, `/uet-taxila/student-assistant`
- Winnable: exact phrase returns only official dept pages + unrelated repos — empty intent SERP.

**3. `/uet-taxila/prospectus-assistant`**
- Title: *UET Taxila Prospectus Assistant (AI) — Understand the 2025 Prospectus* · H1: *UET Taxila Prospectus Assistant*
- Primary: `UET Taxila prospectus assistant` · Secondary: `UET Taxila prospectus AI`, `UET Taxila prospectus 2025 explained`
- FAQ: What is it? · Which prospectus? · How to read it? · What's inside (programs/fees/rules)? · Can it explain eligibility? · Where to download the PDF?
- Links: `/uet-taxila`, `/uet-taxila/ai-chatbot`, `/uet-taxila/admissions-helper`, `/uet-taxila/fees-merit-scholarships`
- Winnable: prospectus PDFs rank but are unreadable; an AI explainer of the 2025 prospectus has no rival. Cite `admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2025.pdf`.

### P1 — High-intent assistants

**4. `/uet-taxila/admissions-helper`**
- Title: *Ask UET Taxila Admissions — AI Admission Helper* · H1: *UET Taxila Admissions Helper (AI)*
- Primary: `UET Taxila admission chatbot` · Secondary: `UET Taxila admissions AI`, `UET Taxila admission helper`
- FAQ: How to apply? · Eligibility? · What is TCAT/ECAT & when? · Required documents? · When are merit lists? · Fall 2026 last date?
- Links: `/uet-taxila`, `/uet-taxila/ai-chatbot`, `/uet-taxila/prospectus-assistant`, `/uet-taxila/fees-merit-scholarships`, `/uet-taxila/programs-guide`
- Winnable: portal FAQ is form-based; conversational guide uncontested (win the *chatbot/helper* modifier vs gotest/eduinfopedia).

**5. `/uet-taxila/programs-guide`**
- Title: *UET Taxila Programs — AI Guide & Explorer* · H1: *UET Taxila Programs Guide (AI)*
- Primary: `UET Taxila programs chatbot` · Secondary: `UET Taxila programs AI guide`, `UET Taxila undergraduate programs`
- FAQ: Which UG programs? · Which engineering programs? · CS & Software Engineering offered? · Engineering Technology (afternoon) programs? · Eligibility per program? · Chakwal sub-campus programs?
- Links: `/uet-taxila`, `/uet-taxila/ai-chatbot`, `/uet-taxila/admissions-helper`, `/uet-taxila/fees-merit-scholarships`, `/uet-taxila/vs-uet-lahore`
- Winnable: list ranks (incl. Maqsad) but AI explorer + widget wins the modifier; differentiate with citations.

**6. `/uet-taxila/student-assistant`**
- Title: *UET Taxila Student Assistant — AI Help for Campus Life* · H1: *UET Taxila Student Assistant*
- Primary: `UET Taxila student chatbot` · Secondary: `UET Taxila student assistant`, `UET Taxila campus life AI`
- FAQ: What can it help with? · How to apply for hostel? · Bus routes? · Societies/clubs? · Libraries/cafeterias? · Contact student affairs?
- Links: `/uet-taxila`, `/uet-taxila/ai-chatbot`, `/uet-taxila/hostel-transport`, `/uet-taxila/admissions-helper`
- Winnable: portal/FAQ only; student-life Q&A assistant has no indexed competitor.

### P2 — Comparison, fees, project/about

**7. `/uet-taxila/fees-merit-scholarships`**
- Title: *UET Taxila Fees, Merit & Scholarships (AI Explained)* · H1: *UET Taxila Fees, Merit & Scholarships*
- Primary: `UET Taxila fee structure chatbot` · Secondary: `UET Taxila merit calculator`, `UET Taxila scholarships AI`
- FAQ: 2026 fee structure? · Subsidized vs partial-subsidized? · How is merit calculated? · Scholarships available? · Hostel charges? · Refund policy?
- Links: `/uet-taxila`, `/uet-taxila/ai-chatbot`, `/uet-taxila/admissions-helper`, `/uet-taxila/prospectus-assistant`
- Winnable: figures buried in PDFs/aggregators; explainer + chat has no conversational rival. **Caveat:** bare "fee structure" contested (Maqsad/gotest) — win on modifier + merit-formula explainer.

**8. `/uet-taxila/vs-uet-lahore`**
- Title: *UET Taxila vs UET Lahore — Honest Comparison* · H1: *UET Taxila vs UET Lahore*
- Primary: `UET Taxila vs UET Lahore` · Secondary: `UET Taxila vs UET Lahore which is better`, `... programs`
- FAQ: Same university? · Programs unique to each? · Same ECAT? · Fee comparison? · Better for CS/SE? · Can I apply to both?
- Links: `/uet-taxila`, `/uet-taxila/programs-guide`, `/uet-taxila/fees-merit-scholarships`, `/uet-taxila/ai-chatbot`
- Winnable: Maqsad has a 3-way table but no dedicated neutral page; Wikipedia pages separate only.

**9. `/uet-gpt/open-source`**
- Title: *Open-Source UET Taxila Chatbot — About & GitHub* · H1: *Open-Source UET Taxila Chatbot*
- Primary: `open source UET Taxila chatbot` · Secondary: `UET GPT GitHub`, `UET Taxila RAG chatbot`
- FAQ: Is it open source? · Where is source? · How does the RAG pipeline work? · Can I self-host? · How differs from other UET Taxila bots? · How to contribute?
- Links: `/uet-gpt`, `/`, `/uet-taxila/ai-chatbot`, `/uet-taxila`
- Winnable: no indexed OSS owns this phrase for the campus; doubles as project/about page; differentiate from other "UET GPT" repos.

### P3 — Long-tail / per-topic

**10. `/uet-taxila/hostel-transport`**
- Title: *UET Taxila Hostel & Transport — AI Assistant* · H1: *UET Taxila Hostel & Transport Assistant*
- Primary: `UET Taxila hostel chatbot` · Secondary: `UET Taxila transport chatbot`, `UET Taxila hostel fees`
- FAQ: How to apply for hostel? · Hostel/mess charges? · Female hostels? · Bus routes? · Transport charges? · Allotment order?
- Links: `/uet-taxila`, `/uet-taxila/student-assistant`, `/uet-taxila/fees-merit-scholarships`, `/uet-taxila/ai-chatbot`
- Winnable: specifics in PDFs/pages; per-topic pages uncontested (rival AlishbaMudassar repo low-authority).

**11. `/uet-taxila/ask-anything`**
- Title: *Ask UET Taxila Anything — AI Question Answering* · H1: *Ask UET Taxila Anything*
- Primary: `ask UET Taxila anything` · Secondary: `UET Taxila question answer AI`, `UET Taxila AI Q&A`
- FAQ: What can I ask? · Is it official? · How differs from ChatGPT? · Knows 2026 dates? · Answers in Urdu? · Free?
- Links: `/uet-gpt`, `/uet-taxila/ai-chatbot`, `/uet-taxila`, `/uet-taxila/admissions-helper`
- Winnable: generic Ask-AI tools + contact page rank; zero Taxila-specific AI. Pure branded-long-tail capture.

---

## 3. Additional slugs NOT yet considered (recommended)

1. **`/uet-taxila/chakwal-sub-campus`** — UET Taxila runs a Chakwal sub-campus (Electronics & Mechatronics). No dedicated page ranks for "UET Taxila Chakwal campus." Supports programs-guide FAQ.
2. **`/uet-taxila/departments`** — Hub for all departments (CS, SE, CE, EE, Telecom, Mech, Civil, Env, Industrial, Electronics, Basic Sciences). Wins head "UET Taxila departments" + strengthens linking.
3. **`/uet-gpt/how-it-works`** — RAG pipeline explainer (crawler → Convex → embeddings → agent). Targets `UET Taxila RAG chatbot` / `how does UET GPT work`; supports open-source page.
4. **`/uet-taxila/vs-uet-peshawar`** — Maqsad compares all three; a Taxila-vs-Peshawar page interlinks with the Lahore comparison.
5. **`/uet-taxila/merit-calculator`** — High-intent "UET Taxila merit formula / aggregate." Guided explainer + widget wins "UET Taxila merit calculator" (calculator tool = future enhancement).
6. **`/uet-gpt/privacy`** — Trust/transparency page (data handling, sources, not-official disclaimer). Supports E-E-A-T; low effort, high trust.

---

## 4. Build order

1. **P0:** `/uet-gpt`, `/uet-taxila/ai-chatbot`, `/uet-taxila/prospectus-assistant`
2. **P1:** `/uet-taxila/admissions-helper`, `/uet-taxila/programs-guide`, `/uet-taxila/student-assistant`
3. **P2:** `/uet-taxila/fees-merit-scholarships`, `/uet-taxila/vs-uet-lahore`, `/uet-gpt/open-source`
4. **P3:** `/uet-taxila/hostel-transport`, `/uet-taxila/ask-anything`
5. **Bonus:** `/uet-taxila/chakwal-sub-campus`, `/uet-taxila/departments`, `/uet-gpt/how-it-works`, `/uet-taxila/vs-uet-peshawar`, `/uet-taxila/merit-calculator`, `/uet-gpt/privacy`

**Moat:** on every fee/program/admission page, differentiate from Maqsad/aggregators by (a) embedding the live chat widget they lack, and (b) citing the official 2025 prospectus + `admissions.uettaxila.edu.pk`.

---

## 5. Final recommended slugs + target keywords

| Slug | Primary target keyword |
|---|---|
| `/uet-gpt` | UET GPT Taxila |
| `/uet-taxila/ai-chatbot` | UET Taxila AI chatbot |
| `/uet-taxila/prospectus-assistant` | UET Taxila prospectus assistant |
| `/uet-taxila/admissions-helper` | UET Taxila admission chatbot |
| `/uet-taxila/programs-guide` | UET Taxila programs chatbot |
| `/uet-taxila/student-assistant` | UET Taxila student chatbot |
| `/uet-taxila/fees-merit-scholarships` | UET Taxila fee structure chatbot |
| `/uet-taxila/vs-uet-lahore` | UET Taxila vs UET Lahore |
| `/uet-gpt/open-source` | open source UET Taxila chatbot |
| `/uet-taxila/hostel-transport` | UET Taxila hostel chatbot |
| `/uet-taxila/ask-anything` | ask UET Taxila anything |
| `/uet-taxila/chakwal-sub-campus` | UET Taxila Chakwal campus |
| `/uet-taxila/departments` | UET Taxila departments |
| `/uet-gpt/how-it-works` | UET Taxila RAG chatbot |
| `/uet-taxila/vs-uet-peshawar` | UET Taxila vs UET Peshawar |
| `/uet-taxila/merit-calculator` | UET Taxila merit calculator |
| `/uet-gpt/privacy` | UET GPT privacy |
