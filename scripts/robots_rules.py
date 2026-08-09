"""Hardened ``robots.txt`` parsing behind a small, stable adapter.

The adapter delegates Robots Exclusion Protocol rule matching to Protego while
adding bounded-input handling, strict UTF-8 preparation, defensive directive
materialization, safe caller-input validation, explicit fallback policies, and
a minimum dependency-version gate.

This module intentionally does *not* fetch ``robots.txt`` files, follow
redirects, interpret HTTP status codes, manage caches, resolve DNS, authorize
sitemap hosts, or perform SSRF checks. Those responsibilities belong to the
crawler and transport layers. The module performs no network I/O.
"""

from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field, replace
from datetime import time
from functools import lru_cache
from importlib import metadata
from typing import Any, Final, Iterable, Iterator
from urllib.parse import SplitResult, urlsplit

from protego import Protego

__all__ = [
    "DEFAULT_MAX_ROBOTS_BYTES",
    "InsecureProtegoVersionError",
    "RobotsDiagnostics",
    "RobotsRequestRate",
    "RobotsRules",
    "RobotsRulesError",
    "RobotsVisitTime",
]

# RFC 9309 section 2.5 requires a parser limit of at least 500 KiB.
DEFAULT_MAX_ROBOTS_BYTES: Final[int] = 500 * 1024

# Protego 0.6.2 contains the fix for CVE-2026-55520 / GHSA-wjmf-p669-5m5p.
_MIN_PROTEGO_VERSION: Final[tuple[int, int, int]] = (0, 6, 2)
_RELEASE_RE: Final[re.Pattern[str]] = re.compile(
    r"^\s*(?P<major>0|[1-9]\d*)\."
    r"(?P<minor>0|[1-9]\d*)\."
    r"(?P<patch>0|[1-9]\d*)"
    r"(?P<suffix>(?:\.post\d+)?(?:\+[A-Za-z0-9.-]+)?)\s*$"
)

# Bounds for values that may be propagated into later crawler stages.
_MAX_SITEMAP_URL_CHARS: Final[int] = 8_192
_MAX_SITEMAPS: Final[int] = 10_000
_MAX_USER_AGENT_CHARS: Final[int] = 1_024
_MAX_TARGET_URL_CHARS: Final[int] = 65_536
_MAX_PREFERRED_HOST_CHARS: Final[int] = 2_048
_TEXT_SCAN_CHUNK_CHARS: Final[int] = 8_192

_ALLOWED_SITEMAP_SCHEMES: Final[frozenset[str]] = frozenset({"http", "https"})
_ALLOW_ALL_TEXT: Final[str] = "User-agent: *\nDisallow:\n"
_DISALLOW_ALL_TEXT: Final[str] = "User-agent: *\nDisallow: /\n"


class RobotsRulesError(ValueError):
    """Base exception for invalid adapter configuration or content type."""


class InsecureProtegoVersionError(RobotsRulesError):
    """Raised when Protego is missing, unversioned, prerelease, or vulnerable."""


@dataclass(frozen=True, slots=True)
class RobotsDiagnostics:
    """Metadata describing preparation of an untrusted robots body.

    ``source_bytes`` is exact when ``source_bytes_exact`` is true. For an
    oversized string, preparation stops after proving that the byte limit was
    exceeded; ``source_bytes`` is then a safe lower bound and
    ``source_bytes_exact`` is false. This prevents diagnostics from turning the
    parser's bounded-input policy into an unbounded CPU scan.
    """

    source_bytes: int = 0
    source_bytes_exact: bool = True
    parsed_bytes: int = 0
    truncated: bool = False
    ignored_invalid_lines: int = 0
    decoding_error_lines: int = 0
    parser_failed: bool = False
    ignored_sitemaps: int = 0
    sitemap_limit_reached: bool = False


@dataclass(frozen=True, slots=True)
class RobotsRequestRate:
    """Validated representation of Protego's optional ``Request-rate`` value."""

    requests: int
    seconds: float
    start_time: time | None = None
    end_time: time | None = None


@dataclass(frozen=True, slots=True)
class RobotsVisitTime:
    """Validated representation of Protego's optional ``Visit-time`` value."""

    start_time: time
    end_time: time


@dataclass(frozen=True, slots=True)
class RobotsRules:
    """Parsed robots rules plus immutable, validated non-rule directives.

    The public contract remains intentionally small: ``parse()``, ``can_fetch()``,
    ``crawl_delay()``, and materialized ``sitemaps``. Additional accessors expose
    Protego directives without leaking parser-owned iterator or named-tuple
    instances.
    """

    _parser: Protego = field(repr=False, compare=False)
    sitemaps: tuple[str, ...]
    diagnostics: RobotsDiagnostics = field(default_factory=RobotsDiagnostics)

    @classmethod
    def parse(
        cls,
        text: str | bytes | bytearray | memoryview,
        *,
        max_bytes: int = DEFAULT_MAX_ROBOTS_BYTES,
    ) -> "RobotsRules":
        """Parse untrusted robots content into an immutable adapter.

        ``max_bytes`` may be increased but cannot be lower than RFC 9309's
        500-KiB minimum. Only the first ``max_bytes`` bytes are parsed. The byte
        prefix is retained exactly—even if it ends mid-line—so every parseable
        rule inside the permitted prefix is offered to Protego.

        Input is decoded as UTF-8 (accepting an initial UTF-8 BOM). Logical lines
        containing invalid UTF-8 replacement characters, surrogate code points,
        or forbidden controls are ignored; other parseable lines are preserved.

        If Protego unexpectedly fails, the result becomes deny-all and
        ``diagnostics.parser_failed`` is set. This is a deliberate fail-closed
        safety policy for parser defects, not RFC HTTP-status handling.
        """

        _ensure_secure_protego()
        _validate_max_bytes(max_bytes)
        prepared, diagnostics = _prepare_robots_text(text, max_bytes=max_bytes)

        try:
            parser = Protego.parse(prepared)
        except Exception:  # Untrusted text must never crash or fail open.
            parser = _build_fallback_parser(allow=False)
            diagnostics = replace(diagnostics, parser_failed=True)

        sitemaps, ignored, limited = _read_sitemaps(parser)
        diagnostics = replace(
            diagnostics,
            ignored_sitemaps=ignored,
            sitemap_limit_reached=limited,
        )
        return cls(_parser=parser, sitemaps=sitemaps, diagnostics=diagnostics)

    @classmethod
    def allow_all(cls) -> "RobotsRules":
        """Return an explicit allow-all policy.

        The crawler may use this for an RFC 9309 ``unavailable`` result after it
        has applied its own HTTP-status and redirect policy.
        """

        _ensure_secure_protego()
        return cls(_parser=_build_fallback_parser(allow=True), sitemaps=())

    @classmethod
    def disallow_all(cls) -> "RobotsRules":
        """Return an explicit deny-all policy.

        The crawler may use this for an RFC 9309 ``unreachable`` result after it
        has applied its own network and HTTP-status policy.
        """

        _ensure_secure_protego()
        return cls(_parser=_build_fallback_parser(allow=False), sitemaps=())

    def can_fetch(self, url: str | bytes, user_agent: str | bytes) -> bool:
        """Return whether ``user_agent`` may fetch ``url``.

        Invalid inputs and parser failures are denied. URL normalization is
        intentionally not performed here: the caller must pass the exact
        normalized URL form it will fetch because REP path matching is
        octet-sensitive.
        """

        normalized_url = _normalize_caller_text(
            url,
            maximum_chars=_MAX_TARGET_URL_CHARS,
        )
        normalized_agent = _normalize_caller_text(
            user_agent,
            maximum_chars=_MAX_USER_AGENT_CHARS,
        )
        if normalized_url is None or normalized_agent is None:
            return False

        try:
            return bool(self._parser.can_fetch(normalized_url, normalized_agent))
        except Exception:
            return False

    def crawl_delay(self, user_agent: str | bytes) -> float | None:
        """Return a finite, non-negative ``Crawl-delay`` value when present."""

        normalized_agent = _normalize_caller_text(
            user_agent,
            maximum_chars=_MAX_USER_AGENT_CHARS,
        )
        if normalized_agent is None:
            return None

        try:
            value = self._parser.crawl_delay(normalized_agent)
        except Exception:
            return None
        return _finite_nonnegative_float(value)

    def request_rate(self, user_agent: str | bytes) -> RobotsRequestRate | None:
        """Return a validated ``Request-rate`` directive when present."""

        normalized_agent = _normalize_caller_text(
            user_agent,
            maximum_chars=_MAX_USER_AGENT_CHARS,
        )
        if normalized_agent is None:
            return None

        try:
            value = self._parser.request_rate(normalized_agent)
        except Exception:
            return None
        if value is None:
            return None

        requests = _positive_int(getattr(value, "requests", None))
        seconds = _finite_positive_float(getattr(value, "seconds", None))
        if requests is None or seconds is None:
            return None

        start_time = _optional_time(getattr(value, "start_time", None))
        end_time = _optional_time(getattr(value, "end_time", None))
        if (start_time is None) != (end_time is None):
            # An incomplete time window is malformed; do not propagate it.
            start_time = None
            end_time = None

        return RobotsRequestRate(
            requests=requests,
            seconds=seconds,
            start_time=start_time,
            end_time=end_time,
        )

    def visit_time(self, user_agent: str | bytes) -> RobotsVisitTime | None:
        """Return a validated ``Visit-time`` directive when present."""

        normalized_agent = _normalize_caller_text(
            user_agent,
            maximum_chars=_MAX_USER_AGENT_CHARS,
        )
        if normalized_agent is None:
            return None

        try:
            value = self._parser.visit_time(normalized_agent)
        except Exception:
            return None
        if value is None:
            return None

        start_time = _required_time(getattr(value, "start_time", None))
        end_time = _required_time(getattr(value, "end_time", None))
        if start_time is None or end_time is None:
            return None
        return RobotsVisitTime(start_time=start_time, end_time=end_time)

    @property
    def preferred_host(self) -> str | None:
        """Return Protego's optional, non-standard ``Host`` value safely.

        This value is informational only. It must not alter network scope,
        redirects, or canonical origins without separate crawler validation.
        """

        try:
            value = self._parser.preferred_host
        except Exception:
            return None
        return _normalize_parser_text(
            value,
            maximum_chars=_MAX_PREFERRED_HOST_CHARS,
        )


def _validate_max_bytes(max_bytes: int) -> None:
    if isinstance(max_bytes, bool) or not isinstance(max_bytes, int):
        raise TypeError("max_bytes must be an integer")
    if max_bytes < DEFAULT_MAX_ROBOTS_BYTES:
        raise RobotsRulesError(
            f"max_bytes must be at least {DEFAULT_MAX_ROBOTS_BYTES} bytes "
            "to comply with RFC 9309 section 2.5"
        )


@lru_cache(maxsize=1)
def _ensure_secure_protego() -> None:
    """Reject missing, prerelease, malformed, or vulnerable Protego versions."""

    try:
        installed = metadata.version("Protego")
    except metadata.PackageNotFoundError as exc:
        raise InsecureProtegoVersionError(
            "Protego package metadata is unavailable; install Protego>=0.6.2,<0.7"
        ) from exc

    release = _parse_final_release(installed)
    if release is None:
        raise InsecureProtegoVersionError(
            f"Protego version {installed!r} is not a supported final release; "
            "install Protego>=0.6.2,<0.7"
        )
    if release < _MIN_PROTEGO_VERSION:
        minimum = ".".join(str(value) for value in _MIN_PROTEGO_VERSION)
        raise InsecureProtegoVersionError(
            f"Protego {installed!r} is vulnerable; install Protego>={minimum},<0.7 "
            "to address CVE-2026-55520"
        )


def _parse_final_release(value: str) -> tuple[int, int, int] | None:
    """Parse final/post/local ``X.Y.Z`` releases while rejecting prereleases."""

    match = _RELEASE_RE.fullmatch(value)
    if match is None:
        return None
    return (
        int(match.group("major")),
        int(match.group("minor")),
        int(match.group("patch")),
    )


def _prepare_robots_text(
    value: str | bytes | bytearray | memoryview,
    *,
    max_bytes: int,
) -> tuple[str, RobotsDiagnostics]:
    prefix, source_bytes, source_bytes_exact, truncated = _bounded_source_prefix(
        value, max_bytes=max_bytes
    )

    decoded = prefix.decode("utf-8-sig", errors="replace")
    sanitized_lines: list[str] = []
    ignored_invalid_lines = 0
    decoding_error_lines = 0

    # RFC 9309 permits CR, LF, and CRLF. Avoid splitlines(), which recognizes
    # unrelated Unicode controls as line boundaries.
    decoded = decoded.replace("\r\n", "\n").replace("\r", "\n")
    for line in decoded.split("\n"):
        if "\ufffd" in line:
            decoding_error_lines += 1
            continue
        if _contains_forbidden_character(line):
            ignored_invalid_lines += 1
            continue
        sanitized_lines.append(line)

    prepared = "\n".join(sanitized_lines)
    diagnostics = RobotsDiagnostics(
        source_bytes=source_bytes,
        source_bytes_exact=source_bytes_exact,
        parsed_bytes=len(prepared.encode("utf-8")),
        truncated=truncated,
        ignored_invalid_lines=ignored_invalid_lines,
        decoding_error_lines=decoding_error_lines,
    )
    return prepared, diagnostics


def _bounded_source_prefix(
    value: str | bytes | bytearray | memoryview,
    *,
    max_bytes: int,
) -> tuple[bytes, int, bool, bool]:
    """Return prefix, observed size, size-exactness, and truncation state."""

    if isinstance(value, str):
        return _bounded_string_prefix(value, max_bytes=max_bytes)
    if isinstance(value, bytes):
        source_bytes = len(value)
        return value[:max_bytes], source_bytes, True, source_bytes > max_bytes
    if isinstance(value, (bytearray, memoryview)):
        try:
            view = memoryview(value).cast("B")
        except (TypeError, ValueError) as exc:
            raise TypeError("robots memoryview must be byte-addressable") from exc
        source_bytes = view.nbytes
        return bytes(view[:max_bytes]), source_bytes, True, source_bytes > max_bytes
    raise TypeError("robots content must be str or bytes-like")


def _bounded_string_prefix(
    value: str, *, max_bytes: int
) -> tuple[bytes, int, bool, bool]:
    """Encode only far enough to fill the prefix and prove truncation."""

    prefix = bytearray()
    observed_bytes = 0
    value_length = len(value)

    for start in range(0, value_length, _TEXT_SCAN_CHUNK_CHARS):
        end = min(start + _TEXT_SCAN_CHUNK_CHARS, value_length)
        encoded = value[start:end].encode("utf-8", errors="surrogatepass")
        observed_bytes += len(encoded)
        remaining = max_bytes - len(prefix)
        if remaining > 0:
            prefix.extend(encoded[:remaining])

        if observed_bytes > max_bytes:
            size_exact = end == value_length
            return bytes(prefix), observed_bytes, size_exact, True

    return bytes(prefix), observed_bytes, True, False


def _contains_forbidden_character(line: str) -> bool:
    for character in line:
        codepoint = ord(character)
        if 0xD800 <= codepoint <= 0xDFFF:
            return True
        # SP and HTAB are robots whitespace. Other C0/C1 controls are invalid.
        if character != "\t" and unicodedata.category(character) == "Cc":
            return True
    return False


def _build_fallback_parser(*, allow: bool) -> Protego:
    text = _ALLOW_ALL_TEXT if allow else _DISALLOW_ALL_TEXT
    try:
        return Protego.parse(text)
    except Exception as exc:
        raise RuntimeError("Protego failed to parse a built-in fallback policy") from exc


def _read_sitemaps(parser: Protego) -> tuple[tuple[str, ...], int, bool]:
    try:
        values = parser.sitemaps
    except Exception:
        return (), 0, False
    return _materialize_sitemaps(values)


def _materialize_sitemaps(
    values: Iterable[object],
) -> tuple[tuple[str, ...], int, bool]:
    result: list[str] = []
    seen: set[str] = set()
    ignored = 0
    limit_reached = False

    try:
        iterator: Iterator[object] = iter(values)
    except (TypeError, RuntimeError):
        return (), 0, False

    while True:
        try:
            value = next(iterator)
        except StopIteration:
            break
        except Exception:
            # Preserve already validated values; the iterator itself is broken.
            break

        candidate = _safe_sitemap_url(value)
        if candidate is None:
            ignored += 1
            continue
        if candidate in seen:
            continue
        if len(result) >= _MAX_SITEMAPS:
            limit_reached = True
            ignored += 1
            continue
        seen.add(candidate)
        result.append(candidate)

    return tuple(result), ignored, limit_reached


def _safe_sitemap_url(value: object) -> str | None:
    candidate = _normalize_parser_text(
        value,
        maximum_chars=_MAX_SITEMAP_URL_CHARS,
    )
    if candidate is None or "\\" in candidate:
        return None

    try:
        parsed: SplitResult = urlsplit(candidate)
        host = parsed.hostname
        _ = parsed.port  # Force validation of malformed port syntax.
    except (UnicodeError, ValueError):
        return None

    if parsed.scheme.lower() not in _ALLOWED_SITEMAP_SCHEMES:
        return None
    if not host or parsed.username is not None or parsed.password is not None:
        return None
    if parsed.fragment:
        return None
    return candidate


def _decode_text(value: object) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("latin-1")
        except UnicodeError:
            return None
    return None


def _normalize_caller_text(value: object, *, maximum_chars: int) -> str | None:
    """Validate caller input without silently trimming or rewriting it."""

    text = _decode_text(value)
    if text is None or not text or len(text) > maximum_chars:
        return None
    if text != text.strip(" \t"):
        return None
    if _contains_any_control_or_surrogate(text):
        return None
    return text


def _normalize_parser_text(value: object, *, maximum_chars: int) -> str | None:
    """Validate parser-returned text, permitting only outer SP/HTAB trimming."""

    text = _decode_text(value)
    if text is None:
        return None
    if _contains_any_control_or_surrogate(text, permit_tab=True):
        return None
    text = text.strip(" \t")
    if not text or len(text) > maximum_chars:
        return None
    return text


def _contains_any_control_or_surrogate(text: str, *, permit_tab: bool = False) -> bool:
    for character in text:
        codepoint = ord(character)
        if 0xD800 <= codepoint <= 0xDFFF:
            return True
        if unicodedata.category(character) == "Cc":
            if permit_tab and character == "\t":
                continue
            return True
    return False


def _finite_nonnegative_float(value: object) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return None
    if not math.isfinite(result) or result < 0:
        return None
    return result


def _finite_positive_float(value: object) -> float | None:
    result = _finite_nonnegative_float(value)
    if result is None or result <= 0:
        return None
    return result


def _positive_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if isinstance(value, str) and value.isascii() and value.isdecimal():
        result = int(value)
        return result if result > 0 else None
    return None


def _optional_time(value: object) -> time | None:
    return value if isinstance(value, time) else None


def _required_time(value: object) -> time | None:
    return _optional_time(value)