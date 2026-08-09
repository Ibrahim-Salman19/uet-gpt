"""Per-family ledger coverage — corpus representation vs the real crawl ledger.

The directive for Deliverable 2 requires expanding the labelled corpus *only
from families confirmed in the real 4,111-URL ledger* and reporting per-family
coverage. This module answers two questions a reviewer will ask:

  1. Which families does the **real ledger** confirm (by host + URL shape)?
  2. Of those, which does the **fixture corpus** actually represent, and how
     richly (fixture count, labelled count, assertion density)?

A family present in the ledger but absent (or vacuously represented) in the
corpus is a coverage gap — exactly what the directive wants surfaced.

The ledger is optional: when ``crawl_ledger.sqlite3`` is not on disk (e.g. in
CI, where only the committed corpus ships), ``build_coverage_report`` returns
``None`` and the harness skips the block rather than failing.

Usage::

    from ledger_coverage import build_coverage_report
    report = build_coverage_report(corpus_root, ledger_path, per_family_stats)
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit


# ── Family classifier ────────────────────────────────────────────────────────
# Mirrors the ad-hoc classification used to survey the ledger. The corpus
# family dirs are a *curated subset* of these; a ledger family with no
# matching corpus dir is a gap. ``pdf`` is host-agnostic (any .pdf URL).


def classify_ledger_url(url: str) -> str:
    """Map a crawled URL to one of the confirmed ledger families.

    The families are derived empirically from the 4,111-URL ledger:

      admissions   — admissions.uettaxila.edu.pk (the .php portal)
      fms          — fms.uettaxila.edu.pk (faculty profiles)
      main-root    — uettaxila.edu.pk apex / www
      web-other    — web.uettaxila.edu.pk non-.asp/.aspx pages (the bulk)
      web-asp      — *.asp pages under web.uettaxila.edu.pk
      web-aspx     — *.aspx pages (incl. mis.uettaxila.edu.pk Alumni)
      pdf          — any .pdf URL regardless of host
      other        — anything else (entrytest/admission subdomains, etc.)
    """
    u = urlsplit(url)
    host = (u.hostname or "").lower()
    path = u.path.lower()
    if path.endswith(".pdf"):
        return "pdf"
    if "admissions.uettaxila" in host:
        return "admissions"
    if "fms.uettaxila" in host:
        return "fms"
    if host in ("uettaxila.edu.pk", "www.uettaxila.edu.pk"):
        return "main-root"
    if "web.uettaxila" in host:
        if path.endswith(".asp"):
            return "web-asp"
        if path.endswith(".aspx"):
            return "web-aspx"
        return "web-other"
    if "mis.uettaxila" in host:
        return "web-aspx"
    return "other"


# ── Corpus-family → ledger-family mapping ────────────────────────────────────
# The corpus family directory names are curated labels that don't always match
# the ledger classifier 1:1. This maps each corpus family to the ledger
# families it represents, so coverage is attributed correctly.

CORPUS_TO_LEDGER = {
    "admissions-php": {"admissions"},
    "fms-profile": {"fms"},
    "main-root": {"main-root"},
    "legacy-asp": {"web-asp"},
    "legacy-aspx": {"web-aspx"},
    "web-other": {"web-other"},
    "pdf-download": {"pdf"},
    "fetch-failure": set(),   # meta-family (graceful failure captures), not a ledger family
}


def _ledger_family_counts(ledger_path: Path) -> dict[str, dict[str, int]] | None:
    """Read the crawl ledger and return per-family ingestion stats.

    Returns ``None`` if the ledger is absent (the corpus-only / CI case).
    Only ``ingested`` rows (state='ingested' with real word_count) count as
    confirmed successful content — discovered-but-not-crawled URLs are not
    evidence of a crawlable family.
    """
    if not ledger_path.exists():
        return None
    con = sqlite3.connect(str(ledger_path))
    try:
        cur = con.cursor()
        cur.execute(
            "SELECT url, state, word_count FROM crawl_urls"
        )
        by_fam: dict[str, dict[str, int]] = {}
        for url, state, wc in cur.fetchall():
            fam = classify_ledger_url(url)
            d = by_fam.setdefault(fam, {"total": 0, "ingested_ok": 0})
            d["total"] += 1
            if state == "ingested" and (wc or 0) > 50:
                d["ingested_ok"] += 1
        return by_fam
    finally:
        con.close()


def build_coverage_report(
    corpus_root: Path,
    ledger_path: Path,
    per_family_stats: dict[str, dict[str, Any]],
) -> dict[str, Any] | None:
    """Compute a per-family ledger-coverage report.

    ``per_family_stats`` is the harness ``aggregate()`` per-family output
    (fixture/labelled/assertion counts). The report cross-references it
    against the ledger so a reviewer can see, per confirmed family: how many
    real URLs exist, how many corpus fixtures represent it, and how many of
    those are labelled.

    Returns ``None`` when the ledger is unavailable (CI). The block is then
    omitted from the report rather than degraded.
    """
    ledger = _ledger_family_counts(ledger_path)
    if ledger is None:
        return None

    # Invert the corpus→ledger map so we can attribute corpus fixtures to
    # ledger families.
    corpus_families = set(per_family_stats.keys())

    families: list[dict[str, Any]] = []
    for lfam in sorted(ledger):
        lstats = ledger[lfam]
        # Which corpus families represent this ledger family?
        representing = [cf for cf in corpus_families if lfam in CORPUS_TO_LEDGER.get(cf, set())]
        corpus_total = sum(per_family_stats[cf].get("fixtures", 0) for cf in representing)
        corpus_labelled = sum(per_family_stats[cf].get("labelled", 0) for cf in representing)
        corpus_assertions = sum(per_family_stats[cf].get("assertion_count", 0) for cf in representing)
        represented = corpus_total > 0
        labelled = corpus_labelled > 0
        families.append({
            "ledger_family": lfam,
            "ledger_total": lstats["total"],
            "ledger_ingested_ok": lstats["ingested_ok"],
            "corpus_families": sorted(representing),
            "corpus_fixtures": corpus_total,
            "corpus_labelled": corpus_labelled,
            "corpus_assertions": corpus_assertions,
            "represented": represented,
            "labelled": labelled,
        })

    gaps = [f["ledger_family"] for f in families if not f["labelled"] and f["ledger_ingested_ok"] > 0]
    return {
        "ledger_path": str(ledger_path),
        "ledger_total_urls": sum(f["ledger_total"] for f in families),
        "ledger_ingested_ok": sum(f["ledger_ingested_ok"] for f in families),
        "families": families,
        "coverage_gaps": gaps,   # ledger families with ingested content but no labelled corpus fixture
    }


def print_coverage_report(coverage: dict[str, Any]) -> None:
    """Human-readable coverage summary for the console."""
    print("\n  ledger coverage (corpus vs confirmed crawl ledger):")
    print(f"    {'family':<14}{'ledger_ok':>10}{'fixtures':>10}{'labelled':>10}{'asrt':>6}  status")
    print("    " + "-" * 62)
    for f in coverage["families"]:
        status = "labelled" if f["labelled"] else (
            "represented" if f["represented"] else (
                "GAP" if f["ledger_ingested_ok"] > 0 else "empty"
            )
        )
        print(f"    {f['ledger_family']:<14}{f['ledger_ingested_ok']:>10}"
              f"{f['corpus_fixtures']:>10}{f['corpus_labelled']:>10}"
              f"{f['corpus_assertions']:>6}  {status}")
    gaps = coverage["coverage_gaps"]
    if gaps:
        print(f"\n    ⚠️  {len(gaps)} coverage gap(s) — ledger families with ingested "
              f"content but no labelled corpus fixture: {', '.join(gaps)}")
