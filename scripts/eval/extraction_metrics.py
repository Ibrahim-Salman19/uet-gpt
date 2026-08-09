"""Matchers and normalization for the extraction evaluation.

Kept import-light and side-effect-free so ``test_extraction_eval.py`` can
exercise each function in isolation. The harness (``run_extraction_eval.py``)
composes these into per-fixture metrics.

Normalization mirrors ``docs/extraction_standard.md`` Layer 3 (the normalizer)
so that expectations match *semantically*: collapsed whitespace, no
``&nbsp;``, no ASP.NET ``__VIEWSTATE`` residue. Matching is substring-based on
the normalized form — intentionally lenient, because the goal is to detect
regressions (lost facts, leaked boilerplate), not to enforce exact strings.
"""

from __future__ import annotations

import re
from typing import Iterable
from urllib.parse import urlsplit

# ─────────────────────────────────────────────────────────────────────────────
# Normalization
# ─────────────────────────────────────────────────────────────────────────────

_VIEWSTATE_RE = re.compile(r"__[A-Za-z]+(State|Validation|Event)", re.I)
_WS_RE = re.compile(r"\s+")
_NBSP_RE = re.compile(r"(?:&nbsp;|\u00a0)", re.I)


def normalize_text(text: str) -> str:
    """Lowercase, strip nbsp/ASP.NET residue, collapse all whitespace.

    The output is a single space-separated token stream — no newlines — so a
    required block spanning several rendered lines still matches as one phrase.

    Note: this *removes* ``__VIEWSTATE``/``__EVENTVALIDATION`` residue because
    the point of normalizing *required* content is to ignore those artifacts.
    For *forbidden*-block detection use :func:`normalize_for_detection`, which
    preserves boilerplate tokens instead of deleting them.
    """
    if not text:
        return ""
    out = text.lower()
    out = _NBSP_RE.sub(" ", out)
    out = _VIEWSTATE_RE.sub(" ", out)          # drop __VIEWSTATE / __EVENTVALIDATION
    out = out.replace("\u200b", "")             # zero-width spaces
    out = _WS_RE.sub(" ", out)
    return out.strip()


def normalize_for_detection(text: str) -> str:
    """Lowercase + whitespace collapse only — preserves boilerplate tokens.

    Use this for *forbidden*-block checks: we want to detect that a page leaked
    ``__VIEWSTATE`` or ``Skip to main content``, so we must NOT delete those
    tokens during normalization the way :func:`normalize_text` does.
    """
    if not text:
        return ""
    out = _NBSP_RE.sub(" ", text.lower())
    out = _WS_RE.sub(" ", out)
    return out.strip()


def normalize_url(url: str) -> str:
    """Lowercase host + scheme, drop fragment, drop trailing slash on bare host.

    Two URLs that point at the same resource should compare equal regardless of
    fragment or trivial casing. This intentionally does *not* sort query params
    (parameter order can carry meaning on legacy ASP routes).
    """
    if not url:
        return ""
    parts = urlsplit(url.strip())
    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    path = parts.path or "/"
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    rebuilt = parts._replace(scheme=scheme, netloc=netloc, path=path, fragment="")
    return rebuilt.geturl()


def url_host(url: str) -> str:
    return urlsplit(url.strip()).netloc.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Matchers (all operate on normalized text/urls)
# ─────────────────────────────────────────────────────────────────────────────

def contains_phrase(haystack: str, phrase: str) -> bool:
    """True if the normalized ``phrase`` appears in the normalized ``haystack``.

    Uses the *preserving* normalizer (``normalize_for_detection``) so this works
    for forbidden-token detection. For required critical-fact recall, prefer
    :func:`required_block_present`, which additionally strips ASP.NET residue.
    Both sides accept raw or pre-normalized text.
    """
    return normalize_for_detection(phrase) in normalize_for_detection(haystack)


def required_block_present(haystack_raw: str, phrase: str) -> bool:
    """Recall matcher for required critical-fact blocks.

    Uses ``normalize_text`` (which strips ``__VIEWSTATE`` residue) on both sides,
    so a required phrase matches even when the page is noisy with ASP.NET state.
    """
    return normalize_text(phrase) in normalize_text(haystack_raw)


def any_link_contains(links: Iterable[str], fragment: str) -> list[str]:
    """Return the links whose normalized form contains the fragment.

    Returns the offenders (empty list = good) so callers can report *which*
    link violated an expectation rather than just a boolean.
    """
    frag = fragment.lower()
    return [ln for ln in links if frag in normalize_url(ln).lower()]


def link_set_contains(links: Iterable[str], fragment: str) -> bool:
    return bool(any_link_contains(links, fragment))


# ─────────────────────────────────────────────────────────────────────────────
# Metric computation (pure functions over expected + actual)
# ─────────────────────────────────────────────────────────────────────────────

def score_fixture(expected: dict, *, title: str, markdown: str, crawl_links,
                  resources, canonical_url: str, raised: bool,
                  image_candidates=None) -> dict:
    """Compute the per-fixture metric dict from an ``expected.json`` payload.

    ``crawl_links``/``resources`` may be lists of strings or of objects with a
    ``url`` field; both are flattened to URL strings here. ``image_candidates``
    (optional, default None) is a list of image-candidate objects/dicts with
    ``url``/``alt_text``/``source``/``score`` — scored against
    ``required_images``/``image_min_count`` expectations (Deliverable 2).
    """
    exp = expected.get("expected", expected)
    link_urls = [_as_url(x) for x in crawl_links]
    resource_urls = [_as_url(x) for x in resources]
    all_urls = link_urls + resource_urls

    title_norm = title
    md_raw = markdown

    # ── title ──
    req_title = exp.get("title_contains", [])
    bad_title = exp.get("title_not_contains", [])
    title_required_ok = all(required_block_present(title_norm, t) for t in req_title)
    title_forbidden_ok = not any(contains_phrase(title_norm, t) for t in bad_title)
    title_accuracy = 1.0 if (title_required_ok and title_forbidden_ok) else 0.0

    # ── canonical ──
    exp_host = exp.get("canonical_host")
    canonical_accuracy = (
        1.0 if (not exp_host or url_host(canonical_url).endswith(exp_host)) else 0.0
    )

    # ── blocks (recall) — strips ASP.NET residue so required facts survive ──
    required = exp.get("required_text_blocks", [])
    required_texts = [_block_text(b) for b in required]
    missing = [t for t in required_texts if not required_block_present(md_raw, t)]
    required_total = len(required_texts)
    required_matched = required_total - len(missing)
    block_recall = required_matched / required_total if required_total else 1.0

    # ── blocks (precision) — preserves boilerplate tokens so leaks are detected ──
    forbidden = exp.get("forbidden_text_blocks", [])
    leaked = [t for t in forbidden if contains_phrase(md_raw, t)]
    forbidden_total = len(forbidden)
    forbidden_leaked_count = len(leaked)
    block_precision = 1.0 - (forbidden_leaked_count / forbidden_total) if forbidden_total else 1.0

    # ── links ──
    req_links = exp.get("required_links_contain", [])
    bad_links = exp.get("forbidden_links_contain", [])
    missing_links = [f for f in req_links if not link_set_contains(all_urls, f)]
    leaked_links = [f for f in bad_links if link_set_contains(all_urls, f)]
    req_links_total = len(req_links)
    req_links_matched = req_links_total - len(missing_links)
    bad_links_total = len(bad_links)
    bad_links_leaked_count = len(leaked_links)
    link_recall = req_links_matched / req_links_total if req_links_total else 1.0
    link_precision = 1.0 - (bad_links_leaked_count / bad_links_total) if bad_links_total else 1.0

    # ── resource floor ──
    resource_min = exp.get("resource_min_count", 0)
    resource_floor_ok = len(resource_urls) >= resource_min

    # ── typed resources + image candidates (Deliverable 2) ──
    # Scored separately from the legacy substring link checks. A typed
    # ``required_resources`` spec (kind/crawlable/nofollow) is satisfied only by
    # a real ``resources`` entry, never by a bare crawl_link string — so a PDF in
    # crawl_links cannot satisfy a ``kind: pdf`` resource expectation.
    typed = score_typed_resources(exp, resources or [], crawl_links or [])
    images = score_image_candidates(exp, image_candidates or [])

    # ── hard properties ──
    extraction_raises = 1 if raised else 0

    # Resource/image floors affect ``passed`` only when asserted (rate is not None).
    typed_recall_ok = typed["resource_recall"] in (None, 1.0)
    typed_precision_ok = typed["resource_precision"] in (None, 1.0)
    image_recall_ok = images["image_recall"] in (None, 1.0)
    image_floor_ok = images["image_floor_ok"]

    passed = (
        block_recall == 1.0
        and block_precision == 1.0
        and title_accuracy == 1.0
        and link_recall == 1.0
        and link_precision == 1.0
        and canonical_accuracy == 1.0
        and extraction_raises == 0
        and resource_floor_ok
        and typed_recall_ok
        and typed_precision_ok
        and image_recall_ok
        and image_floor_ok
    )

    out = {
        "title_accuracy": title_accuracy,
        "canonical_accuracy": canonical_accuracy,
        "block_recall": block_recall,
        "block_precision": block_precision,
        "link_recall": link_recall,
        "link_precision": link_precision,
        "resource_floor_ok": resource_floor_ok,
        "extraction_raises": extraction_raises,
        "passed": passed,
        # Raw counts (defect 10): enable micro-averaging (total matched / total
        # assertions) alongside the macro (per-fixture mean) the harness already
        # reports. The rate fields above remain the per-fixture view.
        "required_blocks_total": required_total,
        "required_blocks_matched": required_matched,
        "forbidden_blocks_total": forbidden_total,
        "forbidden_blocks_leaked": forbidden_leaked_count,
        "required_links_total": req_links_total,
        "required_links_matched": req_links_matched,
        "forbidden_links_total": bad_links_total,
        "forbidden_links_leaked": bad_links_leaked_count,
        # Diagnostic detail (only populated on failure to keep reports small):
        "missing_blocks": missing,
        "leaked_blocks": leaked,
        "missing_links": missing_links,
        "leaked_links": leaked_links,
    }
    # Merge typed-resource + image metrics (Deliverable 2). These are additive —
    # the legacy fields above are unchanged so existing tests/consumers keep
    # working. ``resource_recall``/``resource_precision``/``image_recall`` are
    # None when no typed expectation is asserted, so they don't move ``passed``.
    out.update(typed)
    out.update(images)
    return out


def _as_url(x) -> str:
    if isinstance(x, str):
        return x
    if isinstance(x, dict):
        return x.get("url", "") or x.get("href", "") or ""
    return getattr(x, "url", "")


def _block_text(b) -> str:
    if isinstance(b, dict):
        return b.get("text", "")
    return str(b)


# ─────────────────────────────────────────────────────────────────────────────
# Typed resource matching (Deliverable 2)
# ─────────────────────────────────────────────────────────────────────────────
# The extractor classifies every discovered link into a ``resources`` entry with
# a closed ``kind`` enum (page|pdf|document|spreadsheet|calendar|data|
# presentation|ebook|archive|video|audio|image) plus ``crawlable`` and
# ``nofollow`` booleans. ``crawl_links`` is redundant with
# ``{r for r in resources if r.crawlable}`` (minus the page's own URL), so we
# model ``resources`` as the source of truth and score typed expectations
# separately from the legacy string-substring link checks.

RESOURCE_KINDS = (
    "page", "pdf", "document", "spreadsheet", "calendar", "data",
    "presentation", "ebook", "archive", "video", "audio", "image",
)


def _resource_field(res, name: str):
    """Read a field from a resource whether it's a dict, dataclass, or shim."""
    if isinstance(res, dict):
        return res.get(name)
    return getattr(res, name, None)


def _resource_matches_spec(res, spec: dict) -> bool:
    """True iff ``res`` satisfies every typed constraint in ``spec``.

    ``spec`` fields (all optional; ``url_contains`` alone is a substring match):
      - url_contains  — substring of the normalized URL (required)
      - kind          — exact kind-enum match
      - crawlable     — bool match
      - nofollow      — bool match
    """
    url = normalize_url(_as_url(res))
    needle = str(spec.get("url_contains", "")).lower()
    if needle and needle not in url.lower():
        return False
    for field_name in ("kind", "crawlable", "nofollow"):
        if field_name in spec and spec[field_name] is not None:
            actual = _resource_field(res, field_name)
            if field_name == "kind":
                if str(actual or "").lower() != str(spec[field_name]).lower():
                    return False
            else:
                if bool(actual) != bool(spec[field_name]):
                    return False
    return True


def _find_matching_resource(resources, spec: dict) -> bool:
    """True iff any resource in ``resources`` satisfies ``spec`` (typed match)."""
    return any(_resource_matches_spec(r, spec) for r in resources)


def score_typed_resources(exp: dict, resources, crawl_links) -> dict:
    """Score typed resource expectations separately from legacy link checks.

    Returns a dict with resource_recall, resource_precision, raw counts, and
    diagnostic lists. This is *additive*: the legacy ``link_recall``/
    ``link_precision`` (substring over crawl_links+resource_urls) remain in the
    main ``score_fixture`` output for backward compatibility.

    The point (reviewer's concern): a PDF appearing in ``crawl_links`` must NOT
    satisfy a ``required_resources`` expectation that asks for a typed ``pdf``
    resource — typed matching is independent of the legacy substring match.
    """
    req_resources = exp.get("required_resources", []) or []
    forbidden_resources = exp.get("forbidden_resources", []) or []

    # ── recall: required typed resources present ──
    missing = []
    matched = 0
    critical_missing = []  # specs flagged critical=True that were not matched
    for spec in req_resources:
        if _find_matching_resource(resources, spec):
            matched += 1
        else:
            # A typed resource may legitimately also surface as a bare crawl link
            # if the harness flattened it; check there too so the diagnostic is
            # precise about *which* dimension failed. But for the *typed* metric,
            # only a typed ``resources`` match counts — crawl_links (bare strings)
            # cannot satisfy a kind/crawlable/nofollow spec.
            missing.append(spec)
            if spec.get("critical"):
                critical_missing.append(spec.get("url_contains", "<unspecified>"))
    req_total = len(req_resources)
    resource_recall = (matched / req_total) if req_total else None  # None = not asserted

    # ── precision: forbidden typed resources absent ──
    leaked = [spec for spec in forbidden_resources if _find_matching_resource(resources, spec)]
    forb_total = len(forbidden_resources)
    resource_precision = (1.0 - len(leaked) / forb_total) if forb_total else None

    return {
        "resource_recall": resource_recall,
        "resource_precision": resource_precision,
        "required_resources_total": req_total,
        "required_resources_matched": matched,
        "forbidden_resources_total": forb_total,
        "forbidden_resources_leaked": len(leaked),
        "missing_resources": missing,
        "leaked_resources": leaked,
        # Critical-resource recall (Deliverable 2): a spec with ``critical: true``
        # (e.g. the prospectus PDF link, a merit-list download) enforces an
        # uncompensable 100% floor at the gate level. A non-critical resource
        # miss lowers resource_recall but cannot, on its own, fail the gate.
        "critical_resources_total": sum(1 for s in req_resources if s.get("critical")),
        "critical_resources_matched": sum(1 for s in req_resources if s.get("critical")) - len(critical_missing),
        "critical_resources_missing": critical_missing,
    }


def score_image_candidates(exp: dict, image_candidates) -> dict:
    """Score image-candidate expectations (alt text, source prefix, min count).

    Image ``source`` is a free-form namespace (img:*, source:*, meta:*, …) so we
    match by prefix, not equality. ``required_alt_text`` checks whether any
    candidate's alt_text contains the phrase (semantic, like block matching).
    """
    req_imgs = exp.get("required_images", []) or []
    img_min = int(exp.get("image_min_count", 0) or 0)
    cands = list(image_candidates or [])

    missing_alt = []
    for spec in req_imgs:
        needle = str(spec.get("alt_contains", "")).lower()
        source_prefix = str(spec.get("source_prefix", "")).lower()
        found = False
        for ic in cands:
            alt = str(_resource_field(ic, "alt_text") or "")
            src = str(_resource_field(ic, "source") or "").lower()
            if needle and needle not in normalize_text(alt):
                continue
            if source_prefix and not src.startswith(source_prefix):
                continue
            found = True
            break
        if not found:
            missing_alt.append(spec)

    req_total = len(req_imgs)
    matched = req_total - len(missing_alt)
    image_recall = (matched / req_total) if req_total else None
    image_floor_ok = len(cands) >= img_min

    return {
        "image_recall": image_recall,
        "image_floor_ok": image_floor_ok,
        "required_images_total": req_total,
        "required_images_matched": matched,
        "image_count": len(cands),
        "missing_images": missing_alt,
    }
