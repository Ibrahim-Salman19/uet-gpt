"""Canonical URL handling and strict UET Taxila network scope.

The policy keeps URL normalization independent from the transport and crawler
orchestration. Exact seed origins are accepted. Optionally, official HTTPS
subdomains under configured DNS suffixes are accepted when discovered in page
links. Non-default ports, user-info URLs, lookalike domains, fragments, and
non-HTTP schemes are rejected.
"""

from __future__ import annotations

import fnmatch
import urllib.parse
from typing import Protocol, Sequence

DEFAULT_PORTS = {"http": 80, "https": 443}


class UrlPolicySettingsLike(Protocol):
    @property
    def all_seeds(self) -> tuple[str, ...]: ...

    allowed_host_suffixes: tuple[str, ...]
    strip_params: frozenset[str]
    skip_extensions: frozenset[str]
    include_patterns: tuple[str, ...]
    exclude_patterns: tuple[str, ...]


def normalized_origin(url: str) -> str:
    """Return a normalized origin or an empty string for an invalid URL."""

    try:
        parsed = urllib.parse.urlsplit(url)
        scheme = parsed.scheme.lower()
        host = (parsed.hostname or "").lower().rstrip(".")
        port = parsed.port
    except (ValueError, UnicodeError):
        return ""
    if scheme not in ("http", "https") or not host:
        return ""
    if port is None or port == DEFAULT_PORTS.get(scheme):
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


class UrlPolicy:
    """Normalize URLs and constrain all network requests to official scope."""

    def __init__(self, settings: UrlPolicySettingsLike):
        self.settings = settings
        self.allowed_origins = frozenset(
            origin
            for origin in (normalized_origin(url) for url in settings.all_seeds)
            if origin
        )
        self.allowed_host_suffixes = frozenset(settings.allowed_host_suffixes)
        self.https_hosts = frozenset(
            (urllib.parse.urlsplit(url).hostname or "").lower().rstrip(".")
            for url in settings.all_seeds
            if urllib.parse.urlsplit(url).scheme.lower() == "https"
        )
        if not self.allowed_origins and not self.allowed_host_suffixes:
            raise RuntimeError(
                "No valid allowed origins or DNS suffixes could be derived from configuration"
            )

    def _host_matches_allowed_suffix(self, host: str) -> bool:
        host = host.lower().rstrip(".")
        return any(
            host == suffix or host.endswith("." + suffix)
            for suffix in self.allowed_host_suffixes
        )

    def canonicalize(self, url: str) -> str:
        """Produce a stable, fetchable URL while preserving server semantics."""

        try:
            parsed = urllib.parse.urlsplit(url.strip())
            scheme = parsed.scheme.lower()
            host = (parsed.hostname or "").lower().rstrip(".")
            if scheme not in ("http", "https") or not host:
                return ""
            if parsed.username is not None or parsed.password is not None:
                return ""
            # UET pages contain legacy HTTP links. Upgrade only explicitly seeded
            # hosts or hosts under an explicitly allowed official DNS suffix.
            if scheme == "http" and (
                host in self.https_hosts or self._host_matches_allowed_suffix(host)
            ):
                scheme = "https"
            port = parsed.port
        except (ValueError, UnicodeError):
            return ""

        netloc = host
        if port is not None and port != DEFAULT_PORTS.get(scheme):
            netloc = f"{host}:{port}"

        # Decode once and encode once. This fixes spaces/non-ASCII filenames
        # without double-encoding existing percent escapes.
        path = urllib.parse.quote(
            urllib.parse.unquote(parsed.path or "/"),
            safe="/:@!$&'()*+,;=-._~",
        )

        # Preserve ``?v1`` versus ``?v1=``. Both forms occur on legacy UET pages.
        query_items: list[tuple[str, str, bool]] = []
        for component in parsed.query.split("&") if parsed.query else []:
            if not component:
                continue
            raw_key, separator, raw_value = component.partition("=")
            key = urllib.parse.unquote_plus(raw_key)
            value = urllib.parse.unquote_plus(raw_value)
            if key.lower() in self.settings.strip_params:
                continue
            query_items.append((key, value, bool(separator)))
        query_items.sort(key=lambda item: (item[0], item[1], item[2]))
        query = "&".join(
            urllib.parse.quote_plus(key)
            + ("=" + urllib.parse.quote_plus(value) if had_equals else "")
            for key, value, had_equals in query_items
        )
        return urllib.parse.urlunsplit((scheme, netloc, path, query, ""))

    def is_network_target(self, url: str) -> bool:
        """Return whether a URL is within the permitted network boundary."""

        canonical = self.canonicalize(url)
        if not canonical:
            return False
        parsed = urllib.parse.urlsplit(canonical)
        origin = normalized_origin(canonical)
        if origin in self.allowed_origins:
            return True
        # Dynamically discovered official subdomains are HTTPS-only and cannot
        # use arbitrary ports. Exact seed origins can opt into another port.
        return bool(
            parsed.scheme == "https"
            and parsed.port in (None, 443)
            and parsed.hostname
            and self._host_matches_allowed_suffix(parsed.hostname)
        )

    @staticmethod
    def _matches_patterns(url: str, patterns: Sequence[str]) -> bool:
        path = urllib.parse.urlsplit(url).path
        for pattern in patterns:
            target = url if pattern.startswith(("http://", "https://")) else path
            if fnmatch.fnmatch(target, pattern):
                return True
        return False

    def is_crawl_candidate(self, url: str) -> bool:
        canonical = self.canonicalize(url)
        if not canonical or not self.is_network_target(canonical):
            return False
        path = urllib.parse.urlsplit(canonical).path.lower()
        if any(path.endswith(extension) for extension in self.settings.skip_extensions):
            return False
        if self._matches_patterns(canonical, self.settings.exclude_patterns):
            return False
        if self.settings.include_patterns and not self._matches_patterns(
            canonical, self.settings.include_patterns
        ):
            return False
        return True

    @staticmethod
    def is_probable_pdf_url(url: str) -> bool:
        return urllib.parse.urlsplit(url).path.lower().endswith(".pdf")