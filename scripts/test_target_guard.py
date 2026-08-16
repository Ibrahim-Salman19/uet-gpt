"""
Unit tests for scripts/uet_crawler/target_guard.py.

Proves the local-vs-cloud fail-closed contract required by the resource-safety
remediation: LOCAL positively verified -> allowed; CLOUD -> rejected;
UNKNOWN/ambiguous/malformed -> rejected. No network access, no third-party
dependencies - this module is pure stdlib, so the suite always runs.

Run:  pytest scripts/test_target_guard.py
"""

import pytest

from uet_crawler.target_guard import (
    CLOUD_EXECUTION_AUTHORIZATION_PHRASE,
    UnsafeConvexTargetError,
    assert_local_convex_target,
)


# ─── Positive: verified local targets ─────────────────────────────────────────


@pytest.mark.parametrize(
    "url",
    [
        "http://localhost:3211",
        "https://localhost:3211",
        "http://127.0.0.1:3211",
        "http://127.0.0.1:3211/",  # trailing slash normalized away
        "http://127.5.9.2:3210",  # any 127.0.0.0/8 address is loopback
        "http://[::1]:3211",  # IPv6 loopback
        "http://LOCALHOST:3211",  # case-insensitive host
    ],
)
def test_loopback_targets_allowed(url):
    result = assert_local_convex_target(url)
    assert result == url.rstrip("/")


def test_supported_local_convex_endpoint_allowed():
    # The actual shape self-hosted Convex documents for its HTTP Actions port.
    assert assert_local_convex_target("http://127.0.0.1:3211") == "http://127.0.0.1:3211"


# ─── Negative: cloud targets rejected by default ──────────────────────────────


@pytest.mark.parametrize(
    "url",
    [
        "https://rugged-bird-156.convex.cloud",
        "https://rugged-bird-156.convex.site",
        "https://adamant-stork-623.convex.site",
        "https://anything.convex.cloud",
    ],
)
def test_convex_cloud_targets_rejected(url):
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(url)


# ─── Negative: missing / malformed / ambiguous ────────────────────────────────


@pytest.mark.parametrize("url", [None, "", "   "])
def test_missing_target_rejected(url):
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(url)


@pytest.mark.parametrize(
    "url",
    [
        "not a url",
        "://missing-scheme",
        "ftp://127.0.0.1:3211",  # not http(s)
        "http://",  # no host
    ],
)
def test_malformed_target_rejected(url):
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com",
        "http://10.0.0.5:3210",  # private LAN, but NOT loopback - a different machine
        "http://192.168.1.20:3210",
        # The guard must not be foolable by a name containing "local"/"dev" -
        # only genuine loopback IPs/hostnames count.
        "https://local.example.com",
        "https://dev.uettaxila-mirror.example.com",
        "https://convex-cloud-lookalike.local",
    ],
)
def test_ambiguous_non_loopback_target_rejected(url):
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(url)


@pytest.mark.parametrize(
    "url",
    [
        "http://user:pass@127.0.0.1:3211",  # embedded credentials
        "http://127.0.0.1:3211?x=1",  # query string
        "http://127.0.0.1:3211#frag",  # fragment
    ],
)
def test_loopback_with_unclean_origin_rejected(url):
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(url)


# ─── The explicit cloud-execution override ────────────────────────────────────


def test_correct_authorization_phrase_allows_https_cloud_target():
    result = assert_local_convex_target(
        "https://rugged-bird-156.convex.site",
        cloud_execution_authorization_phrase=CLOUD_EXECUTION_AUTHORIZATION_PHRASE,
    )
    assert result == "https://rugged-bird-156.convex.site"


def test_wrong_authorization_phrase_still_rejected():
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(
            "https://rugged-bird-156.convex.site",
            cloud_execution_authorization_phrase="i-am-sure",
        )


def test_authorization_phrase_substring_not_accepted():
    # Must match exactly - a prefix/substring must not accidentally satisfy it.
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(
            "https://rugged-bird-156.convex.site",
            cloud_execution_authorization_phrase=CLOUD_EXECUTION_AUTHORIZATION_PHRASE[:-1],
        )


def test_authorized_cloud_target_still_requires_https():
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(
            "http://rugged-bird-156.convex.site",  # http, not https
            cloud_execution_authorization_phrase=CLOUD_EXECUTION_AUTHORIZATION_PHRASE,
        )


def test_authorization_phrase_does_not_relax_malformed_url_checks():
    with pytest.raises(UnsafeConvexTargetError):
        assert_local_convex_target(
            "not a url",
            cloud_execution_authorization_phrase=CLOUD_EXECUTION_AUTHORIZATION_PHRASE,
        )
