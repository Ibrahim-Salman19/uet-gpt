"""Adversarial regression tests for scripts.uet_crawler.robots_rules.

Run from the repository root after installing Protego 0.6.2 or newer:

    python -m unittest -v test_robots_rules_adversarial.py
"""

from __future__ import annotations

import math
import random
import string
import unittest
from datetime import time
from unittest.mock import patch

from protego import Protego

from scripts.uet_crawler.robots_rules import (
    DEFAULT_MAX_ROBOTS_BYTES,
    RobotsRequestRate,
    RobotsRules,
    RobotsRulesError,
    RobotsVisitTime,
)


class BrokenParser:
    @property
    def preferred_host(self):
        raise RuntimeError("broken preferred_host")

    @property
    def sitemaps(self):
        raise RuntimeError("broken sitemaps")

    def can_fetch(self, url: str, user_agent: str) -> bool:
        raise RuntimeError("broken can_fetch")

    def crawl_delay(self, user_agent: str):
        raise RuntimeError("broken crawl_delay")

    def request_rate(self, user_agent: str):
        raise RuntimeError("broken request_rate")

    def visit_time(self, user_agent: str):
        raise RuntimeError("broken visit_time")


class RobotsRulesTests(unittest.TestCase):
    def test_longest_match_wildcards_end_anchor_and_allow_tie(self) -> None:
        rules = RobotsRules.parse(
            """
            User-agent: *
            Disallow: /private
            Allow: /private/public
            Disallow: /account/*/profile
            Disallow: /contact$
            Disallow: /same
            Allow: /same
            """
        )
        self.assertFalse(rules.can_fetch("https://example.test/private", "UETBot"))
        self.assertTrue(
            rules.can_fetch("https://example.test/private/public", "UETBot")
        )
        self.assertFalse(
            rules.can_fetch("https://example.test/account/a/profile", "UETBot")
        )
        self.assertFalse(rules.can_fetch("https://example.test/contact", "UETBot"))
        self.assertTrue(
            rules.can_fetch("https://example.test/contact/more", "UETBot")
        )
        self.assertTrue(rules.can_fetch("https://example.test/same", "UETBot"))

    def test_group_matching_is_case_insensitive(self) -> None:
        rules = RobotsRules.parse(
            "User-agent: UETBot\nDisallow: /restricted\n"
            "User-agent: *\nDisallow: /generic\n"
        )
        self.assertFalse(
            rules.can_fetch("https://example.test/restricted", "uetbot")
        )

    def test_sitemaps_are_materialized_filtered_and_deduplicated(self) -> None:
        rules = RobotsRules.parse(
            """
            User-agent: *
            Disallow:
            Sitemap: https://example.test/sitemap.xml
            Sitemap: https://example.test/sitemap.xml
            Sitemap: http://cdn.example.test/sitemap.xml
            Sitemap: ftp://example.test/sitemap.xml
            Sitemap: /relative.xml
            Sitemap: https://user:pass@example.test/private.xml
            Sitemap: https://example.test/fragment.xml#x
            """
        )
        # Protego 0.6.2 comment-strips everything from "#" per RFC 9309
        # section 2.3 before the adapter sees the value, so the fragment
        # line survives as a plain HTTPS sitemap.
        self.assertEqual(
            rules.sitemaps,
            (
                "https://example.test/sitemap.xml",
                "http://cdn.example.test/sitemap.xml",
                "https://example.test/fragment.xml",
            ),
        )
        self.assertGreaterEqual(rules.diagnostics.ignored_sitemaps, 3)

    def test_adapter_rejects_fragment_sitemaps_when_parser_emits_them(self) -> None:
        class FragmentParser:
            def can_fetch(self, url: str, user_agent: str) -> bool:
                return True

            def crawl_delay(self, user_agent: str):
                return None

            def request_rate(self, user_agent: str):
                return None

            def visit_time(self, user_agent: str):
                return None

            @property
            def preferred_host(self):
                return None

            @property
            def sitemaps(self):
                return iter(
                    [
                        "https://example.test/ok.xml",
                        "https://example.test/fragment.xml#x",
                        "https://example.test/fragment.xml#y",
                        "/relative.xml",
                        "https://user:pass@example.test/private.xml",
                    ]
                )

        with patch.object(Protego, "parse", return_value=FragmentParser()):
            rules = RobotsRules.parse("User-agent: *")
        self.assertEqual(rules.sitemaps, ("https://example.test/ok.xml",))
        self.assertGreaterEqual(rules.diagnostics.ignored_sitemaps, 4)

    def test_utf8_bom_crlf_invalid_utf8_and_controls(self) -> None:
        body = (
            b"\xef\xbb\xbfUser-agent: *\r\n"
            b"Disallow: /valid\r\n"
            b"Disallow: /bad\xff\r\n"
            b"Allow: /control\x00value\r\n"
        )
        rules = RobotsRules.parse(body)
        self.assertFalse(rules.can_fetch("https://example.test/valid", "UETBot"))
        self.assertEqual(rules.diagnostics.decoding_error_lines, 1)
        self.assertEqual(rules.diagnostics.ignored_invalid_lines, 1)

    def test_exact_500_kib_prefix_is_processed_and_oversize_is_bounded(self) -> None:
        prefix = b"User-agent: *\nDisallow: /blocked\n"
        body = prefix + b"#" * (DEFAULT_MAX_ROBOTS_BYTES + 64 - len(prefix))
        rules = RobotsRules.parse(memoryview(body))
        self.assertTrue(rules.diagnostics.truncated)
        self.assertTrue(rules.diagnostics.source_bytes_exact)
        self.assertEqual(rules.diagnostics.source_bytes, len(body))
        self.assertLessEqual(rules.diagnostics.parsed_bytes, DEFAULT_MAX_ROBOTS_BYTES)
        self.assertFalse(
            rules.can_fetch("https://example.test/blocked", "UETBot")
        )

    def test_oversized_string_does_not_require_full_byte_scan(self) -> None:
        body = "User-agent: *\n" + "x" * (DEFAULT_MAX_ROBOTS_BYTES * 3)
        rules = RobotsRules.parse(body)
        self.assertTrue(rules.diagnostics.truncated)
        self.assertFalse(rules.diagnostics.source_bytes_exact)
        self.assertGreater(rules.diagnostics.source_bytes, DEFAULT_MAX_ROBOTS_BYTES)

    def test_explicit_allow_and_disallow_factories(self) -> None:
        self.assertTrue(
            RobotsRules.allow_all().can_fetch("https://example.test/a", "UETBot")
        )
        self.assertFalse(
            RobotsRules.disallow_all().can_fetch("https://example.test/a", "UETBot")
        )

    def test_crawl_delay_request_rate_and_visit_time(self) -> None:
        rules = RobotsRules.parse(
            """
            User-agent: *
            Crawl-delay: 4
            Request-rate: 10/1m
            Visit-time: 0400 0845
            """
        )
        self.assertEqual(rules.crawl_delay("UETBot"), 4.0)
        self.assertEqual(
            rules.request_rate("UETBot"),
            RobotsRequestRate(requests=10, seconds=60.0),
        )
        self.assertEqual(
            rules.visit_time("UETBot"),
            RobotsVisitTime(start_time=time(4, 0), end_time=time(8, 45)),
        )

    def test_invalid_caller_input_and_broken_parser_fail_safe(self) -> None:
        broken = RobotsRules(_parser=BrokenParser(), sitemaps=())  # type: ignore[arg-type]
        self.assertFalse(broken.can_fetch("https://example.test/a", "UETBot"))
        self.assertIsNone(broken.crawl_delay("UETBot"))
        self.assertIsNone(broken.request_rate("UETBot"))
        self.assertIsNone(broken.visit_time("UETBot"))
        self.assertIsNone(broken.preferred_host)

        allow = RobotsRules.allow_all()
        invalid = (None, 1, True, object(), "", " https://example.test/a", "x\n")
        for value in invalid:
            self.assertFalse(allow.can_fetch(value, "UETBot"))  # type: ignore[arg-type]
            self.assertFalse(
                allow.can_fetch("https://example.test/a", value)  # type: ignore[arg-type]
            )

    def test_parser_exception_becomes_deny_all(self) -> None:
        real_parse = Protego.parse

        def conditional_parse(text: str):
            if text == "TRIGGER_FAILURE":
                raise RuntimeError("simulated parser failure")
            return real_parse(text)

        with patch.object(Protego, "parse", side_effect=conditional_parse):
            rules = RobotsRules.parse("TRIGGER_FAILURE")
        self.assertTrue(rules.diagnostics.parser_failed)
        self.assertFalse(rules.can_fetch("https://example.test/a", "UETBot"))

    def test_max_bytes_must_respect_rfc_minimum(self) -> None:
        with self.assertRaises(RobotsRulesError):
            RobotsRules.parse("", max_bytes=DEFAULT_MAX_ROBOTS_BYTES - 1)
        with self.assertRaises(TypeError):
            RobotsRules.parse("", max_bytes=True)  # type: ignore[arg-type]

    def test_public_methods_do_not_raise_on_seeded_malformed_inputs(self) -> None:
        rules = RobotsRules.parse("User-agent: *\nDisallow: /blocked\n")
        generator = random.Random(20260801)
        values: list[object] = [None, True, 0, object(), b"\xff", ""]
        alphabet = string.printable + "\x00\ud800\uffff"
        values.extend(
            "".join(generator.choice(alphabet) for _ in range(generator.randrange(200)))
            for _ in range(2_000)
        )

        for value in values:
            try:
                rules.can_fetch(value, "UETBot")  # type: ignore[arg-type]
                rules.can_fetch("https://example.test/a", value)  # type: ignore[arg-type]
                rules.crawl_delay(value)  # type: ignore[arg-type]
                rules.request_rate(value)  # type: ignore[arg-type]
                rules.visit_time(value)  # type: ignore[arg-type]
            except Exception as exc:  # pragma: no cover - assertion path
                self.fail(f"public method raised for {value!r}: {exc!r}")

    def test_nonfinite_directive_values_are_not_propagated(self) -> None:
        class NonFiniteParser(BrokenParser):
            def crawl_delay(self, user_agent: str):
                return math.inf

        rules = RobotsRules(_parser=NonFiniteParser(), sitemaps=())  # type: ignore[arg-type]
        self.assertIsNone(rules.crawl_delay("UETBot"))


if __name__ == "__main__":
    unittest.main(verbosity=2)