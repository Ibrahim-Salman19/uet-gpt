"""Production-grade cleaning and quality assessment for PDF-derived Markdown.

The module is intentionally dependency-free and safe to use from both automated
crawler ingestion and manual PDF ingestion paths.

It targets common PyMuPDF4LLM / OCR / VLM extraction artifacts while preserving
real Markdown structure:

* image or figure omission placeholders;
* repeated running headers and footers;
* standalone page-number artifacts;
* Unicode comparison inconsistencies;
* excessive blank lines left by removals;
* sparse, symbol-heavy, or numerically mangled extraction output.

The original public entry points remain drop-in compatible:

    clean_pdf_markdown(markdown: str) -> str
    is_pdf_output_garbage(markdown: str, min_word_count: int = 50) -> bool

For observability, callers may additionally use:

    clean_pdf_markdown_with_report(...)
    assess_pdf_markdown_quality(...)
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from typing import Final, Literal, Sequence


# ---------------------------------------------------------------------------
# Configuration and diagnostics
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class CleaningConfig:
    """Tuning knobs for Markdown cleaning.

    Defaults are deliberately conservative: content is removed only when there
    is strong evidence that it is extraction noise.
    """

    # Candidate running-matter line limits.
    max_boilerplate_chars: int = 80
    max_boilerplate_words: int = 12

    # Repetition needed when explicit page boundaries are unavailable.
    repetition_min_occurrences: int = 9

    # With page boundaries, a line must occur at the same edge on at least this
    # fraction of pages. Small documents use a separate adaptive threshold.
    repetition_min_page_ratio: float = 0.35

    # Number of non-empty lines inspected at the top and bottom of each page.
    page_edge_window: int = 4

    # Keep structural page separators in the cleaned output.
    preserve_page_separators: bool = True

    # Maximum blank lines retained between blocks. One blank line means at
    # most two consecutive "\n" characters after joining.
    max_consecutive_blank_lines: int = 1

    def __post_init__(self) -> None:
        if self.max_boilerplate_chars < 1:
            raise ValueError("max_boilerplate_chars must be positive")
        if self.max_boilerplate_words < 1:
            raise ValueError("max_boilerplate_words must be positive")
        if self.repetition_min_occurrences < 2:
            raise ValueError("repetition_min_occurrences must be at least 2")
        if not 0 < self.repetition_min_page_ratio <= 1:
            raise ValueError("repetition_min_page_ratio must be in (0, 1]")
        if self.page_edge_window < 1:
            raise ValueError("page_edge_window must be positive")
        if self.max_consecutive_blank_lines < 0:
            raise ValueError("max_consecutive_blank_lines cannot be negative")


@dataclass(frozen=True, slots=True)
class CleaningReport:
    """Counts of modifications made during cleaning."""

    original_line_count: int
    cleaned_line_count: int
    placeholders_removed: int
    boilerplate_removed: int
    page_artifacts_removed: int
    control_characters_removed: int
    picture_text_blocks_removed: int
    pages_detected: int
    used_page_aware_detection: bool


@dataclass(frozen=True, slots=True)
class PdfMarkdownQuality:
    """Explainable result of PDF Markdown quality assessment."""

    is_garbage: bool
    score: float
    reasons: tuple[str, ...]
    word_count: int
    alphabetic_word_count: int
    unique_alphabetic_word_count: int
    non_empty_line_count: int
    table_line_ratio: float
    alphanumeric_character_ratio: float
    suspicious_character_ratio: float


DEFAULT_CLEANING_CONFIG: Final = CleaningConfig()


# ---------------------------------------------------------------------------
# Regexes and internal records
# ---------------------------------------------------------------------------


# Fenced code blocks. Up to three spaces of indentation is CommonMark-compatible.
_FENCE_RE: Final = re.compile(r"^ {0,3}(`{3,}|~{3,})(.*)$")

_HORIZONTAL_RULE_RE: Final = re.compile(
    r"^\s*(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$"
)

# PyMuPDF4LLM debugging separator (0-based page number), plus common VLM/OCR
# page-marker forms. These lines are boundaries, not noise by default.
_EXPLICIT_PAGE_SEPARATOR_RE: Final = re.compile(
    r"^\s*(?:"
    r"---\s*end\s+of\s+page\s*=\s*\d+\s*---"
    r"|<!--\s*(?:page(?:break)?)(?:\s*[:=#-]?\s*\d+)?\s*-->"
    r"|\[\[?\s*page\s+\d+\s*\]?\]"
    r"|\\pagebreak"
    r"|\f"
    r")\s*$",
    re.IGNORECASE,
)

# pymupdf4llm wraps OCR output from *inside* an image/picture bounding box
# (logos, seals, decorative graphics) in these markers - per its own source
# comment (picture_text_to_md/fallback_text_to_md in helpers/document_layout.py)
# it "cannot be sure about the formatting" of that region. Full-page scanned
# body text is OCRed through the normal heading/paragraph path and never
# wrapped this way, so this pattern only ever matches non-prose graphic
# regions. Measured against real UET PDFs, the wrapped content is OCR
# misreads of decorative crests/seals (e.g. "ND)<br>WY =-- W<br>Ne SE<br>"),
# not legitimate body text, so it is dropped rather than left to pollute
# retrieval with noise tokens.
_PICTURE_TEXT_BLOCK_RE: Final = re.compile(
    r"<!--\s*Start of picture text\s*-->.*?<!--\s*End of picture text\s*-->\n?",
    re.IGNORECASE | re.DOTALL,
)

# Placeholder generated when picture/image regions are omitted from text.
# It intentionally requires a placeholder signal (arrows, dimensions, or the
# word "omitted") so legitimate captions such as "Figure 2" survive.
_OMISSION_PLACEHOLDER_RE: Final = re.compile(
    r"^\s*(?:[-*_]\s*)*"
    r"(?:={2,}>|==>|<={2}|<==)?\s*"
    r"(?:picture|image|figure|graphic|vector(?:\s+graphic)?|drawing)\b"
    r"(?:\s*[:#-]?\s*(?:"
    r"\[\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*\]"
    r"|\(\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*\)"
    r"|\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?"
    r"))?"
    r"(?:\s+(?:was\s+)?(?:intentionally\s+)?omitted)?\s*"
    r"(?:={2,}>|==>|<={2}|<==)?\s*$",
    re.IGNORECASE,
)

# A dimensions-only placeholder is removed only when the *whole line* is the
# bracketed dimensions token. Inline dimensions in real prose are preserved.
_DIMENSIONS_ONLY_RE: Final = re.compile(
    r"^\s*(?:={2,}>|==>|<={2}|<==)?\s*"
    r"\[\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*\]"
    r"\s*(?:={2,}>|==>|<={2}|<==)?\s*$",
    re.IGNORECASE,
)

_MARKDOWN_STRUCTURAL_PREFIX_RE: Final = re.compile(
    r"^\s*(?:"
    r">\s?"  # block quote
    r"|[-+*]\s+"  # unordered list
    r"|\d{1,4}[.)]\s+"  # ordered list
    r"|!\["  # image
    r"|\[[^\]]+\]:"  # reference definition
    r")"
)

_MARKDOWN_HEADING_RE: Final = re.compile(r"^\s{0,3}#{1,6}\s+")
_MARKDOWN_TABLE_DELIMITER_RE: Final = re.compile(
    r"^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$"
)

# Explicit labels are high-confidence page artifacts even without boundaries.
_EXPLICIT_PAGE_NUMBER_RE: Final = re.compile(
    r"^\s*(?:[#>*_`~-]+\s*)*"
    r"(?:page|pg\.?|p\.)\s*[:#-]?\s*"
    r"\d{1,6}"
    r"(?:\s*(?:of|/|\\)\s*\d{1,6})?"
    r"(?:\s*[#>*_`~-]+)*\s*$",
    re.IGNORECASE,
)

_BARE_ARABIC_PAGE_NUMBER_RE: Final = re.compile(
    r"^\s*(?:[*_`#~-]+\s*)*([0-9]{1,6})"
    r"(?:\s*(?:of|/|\\)\s*([0-9]{1,6}))?"
    r"(?:\s*[*_`#~-]+)*\s*$",
    re.IGNORECASE,
)

_BARE_ROMAN_PAGE_NUMBER_RE: Final = re.compile(
    r"^\s*(?:[*_`#~-]+\s*)*([ivxlcdm]{2,8})"
    r"(?:\s*[*_`#~-]+)*\s*$",
    re.IGNORECASE,
)

_WORD_RE: Final = re.compile(r"[^\W_]+(?:[’'\-][^\W_]+)*", re.UNICODE)
_WHITESPACE_RE: Final = re.compile(r"\s+")
_WHOLE_LINE_EMPHASIS_RE: Final = re.compile(
    r"^(?:\*\*|__|~~|`|\*|_)(.*?)(?:\*\*|__|~~|`|\*|_)$"
)
_TRAILING_DYNAMIC_PAGE_RE: Final = re.compile(
    r"(?<!\d)(?:"
    r"(?:page|pg\.?)\s*[:#-]?\s*\d{1,6}(?:\s*(?:of|/)\s*\d{1,6})?"
    r"|\d{1,4}\s*(?:of|/)\s*\d{1,6}"
    r"|\d{1,4}"
    r")\s*$",
    re.IGNORECASE,
)
_URL_OR_EMAIL_RE: Final = re.compile(
    r"(?:https?://|www\.|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b)", re.IGNORECASE
)

# Characters that frequently signal failed glyph mapping / OCR corruption.
# Format characters are counted for quality analysis, but are not all removed:
# ZWNJ/ZWJ can be linguistically meaningful in Arabic-derived scripts.
_REPLACEMENT_CHAR: Final = "\ufffd"


@dataclass(slots=True)
class _LineRecord:
    text: str
    original_index: int
    protected: bool = False
    is_fence_line: bool = False
    is_separator: bool = False
    is_generic_horizontal_rule: bool = False
    page_index: int = 0
    page_content_index: int | None = None
    page_content_count: int = 0
    edge: Literal["top", "bottom"] | None = None


# ---------------------------------------------------------------------------
# Public cleaning API
# ---------------------------------------------------------------------------


def clean_pdf_markdown(
    markdown: str,
    *,
    config: CleaningConfig = DEFAULT_CLEANING_CONFIG,
) -> str:
    """Return cleaned PDF-derived Markdown.

    The function is idempotent and preserves fenced code, Markdown tables,
    headings, list items, and horizontal/page separators.
    """

    cleaned, _ = clean_pdf_markdown_with_report(markdown, config=config)
    return cleaned


def clean_pdf_markdown_with_report(
    markdown: str,
    *,
    config: CleaningConfig = DEFAULT_CLEANING_CONFIG,
) -> tuple[str, CleaningReport]:
    """Clean Markdown and return an explainable modification report."""

    if not isinstance(markdown, str):
        raise TypeError(f"markdown must be str, got {type(markdown).__name__}")
    if not isinstance(config, CleaningConfig):
        raise TypeError("config must be a CleaningConfig instance")

    markdown, picture_text_blocks_removed = _PICTURE_TEXT_BLOCK_RE.subn("", markdown)
    normalized, controls_removed = _normalize_input(markdown)
    records = _build_line_records(normalized)
    original_line_count = len(records)

    placeholders_removed = 0
    first_pass: list[_LineRecord] = []
    for record in records:
        if not record.protected and _is_omission_placeholder(record.text):
            placeholders_removed += 1
            continue
        first_pass.append(record)

    records, page_count, page_aware = _assign_pages_and_edges(first_pass, config)
    boilerplate_keys = _detect_boilerplate(records, page_count, page_aware, config)

    # Without page boundaries, remove bare numeric page lines only when the
    # document contains a sequence/pattern of them. This avoids deleting a
    # legitimate standalone quantity from a short one-page notice.
    bare_page_artifacts = _detect_bare_page_number_lines(
        records,
        page_aware=page_aware,
    )

    boilerplate_removed = 0
    page_artifacts_removed = 0
    retained: list[_LineRecord] = []

    for record in records:
        if record.protected:
            retained.append(record)
            continue

        if record.is_separator:
            if config.preserve_page_separators:
                retained.append(record)
            continue

        key = _boilerplate_key(record.text, normalize_dynamic_page=page_aware)
        if key and key in boilerplate_keys:
            boilerplate_removed += 1
            continue

        if _is_page_number_artifact(
            record,
            page_aware=page_aware,
            bare_page_candidates=bare_page_artifacts,
        ):
            page_artifacts_removed += 1
            continue

        retained.append(record)

    cleaned = _join_and_collapse_blank_lines(retained, config.max_consecutive_blank_lines)

    report = CleaningReport(
        original_line_count=original_line_count,
        cleaned_line_count=len(cleaned.splitlines()) if cleaned else 0,
        placeholders_removed=placeholders_removed,
        boilerplate_removed=boilerplate_removed,
        page_artifacts_removed=page_artifacts_removed,
        control_characters_removed=controls_removed,
        picture_text_blocks_removed=picture_text_blocks_removed,
        pages_detected=page_count,
        used_page_aware_detection=page_aware,
    )
    return cleaned, report


# ---------------------------------------------------------------------------
# Public quality API
# ---------------------------------------------------------------------------


def assess_pdf_markdown_quality(
    markdown: str,
    min_word_count: int = 50,
    *,
    clean_before_assessment: bool = True,
    config: CleaningConfig = DEFAULT_CLEANING_CONFIG,
) -> PdfMarkdownQuality:
    """Assess whether extracted Markdown is useful enough for RAG chunking.

    The assessment is language-agnostic: Python Unicode character properties
    are used instead of an English dictionary. The result exposes metrics and
    reasons so thresholds can be monitored in production.
    """

    if not isinstance(markdown, str):
        raise TypeError(f"markdown must be str, got {type(markdown).__name__}")
    if not isinstance(min_word_count, int) or isinstance(min_word_count, bool):
        raise TypeError("min_word_count must be an int")
    if min_word_count < 0:
        raise ValueError("min_word_count cannot be negative")

    text = clean_pdf_markdown(markdown, config=config) if clean_before_assessment else markdown

    if not text or not text.strip():
        return PdfMarkdownQuality(
            is_garbage=True,
            score=0.0,
            reasons=("empty_after_cleaning",),
            word_count=0,
            alphabetic_word_count=0,
            unique_alphabetic_word_count=0,
            non_empty_line_count=0,
            table_line_ratio=0.0,
            alphanumeric_character_ratio=0.0,
            suspicious_character_ratio=0.0,
        )

    analysis_lines = [
        line
        for line in text.split("\n")
        if line.strip()
        and not _is_any_page_separator(line)
        and not _HORIZONTAL_RULE_RE.fullmatch(line)
    ]

    words = _WORD_RE.findall(text)
    alpha_words = [word for word in words if any(char.isalpha() for char in word)]
    unique_alpha_words = {_comparison_text(word) for word in alpha_words}

    pipe_lines = [line for line in analysis_lines if line.count("|") >= 2]
    table_line_ratio = len(pipe_lines) / len(analysis_lines) if analysis_lines else 0.0

    visible_chars = [char for char in text if not char.isspace()]
    alnum_chars = sum(char.isalnum() for char in visible_chars)
    alnum_ratio = alnum_chars / len(visible_chars) if visible_chars else 0.0

    suspicious_chars = sum(_is_suspicious_character(char) for char in visible_chars)
    suspicious_ratio = suspicious_chars / len(visible_chars) if visible_chars else 0.0

    reasons: list[str] = []
    penalty = 0.0

    if len(words) < min_word_count:
        reasons.append("too_few_words")
        penalty += 0.60

    # Numeric/symbol-only output can exceed the raw token threshold but still
    # contain essentially no retrievable semantic text.
    minimum_alpha_words = max(5, min_word_count // 5)
    if len(alpha_words) < minimum_alpha_words:
        reasons.append("too_few_alphabetic_words")
        penalty += 0.45

    # Existing mangled-table signal, strengthened by using cleaned text and
    # Unicode-aware alphabetic counts.
    if table_line_ratio > 0.50 and len(alpha_words) < max(len(words) // 3, 8):
        reasons.append("mostly_numeric_or_symbolic_table")
        penalty += 0.55

    if alnum_ratio < 0.22 and len(alpha_words) < max(min_word_count, 20):
        reasons.append("symbol_heavy_output")
        penalty += 0.40

    if suspicious_ratio > 0.02:
        reasons.append("many_invalid_or_unmapped_glyphs")
        penalty += min(0.60, suspicious_ratio * 10)

    # Extremely low lexical diversity usually means a handful of headers or
    # OCR fragments repeated across many pages.
    if len(alpha_words) >= 30:
        lexical_diversity = len(unique_alpha_words) / len(alpha_words)
        if lexical_diversity < 0.06:
            reasons.append("extremely_repetitive_text")
            penalty += 0.35

    score = max(0.0, min(1.0, 1.0 - penalty))

    # A hard sparse failure is enough by itself. For other signals, require a
    # combined confidence threshold to avoid rejecting legitimate tables or
    # documents written in non-Latin scripts.
    hard_sparse_failure = (
        len(words) < min_word_count
        and len(alpha_words) < max(10, min_word_count // 2)
    )
    is_garbage = hard_sparse_failure or score < 0.45

    return PdfMarkdownQuality(
        is_garbage=is_garbage,
        score=score,
        reasons=tuple(reasons),
        word_count=len(words),
        alphabetic_word_count=len(alpha_words),
        unique_alphabetic_word_count=len(unique_alpha_words),
        non_empty_line_count=len(analysis_lines),
        table_line_ratio=table_line_ratio,
        alphanumeric_character_ratio=alnum_ratio,
        suspicious_character_ratio=suspicious_ratio,
    )


def is_pdf_output_garbage(markdown: str, min_word_count: int = 50) -> bool:
    """Return ``True`` when PDF extraction is unsuitable for useful chunking.

    This remains a drop-in replacement for the original boolean helper. Use
    :func:`assess_pdf_markdown_quality` when diagnostics are needed.
    """

    return assess_pdf_markdown_quality(
        markdown,
        min_word_count=min_word_count,
    ).is_garbage


def skip_ocr_if_native_text_sufficient(ocr_function, min_word_count: int = 20):
    """Wrap a pymupdf4llm OCR callback to skip OCR when native text already suffices.

    pymupdf4llm's own need-OCR heuristic (the ``chars_bad``/``bad_areas``
    ratio checks in ``pymupdf4llm/ocr/analyze_page.py``) can misfire on
    dot-leader-heavy layouts (e.g. a table of contents), triggering OCR on a
    page whose native text extraction is already complete and correct.
    pymupdf4llm excludes already-"legible" text spans from the OCR pixmap,
    but dot-leader glyphs are not always classified as legible, so the OCR
    pass appends a redundant, sometimes garbled reading of the same content
    rather than filling in anything missing.

    The callback receives the live page object before OCR runs, so checking
    its already-available native text word count against a low floor lets
    callers skip OCR precisely when it would only add noise, without
    touching pymupdf4llm's own per-page OCR-need decision (a page with too
    little native text, e.g. a scanned cover with 0 words, still gets OCRed
    normally). Deliberately a raw word count rather than
    :func:`assess_pdf_markdown_quality`: that function's
    suspicious-character/alphanumeric-ratio checks are tuned to flag
    dot-leader-heavy text as a quality problem, which is the exact case
    this exists to protect - reusing it here would defeat the purpose.
    """

    def wrapped(page, dpi=150, pixmap=None, language="eng", keep_ocr_text=False):
        if len(page.get_text().split()) >= min_word_count:
            return
        return ocr_function(
            page, dpi=dpi, pixmap=pixmap, language=language, keep_ocr_text=keep_ocr_text
        )

    return wrapped


# ---------------------------------------------------------------------------
# Input normalization and structural parsing
# ---------------------------------------------------------------------------


def _normalize_input(markdown: str) -> tuple[str, int]:
    """Normalize line endings and remove only unambiguously harmful controls."""

    # Make form feeds visible as standalone page-boundary records.
    text = markdown.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\f", "\n\f\n")

    controls_removed = text.count("\x00") + text.count("\ufeff") + text.count("\u200b")
    text = text.replace("\x00", "").replace("\ufeff", "").replace("\u200b", "")
    return text, controls_removed


def _build_line_records(text: str) -> list[_LineRecord]:
    lines = text.split("\n")
    records: list[_LineRecord] = []

    active_fence_char: str | None = None
    active_fence_length = 0

    for index, line in enumerate(lines):
        fence_match = _FENCE_RE.match(line)
        is_fence_line = False

        if fence_match:
            marker = fence_match.group(1)
            marker_char = marker[0]
            marker_length = len(marker)

            if active_fence_char is None:
                active_fence_char = marker_char
                active_fence_length = marker_length
                is_fence_line = True
                protected = True
            elif marker_char == active_fence_char and marker_length >= active_fence_length:
                is_fence_line = True
                protected = True
                active_fence_char = None
                active_fence_length = 0
            else:
                protected = True
        else:
            protected = active_fence_char is not None

        explicit_separator = _EXPLICIT_PAGE_SEPARATOR_RE.fullmatch(line) is not None
        generic_hr = _HORIZONTAL_RULE_RE.fullmatch(line) is not None

        records.append(
            _LineRecord(
                text=line,
                original_index=index,
                protected=protected,
                is_fence_line=is_fence_line,
                is_separator=explicit_separator,
                is_generic_horizontal_rule=generic_hr,
            )
        )

    return records


def _assign_pages_and_edges(
    records: list[_LineRecord],
    config: CleaningConfig,
) -> tuple[list[_LineRecord], int, bool]:
    """Infer pages and mark top/bottom edge lines without altering output."""

    explicit_separator_count = sum(record.is_separator for record in records)
    generic_hr_count = sum(
        record.is_generic_horizontal_rule and not record.protected for record in records
    )

    # Generic horizontal rules are treated as probable VLM page boundaries only
    # when repeated. They remain preserved in the output either way.
    use_generic_hr_as_boundary = explicit_separator_count == 0 and generic_hr_count >= 2
    page_aware = explicit_separator_count > 0 or use_generic_hr_as_boundary

    if not page_aware:
        for record in records:
            record.page_index = 0
            record.edge = None
        return records, 1 if records else 0, False

    page_index = 0
    for record in records:
        record.page_index = page_index
        is_boundary = record.is_separator or (
            use_generic_hr_as_boundary
            and record.is_generic_horizontal_rule
            and not record.protected
        )
        if is_boundary:
            record.is_separator = True
            page_index += 1

    # Ignore a trailing empty pseudo-page caused by a final separator.
    page_to_records: dict[int, list[_LineRecord]] = defaultdict(list)
    for record in records:
        if not record.is_separator:
            page_to_records[record.page_index].append(record)

    nonempty_pages = [
        page
        for page, page_records in page_to_records.items()
        if any(record.text.strip() for record in page_records)
    ]
    page_count = len(nonempty_pages)

    for page in nonempty_pages:
        content = [
            record
            for record in page_to_records[page]
            if record.text.strip() and not record.protected
        ]
        if not content:
            continue

        for content_index, record in enumerate(content):
            record.page_content_index = content_index
            record.page_content_count = len(content)

        effective_edge_window = min(
            config.page_edge_window,
            max(1, math.ceil(len(content) / 4)),
        )
        top = content[:effective_edge_window]
        bottom = content[-effective_edge_window:]
        for record in top:
            record.edge = "top"
        for record in bottom:
            # For very short pages, top takes precedence. The same line should
            # not contribute to both edge counters.
            if record.edge is None:
                record.edge = "bottom"

    return records, page_count, True


# ---------------------------------------------------------------------------
# Artifact detection
# ---------------------------------------------------------------------------


def _is_omission_placeholder(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if _DIMENSIONS_ONLY_RE.fullmatch(stripped):
        return True
    if not _OMISSION_PLACEHOLDER_RE.fullmatch(stripped):
        return False

    folded = stripped.casefold()
    has_placeholder_signal = (
        "omitted" in folded
        or "==>" in stripped
        or "<==" in stripped
        or re.search(r"\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?", stripped)
        is not None
    )
    return has_placeholder_signal


def _detect_boilerplate(
    records: Sequence[_LineRecord],
    page_count: int,
    page_aware: bool,
    config: CleaningConfig,
) -> set[str]:
    if page_aware and page_count >= 3:
        return _detect_page_aware_boilerplate(records, page_count, config)
    return _detect_unsegmented_boilerplate(records, config)


def _detect_page_aware_boilerplate(
    records: Sequence[_LineRecord],
    page_count: int,
    config: CleaningConfig,
) -> set[str]:
    pages_by_edge_and_key: dict[tuple[str, str], set[int]] = defaultdict(set)

    for record in records:
        if record.protected or record.edge is None:
            continue
        if not _is_boilerplate_candidate(
            record.text,
            allow_markdown_heading=True,
            config=config,
        ):
            continue

        # A repeated Markdown heading can be genuine document structure. Remove
        # it only when it also looks like high-confidence running matter (for
        # example an all-caps document title, URL, or explicit page label).
        if (
            _MARKDOWN_HEADING_RE.match(record.text)
            and not _looks_like_high_confidence_running_matter(record.text)
        ):
            continue

        key = _boilerplate_key(record.text, normalize_dynamic_page=True)
        if key:
            pages_by_edge_and_key[(record.edge, key)].add(record.page_index)

    if page_count < config.repetition_min_occurrences:
        required_pages = max(3, math.ceil(page_count * 0.60))
    else:
        required_pages = max(
            config.repetition_min_occurrences,
            math.ceil(page_count * config.repetition_min_page_ratio),
        )

    boilerplate: set[str] = set()
    for (_, key), pages in pages_by_edge_and_key.items():
        if len(pages) >= required_pages:
            boilerplate.add(key)
    return boilerplate


def _detect_unsegmented_boilerplate(
    records: Sequence[_LineRecord],
    config: CleaningConfig,
) -> set[str]:
    keys: list[str] = []
    original_by_key: dict[str, str] = {}

    for record in records:
        if record.protected:
            continue
        if not _is_boilerplate_candidate(
            record.text,
            allow_markdown_heading=False,
            config=config,
        ):
            continue
        key = _boilerplate_key(record.text, normalize_dynamic_page=False)
        if key:
            keys.append(key)
            original_by_key.setdefault(key, record.text.strip())

    counts = Counter(keys)
    boilerplate: set[str] = set()

    for key, count in counts.items():
        if count < config.repetition_min_occurrences:
            continue
        original = original_by_key[key]
        if _looks_like_high_confidence_running_matter(original):
            boilerplate.add(key)

    return boilerplate


def _is_boilerplate_candidate(
    line: str,
    *,
    allow_markdown_heading: bool,
    config: CleaningConfig,
) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if _is_omission_placeholder(stripped):
        return False
    if _is_any_page_separator(stripped) or _HORIZONTAL_RULE_RE.fullmatch(stripped):
        return False
    if _MARKDOWN_TABLE_DELIMITER_RE.fullmatch(stripped):
        return False
    if stripped.count("|") >= 2:
        return False
    if _MARKDOWN_STRUCTURAL_PREFIX_RE.match(stripped):
        return False
    if not allow_markdown_heading and _MARKDOWN_HEADING_RE.match(stripped):
        return False

    candidate = _strip_whole_line_markdown(stripped)
    visible = _strip_markdown_heading_prefix(candidate)
    if not visible or len(visible) > config.max_boilerplate_chars:
        return False

    words = _WORD_RE.findall(visible)
    if not words or len(words) > config.max_boilerplate_words:
        return False

    # Running matter normally does not look like a full prose sentence.
    if visible.endswith((".", "?", "!", ";")):
        return False
    # Numeric-only lines are handled by the dedicated page-sequence detector;
    # treating them as generic boilerplate would erase legitimate fees, years,
    # counts, and table values repeated across short notices.
    if not any(char.isalpha() for char in visible):
        return False
    return True


def _looks_like_high_confidence_running_matter(line: str) -> bool:
    visible = _strip_markdown_heading_prefix(_strip_whole_line_markdown(line.strip()))
    words = _WORD_RE.findall(visible)
    letters = [char for char in visible if char.isalpha()]

    if _URL_OR_EMAIL_RE.search(visible):
        return True
    if _EXPLICIT_PAGE_NUMBER_RE.fullmatch(visible):
        return True
    if len(words) < 2:
        return False
    if not letters:
        return False

    uppercase_ratio = sum(char.isupper() for char in letters) / len(letters)
    titlecase_words = sum(word[:1].isupper() for word in words if any(c.isalpha() for c in word))
    titlecase_ratio = titlecase_words / len(words)

    # Exact repeated all-caps document titles are the most common unsegmented
    # running-header artifact. Title-case is accepted only with at least three
    # words to avoid deleting repeated one/two-word semantic labels.
    return uppercase_ratio >= 0.70 or (len(words) >= 3 and titlecase_ratio >= 0.80)


def _boilerplate_key(line: str, *, normalize_dynamic_page: bool) -> str:
    stripped = line.strip()
    was_markdown_heading = _MARKDOWN_HEADING_RE.match(stripped) is not None
    visible = _strip_whole_line_markdown(stripped)
    visible = _strip_markdown_heading_prefix(visible)
    visible = _comparison_text(visible)
    if not visible:
        return ""

    if normalize_dynamic_page:
        match = _TRAILING_DYNAMIC_PAGE_RE.search(visible)
        if match:
            token = match.group(0).strip()
            explicit_page_token = bool(
                re.search(r"\b(?:page|pg\.?)\b|\bof\b|/", token, re.IGNORECASE)
            )
            prefix = visible[: match.start()].rstrip()
            delimiter_before_bare_number = bool(
                token.isdigit() and re.search(r"[|:–—-]$", prefix)
            )
            # Numbered semantic labels such as "Chapter 7" or "Section 4"
            # must remain distinct. A bare trailing number is normalized only
            # when a delimiter strongly suggests running matter.
            may_normalize = explicit_page_token or (
                delimiter_before_bare_number and not was_markdown_heading
            )

            # Do not treat a standalone publication year as a dynamic page
            # number. A fixed year still matches naturally across pages.
            if may_normalize and not (_is_year_token(token) and match.start() == 0):
                visible = (visible[: match.start()] + " <page>").strip()
                visible = _WHITESPACE_RE.sub(" ", visible)
    return visible


def _detect_bare_page_number_lines(
    records: Sequence[_LineRecord],
    *,
    page_aware: bool,
) -> set[int]:
    """Detect bare Arabic/Roman page-number sequences conservatively."""

    candidates_by_edge: dict[str, list[tuple[_LineRecord, int]]] = defaultdict(list)

    for record in records:
        if record.protected:
            continue
        if page_aware and not _is_outermost_page_line(record):
            continue

        arabic_match = _BARE_ARABIC_PAGE_NUMBER_RE.fullmatch(record.text)
        if arabic_match:
            value = int(arabic_match.group(1))
            if _is_year_value(value) and arabic_match.group(2) is None:
                continue
        else:
            roman_match = _BARE_ROMAN_PAGE_NUMBER_RE.fullmatch(record.text)
            if not roman_match:
                continue
            value = _roman_to_int(roman_match.group(1))
            if value <= 0:
                continue

        edge_key = record.edge or "unsegmented"
        candidates_by_edge[edge_key].append((record, value))

    detected: set[int] = set()
    for candidates in candidates_by_edge.values():
        if _looks_like_page_number_sequence(candidates, page_aware=page_aware):
            detected.update(record.original_index for record, _ in candidates)
    return detected


def _looks_like_page_number_sequence(
    candidates: Sequence[tuple[_LineRecord, int]],
    *,
    page_aware: bool,
) -> bool:
    if len(candidates) < 2:
        return False

    values = [value for _, value in candidates]
    distinct = len(set(values))
    monotonic_steps = sum(
        1 for previous, current in zip(values, values[1:]) if 0 < current - previous <= 3
    )
    required_steps = max(1, math.ceil((len(values) - 1) * 0.60))

    if distinct >= 3 and monotonic_steps >= required_steps:
        return True

    if page_aware:
        one_based_matches = sum(
            value == record.page_index + 1 for record, value in candidates
        )
        zero_based_matches = sum(value == record.page_index for record, value in candidates)
        required_matches = math.ceil(len(candidates) * 0.80)
        return max(one_based_matches, zero_based_matches) >= required_matches

    return False


def _roman_to_int(value: str) -> int:
    values = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
    total = 0
    previous = 0
    for char in reversed(value.casefold()):
        current = values.get(char, 0)
        if current < previous:
            total -= current
        else:
            total += current
            previous = current
    return total


def _is_page_number_artifact(
    record: _LineRecord,
    *,
    page_aware: bool,
    bare_page_candidates: set[int],
) -> bool:
    stripped = record.text.strip()
    if not stripped:
        return False
    if _EXPLICIT_PAGE_NUMBER_RE.fullmatch(stripped):
        return True

    if _BARE_ARABIC_PAGE_NUMBER_RE.fullmatch(stripped):
        return record.original_index in bare_page_candidates

    if _BARE_ROMAN_PAGE_NUMBER_RE.fullmatch(stripped):
        return record.original_index in bare_page_candidates

    return False


def _is_outermost_page_line(record: _LineRecord) -> bool:
    if record.page_content_index is None or record.page_content_count < 1:
        return False
    return record.page_content_index in {0, record.page_content_count - 1}


# ---------------------------------------------------------------------------
# Output assembly
# ---------------------------------------------------------------------------


def _join_and_collapse_blank_lines(
    records: Sequence[_LineRecord],
    max_blank_lines: int,
) -> str:
    output: list[str] = []
    blank_run = 0
    in_fence = False

    for record in records:
        line = record.text.rstrip()

        if record.is_fence_line:
            output.append(line)
            in_fence = not in_fence
            blank_run = 0
            continue

        if in_fence or record.protected:
            output.append(line)
            blank_run = 0 if line else blank_run + 1
            continue

        if not line.strip():
            if blank_run < max_blank_lines:
                output.append("")
            blank_run += 1
            continue

        output.append(line)
        blank_run = 0

    # Match the original helper's surrounding-whitespace behavior without
    # altering indentation inside fenced code blocks.
    return "\n".join(output).strip()


# ---------------------------------------------------------------------------
# Comparison and quality helpers
# ---------------------------------------------------------------------------


def _comparison_text(text: str) -> str:
    # NFKC lets visually equivalent compatibility forms compare consistently.
    normalized = unicodedata.normalize("NFKC", text).casefold()
    # Strip Unicode format controls for comparison only. Output keeps meaningful
    # ZWNJ/ZWJ characters intact.
    normalized = "".join(
        char for char in normalized if unicodedata.category(char) != "Cf"
    )
    return _WHITESPACE_RE.sub(" ", normalized).strip()


def _strip_whole_line_markdown(text: str) -> str:
    current = text.strip()
    # Peel a small bounded number of whole-line wrappers such as **Header**.
    for _ in range(3):
        match = _WHOLE_LINE_EMPHASIS_RE.fullmatch(current)
        if not match:
            break
        current = match.group(1).strip()
    return current


def _strip_markdown_heading_prefix(text: str) -> str:
    return _MARKDOWN_HEADING_RE.sub("", text, count=1).strip()


def _is_any_page_separator(line: str) -> bool:
    return _EXPLICIT_PAGE_SEPARATOR_RE.fullmatch(line.strip()) is not None


def _is_year_value(value: int) -> bool:
    return 1800 <= value <= 2200


def _is_year_token(token: str) -> bool:
    token = token.strip()
    return token.isdigit() and _is_year_value(int(token))


def _is_suspicious_character(char: str) -> bool:
    if char == _REPLACEMENT_CHAR:
        return True
    category = unicodedata.category(char)
    if category in {"Co", "Cs"}:  # private-use or surrogate
        return True
    if category == "Cc" and char not in {"\n", "\t"}:
        return True
    return False


__all__ = [
    "CleaningConfig",
    "CleaningReport",
    "PdfMarkdownQuality",
    "assess_pdf_markdown_quality",
    "clean_pdf_markdown",
    "clean_pdf_markdown_with_report",
    "is_pdf_output_garbage",
    "skip_ocr_if_native_text_sufficient",
]