"""Curated starter corpus for the UET extraction evaluation.

Every entry is a real URL observed in ``crawl_ledger.sqlite3`` (the production
crawl's record of what was fetched). Categories are grounded in the ledger's
actual distribution, *not* in a speculative page-family taxonomy:

  - legacy-asp / legacy-aspx : the dominant idiom on ``web.uettaxila.edu.pk``
  - admissions-php            : ``admissions.uettaxila.edu.pk/*.php``
  - pdf-download              : real ``.pdf`` documents served as bytes
  - fms-profile               : ``fms.uettaxila.edu.pk/Profile/*`` (often 522)
  - main-root                 : top-level host pages
  - fetch-failure             : 4xx/5xx that the extractor must handle gracefully

A ``(family, url)`` tuple is the unit of capture. The slug is derived from the
URL path so each fixture lands at ``fixtures/<family>/<slug>/``. Failure-mode
fixtures intentionally share their family with a success fixture so the eval can
distinguish "extracted correctly" from "handled a dead link gracefully".
"""

from __future__ import annotations

# (family, url). Order within a family is by descending word_count in the
# ledger, so the most content-rich examples are captured first.
STARTER_SET: tuple[tuple[str, str], ...] = (
    # ── legacy-asp ──────────────────────────────────────────────────────────
    ("legacy-asp", "https://web.uettaxila.edu.pk/cped/courses_UG.asp"),
    ("legacy-asp", "https://web.uettaxila.edu.pk/MED/BScTechnologyMechanical.asp"),
    ("legacy-asp", "https://web.uettaxila.edu.pk/telecom/BETSoftwareEngineering.asp"),
    ("legacy-asp", "https://web.uettaxila.edu.pk/telecom/BETCyberSecurity.asp"),
    ("legacy-asp", "https://web.uettaxila.edu.pk/EncED/AcademicCommittees.asp"),
    ("legacy-asp", "https://web.uettaxila.edu.pk/MCED/Curriculum.asp"),

    # ── legacy-aspx ─────────────────────────────────────────────────────────
    ("legacy-aspx", "https://web.uettaxila.edu.pk/LibraryRules.aspx"),
    ("legacy-aspx", "https://web.uettaxila.edu.pk/Hostels.aspx"),
    ("legacy-aspx", "https://web.uettaxila.edu.pk/ExamsFAQ.aspx"),
    ("legacy-aspx", "https://web.uettaxila.edu.pk/ORIC.aspx"),
    ("legacy-aspx", "https://web.uettaxila.edu.pk/Sports.aspx"),
    ("legacy-aspx", "https://web.uettaxila.edu.pk/Transport.aspx"),

    # ── admissions-php ──────────────────────────────────────────────────────
    ("admissions-php", "https://admissions.uettaxila.edu.pk/ProcedureAndRequirements.php"),
    ("admissions-php", "https://admissions.uettaxila.edu.pk/Seats_Allocation.php"),
    ("admissions-php", "https://admissions.uettaxila.edu.pk/FAQS.php"),
    ("admissions-php", "https://admissions.uettaxila.edu.pk/Admission_Eligibility.php"),
    ("admissions-php", "https://admissions.uettaxila.edu.pk/FeesForTechnologyPrograms.php"),
    ("admissions-php", "https://admissions.uettaxila.edu.pk/Schedule2.php"),

    # ── pdf-download ────────────────────────────────────────────────────────
    # The prospectus is the single most important student document; the
    # smaller PDFs exercise the non-HTML extraction branch cheaply.
    ("pdf-download", "https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2024.pdf"),
    ("pdf-download", "https://web.uettaxila.edu.pk/Downloads/Policies/SEXUALHARASSMENT-POLICY.pdf"),
    ("pdf-download", "https://web.uettaxila.edu.pk/PageContents/Rules/peeda_2006_2.pdf"),

    # ── fms-profile ─────────────────────────────────────────────────────────
    # fms.* is frequently behind Cloudflare and returns 522; we keep it to
    # exercise both the success and the failure path on the same family.
    ("fms-profile", "https://fms.uettaxila.edu.pk/Profile/haroon.yousaf"),
    ("fms-profile", "https://fms.uettaxila.edu.pk/Profile/gulistan.raja"),

    # ── main-root ───────────────────────────────────────────────────────────
    ("main-root", "https://web.uettaxila.edu.pk/"),
    ("main-root", "https://admissions.uettaxila.edu.pk/"),
    ("main-root", "https://uettaxila.edu.pk/"),

    # ── web-other ───────────────────────────────────────────────────────────
    # web.uettaxila.edu.pk non-.asp/.aspx pages — the single largest confirmed
    # ledger family (207 ingested URLs with wc>50) and, before this batch, a
    # coverage GAP (zero corpus representation). This curated 14-fixture batch
    # is selected for *structural diversity*, not word count: route prefix,
    # DOM/template fingerprint, word-count bucket, and page shape (modern
    # nav vs legacy .htm, table-heavy vs prose, query-param vs path) all vary.
    # Selection rationale is in ``scripts/corpus/web_other_shortlist.md``.
    ("web-other", "https://web.uettaxila.edu.pk/dlsei"),                                       # modern non-ASP (DLSEI — modern nav, downloads, 2026 footer)
    ("web-other", "https://web.uettaxila.edu.pk/RTI"),                                        # modern non-ASP info section (Right to Information)
    ("web-other", "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=2"),           # department faculty listing (Mechanical — table-heavy)
    ("web-other", "https://web.uettaxila.edu.pk/departmentfaculty?departmentId=5"),           # department faculty listing (Software Eng — same template, diff dept)
    ("web-other", "https://web.uettaxila.edu.pk/DownloadExaminationForms"),                   # course/CMS-style download hub (resource-heavy)
    ("web-other", "https://web.uettaxila.edu.pk/NewsDetails/Celebrating-Pakistani-Researchers-Among-the-Worlds-Top-2-Scientists"),  # single news detail
    ("web-other", "https://web.uettaxila.edu.pk/Events/All"),                                 # events listing (aggregated, high wc)
    ("web-other", "https://web.uettaxila.edu.pk/21stConvocation2024"),                        # convocation (schedule/registration, table+dates)
    ("web-other", "https://web.uettaxila.edu.pk/ITservices"),                                 # office page with downloads
    ("web-other", "https://web.uettaxila.edu.pk/TimeTables?DepartmentId=4&StudyLevelId=1"),  # query-param table page (form-heavy)
    ("web-other", "https://web.uettaxila.edu.pk/swarmroboticslab/Publications"),              # research lab page (modern template, distinct)
    ("web-other", "https://web.uettaxila.edu.pk/qec/aboutQEC.htm"),                           # pre-ASP legacy .htm office page
    ("web-other", "https://web.uettaxila.edu.pk/swarmroboticslab/AimandScope"),                # low-wc edge case (diagnostic — sparse content)
    ("web-other", "https://web.uettaxila.edu.pk/pgAdmissions"),                               # postgraduate admissions (critical-ish)

    # ── fetch-failure ───────────────────────────────────────────────────────
    # Real dead/broken links recorded in the ledger. The extractor must not
    # raise on these; the eval scores ``extraction_raises`` as a hard property.
    ("fetch-failure", "https://web.uettaxila.edu.pk/admissions/"),       # 404
    ("fetch-failure", "https://web.uettaxila.edu.pk/default.asp"),       # 500
    ("fetch-failure", "https://web.uettaxila.edu.pk/research/"),         # 404
)


def slugify(url: str) -> str:
    """Derive a filesystem-safe, stable slug from a URL's path+query.

    The slug is deterministic for a given URL so re-capture is idempotent. It
    keeps the final path segment when meaningful and falls back to a short hash
    when the path is empty (e.g. a bare host root).
    """
    import hashlib
    import re
    from urllib.parse import urlsplit

    parts = urlsplit(url)
    path = parts.path or "/"
    # Prefer the last non-empty path segment; for roots use the host.
    segments = [s for s in path.split("/") if s]
    if segments:
        base = segments[-1]
    else:
        base = parts.netloc
    # Strip an extension to keep slugs stable regardless of .asp/.pdf/.php.
    base = re.sub(r"\.(aspx?|php|pdf|html?|txt)$", "", base, flags=re.I)
    # Collapse to [a-z0-9-], truncating over-long slugs (some aspx routes are
    # whole sentences) and appending a short hash so distinct URLs never collide.
    cleaned = re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:6]
    cleaned = cleaned[:48].rstrip("-")
    return f"{cleaned or 'page'}-{digest}"
