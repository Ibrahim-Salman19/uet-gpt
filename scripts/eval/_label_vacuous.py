"""Author grounded labels for the previously-vacuous captured fixtures.

This is a one-off migration. Every phrase/spec below was *verified* against the
extractor's actual output (see _probe_vacuous.py) before being committed —
nothing here is speculative. Run from the repo root::

    python scripts/eval/_label_vacuous.py

Idempotent: re-running overwrites the ``expected`` block with the same content.
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "corpus" / "fixtures"

# Each entry: (family, slug, family_label, fixture_id, criticality, expected_dict)
# The expected_dict is the FULL "expected" block (replaces the vacuous one).
LABELS: list[tuple[str, str, str, str, str, dict]] = [
    # ── critical admissions-php (eligibility / fees / faqs / procedure) ──
    (
        "admissions-php",
        "admission-eligibility-1cc3b3",
        "admissions-php",
        "admissions-php/admission-eligibility-1cc3b3",
        "critical",
        {
            "canonical_host": "admissions.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": ["ProgramsOffered"],
            "required_text_blocks": [
                {"text": "Admission Eligibility", "why": "page H1"},
                {"text": "HSSC", "why": "eligibility prerequisite keyword"},
                {"text": "60%", "why": "minimum HSSC percentage threshold"},
                {"text": "Civil Engineering", "why": "a program in the eligibility table"},
                {"text": "Electrical Engineering", "why": "a program in the eligibility table"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Admission Eligibility"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "critical",
            "required_resources": [
                {"url_contains": "ProgramsOffered", "kind": "page", "crawlable": True, "critical": True},
            ],
        },
    ),
    (
        "admissions-php",
        "feesfortechnologyprograms-ff27fa",
        "admissions-php",
        "admissions-php/feesfortechnologyprograms-ff27fa",
        "critical",
        {
            "canonical_host": "admissions.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Fee Structure", "why": "page H1"},
                {"text": "Tuition", "why": "a recurring line item"},
                {"text": "25,000", "why": "tuition amount"},
                {"text": "Per Semester", "why": "recurring-charge section"},
                {"text": "Non-Resident", "why": "fee-table column header"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Fee Structure"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "critical",
        },
    ),
    (
        "admissions-php",
        "faqs-07df8a",
        "admissions-php",
        "admissions-php/faqs-07df8a",
        "critical",
        {
            "canonical_host": "admissions.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Frequently Asked Questions", "why": "page H1"},
                {"text": "Rs. 4,000", "why": "application processing fee amount"},
                {"text": "application processing fee", "why": "fee-answer keyword"},
                {"text": "HBL", "why": "payment-channel bank"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Frequently Asked Questions"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "critical",
        },
    ),
    (
        "admissions-php",
        "procedureandrequirements-05a20e",
        "admissions-php",
        "admissions-php/procedureandrequirements-05a20e",
        "critical",
        {
            "canonical_host": "admissions.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Online Admission Procedure", "why": "procedure section heading"},
                {"text": "Entry Test", "why": "STEP-1 keyword"},
                {"text": "documents", "why": "requirements keyword"},
                {"text": "ECAT", "why": "entry-test keyword"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Admission Procedure"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "critical",
        },
    ),
    # ── fms-profile (standard; faculty CVs) ──
    (
        "fms-profile",
        "gulistan-raja-556686",
        "fms-profile",
        "fms-profile/gulistan-raja-556686",
        "standard",
        {
            "canonical_host": "fms.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Dr. Gulistan Raja", "why": "faculty name"},
                {"text": "Designation", "why": "profile-table field"},
                {"text": "Department", "why": "profile-table field"},
                {"text": "Email", "why": "profile-table field"},
                {"text": "Professor", "why": "designation value"},
                {"text": "PhD", "why": "highest qualification"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Gulistan Raja"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    (
        "fms-profile",
        "haroon-yousaf-e9402e",
        "fms-profile",
        "fms-profile/haroon-yousaf-e9402e",
        "standard",
        {
            "canonical_host": "fms.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Dr. Muhammad Haroon Yousaf", "why": "faculty name"},
                {"text": "Designation", "why": "profile-table field"},
                {"text": "Department", "why": "profile-table field"},
                {"text": "Email", "why": "profile-table field"},
                {"text": "Professor", "why": "designation value"},
                {"text": "PhD", "why": "highest qualification"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Haroon Yousaf"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    # ── legacy-asp (standard; academic curriculum pages) ──
    (
        "legacy-asp",
        "courses-ug-8ddef9",
        "legacy-asp",
        "legacy-asp/courses-ug-8ddef9",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Computer Engineering", "why": "department title"},
                {"text": "Course", "why": "course-catalog keyword"},
                {"text": "Semester", "why": "curriculum structure keyword"},
                {"text": "Credit", "why": "credit-hour keyword"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Computer Engineering"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    (
        "legacy-asp",
        "curriculum-e38252",
        "legacy-asp",
        "legacy-asp/curriculum-e38252",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Elective", "why": "page title: List of Elective Courses"},
                {"text": "Mechatronics", "why": "department name"},
                {"text": "Semester", "why": "curriculum structure keyword"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Elective"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    (
        "legacy-asp",
        "betsoftwareengineering-a27271",
        "legacy-asp",
        "legacy-asp/betsoftwareengineering-a27271",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [],
            "resource_min_count": 0,
            "title_contains": ["Software Engineering"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    # ── legacy-aspx (standard; exams/sports) ──
    (
        "legacy-aspx",
        "examsfaq-55db37",
        "legacy-aspx",
        "legacy-aspx/examsfaq-55db37",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Examination Frequently Asked Questions", "why": "page heading"},
                {"text": "Transcript", "why": "exams FAQ topic"},
                {"text": "Grade Sheet", "why": "exams FAQ topic"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Examination Frequently Asked Questions"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    (
        "legacy-aspx",
        "sports-307a01",
        "legacy-aspx",
        "legacy-aspx/sports-307a01",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": ["logout", "login"],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "Sports", "why": "page topic"},
                {"text": "cricket", "why": "a listed sport"},
                {"text": "Inter University", "why": "competition keyword"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Sports"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "standard",
        },
    ),
    # ── pdf-download (prospectus critical; policies standard) ──
    (
        "pdf-download",
        "uet-prospectus-2024-d60577",
        "pdf-download",
        "pdf-download/uet-prospectus-2024-d60577",
        "critical",
        {
            "canonical_host": "admissions.uettaxila.edu.pk",
            "forbidden_links_contain": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "UG PROSPECTUS 2024", "why": "document identity"},
                {"text": "Disclaimer", "why": "front-matter section"},
                {"text": "Vision", "why": "university vision heading"},
                {"text": "Mission", "why": "university mission heading"},
                {"text": "Undergraduate", "why": "admissions scope"},
            ],
            "resource_min_count": 0,
            "title_contains": ["Prospectus"],
            "title_not_contains": ["Untitled", "404"],
            "criticality": "critical",
            "max_duration_ms": 300000,
        },
    ),
    (
        "pdf-download",
        "sexualharassment-policy-4b52e1",
        "pdf-download",
        "pdf-download/sexualharassment-policy-4b52e1",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "PROTECTION AGAINST SEXUAL HARASSMENT", "why": "policy title"},
                {"text": "HIGHER EDUCATION COMMISSION", "why": "issuing body"},
            ],
            "resource_min_count": 0,
            "title_contains": [],
            "title_not_contains": ["Untitled"],
            "criticality": "standard",
            "max_duration_ms": 60000,
        },
    ),
    (
        "pdf-download",
        "peeda-2006-2-08031c",
        "pdf-download",
        "pdf-download/peeda-2006-2-08031c",
        "standard",
        {
            "canonical_host": "web.uettaxila.edu.pk",
            "forbidden_links_contain": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "required_text_blocks": [
                {"text": "PUNJAB EMPLOYEES EFFICIENCY, DISCIPLINE AND ACCOUNTABILITY ACT", "why": "act title"},
                {"text": "NOTIFICATION", "why": "notification section"},
                {"text": "Discipline", "why": "core act subject"},
                {"text": "Efficiency", "why": "core act subject"},
            ],
            "resource_min_count": 0,
            "title_contains": [],
            "title_not_contains": ["Untitled"],
            "criticality": "standard",
            "max_duration_ms": 60000,
        },
    ),
]


def main() -> None:
    written = 0
    for family, slug, family_label, fixture_id, criticality, expected in LABELS:
        fx_dir = ROOT / family / slug
        ej_path = fx_dir / "expected.json"
        if not ej_path.exists():
            raise SystemExit(f"missing fixture: {ej_path}")
        payload = {
            "_curated": True,
            "_labelled_by": "scripts/eval/_label_vacuous.py (Deliverable 2 grounded labels)",
            "expected": expected,
            "family": family_label,
            "fixture_id": fixture_id,
        }
        if slug == "uet-prospectus-2024-d60577":
            payload["_note"] = (
                "max_duration_ms=300000 accommodates the isolated worker's TWO-pass "
                "extraction (determinism fingerprint): single pass measures ~124s on "
                "this 4.8MB PDF, so two passes + spawn overhead need ~282s. The "
                "earlier 180000ms budget fit one pass but timed out on two. CI runners "
                "are typically faster; if a slower machine times out, raise this rather "
                "than disabling determinism."
            )
        ej_path.write_text(
            json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        written += 1
    print(f"wrote {written} grounded expectation files")


if __name__ == "__main__":
    main()
