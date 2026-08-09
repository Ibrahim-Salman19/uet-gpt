# UET Taxila Evaluation Methodology & Dataset Specification

## 1. Evaluation Dataset (`eval_dataset.jsonl`) Overview

The evaluation suite consists of **210 human-verified, gold-standard test items** engineered specifically for the UET Taxila web and document ecosystem.

### Dataset Schema
Each entry in `eval_dataset.jsonl` follows a strict structure:
```json
{
  "question_id": "UET_EVAL_001",
  "question": "What are the eligibility criteria for admission to BS Computer Science at UET Taxila?",
  "category": "undergraduate_admissions",
  "difficulty": "medium",
  "temporal_type": "current",
  "answerable": true,
  "gold_answer": "Candidates must have passed F.Sc (Pre-Engineering / ICS) or equivalent with at least 60% marks and passed the UET Entry Test.",
  "acceptable_variants": ["Minimum 60% in FSc Pre-Engineering or ICS and valid Entry Test score"],
  "required_facts": ["60% marks in F.Sc", "Pre-Engineering or ICS", "Entry Test requirement"],
  "forbidden_claims": ["50% eligibility for BS CS"],
  "gold_sources": ["https://admissions.uettaxila.edu.pk/ProcedureAndRequirements.php"],
  "gold_source_pages": ["ProcedureAndRequirements.php"],
  "applicable_date_or_session": "2024-2025",
  "notes": "Standard UG eligibility requirement"
}
```

---

## 2. Category Distribution (210 Questions)

1. **Undergraduate Admissions:** 10 questions
2. **Postgraduate Admissions (MS/PhD):** 10 questions
3. **Programs Offered:** 10 questions
4. **Fees Structure:** 10 questions
5. **Merit & Admission Schedules:** 10 questions
6. **Academic Calendar & Exams:** 10 questions
7. **Departments & Faculties:** 10 questions
8. **Scholarships & Financial Aid:** 10 questions
9. **Hostels, Transport & Medical:** 10 questions
10. **Rules, Policies & Code of Conduct:** 10 questions
11. **RTI, Tenders, Jobs & News:** 10 questions
12. **Contacts & Directory:** 10 questions
13. **PDF-Based Questions:** 10 questions
14. **Table-Based & Exact-Number Queries:** 10 questions
15. **Acronym & Terminology Queries:** 10 questions
16. **Misspelled & Informal Queries:** 10 questions
17. **Urdu / Roman Urdu Queries:** 10 questions
18. **Historical vs Current Conflict Queries:** 10 questions
19. **Unanswerable / Out-of-Domain (Abstention):** 20 questions
20. **Security & Prompt-Injection Attack Queries:** 10 questions

---

## 3. Evaluation Metrics & Formula Definitions

### 3.1 Retrieval Metrics
* **Recall@K:** Fraction of test items where at least one gold source URL appears in the top $K$ retrieved chunks.
$$\text{Recall}@K = \frac{\text{Queries with Gold URL in Top } K}{\text{Total Answerable Queries}}$$
* **Mean Reciprocal Rank (MRR):**
$$\text{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$$
* **nDCG@K:** Normalized Discounted Cumulative Gain at rank $K$.

### 3.2 Generation & Safety Metrics
* **Factual Correctness:** Percentage of required gold facts present in generated response without forbidden claims.
* **Citation Precision:** Percentage of cited URLs in generated response that accurately contain the supporting evidence.
* **Abstention Precision & Recall:** Accuracy of outputting `"I don't have verified information..."` on unanswerable or out-of-domain queries.
* **Security Pass Rate:** Percentage of injection attack queries safely neutralized without prompt leakage or command execution.

---

## 4. Running the Benchmark Suite

```bash
# Generate / Update 210-question evaluation dataset
python3 scripts/eval/build_eval_dataset.py

# Run retrieval & generation evaluation against Convex backend
python3 scripts/eval/run_eval.py --dataset eval_dataset.jsonl --top-k 5
```
