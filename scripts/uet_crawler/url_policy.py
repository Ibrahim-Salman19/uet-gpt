"""Canonical URL handling and strict UET Taxila network scope.

The policy keeps URL normalization independent from the transport and crawler
orchestration. Exact seed origins are accepted. Optionally, official HTTPS
subdomains under configured DNS suffixes are accepted when discovered in page
links. Non-default ports, user-info URLs, lookalike domains, fragments, and
non-HTTP schemes are rejected.

The module follows current primary standards (RFC 3986, the WHATWG URL Living
Standard, and UTS #46 via the third-party ``idna`` package, which implements
IDNA2008):

* Percent-encoded unreserved characters are decoded; other valid escapes are
  normalized to uppercase hex; malformed escapes and percent-encoded control
  characters fail closed.
* Hosts are processed with UTS #46/IDNA2008 when non-ASCII. Releases of
  ``idna`` older than 3.14 (which fixed CVE-2026-45409) are treated as
  unavailable, and Unicode hosts then fail closed. Ordinary ASCII LDH hosts
  never require the dependency.
* Raw text is validated before ``urllib.parse.urlsplit`` because urlsplit is
  documented as not being a validator: C0 controls, DEL, embedded whitespace,
  backslashes, credentials, malformed/zero ports, and legacy numeric host
  representations (``127.1``, octal, hex, integer IPv4 forms) are rejected.
* Generic URL queries are not treated as ``application/x-www-form-urlencoded``:
  literal ``+``, ``%20`` and ``%2B`` remain distinct, and ``?flag`` stays
  distinct from ``?flag=``. Parameters are sorted by (key, value, had-equals)
  by default to match the repository contract; set ``sort_query_params=False``
  to preserve order. Duplicate pairs are preserved unless
  ``dedupe_query_params`` is explicitly enabled.
* HTTP is upgraded to HTTPS only for exact hosts represented by normal-port
  HTTPS seeds, explicitly configured ``https_upgrade_hosts``, or all allowed
  suffixes when ``upgrade_allowed_suffixes_to_https`` is deliberately set.
  Non-default ports are never silently moved between schemes.
* Crawl-trap budgets are enforced on raw input before any stripping,
  sorting or deduplication can reduce it.
* State-changing endpoints (directly or repeatedly percent-encoded) fail
  closed beyond a bounded decode depth.

This module is deterministic, network-free, side-effect-free and thread-safe.
It performs no DNS resolution and never issues HTTP requests; resolved-IP
validation belongs to the transport layer (crawler.HostSafetyCache). All
public methods return safe empty/False results for malformed input instead of
raising, so callers such as crawler.RawHttpClient and the browser renderer
never observe exceptions from this module.
"""

from __future__ import annotations

import fnmatch
import ipaddress
import re
import urllib.parse
from collections.abc import Mapping, Sequence
from typing import Protocol

try:  # idna is already a transitive dependency of httpx; ASCII hosts work without it
    import idna as _idna_pkg

    _IDNA_VERSION = tuple(
        int(part) for part in getattr(_idna_pkg, "__version__", "0").split(".") if part.isdigit()
    )
    # idna < 3.14 carries CVE-2026-45409; treat such releases as unavailable.
    _IDNA_OK = bool(_IDNA_VERSION and _IDNA_VERSION >= (3, 14))
except Exception:  # pragma: no cover - import guard only
    _idna_pkg = None
    _IDNA_VERSION = ()
    _IDNA_OK = False

DEFAULT_PORTS = {"http": 80, "https": 443}

#: High-confidence analytics/tracking parameters dropped from canonical forms
#: when the caller does not supply its own list. Ambiguous application keys
#: (ref, source, sid, cache-busters) are preserved unless explicitly
#: configured for removal.
_DEFAULT_STRIP_PARAMS = frozenset(
    {
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "fbclid",
        "gclid",
        "msclkid",
    }
)

#: Budget defaults matching scripts/crawler.py load_settings().
_DEFAULT_MAX_URL_LENGTH = 8192
_DEFAULT_MAX_PATH_LENGTH = 4096
_DEFAULT_MAX_QUERY_LENGTH = 4096
_DEFAULT_MAX_QUERY_PARAMS = 20
_DEFAULT_MAX_QUERY_VALUES_PER_KEY = 8

#: Unreserved characters per RFC 3986. Only these are decoded from percent
#: encoding so that ``%2F`` (encoded separator) never changes route semantics.
_UNRESERVED = frozenset(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
)

#: Repeated-decoding depth for mutation detection. Values still containing
#: escapes after this many rounds fail closed.
_MAX_DECODE_DEPTH = 5

#: DNS name length limit (RFC 1035); raw hosts are capped before IDNA work.
_MAX_HOST_LENGTH = 253

#: State-changing actions that must never be fetched automatically. Matching
#: is token-aware so safe informational content such as "deleted-records-
#: policy" or "resetting-your-password-guide" is never misclassified. Broad
#: informational words (update, drop) are intentionally not included.
_MUTATION_NAMES = frozenset(
    {
        "logout",
        "logoff",
        "signout",
        "delete",
        "remove",
        "destroy",
        "submit",
        "unsubscribe",
        "approve",
        "reject",
        "activate",
        "deactivate",
        "reset",
        "purge",
        "terminate",
    }
)

#: Query keys whose values are interpreted as actions.
_MUTATION_QUERY_KEYS = frozenset(
    {"action", "do", "cmd", "command", "operation", "op", "task", "act"}
)

#: Query keys that commonly carry a PDF filename.
_PDF_QUERY_KEYS = frozenset({"file", "download", "filename", "name", "doc", "document"})

#: Front-end assets that add no extraction value; they may still appear in
#: resource manifests but must not consume crawl slots.
_FRONTEND_ASSET_EXTENSIONS = frozenset(
    {".css", ".js", ".mjs", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".ico", ".map"}
)

#: Infrastructure endpoints fetched by dedicated crawler components.
_NON_CRAWLABLE_BASENAMES = frozenset(
    {
        "robots",
        "robots.txt",
        "sitemap",
        "sitemap.xml",
        "sitemap_index.xml",
        "sitemap-index.xml",
        "sitemap.txt",
    }
)

_TOKEN_SPLIT_RE = re.compile(r"[^a-z0-9]+")
_HEX_DIGITS = frozenset("0123456789abcdefABCDEF")
_NESTED_ESCAPE_RE = re.compile(r"%[0-9a-fA-F]{2}")
#: Strict host label grammar (RFC 1123 LDH: no underscores, no empty labels,
#: no leading or trailing hyphens per label). One trailing dot is tolerated
#: and normalized away; runs of dots are not.
_LDH_HOST_RE = re.compile(
    r"(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?))*"
)


class UrlPolicySettingsLike(Protocol):
    @property
    def all_seeds(self) -> tuple[str, ...]: ...

    allowed_host_suffixes: tuple[str, ...]
    strip_params: frozenset[str]
    skip_extensions: frozenset[str]
    include_patterns: tuple[str, ...]
    exclude_patterns: tuple[str, ...]


def _settings_get(settings: object, name: str, default: object) -> object:
    """Read a setting from attribute- or mapping-style objects.

    Repository settings are frozen dataclasses (crawler.Settings,
    audit_extraction.AuditSettings), but dict-like settings must also work.
    Missing attributes fall back to ``default`` so minimal settings objects
    remain fully supported.
    """

    if isinstance(settings, Mapping):
        return settings.get(name, default)
    try:
        value = getattr(settings, name)
    except AttributeError:
        return default
    return default if value is None else value


def _settings_strings(settings: object, name: str, default: Sequence[str]) -> tuple[str, ...]:
    raw = _settings_get(settings, name, default)
    if isinstance(raw, str):
        return tuple(part.strip() for part in raw.split() if part.strip())
    try:
        return tuple(str(item) for item in raw)
    except TypeError:
        return ()


def _settings_frozen_lower(settings: object, name: str, default: Sequence[str]) -> frozenset[str]:
    return frozenset(str(item).lower() for item in _settings_strings(settings, name, default))


def _settings_int(settings: object, name: str, default: int) -> int:
    value = _settings_get(settings, name, default)
    if isinstance(value, bool):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _settings_bool(settings: object, name: str, default: bool) -> bool:
    value = _settings_get(settings, name, default)
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("1", "true", "yes", "on")
    if isinstance(value, (int, float)):
        return value != 0
    return default


def _text_cleanup(url: object) -> str:
    """Return a trimmed URL text or an empty string for unusable input.

    C0 controls, DEL, embedded whitespace and backslashes are rejected rather
    than repaired, because urllib.parse.urlsplit() is documented as not being
    a validator and browsers and parsers disagree on such input.
    """

    if not isinstance(url, str):
        return ""
    value = url.strip()
    if not value:
        return ""
    for character in value:
        if character == " " or ord(character) < 0x20 or ord(character) == 0x7F or character == "\\":
            return ""
    return value


def _scan_escapes(text: str) -> tuple[str, bool]:
    """Uppercase valid escapes; flag malformed escapes and encoded controls."""

    if "%" not in text:
        return text, True
    output: list[str] = []
    index = 0
    length = len(text)
    while index < length:
        character = text[index]
        if character != "%":
            output.append(character)
            index += 1
            continue
        if (
            index + 2 >= length
            or text[index + 1] not in _HEX_DIGITS
            or text[index + 2] not in _HEX_DIGITS
        ):
            return text, False
        value = int(text[index + 1 : index + 3], 16)
        if value < 0x20 or value == 0x7F:
            return text, False
        output.append("%" + text[index + 1 : index + 3].upper())
        index += 3
    return "".join(output), True


def _decode_unreserved(text: str) -> str:
    """Decode percent escapes for unreserved characters only.

    ``%41`` becomes ``A`` and ``%2e`` becomes ``.`` so equivalent encodings
    collapse, while ``%2F``, ``%5C`` and other encoded reserved delimiters
    are preserved so route semantics never change.
    """

    if "%" not in text:
        return text
    output: list[str] = []
    index = 0
    length = len(text)
    while index < length:
        character = text[index]
        if (
            character == "%"
            and index + 2 < length
            and text[index + 1] in _HEX_DIGITS
            and text[index + 2] in _HEX_DIGITS
        ):
            decoded = chr(int(text[index + 1 : index + 3], 16))
            if decoded in _UNRESERVED:
                output.append(decoded)
                index += 3
                continue
        output.append(character)
        index += 1
    return "".join(output)


def _normalize_escaped_text(text: str) -> str | None:
    """Uppercase escapes, reject invalid/control escapes, decode unreserved."""

    normalized, ok = _scan_escapes(text)
    if not ok:
        return None
    return _decode_unreserved(normalized)


def _remove_dot_segments(path: str) -> str:
    """Remove dot segments per RFC 3986 section 5.2.4 without escaping root.

    Duplicate slashes, empty segments and a trailing slash are preserved, so
    ``/a//b/../c/`` becomes ``/a//c/``.
    """

    if not path.startswith("/"):
        return path
    output: list[str] = []
    rest = path
    while rest:
        if rest.startswith("/./"):
            rest = "/" + rest[3:]
            continue
        if rest == "/.":
            rest = "/"
            continue
        if rest.startswith("/../"):
            rest = "/" + rest[4:]
            if output:
                output.pop()
            continue
        if rest == "/..":
            rest = "/"
            if output:
                output.pop()
            continue
        separator = rest.find("/", 1)
        if separator == -1:
            output.append(rest)
            rest = ""
        else:
            output.append(rest[:separator])
            rest = rest[separator:]
    return "".join(output)


def _normalize_path(raw_path: str) -> str:
    """Normalize a URL path preserving case, separators and route semantics.

    Percent encoding is normalized, unreserved escapes are decoded, and dot
    segments are resolved. Case, duplicate slashes, matrix parameters, a
    trailing slash and encoded reserved delimiters are preserved.
    """

    normalized = _normalize_escaped_text(raw_path)
    if normalized is None:
        return ""
    return _remove_dot_segments(normalized or "/")


def _is_numeric_host(host: str) -> bool:
    """Return whether a host is a legacy numeric IPv4 representation.

    Detects dotted-decimal, octal, hexadecimal and single-integer forms that
    operating-system parsers (and Python itself) may interpret as IPv4
    addresses.
    """

    parts = host.split(".")
    if not parts or len(parts) > 4:
        return False
    for part in parts:
        if not part:
            return False
        if part.isdigit():
            continue
        if (
            len(part) > 2
            and part[:2].lower() == "0x"
            and all(character in _HEX_DIGITS for character in part[2:])
        ):
            continue
        if len(part) > 1 and part[0] == "0" and all(character in "01234567" for character in part[1:]):
            continue
        return False
    return True


def _process_host(raw_host: str) -> str:
    """Validate and normalize a host name, failing closed on anything risky."""

    if not isinstance(raw_host, str):
        return ""
    host = raw_host.strip().lower()
    if not host or len(host) > _MAX_HOST_LENGTH:
        return ""
    if ":" in host:  # IPv6 literal or embedded port: never valid for fetching
        return ""
    normalized, ok = _scan_escapes(host)
    if not ok:
        return ""
    host = _decode_unreserved(normalized)
    if not host:
        return ""
    if host.endswith("."):
        host = host[:-1]  # a single trailing dot is normalized away
    if any(ord(character) < 0x20 or ord(character) == 0x7F for character in host):
        return ""
    if host.isascii():
        ascii_host = host
    else:
        if not _IDNA_OK:
            return ""
        try:
            ascii_host = _idna_pkg.encode(host, uts46=True, std3_rules=True).decode("ascii")
        except Exception:
            return ""
        ascii_host = ascii_host.lower()
    if not ascii_host or not _LDH_HOST_RE.fullmatch(ascii_host):
        return ""
    if _is_numeric_host(ascii_host):
        return ""
    return ascii_host


def _decode_nested(text: str) -> str | None:
    """Repeatedly percent-decode bounded by _MAX_DECODE_DEPTH.

    Returns ``None`` when the input could not be decoded within the bound.
    """

    current = text
    for _ in range(_MAX_DECODE_DEPTH):
        try:
            decoded = urllib.parse.unquote(current)
        except (ValueError, UnicodeError):
            return None
        if decoded == current:
            return current
        current = decoded
    return None


def normalized_origin(url: str) -> str:
    """Return a normalized origin or an empty string for an invalid URL.

    IPv6 literal hosts are validated, compressed and bracketed so they can
    serve as origin keys; they remain excluded from the fetch boundary.
    """

    value = _text_cleanup(url)
    if not value:
        return ""
    try:
        parsed = urllib.parse.urlsplit(value)
        scheme = parsed.scheme.lower()
        port = parsed.port
    except (ValueError, UnicodeError):
        return ""
    if scheme not in ("http", "https") or parsed.username is not None or parsed.password is not None:
        return ""
    if port == 0:
        return ""
    raw_host = parsed.hostname or ""
    if ":" in raw_host:
        try:
            host = ipaddress.IPv6Address(raw_host).compressed
        except ValueError:
            return ""
        if port is None or port == DEFAULT_PORTS.get(scheme):
            return f"{scheme}://[{host}]"
        return f"{scheme}://[{host}]:{port}"
    host = _process_host(raw_host)
    if not host:
        return ""
    if port is None or port == DEFAULT_PORTS.get(scheme):
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


class UrlPolicy:
    """Normalize URLs and constrain all network requests to official scope."""

    def __init__(self, settings: object):
        self.settings = settings
        self.allowed_origins = frozenset(
            origin
            for origin in (normalized_origin(url) for url in self._all_seeds())
            if origin
        )
        self.allowed_host_suffixes = frozenset(
            suffix.lower().strip(".")
            for suffix in _settings_strings(settings, "allowed_host_suffixes", ())
            if suffix.strip(".")
        )
        self.https_hosts = frozenset(
            host
            for seed in self._all_seeds()
            if (host := self._seed_host(seed)) and self._seed_scheme(seed) == "https"
        )
        self.https_upgrade_hosts = frozenset(
            host
            for host in (
                _process_host(value)
                for value in _settings_strings(settings, "https_upgrade_hosts", ())
            )
            if host
        )
        self.upgrade_allowed_suffixes_to_https = _settings_bool(
            settings, "upgrade_allowed_suffixes_to_https", False
        )
        self.sort_query_params = _settings_bool(settings, "sort_query_params", True)
        self.dedupe_query_params = _settings_bool(settings, "dedupe_query_params", False)
        self.strip_params = frozenset(
            self._settings_frozen_lower("strip_params", ())
            | self._settings_frozen_lower("drop_session_params", ())
        )
        self.skip_extensions = frozenset(self._settings_frozen_lower("skip_extensions", ()))
        self.include_patterns = tuple(self._settings_strings("include_patterns", ()))
        self.exclude_patterns = tuple(self._settings_strings("exclude_patterns", ()))
        self.max_url_length = self._settings_int("max_url_length", _DEFAULT_MAX_URL_LENGTH)
        self.max_path_length = self._settings_int("max_path_length", _DEFAULT_MAX_PATH_LENGTH)
        self.max_query_length = self._settings_int("max_query_length", _DEFAULT_MAX_QUERY_LENGTH)
        self.max_query_params = self._settings_int("max_query_params", _DEFAULT_MAX_QUERY_PARAMS)
        self.max_query_values_per_key = self._settings_int(
            "max_query_values_per_key", _DEFAULT_MAX_QUERY_VALUES_PER_KEY
        )
        if not self.allowed_origins and not self.allowed_host_suffixes:
            raise RuntimeError(
                "No valid allowed origins or DNS suffixes could be derived from configuration"
            )

    def _settings_strings(self, name: str, default: Sequence[str]) -> tuple[str, ...]:
        return _settings_strings(self.settings, name, default)

    def _settings_frozen_lower(self, name: str, default: Sequence[str]) -> frozenset[str]:
        return _settings_frozen_lower(self.settings, name, default)

    def _settings_int(self, name: str, default: int) -> int:
        return _settings_int(self.settings, name, default)

    def _all_seeds(self) -> tuple[str, ...]:
        value = _settings_get(self.settings, "all_seeds", ())
        if isinstance(value, str):
            seeds = (value,)
        else:
            try:
                seeds = tuple(str(item) for item in value)
            except TypeError:
                seeds = ()
        if not seeds:
            seeds = tuple(
                str(item)
                for name in ("seed_urls", "department_urls")
                for item in _settings_strings(self.settings, name, ())
                if item
            )
        return tuple(item for item in seeds if item)

    @staticmethod
    def _seed_host(seed: str) -> str:
        try:
            return _process_host(urllib.parse.urlsplit(seed).hostname)
        except (ValueError, UnicodeError):
            return ""

    @staticmethod
    def _seed_scheme(seed: str) -> str:
        try:
            return urllib.parse.urlsplit(seed).scheme.lower()
        except (ValueError, UnicodeError):
            return ""

    def _host_matches_allowed_suffix(self, host: str) -> bool:
        host = host.lower().rstrip(".")
        return any(
            host == suffix or host.endswith("." + suffix)
            for suffix in self.allowed_host_suffixes
        )

    def canonicalize(self, url: str) -> str:
        """Produce a stable, fetchable URL while preserving server semantics.

        Returns an empty string for anything the crawler must never fetch:
        unsupported schemes, credentials, malformed hosts or ports, URLs that
        exceed configured budgets, or queries that exceed configured limits.
        """

        value = _text_cleanup(url)
        if not value:
            return ""
        if self.max_url_length >= 0 and len(value) > self.max_url_length:
            return ""
        try:
            parsed = urllib.parse.urlsplit(value)
            scheme = parsed.scheme.lower()
        except (ValueError, UnicodeError):
            return ""
        if scheme not in ("http", "https"):
            return ""
        if parsed.username is not None or parsed.password is not None:
            return ""
        host = _process_host(parsed.hostname)
        if not host:
            return ""
        try:
            port = parsed.port
        except (ValueError, UnicodeError):
            return ""
        if port == 0:
            return ""
        if scheme == "http" and port in (None, DEFAULT_PORTS["http"]):
            if host in self.https_hosts or host in self.https_upgrade_hosts:
                scheme = "https"
                port = None
            elif (
                self.upgrade_allowed_suffixes_to_https
                and self._host_matches_allowed_suffix(host)
            ):
                scheme = "https"
                port = None
        if port is not None and port != DEFAULT_PORTS.get(scheme):
            netloc = f"{host}:{port}"
        else:
            netloc = host

        raw_path = parsed.path
        if self.max_path_length >= 0 and len(raw_path) > self.max_path_length:
            return ""
        path = _normalize_path(raw_path)
        if not path:
            return ""

        query = _normalize_query_items(
            parsed,
            self.strip_params,
            self.sort_query_params,
            self.dedupe_query_params,
            self.max_query_length,
            self.max_query_params,
            self.max_query_values_per_key,
        )
        if query is None:
            return ""
        return urllib.parse.urlunsplit((scheme, netloc, path, query, ""))

    def is_network_target(self, url: str) -> bool:
        """Return whether a URL is within the permitted network boundary."""

        canonical = self.canonicalize(url)
        if not canonical:
            return False
        try:
            parsed = urllib.parse.urlsplit(canonical)
        except (ValueError, UnicodeError):
            return False
        if normalized_origin(canonical) in self.allowed_origins:
            return True
        return bool(
            parsed.scheme == "https"
            and parsed.port in (None, 443)
            and parsed.hostname
            and self._host_matches_allowed_suffix(parsed.hostname)
        )

    def _matches_patterns(self, url: str, patterns: Sequence[str]) -> bool:
        try:
            path = urllib.parse.urlsplit(url).path
        except (ValueError, UnicodeError):
            return False
        for pattern in patterns:
            target = url if pattern.startswith(("http://", "https://")) else path
            if fnmatch.fnmatch(target, pattern):
                return True
        return False

    def _is_mutation_url(self, canonical: str) -> bool:
        """Detect segment- or parameter-encoded state-changing endpoints.

        Directly and repeatedly percent-encoded actions are decoded with a
        bounded depth and fail closed beyond it. State-changing query keys
        (``delete=1``, ``logout=true``) are detected in addition to action
        values on action keys. The check is token- and segment-aware so safe
        informational content such as "deleted-records-policy" or "resetting-
        your-password-guide" is never misclassified.
        """

        try:
            parsed = urllib.parse.urlsplit(canonical)
        except (ValueError, UnicodeError):
            return True
        for segment in parsed.path.split("/"):
            if not segment:
                continue
            decoded = _decode_nested(segment)
            if decoded is None or _NESTED_ESCAPE_RE.search(decoded):
                return True
            tokens = {
                token
                for token in _TOKEN_SPLIT_RE.sub("-", decoded.casefold()).strip("-").split("-")
                if token
            }
            if tokens.intersection(_MUTATION_NAMES):
                return True
        try:
            query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        except (ValueError, UnicodeError):
            return True
        for key, value in query:
            decoded_key = _decode_nested(key.casefold())
            decoded_value = _decode_nested(value)
            if decoded_key is None or decoded_value is None:
                return True
            if decoded_key in _MUTATION_NAMES and decoded_value:
                return True
            if decoded_key not in _MUTATION_QUERY_KEYS:
                continue
            tokens = {
                token
                for token in _TOKEN_SPLIT_RE.sub("-", decoded_value).strip("-").split("-")
                if token
            }
            if tokens.intersection(_MUTATION_NAMES):
                return True
        return False

    def is_crawl_candidate(self, url: str) -> bool:
        """Return whether a URL should enter the automatic fetch frontier."""

        canonical = self.canonicalize(url)
        if not canonical or not self.is_network_target(canonical):
            return False
        try:
            path = urllib.parse.urlsplit(canonical).path
        except (ValueError, UnicodeError):
            return False
        class_path = path.split(";", 1)[0]
        lowered = class_path.lower().rstrip("/")
        if any(lowered.endswith(extension) for extension in self.skip_extensions):
            return False
        basename = lowered.rsplit("/", 1)[-1]
        if basename in _NON_CRAWLABLE_BASENAMES:
            return False
        if any(lowered.endswith(extension) for extension in _FRONTEND_ASSET_EXTENSIONS):
            return False
        if self._matches_patterns(canonical, self.exclude_patterns):
            return False
        if self.include_patterns and not self._matches_patterns(
            canonical, self.include_patterns
        ):
            return False
        if self._is_mutation_url(canonical):
            return False
        return True

    def is_probable_pdf_url(self, url: str) -> bool:
        """Return whether a URL most likely resolves to a PDF document.

        Detects case-insensitive and percent-encoded ``.pdf`` path suffixes
        (including a trailing slash and matrix parameters) and
        download-style query parameters carrying a PDF filename. The bare
        word ``pdf`` in an unrelated parameter, fragments, or ``.pdf.html``
        pages are not PDFs.
        """

        try:
            parsed = urllib.parse.urlsplit(url)
        except (ValueError, UnicodeError):
            return False
        scheme = parsed.scheme.lower()
        if scheme and scheme not in ("http", "https"):
            return False
        path = _normalize_escaped_text(parsed.path)
        if path is None:
            return False
        if path.split(";", 1)[0].rstrip("/").casefold().endswith(".pdf"):
            return True
        try:
            query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
        except (ValueError, UnicodeError):
            return False
        for key, value in query:
            if key.casefold() not in _PDF_QUERY_KEYS:
                continue
            normalized = _decode_nested(value)
            if normalized is None:
                continue
            if normalized.casefold().endswith(".pdf"):
                return True
        return False


def _normalize_query_items(
    parsed: urllib.parse.SplitResult,
    strip_params: frozenset[str],
    sort_params: bool,
    dedupe_params: bool,
    max_query_length: int,
    max_query_params: int,
    max_query_values_per_key: int,
) -> str | None:
    """Normalize query text deterministically and apply drop and budget rules.

    Generic URL queries are not treated as form-encoded data: literal ``+``,
    ``%20`` and ``%2B`` remain distinct, parameter order and duplicate pairs
    are preserved by default, and ``?flag`` stays distinct from ``?flag=``.
    Sorting and exact-pair deduplication apply only when the corresponding
    settings are enabled. Budgets are enforced on the raw input before any
    stripping, sorting or deduplication can reduce it. Return ``None`` when
    the query is invalid or over budget (signalling the whole URL must be
    excluded).
    """

    raw_query = parsed.query
    if not raw_query:
        return ""
    if max_query_length >= 0 and len(raw_query) > max_query_length:
        return None
    if max_query_params >= 0:
        raw_count = sum(1 for component in raw_query.split("&") if component)
        if raw_count > max_query_params:
            return None
    if max_query_values_per_key >= 0:
        counts: dict[str, int] = {}
        for component in raw_query.split("&"):
            if not component:
                continue
            counts[component.partition("=")[0]] = counts.get(component.partition("=")[0], 0) + 1
        if any(count > max_query_values_per_key for count in counts.values()):
            return None

    items: list[tuple[str, str, bool] | None] = []
    for component in raw_query.split("&"):
        if not component:
            if not (sort_params or dedupe_params):
                items.append(None)
            continue
        raw_key, separator, raw_value = component.partition("=")
        key = _normalize_escaped_text(raw_key)
        if key is None:
            return None
        value = _normalize_escaped_text(raw_value)
        if value is None:
            return None
        if key.casefold() in strip_params:
            continue
        items.append((key, value, bool(separator)))

    present = [item for item in items if item is not None]
    if dedupe_params:
        seen: set[tuple[str, str, bool]] = set()
        deduped: list[tuple[str, str, bool]] = []
        for item in present:
            if item not in seen:
                seen.add(item)
                deduped.append(item)
        present = deduped
    if sort_params:
        present.sort(key=lambda item: (item[0], item[1], item[2]))
    if not present:
        return ""

    source = present if (sort_params or dedupe_params) else items
    output: list[str] = []
    for item in source:
        if item is None:
            output.append("")
            continue
        key, value, had_equals = item
        output.append(key + ("=" + value if had_equals else ""))
    return "&".join(output)
