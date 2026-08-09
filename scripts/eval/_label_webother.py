"""One-off labelling pass for the 14 web-other fixtures (Deliverable 2 expansion).

Authors grounded `expected.json` for each web-other fixture. Every label is
sourced from the RAW page body (via ``_probe_raw.py`` output), NEVER from the
extractor's Markdown — per the directive: "label from the raw page and rendered
page, then compare the extractor output afterward."

Criticality assignment:
  - critical   : admissions-adjacent content a student cannot afford to lose
                 (pgAdmissions PDFs, convocation medalists/schedule)
  - standard   : ordinary informational/office pages (RTI, ITservices, etc.)
  - diagnostic : sparse/edge-case pages (AimandScope low-wc)

Run:  python scripts/eval/_label_webother.py
Idempotent: re-running overwrites expected.json with the same content.
Delete after the labelling pass + gate verification is complete.
"""

from __future__ import annotations

import json
from pathlib import Path

CORPUS = Path(__file__).resolve().parent.parent / "corpus" / "fixtures" / "web-other"

# Each entry: (slug, fixture_id, criticality, expected_dict)
# All text blocks / links / resources below were verified present in the raw
# body.bin via _probe_raw.py before authoring.
LABELS = [
    # ── dlsei ───────────────────────────────────────────────────────────────
    ("dlsei-d1a531", "web-other/dlsei-d1a531", "standard", {
        "title_contains": ["Digital Learning"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "DLSEI intends to enhance online learning", "why": "project purpose — the page's reason to exist"},
            {"text": "24000 Licenses", "why": "license capacity — a concrete deliverable fact"},
            {"text": "1000+ courses", "why": "course scale — a concrete deliverable fact"},
            {"text": "Coursera", "why": "the platform provider named in the body"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["dlsei.hec.gov.pk"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "DLSEI-DISCLAIMER_FORM.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
            {"url_contains": "DLSEI-SOP.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": True},
        ],
        "resource_min_count": 2,
        "max_duration_ms": 60000,
    }),
    # ── RTI ─────────────────────────────────────────────────────────────────
    ("rti-3efd61", "web-other/rti-3efd61", "standard", {
        "title_contains": ["RTI"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Contact Directory of all officials", "why": "RTI disclosure — a required public-access link label"},
            {"text": "Current Budget", "why": "RTI disclosure — budget transparency link"},
            {"text": "Current Universities Policies", "why": "RTI disclosure — policy transparency link"},
            {"text": "Current jobs and jobs archive", "why": "RTI disclosure — jobs transparency link"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["Rules", "Budget"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [],
        "resource_min_count": 0,
        "max_duration_ms": 60000,
    }),
    # ── departmentfaculty (Mechanical, id=2) ────────────────────────────────
    # NOTE: the raw <title> is the terse "DepartmentFaculty", but the extractor
    # returns the richer H1/heading "Faculty : Mechanical Engineering Department".
    # We assert on the heading (the meaningful identity), not the terse <title>.
    ("departmentfaculty-263906", "web-other/departmentfaculty-263906", "standard", {
        "title_contains": ["Mechanical Engineering Department"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Mechanical Engineering Department", "why": "department identity — the page's subject"},
            {"text": "Fracture and Fatigue of Metals", "why": "a specialization listing for the Dean — distinguishes from other depts"},
            {"text": "HVAC", "why": "a specialization — common Mechanical Eng topic"},
        ],
        "forbidden_text_blocks": ["Untitled Document"],
        "required_links_contain": ["fms.uettaxila.edu.pk/Profile/asim.pasha"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "fms.uettaxila.edu.pk/Profile/asim.pasha", "kind": "page", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "fms.uettaxila.edu.pk/Profile/muzaffar.ali", "kind": "page", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 5,
        "max_duration_ms": 60000,
    }),
    # ── departmentfaculty (Software Eng, id=5) ──────────────────────────────
    # See Mechanical note: assert on the heading, not the terse <title>.
    ("departmentfaculty-23be99", "web-other/departmentfaculty-23be99", "standard", {
        "title_contains": ["Software Engineering Department"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Software Engineering Department", "why": "department identity — the page's subject"},
            {"text": "Image Processing, Computer Vision", "why": "a specialization listing for the Dean"},
            {"text": "Ali Javed", "why": "a named faculty member (Post Doctorate, Oakland U) — distinct from Mech page"},
        ],
        "forbidden_text_blocks": ["Untitled Document"],
        "required_links_contain": ["fms.uettaxila.edu.pk/Profile/ali.javed"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "fms.uettaxila.edu.pk/Profile/ali.javed", "kind": "page", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "fms.uettaxila.edu.pk/Profile/adnan.habib", "kind": "page", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 5,
        "max_duration_ms": 60000,
    }),
    # ── DownloadExaminationForms ────────────────────────────────────────────
    # NOTE: resource needles use URL-path segments (no spaces) because the
    # extractor stores hrefs verbatim — spaces appear as %20 in the normalized
    # URL, so a literal-space needle would never match. "ExamBranch/UG/FORM"
    # uniquely identifies the UG form cluster without depending on encoding.
    ("downloadexaminationforms-87ee7b", "web-other/downloadexaminationforms-87ee7b", "critical", {
        "title_contains": ["Examinations Branch Downloads"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["Downloads/ExamBranch"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "exambranch/ug/form", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "exambranch/common/convocation", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
            {"url_contains": "exambranch/pg/phd-scrutinychecklist.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
            {"url_contains": "exambranch/pg/course-completion-form-msc.doc", "kind": "document", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 10,
        "max_duration_ms": 60000,
    }),
    # ── NewsDetails (Pakistani Researchers) ─────────────────────────────────
    ("celebrating-pakistani-researchers-among-the-worl-c276af", "web-other/celebrating-pakistani-researchers-among-the-worl-c276af", "standard", {
        "title_contains": ["News Details"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Ali Javed", "why": "a named honoree — the news subject"},
            {"text": "Software Engineering", "why": "the department of the honorees"},
            {"text": "certificates", "why": "the award bestowed — the news event"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": [],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [],
        "resource_min_count": 0,
        "max_duration_ms": 60000,
    }),
    # ── Events/All ──────────────────────────────────────────────────────────
    ("all-804e7d", "web-other/all-804e7d", "standard", {
        "title_contains": ["Events"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "21st Convocation 2024", "why": "a dated event entry — proves the listing rendered"},
            {"text": "Seminar on Awareness about Traffic Rules", "why": "a distinct event entry"},
            {"text": "All Pakistan Literary Competition", "why": "a distinct event entry"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["EventDetails/21st-Convocation-2024", "Events/Convocation"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [],
        "resource_min_count": 0,
        "max_duration_ms": 60000,
    }),
    # ── 21stConvocation2024 ─────────────────────────────────────────────────
    ("21stconvocation2024-8ff004", "web-other/21stconvocation2024-8ff004", "critical", {
        "title_contains": [],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "21st Convocation", "why": "the ceremony identity — the page's subject"},
            {"text": "Eligible Candidates", "why": "eligibility section — who may attend"},
            {"text": "Willingness Form", "why": "the registration mechanism — critical for attendees"},
            {"text": "Chancellor", "why": "medalist category header — proves the medalists table rendered"},
            {"text": "5th January-2024", "why": "rehearsal date — a concrete critical fact"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["forms.office.com"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "Convocation-Advertisement-2024.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "ListofMedalist202", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 2,
        "max_duration_ms": 60000,
    }),
    # ── ITservices ──────────────────────────────────────────────────────────
    # NOTE: "login" is deliberately NOT in forbidden_links_contain here, unlike
    # the admissions fixtures. This page legitimately links to the Microsoft 365
    # login portal, the Azure Dev Tools login, and a "How to Log in to Office
    # 365" PDF — those are real service links, not session/auth leakage. The
    # forbidden-link guard exists to catch accidental /login.aspx /logout.aspx
    # session routes; "logout" alone covers that intent here.
    ("itservices-19a675", "web-other/itservices-19a675", "standard", {
        "title_contains": ["IT Services"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Office 365", "why": "the flagship IT service named in the body"},
            {"text": "Eduroam", "why": "the wifi service named in the body"},
            {"text": "NARC", "why": "the hosting/operations unit named repeatedly"},
            {"text": "OneDrive", "why": "a concrete sub-service — proves body rendered"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["microsoft365.com", "aka.ms/devtoolsforteaching"],
        "forbidden_links_contain": ["logout"],
        "required_resources": [
            {"url_contains": "EDU-roam-Settings.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
            {"url_contains": "O365-Firstime-Login.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 2,
        "max_duration_ms": 60000,
    }),
    # ── TimeTables (CPED) ───────────────────────────────────────────────────
    ("timetables-4a32cf", "web-other/timetables-4a32cf", "standard", {
        "title_contains": ["TimeTables"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Fall 2025", "why": "a timetable semester label — proves the table rendered"},
            {"text": "Spring 2026", "why": "the latest timetable semester"},
            {"text": "CPED", "why": "the department code in the download paths"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["Downloads/TimeTables/CPED"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "CPED-Spring-2026.xlsx", "kind": "spreadsheet", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "CPED-Fall-2025.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 5,
        "max_duration_ms": 60000,
    }),
    # ── swarmroboticslab/Publications ───────────────────────────────────────
    # NOTE: DOI links are external (not under uettaxila.edu.pk), so the
    # extractor correctly marks them crawlable=False. The label must match that.
    ("publications-da50b5", "web-other/publications-da50b5", "standard", {
        "title_contains": ["Publications"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Swarm Robotics Lab", "why": "lab identity — the site's subject"},
            {"text": "Publications", "why": "the page section"},
        ],
        "forbidden_text_blocks": ["Untitled Document"],
        "required_links_contain": ["doi.org"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "doi.org", "kind": "page", "crawlable": False, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 1,
        "max_duration_ms": 60000,
    }),
    # ── qec/aboutQEC.htm ────────────────────────────────────────────────────
    ("aboutqec-3dfd36", "web-other/aboutqec-3dfd36", "standard", {
        "title_contains": ["Quality Enhancement Cell"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Quality Enhancement Cell", "why": "the office identity — the page's subject"},
            {"text": "Feb 2011", "why": "the QEC establishment date — a concrete fact"},
            {"text": "Quality Assurance Agency", "why": "QAA — the oversight body named throughout"},
            {"text": "Vice-Chancellor", "why": "the reporting line described in the body"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE"],
        "required_links_contain": [],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [],
        "resource_min_count": 0,
        "max_duration_ms": 60000,
    }),
    # ── swarmroboticslab/AimandScope (diagnostic — low wc) ──────────────────
    # NOTE: Sheffield link is external — crawlable=False (see Publications note).
    ("aimandscope-c165ee", "web-other/aimandscope-c165ee", "diagnostic", {
        "title_contains": ["Aim and Scope"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Swarm Intelligence Lab", "why": "a named sub-lab — proves the body rendered"},
            {"text": "Disaster Management", "why": "an application domain listed"},
        ],
        "forbidden_text_blocks": ["Untitled Document"],
        "required_links_contain": ["sheffield.ac.uk"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "sheffield.ac.uk", "kind": "page", "crawlable": False, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 1,
        "max_duration_ms": 60000,
    }),
    # ── pgAdmissions ────────────────────────────────────────────────────────
    # NOTE: resource needles use URL-path segments (no spaces) — the extractor
    # stores hrefs verbatim so spaces are %20 in the normalized URL. The
    # PhDAd/ and MScAd/ path segments uniquely identify each form.
    ("pgadmissions-d0282b", "web-other/pgadmissions-d0282b", "critical", {
        "title_contains": ["Postgraduate Admissions"],
        "title_not_contains": ["Untitled", "404"],
        "canonical_host": "web.uettaxila.edu.pk",
        "required_text_blocks": [
            {"text": "Postgraduate", "why": "the admissions track — the page's subject"},
        ],
        "forbidden_text_blocks": ["__VIEWSTATE", "Untitled Document"],
        "required_links_contain": ["Downloads/PGAdmissions"],
        "forbidden_links_contain": ["logout", "login"],
        "required_resources": [
            {"url_contains": "prospectus-pg-2026.pdf", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "phdad/application", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "mscad/application", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": True},
            {"url_contains": "phdad/phd%20statement", "kind": "pdf", "crawlable": True, "nofollow": False, "critical": False},
        ],
        "resource_min_count": 4,
        "max_duration_ms": 60000,
    }),
]


def main() -> int:
    for slug, fixture_id, criticality, expected_partial in LABELS:
        fdir = CORPUS / slug
        if not fdir.exists():
            print(f"  SKIP  {slug}  (fixture dir missing)")
            continue
        expected = dict(expected_partial)
        expected["criticality"] = criticality
        # full assertion-key set required by the integrity test for non-no_content fixtures
        expected.setdefault("title_contains", [])
        expected.setdefault("title_not_contains", [])
        expected.setdefault("canonical_host", "web.uettaxila.edu.pk")
        expected.setdefault("required_text_blocks", [])
        expected.setdefault("forbidden_text_blocks", [])
        expected.setdefault("required_links_contain", [])
        expected.setdefault("forbidden_links_contain", [])
        expected.setdefault("required_resources", [])
        expected.setdefault("resource_min_count", 0)
        payload = {
            "_curated": True,
            "_labelled_by": "scripts/eval/_label_webother.py (web-other expansion — labels sourced from raw body)",
            "family": "web-other",
            "fixture_id": fixture_id,
            "expected": expected,
        }
        out = fdir / "expected.json"
        out.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(f"  WROTE  {slug}/expected.json  (criticality={criticality}, "
              f"blocks={len(expected['required_text_blocks'])}, "
              f"resources={len(expected['required_resources'])})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
