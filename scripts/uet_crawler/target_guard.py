"""Positive local-vs-cloud Convex target verification for resource-consuming CLI scripts.

Context: the August 2026 incident happened because a crawl was launched against
whatever `CONVEX_SITE_URL` happened to be configured in `.env.local`, which at
the time (and today, by default) points at Convex Cloud. Nothing checked
whether the target was local before spending real, metered resources against
it.

This module fails closed: only a positively-verified LOOPBACK host is treated
as local. It does not pattern-match on names like "dev" or "local" anywhere
in the hostname - those strings are meaningless for safety (a Convex Cloud
deployment can be named anything). "Local" here means loopback specifically
(127.0.0.0/8, ::1, or the "localhost" name) - a private LAN address (e.g.
10.x/192.168.x) is deliberately NOT treated as local, since that could be a
different machine on the network rather than this one.

Every other case - missing, malformed, a Convex Cloud/Site URL, or any other
host - is rejected by default. There is exactly one bypass: passing the exact
`CLOUD_EXECUTION_AUTHORIZATION_PHRASE` string, which must be threaded from an
explicit, one-shot CLI flag for that specific invocation - never from a
persistent environment variable, config file, or default - so cloud execution
can never happen by accident.
"""

from __future__ import annotations

import ipaddress
import urllib.parse

# Must be passed verbatim (case-sensitive) to authorize a cloud target for one
# invocation. Deliberately long and unmistakable - not a short flag like
# "--cloud" that could be set by muscle memory or copy-pasted habitually.
CLOUD_EXECUTION_AUTHORIZATION_PHRASE = "I-HAVE-EXPLICIT-AUTHORIZATION-FOR-CLOUD-EXECUTION"

_LOOPBACK_HOSTNAMES = frozenset({"localhost"})


class UnsafeConvexTargetError(RuntimeError):
    """Raised when a Convex target cannot be positively verified as local."""


def _is_loopback_host(hostname: str) -> bool:
    hostname = hostname.strip().lower().rstrip(".")
    if not hostname:
        return False
    if hostname in _LOOPBACK_HOSTNAMES:
        return True
    # urlsplit() strips IPv6 brackets from .hostname already, but be defensive
    # in case a caller passes a raw bracketed string some other way.
    candidate = hostname[1:-1] if hostname.startswith("[") and hostname.endswith("]") else hostname
    try:
        return ipaddress.ip_address(candidate).is_loopback
    except ValueError:
        return False


def assert_local_convex_target(
    site_url: str | None,
    *,
    cloud_execution_authorization_phrase: str | None = None,
) -> str:
    """Positively verify `site_url` targets a local Convex backend.

    Returns the normalized (trailing-slash-stripped) URL on success.
    Raises UnsafeConvexTargetError for every other case, including a missing,
    malformed, ambiguous, or cloud target. Unknown is never treated as local.
    """
    if site_url is None or not site_url.strip():
        raise UnsafeConvexTargetError(
            "No Convex target configured (CONVEX_SITE_URL is empty). Refusing to "
            "proceed: an unknown target is never treated as local."
        )
    candidate = site_url.strip()

    try:
        parts = urllib.parse.urlsplit(candidate)
    except ValueError as exc:
        raise UnsafeConvexTargetError(f"Convex target URL is malformed: {exc}") from exc

    if (
        parts.scheme not in ("http", "https")
        or not parts.hostname
        or parts.username is not None
        or parts.password is not None
        or parts.query
        or parts.fragment
    ):
        raise UnsafeConvexTargetError(
            "Convex target URL must be a clean http(s) origin with no credentials, "
            "query, or fragment."
        )

    normalized = candidate.rstrip("/")

    if _is_loopback_host(parts.hostname):
        return normalized

    if cloud_execution_authorization_phrase == CLOUD_EXECUTION_AUTHORIZATION_PHRASE:
        if parts.scheme != "https":
            raise UnsafeConvexTargetError(
                "Explicitly-authorized cloud execution still requires https://."
            )
        return normalized

    raise UnsafeConvexTargetError(
        f"Convex target host '{parts.hostname}' is not a positively-verified local "
        "endpoint (loopback required, e.g. http://127.0.0.1:3211 for a self-hosted "
        "local Convex backend's HTTP Actions port). Cloud and unrecognized targets "
        "are rejected by default. This is not bypassed by a name containing "
        "'local' or 'dev' - only a genuine loopback address or the explicit "
        "cloud-execution authorization phrase for this specific invocation."
    )
