"""
Unit tests for crawler.py security-critical pure functions.

Covers the rubric-critical ingestion boundary defenses that previously had no
automated tests:
  * SSRF allowlist + resolved-IP public check (is_safe_host / _is_public_ip)
  * scheme / domain allowlisting (is_allowed_url)
  * URL canonicalization used for dedup (canonicalize_url)
  * redirect re-validation hook (is_fetchable_url)

These tests exercise only pure / network-free logic. DNS-dependent paths are
covered by monkeypatching socket.getaddrinfo so the suite is deterministic and
offline.

Run:  pytest scripts/test_crawler_security.py
"""

import os
import sys
from pathlib import Path

import pytest

# crawler.py reads CONVEX_SITE_URL at import time and exits if it is unset.
os.environ.setdefault("CONVEX_SITE_URL", "https://example.convex.site")

# Make the crawler module importable regardless of the pytest rootdir.
SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

# Heavy third-party deps (curl_cffi, fitz, trafilatura) are required to import
# the module; skip the whole suite cleanly if the crawler env is not installed.
crawler = pytest.importorskip(
    "crawler",
    reason="crawler dependencies (curl_cffi/fitz/trafilatura) not installed",
)


# ─── _is_public_ip ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("ip", [
    "169.254.169.254",   # cloud metadata (link-local)
    "127.0.0.1",         # loopback
    "10.0.0.5",          # RFC1918
    "172.16.0.1",        # RFC1918
    "192.168.1.1",       # RFC1918
    "0.0.0.0",           # unspecified
    "::1",               # IPv6 loopback
    "fe80::1",           # IPv6 link-local
    "::ffff:127.0.0.1",  # IPv4-mapped loopback
    "::ffff:10.0.0.1",   # IPv4-mapped private
])
def test_non_public_ips_rejected(ip):
    assert crawler._is_public_ip(ip) is False


@pytest.mark.parametrize("ip", [
    "8.8.8.8",
    "1.1.1.1",
    "199.59.243.5",  # a routable public address
    "2606:4700:4700::1111",
])
def test_public_ips_accepted(ip):
    assert crawler._is_public_ip(ip) is True


def test_garbage_ip_rejected():
    assert crawler._is_public_ip("not-an-ip") is False


# ─── is_safe_host (resolved-IP check, DNS monkeypatched) ──────────────────────

def _fake_getaddrinfo(ip):
    def _inner(host, port, *args, **kwargs):
        return [(2, 1, 6, "", (ip, 0))]
    return _inner


def test_is_safe_host_blocks_private_resolution(monkeypatch):
    monkeypatch.setattr(crawler.socket, "getaddrinfo", _fake_getaddrinfo("169.254.169.254"))
    assert crawler.is_safe_host("evil.example.com") is False


def test_is_safe_host_allows_public_resolution(monkeypatch):
    monkeypatch.setattr(crawler.socket, "getaddrinfo", _fake_getaddrinfo("8.8.8.8"))
    assert crawler.is_safe_host("good.example.com") is True


def test_is_safe_host_ip_literal_private():
    # IP-literal hosts must be validated directly, no DNS lookup.
    assert crawler.is_safe_host("127.0.0.1") is False
    assert crawler.is_safe_host("169.254.169.254:80") is False


def test_is_safe_host_bracketed_ipv6_literal():
    assert crawler.is_safe_host("[::1]:8080") is False


# ─── is_allowed_url (scheme + domain allowlist) ───────────────────────────────

def test_disallowed_scheme_rejected():
    assert crawler.is_allowed_url("ftp://web.uettaxila.edu.pk/x") is False
    assert crawler.is_allowed_url("file:///etc/passwd") is False


def test_off_domain_rejected():
    assert crawler.is_allowed_url("https://evil.com/") is False


def test_allowed_domain_scheme_pass(monkeypatch):
    # Bypass robots network fetch so the test stays offline.
    monkeypatch.setattr(crawler, "_get_robot_parser", lambda netloc: None)
    domain = next(iter(crawler.ALLOWED_DOMAINS))
    assert crawler.is_allowed_url(f"https://{domain}/some/page") is True


# ─── is_fetchable_url (allowlist + IP check together) ─────────────────────────

def test_is_fetchable_url_blocks_private_even_if_allowlisted(monkeypatch):
    monkeypatch.setattr(crawler, "_get_robot_parser", lambda netloc: None)
    monkeypatch.setattr(crawler.socket, "getaddrinfo", _fake_getaddrinfo("10.0.0.1"))
    domain = next(iter(crawler.ALLOWED_DOMAINS))
    assert crawler.is_fetchable_url(f"https://{domain}/page") is False


# ─── canonicalize_url (dedup correctness) ─────────────────────────────────────

def test_canonicalize_strips_tracking_params():
    url = "https://web.uettaxila.edu.pk/p?utm_source=x&id=1"
    out = crawler.canonicalize_url(url)
    assert "utm_source" not in out
    assert "id=1" in out


def test_canonicalize_strips_trailing_slash_and_fragment():
    out = crawler.canonicalize_url("https://web.uettaxila.edu.pk/p/#frag")
    assert out.endswith("/p")
    assert "#" not in out
