"""Defensive parsing for Gemini Interactions API transcription responses.

The public helpers intentionally accept plain mappings/strings so they work with
raw REST JSON, SDK ``model_dump()`` output, and persisted response fixtures.
"""

from __future__ import annotations

import json
import re
from collections.abc import Mapping, Sequence
from typing import Any, Final


_MODEL_OUTPUT_TYPE: Final = "model_output"
_TEXT_CONTENT_TYPE: Final = "text"
_DECORATIVE_SENTINEL: Final = "DECORATIVE"
_UNREADABLE_HEADING: Final = "Unreadable or uncertain items:"

# Status names have varied across Interactions API revisions. A missing or
# unknown status is accepted for forward compatibility, but known non-final or
# unsuccessful states are not used as completed transcription output.
_UNUSABLE_STEP_STATUSES: Final = frozenset(
    {
        "in_progress",
        "pending",
        "queued",
        "requires_action",
        "failed",
        "cancelled",
        "canceled",
        "incomplete",
        "budget_exceeded",
    }
)

# Keep horizontal tabs and line breaks, which are meaningful in Markdown.
_UNSAFE_CONTROL_CHARACTERS_RE: Final = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]"
)
_OUTER_FENCE_RE: Final = re.compile(
    r"^(?P<fence>`{3,}|~{3,})[^\r\n]*\r?\n"
    r"(?P<body>.*)"
    r"\r?\n(?P<closing>`{3,}|~{3,})[ \t]*$",
    re.DOTALL,
)


def _normalize_text(value: str) -> str:
    """Normalize transport artefacts without changing meaningful Markdown."""

    normalized = value.replace("\r\n", "\n").replace("\r", "\n")
    normalized = _UNSAFE_CONTROL_CHARACTERS_RE.sub(" ", normalized)
    return normalized.strip()


def _is_sequence(value: object) -> bool:
    """Return whether *value* is a non-string sequence."""

    return isinstance(value, Sequence) and not isinstance(
        value, (str, bytes, bytearray)
    )


def _step_is_usable(step: Mapping[str, Any]) -> bool:
    """Reject explicitly unfinished, failed, or errored model-output steps."""

    error = step.get("error")
    if error not in (None, False, "", (), [], {}):
        return False

    status = step.get("status")
    if not isinstance(status, str):
        return True

    normalized_status = status.strip().casefold().replace("-", "_")
    return normalized_status not in _UNUSABLE_STEP_STATUSES


def _extract_text_content(content: object) -> str:
    """Extract ordered text blocks from a Gemini content array."""

    if not _is_sequence(content):
        return ""

    parts: list[str] = []
    for item in content:
        if not isinstance(item, Mapping) or item.get("type") != _TEXT_CONTENT_TYPE:
            continue
        text = item.get("text")
        if not isinstance(text, str):
            continue
        clean_text = _normalize_text(text)
        if clean_text:
            parts.append(clean_text)

    return "\n".join(parts).strip()


def _extract_latest_model_output(steps: object) -> str:
    """Return text from the latest usable ``model_output`` step."""

    if not _is_sequence(steps):
        return ""

    # Interactions are chronological and the final answer is the last model
    # output. Once that step is found, never fall back to an earlier model
    # message: in tool/agent workflows an earlier output may only be a preamble.
    for step in reversed(steps):
        if not isinstance(step, Mapping) or step.get("type") != _MODEL_OUTPUT_TYPE:
            continue
        if not _step_is_usable(step):
            return ""
        return _extract_text_content(step.get("content"))

    return ""


def _extract_legacy_output(outputs: object) -> str:
    """Read pre-June-2026 ``outputs`` payloads kept in old fixtures/storage."""

    if not _is_sequence(outputs):
        return ""

    parts: list[str] = []
    for output in outputs:
        if not isinstance(output, Mapping) or output.get("type") != _TEXT_CONTENT_TYPE:
            continue
        text = output.get("text")
        if not isinstance(text, str):
            continue
        clean_text = _normalize_text(text)
        if clean_text:
            parts.append(clean_text)

    return "\n".join(parts).strip()


def extract_interaction_output_text(payload: Mapping[str, Any]) -> str:
    """Return only final model-output text from an interaction response.

    SDK interaction objects may expose an ``output_text`` convenience property,
    but raw REST responses generally require reading the chronological ``steps``
    array. The fallback selects the latest usable ``model_output`` step and
    ignores user input, thoughts, tool calls/results, media, and errored or
    explicitly unfinished model-output steps.

    A final compatibility fallback reads the retired ``outputs`` schema so old
    persisted responses and test fixtures remain parseable.
    """

    if not isinstance(payload, Mapping):
        return ""

    direct = payload.get("output_text")
    if isinstance(direct, str):
        clean_direct = _normalize_text(direct)
        if clean_direct:
            return clean_direct

    current = _extract_latest_model_output(payload.get("steps"))
    if current:
        return current

    return _extract_legacy_output(payload.get("outputs"))


def _strip_code_fence(text: str) -> str:
    """Remove one complete outer Markdown fence and a leading UTF-8 BOM."""

    candidate = text.strip()
    if candidate.startswith("\ufeff"):
        candidate = candidate[1:].lstrip()

    match = _OUTER_FENCE_RE.fullmatch(candidate)
    if not match:
        return candidate

    opening = match.group("fence")
    closing = match.group("closing")
    if opening[0] != closing[0] or len(closing) < len(opening):
        return candidate

    return match.group("body").strip()


def _is_decorative_sentinel(text: str) -> bool:
    return text.strip().casefold() == _DECORATIVE_SENTINEL.casefold()


def _clean_unreadable_items(value: object) -> list[str]:
    """Validate, flatten whitespace, and de-duplicate unreadable-item labels."""

    if not _is_sequence(value):
        return []

    clean_items: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        clean_item = " ".join(_normalize_text(item).split())
        if not clean_item or clean_item in seen:
            continue
        seen.add(clean_item)
        clean_items.append(clean_item)

    return clean_items


def _append_unreadable_items(markdown: str, items: Sequence[str]) -> str:
    if not items:
        return markdown

    suffix = "\n".join(f"- {item}" for item in items)
    section = f"{_UNREADABLE_HEADING}\n{suffix}"
    return f"{markdown}\n\n{section}" if markdown else section


def parse_transcription_text(text: str) -> str | None:
    """Parse a structured transcription response into indexable Markdown.

    Expected structured output::

        {
          "decorative": false,
          "markdown": "...",
          "unreadable_items": ["..."]
        }

    ``None`` means the image was decorative or contained no indexable content.
    If Gemini temporarily ignores structured output and returns plain text or
    Markdown, the cleaned text is preserved as a compatibility fallback.
    """

    if not isinstance(text, str):
        return None

    cleaned = _strip_code_fence(text)
    if not cleaned or _is_decorative_sentinel(cleaned):
        return None

    try:
        payload = json.loads(cleaned)
    except (json.JSONDecodeError, TypeError, UnicodeError, RecursionError):
        return _normalize_text(cleaned) or None

    # Be conservative with valid JSON scalars. A JSON string is a plausible
    # plain-text fallback; other scalar/container shapes do not match the
    # transcription contract and should not become Python repr text in an index.
    if isinstance(payload, str):
        normalized = _normalize_text(payload)
        if not normalized or _is_decorative_sentinel(normalized):
            return None
        return normalized

    if not isinstance(payload, Mapping):
        return None

    if payload.get("decorative") is True:
        return None

    raw_markdown = payload.get("markdown")
    markdown = _normalize_text(raw_markdown) if isinstance(raw_markdown, str) else ""
    unreadable_items = _clean_unreadable_items(payload.get("unreadable_items"))

    result = _append_unreadable_items(markdown, unreadable_items)
    return result.strip() or None