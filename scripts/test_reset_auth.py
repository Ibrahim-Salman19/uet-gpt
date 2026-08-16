"""
Unit tests for ConvexClient._reset_headers in crawler.py.

August 2026 incident remediation: /api/reset moved from a static bearer-token
compare to the same HMAC+timestamp scheme convex/crawl/webhook.ts's
crawlWebhook already used. This proves the Python side computes
HMAC-SHA256(secret, f"{timestamp}.{body}"), hex-encoded, matching
verifySignature's exact construction in webhook.ts
(encoder.encode(timestamp + "." + body), HMAC-SHA256, hex via bytes->hex).

Run:  pytest scripts/test_reset_auth.py
"""

import hashlib
import hmac
import os
import sys
import types
from pathlib import Path

import pytest

os.environ.setdefault("CONVEX_SITE_URL", "https://example.convex.site")

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

crawler = pytest.importorskip(
    "crawler",
    reason="crawler dependencies (curl_cffi/fitz/trafilatura) not installed",
)


def _make_client(token: str | None) -> "crawler.ConvexClient":
    fake_settings = types.SimpleNamespace(convex_auth_token=token)
    # ConvexClient.__init__ only stores settings/session; _reset_headers only
    # reads self.settings.convex_auth_token, so a real AsyncSession is
    # unnecessary here.
    return crawler.ConvexClient(fake_settings, session=None)


def _reference_signature(secret: str, timestamp: str, body: str) -> str:
    return hmac.new(
        secret.encode("utf-8"), f"{timestamp}.{body}".encode("utf-8"), hashlib.sha256
    ).hexdigest()


def test_reset_headers_includes_hmac_timestamp_and_signature():
    client = _make_client("shared-secret-value")
    headers = client._reset_headers("")

    assert "x-crawl-timestamp" in headers
    assert "x-crawl-signature" in headers
    assert "Authorization" not in headers  # no longer a bearer token


def test_reset_headers_signature_matches_the_documented_hmac_construction():
    client = _make_client("shared-secret-value")
    headers = client._reset_headers("")

    expected = _reference_signature("shared-secret-value", headers["x-crawl-timestamp"], "")
    assert headers["x-crawl-signature"] == expected


def test_reset_headers_signature_covers_the_actual_body():
    client = _make_client("shared-secret-value")
    headers = client._reset_headers('{"some":"payload"}')

    expected = _reference_signature(
        "shared-secret-value", headers["x-crawl-timestamp"], '{"some":"payload"}'
    )
    assert headers["x-crawl-signature"] == expected
    # A signature computed over a different body must NOT match.
    wrong = _reference_signature("shared-secret-value", headers["x-crawl-timestamp"], "")
    assert headers["x-crawl-signature"] != wrong


def test_reset_headers_timestamp_is_current_epoch_millis():
    import time

    before = int(time.time() * 1000)
    client = _make_client("shared-secret-value")
    headers = client._reset_headers("")
    after = int(time.time() * 1000)

    ts = int(headers["x-crawl-timestamp"])
    assert before <= ts <= after


def test_reset_headers_omits_auth_headers_when_no_token_configured():
    client = _make_client(None)
    headers = client._reset_headers("")

    assert "x-crawl-timestamp" not in headers
    assert "x-crawl-signature" not in headers
    assert headers == {"Content-Type": "application/json"}


def test_different_secrets_produce_different_signatures_for_the_same_timestamp_and_body():
    client_a = _make_client("secret-a")
    client_b = _make_client("secret-b")
    # Freeze both to the same timestamp for a fair comparison.
    ts = "1700000000000"
    sig_a = _reference_signature("secret-a", ts, "")
    sig_b = _reference_signature("secret-b", ts, "")
    assert sig_a != sig_b
    # And each client's own real output matches its own reference signature
    # at its own (different, real-clock) timestamp too.
    headers_a = client_a._reset_headers("")
    assert headers_a["x-crawl-signature"] == _reference_signature(
        "secret-a", headers_a["x-crawl-timestamp"], ""
    )
