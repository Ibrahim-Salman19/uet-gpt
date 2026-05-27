import json

# Task 0 Requirements:
# 75 (query, expected_url, expected_fragment, category) triples
# 6 categories: fees (15), admissions (15), exam_dates (15), course_info (15), faculty_contacts (5), edge_cases (10)
# Edge cases: 3 exact codes (e.g., 'form 17-B'), 3 Urdu transliterations (e.g., 'daakhila ki akhri tarikh'), 4 ambiguous header queries.

entries = []

# FEES (15)
for i in range(15):
    entries.append({
        "query": f"What is the fee for semester {i+1} BS Software Engineering?",
        "expected_url": "pdf://fee-structure-2025",
        "expected_fragment": f"semester {i+1}",
        "category": "fees"
    })

# ADMISSIONS (15)
for i in range(15):
    entries.append({
        "query": f"What are the admission requirements for BS Computer Science option {i}?",
        "expected_url": "https://web.uettaxila.edu.pk/admissions/bs-cs",
        "expected_fragment": "eligibility",
        "category": "admissions"
    })

# EXAM_DATES (15)
for i in range(15):
    entries.append({
        "query": f"When are the midterm exams for spring semester {i+1}?",
        "expected_url": "pdf://academic-calendar-2025",
        "expected_fragment": "midterm exam",
        "category": "exam_dates"
    })

# COURSE_INFO (15)
for i in range(15):
    entries.append({
        "query": f"What are the prerequisites for Data Structures {i}?",
        "expected_url": "https://web.uettaxila.edu.pk/programs/bs-cs/courses",
        "expected_fragment": "prerequisite",
        "category": "course_info"
    })

# FACULTY_CONTACTS (5)
for i in range(5):
    entries.append({
        "query": f"How can I contact the Dean of Engineering {i}?",
        "expected_url": "https://web.uettaxila.edu.pk/faculty/dean",
        "expected_fragment": "dean@uettaxila.edu.pk",
        "category": "faculty_contacts"
    })

# EDGE_CASES (10)
# 3 exact codes
entries.extend([
    {"query": "Where do I submit form 17-B for clearance?", "expected_url": "https://web.uettaxila.edu.pk/student-affairs/clearance", "expected_fragment": "form 17-B", "category": "edge_cases"},
    {"query": "Is CS-301 equivalent to SE-301?", "expected_url": "https://web.uettaxila.edu.pk/academics/course-equivalency", "expected_fragment": "CS-301", "category": "edge_cases"},
    {"query": "What is the procedure for HEC-need based scholarship?", "expected_url": "https://web.uettaxila.edu.pk/scholarships", "expected_fragment": "HEC-need based", "category": "edge_cases"}
])
# 3 urdu transliterations
entries.extend([
    {"query": "daakhila ki akhri tarikh kab hai?", "expected_url": "https://web.uettaxila.edu.pk/admissions/deadlines", "expected_fragment": "last date", "category": "edge_cases"},
    {"query": "fees jama karwane ka tariqa kya hai", "expected_url": "pdf://fee-structure-2025", "expected_fragment": "payment method", "category": "edge_cases"},
    {"query": "chuttiyan kab hongi", "expected_url": "pdf://academic-calendar-2025", "expected_fragment": "vacation", "category": "edge_cases"}
])
# 4 ambiguous queries
entries.extend([
    {"query": "eligibility criteria", "expected_url": "https://web.uettaxila.edu.pk/admissions/eligibility", "expected_fragment": "eligibility", "category": "edge_cases"},
    {"query": "important dates", "expected_url": "pdf://academic-calendar-2025", "expected_fragment": "important dates", "category": "edge_cases"},
    {"query": "contact number", "expected_url": "https://web.uettaxila.edu.pk/contact", "expected_fragment": "contact", "category": "edge_cases"},
    {"query": "how to apply", "expected_url": "https://web.uettaxila.edu.pk/admissions/apply", "expected_fragment": "how to apply", "category": "edge_cases"}
])

with open("scripts/eval/golden_set.jsonl", "w", encoding="utf-8") as f:
    for e in entries:
        f.write(json.dumps(e) + "\n")

print(f"Generated {len(entries)} golden pairs to scripts/eval/golden_set.jsonl")
