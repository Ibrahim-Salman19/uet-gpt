"""One-shot curation: overwrite auto-skeletons with real expected.json.

This is a build-time authoring script (not part of the runtime harness). It
encodes a genuine critical fact per content-bearing fixture, grounded in the
captured body, and minimal graceful-handling expectations for failure fixtures.
Re-running it is idempotent. Delete this file after the corpus stabilizes if
desired; the expected.json files stand on their own.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "fixtures"


def write(family, slug, payload):
    payload["_curated"] = True
    payload["fixture_id"] = f"{family}/{slug}"
    payload["family"] = family
    (ROOT / family / slug / "expected.json").write_text(
        json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print("  wrote", family + "/" + slug)


def failure(note):
    return {
        "_note": note,
        "expected": {
            "title_contains": [],
            "title_not_contains": [],
            "canonical_host": None,
            "required_text_blocks": [],
            "forbidden_text_blocks": [],
            "required_links_contain": [],
            "forbidden_links_contain": ["logout", "login"],
            "resource_min_count": 0,
        },
    }


# ── legacy-asp ──
write("legacy-asp", "courses-ug-8ddef9", {"expected": {
    "title_contains": ["Department of Computer Engineering"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "web.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "University of Engineering and Technology, Taxila", "why": "institutional identity"},
        {"text": "Department of Computer Engineering", "why": "department title"},
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": ["cped/downloads.asp"],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("legacy-asp", "betsoftwareengineering-a27271", {"expected": {
    "title_contains": ["Software Engineering Technology Program"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "web.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Software Engineering Technology Program", "why": "program title"},
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": ["telecom/downloads.asp"],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("legacy-asp", "curriculum-e38252", {"expected": {
    "title_contains": ["Elective Courses"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "web.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Department of Mechatronics Engineering", "why": "department title"},
        {"text": "Calculus and Analytical Geometry", "why": "a real course in the curriculum table"},
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": ["mced/contact.asp"],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
for slug in ["bsctechnologymechanical-a2d533", "betcybersecurity-365f51", "academiccommittees-3ce22e"]:
    write("legacy-asp", slug, failure("522 Cloudflare failure fixture: asserts graceful handling."))

# ── legacy-aspx ──
write("legacy-aspx", "examsfaq-55db37", {"expected": {
    "title_contains": ["Examination Frequently Asked Questions"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "web.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Examination Frequently Asked Questions", "why": "page heading"},
        {"text": "Transcript", "why": "a critical exam-office service"},
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("legacy-aspx", "sports-307a01", {"expected": {
    "title_contains": ["Sports"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "web.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Directorate of Sports", "why": "section heading"},
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("legacy-aspx", "transport-057ca9", {"expected": {
    "title_contains": ["Transport"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "web.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Transport Services", "why": "section heading"},
        {"text": "Bus-Routes-Morning-2025.pdf", "why": "a current resource link that must survive extraction"},
    ],
    "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
    "required_links_contain": ["bus-routes-morning-2025.pdf"],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
for slug in ["libraryrules-ed35c9", "hostels-837b47", "oric-ecc7da"]:
    write("legacy-aspx", slug, failure("522 Cloudflare failure fixture: asserts graceful handling."))

# ── admissions-php ──
write("admissions-php", "faqs-07df8a", {"expected": {
    "title_contains": ["Frequently Asked Questions"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Rs. 4,000", "why": "application processing fee — a critical fact"},
        {"text": "60% marks", "why": "eligibility threshold for Engineering programs"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("admissions-php", "feesfortechnologyprograms-ff27fa", {"expected": {
    "title_contains": ["Fee Structure"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Tuition Charges", "why": "core fee line item"},
        {"text": "25,000", "why": "tuition amount — must survive table extraction"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("admissions-php", "admission-eligibility-1cc3b3", {"expected": {
    "title_contains": ["Admission Eligibility"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Eligibility Criteria by Program", "why": "section heading"},
        {"text": "Software Engineering", "why": "a listed program"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("admissions-php", "procedureandrequirements-05a20e", {"expected": {
    "title_contains": ["Admission Procedure"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Rs. 4000", "why": "processing fee amount stated inline"},
        {"text": "Application Processing Fee", "why": "section heading"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("admissions-php", "schedule2-ee1d41", {"expected": {
    "title_contains": ["UET Taxila UG Admissions"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Entry Test Schedule", "why": "section heading"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("admissions-php", "seats-allocation-a0bb04", {"expected": {
    "title_contains": ["Seat Allocation Chart"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Punjab (Open Merit)", "why": "the largest seat quota category"},
        {"text": "Civil", "why": "a program column header in the seat table"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})

# ── pdf-download ──
write("pdf-download", "uet-prospectus-2024-d60577", {
    "_note": "PDFs return their URL as title (no metadata title) — recorded behavior.",
    "expected": {
        "title_contains": [],
        "title_not_contains": [],
        "canonical_host": "admissions.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "UG PROSPECTUS 2024", "why": "document title on page 1"},
            {"text": "UET, TAXILA", "why": "institutional identity"},
        ],
        "forbidden_text_blocks": [],
        "required_links_contain": [],
        "forbidden_links_contain": [],
        "resource_min_count": 0,
    },
})
write("pdf-download", "sexualharassment-policy-4b52e1", {
    "_note": "PDF returns URL as title.",
    "expected": {
        "title_contains": [], "title_not_contains": [],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [], "forbidden_text_blocks": [],
        "required_links_contain": [], "forbidden_links_contain": [],
        "resource_min_count": 0,
    },
})
write("pdf-download", "peeda-2006-2-08031c", {
    "_note": "PDF returns URL as title.",
    "expected": {
        "title_contains": [], "title_not_contains": [],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [], "forbidden_text_blocks": [],
        "required_links_contain": [], "forbidden_links_contain": [],
        "resource_min_count": 0,
    },
})

# ── fms-profile ──
write("fms-profile", "haroon-yousaf-e9402e", {"expected": {
    "title_contains": ["Dr. Muhammad Haroon Yousaf"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "fms.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Dr. Muhammad Haroon Yousaf", "why": "faculty name"},
        {"text": "Computer Engineering", "why": "department"},
        {"text": "haroon.yousaf@uettaxila.edu.pk", "why": "contact email"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
write("fms-profile", "gulistan-raja-556686", {"expected": {
    "title_contains": ["Dr. Gulistan Raja"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "fms.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Dr. Gulistan Raja", "why": "faculty name"},
        {"text": "Signal and Image Processing", "why": "specialization"},
        {"text": "gulistan.raja@uettaxila.edu.pk", "why": "contact email"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": [],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})

# ── main-root ──
write("main-root", "admissions-uettaxila-edu-pk-79a49c", {"expected": {
    "title_contains": ["Undergraduate Admissions 2026"],
    "title_not_contains": ["Untitled", "404"],
    "canonical_host": "admissions.uettaxila.edu.pk",
    "required_text_blocks": [
        {"text": "Application Processing Fee", "why": "critical admissions info"},
        {"text": "4,000", "why": "the fee amount"},
    ],
    "forbidden_text_blocks": [],
    "required_links_contain": ["entrytest.uettaxila.edu.pk"],
    "forbidden_links_contain": ["logout", "login"],
    "resource_min_count": 0,
}})
for slug in ["uettaxila-edu-pk-9289bf", "web-uettaxila-edu-pk-0b20b6"]:
    write("main-root", slug, {
        "_note": (
            "The homepage legitimately links to the alumni MIS login "
            "(mis.uettaxila.edu.pk/Alumni/Login/Login.aspx). Discovery of a login "
            "link is correct and useful for audit; the crawler's UrlPolicy excludes "
            "*/login* from the crawl frontier at authorization time. So 'login' is "
            "NOT forbidden in the discovery layer here — only 'logout' (a "
            "state-changing route) is."
        ),
        "expected": {
            "title_contains": ["UET Taxila"],
            "title_not_contains": ["Untitled", "404"],
            "canonical_host": "uettaxila.edu.pk",
            "required_text_blocks": [
                {"text": "Undergraduate Admissions 2026", "why": "front-page admissions banner"},
                {"text": "merit list", "why": "critical current notice"},
            ],
            "forbidden_text_blocks": [],
            "required_links_contain": ["admissions.uettaxila.edu.pk"],
            "forbidden_links_contain": ["logout"],
            "resource_min_count": 0,
        },
    })

# ── fetch-failure ──
for slug, code in [("admissions-78b6de", "404"), ("default-73fbf4", "500"), ("research-e30700", "404")]:
    write("fetch-failure", slug, failure(
        f"{code} failure fixture: asserts the extractor does not raise and invents no false content."
    ))

print("\nAll expectations curated.")
