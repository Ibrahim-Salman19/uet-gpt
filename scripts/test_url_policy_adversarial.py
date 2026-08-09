"""Adversarial regression tests for scripts.uet_crawler.url_policy.

Run from the repository root with:
    python -m unittest -v test_url_policy_adversarial.py

The suite performs deterministic security/canonicalization cases plus seeded
randomized idempotence and malformed-input tests.  It makes no network calls.
"""

from __future__ import annotations

import random
import string
import unittest
from dataclasses import dataclass

from scripts.uet_crawler.url_policy import UrlPolicy, normalized_origin


@dataclass(frozen=True)
class Settings:
    all_seeds: tuple[str, ...] = (
        "https://www.uettaxila.edu.pk/",
        "http://legacy.uettaxila.edu.pk/",
    )
    allowed_host_suffixes: tuple[str, ...] = ("uettaxila.edu.pk",)
    strip_params: frozenset[str] = frozenset(
        {"utm_source", "utm_medium", "fbclid", "gclid"}
    )
    drop_session_params: frozenset[str] = frozenset(
        {"sid", "sessionid", "phpsessid", "asp.net_sessionid", "jsessionid"}
    )
    skip_extensions: frozenset[str] = frozenset(
        {
            ".jpg",
            ".jpeg",
            ".png",
            ".gif",
            ".webp",
            ".svg",
            ".mp4",
            ".zip",
            ".docx",
            ".xlsx",
        }
    )
    include_patterns: tuple[str, ...] = ()
    exclude_patterns: tuple[str, ...] = ()
    max_url_length: int = 8192
    max_path_length: int = 4096
    max_query_length: int = 4096
    max_query_params: int = 20
    max_query_values_per_key: int = 8


class UrlPolicyAdversarialTests(unittest.TestCase):
    def setUp(self) -> None:
        self.policy = UrlPolicy(Settings())
        self.base = "https://www.uettaxila.edu.pk"

    def test_origins_and_authority_validation(self) -> None:
        cases = {
            "HTTPS://WWW.UETTAXILA.EDU.PK:443/a": "https://www.uettaxila.edu.pk",
            "http://legacy.uettaxila.edu.pk:80/a": "http://legacy.uettaxila.edu.pk",
            "https://www.uettaxila.edu.pk.:443/a": "https://www.uettaxila.edu.pk",
            "https://bücher.example/": "https://xn--bcher-kva.example",
            "https://[2001:0db8::1]/": "https://[2001:db8::1]",
            "https://user@www.uettaxila.edu.pk/": "",
            "https://www.uettaxila.edu.pk\\@evil.example/": "",
            "https://127.1/": "",
            "https://2130706433/": "",
            "https://example..com/": "",
            "https://example.com../": "",
            "https://exa_mple.com/": "",
            "javascript:alert(1)": "",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(normalized_origin(raw), expected)

    def test_canonicalization(self) -> None:
        cases = {
            "https://www.uettaxila.edu.pk": "https://www.uettaxila.edu.pk/",
            "https://www.uettaxila.edu.pk/a/../b": "https://www.uettaxila.edu.pk/b",
            "https://www.uettaxila.edu.pk/a//b/": "https://www.uettaxila.edu.pk/a//b/",
            "https://www.uettaxila.edu.pk/%7euser/%2f": "https://www.uettaxila.edu.pk/~user/%2F",
            "https://www.uettaxila.edu.pk/?b=2&a=1": "https://www.uettaxila.edu.pk/?a=1&b=2",
            "https://www.uettaxila.edu.pk/?flag&flag=": "https://www.uettaxila.edu.pk/?flag&flag=",
            "https://www.uettaxila.edu.pk/?utm_source=x&a=1": "https://www.uettaxila.edu.pk/?a=1",
            "https://www.uettaxila.edu.pk/a#fragment": "https://www.uettaxila.edu.pk/a",
            "http://www.uettaxila.edu.pk/a": "https://www.uettaxila.edu.pk/a",
            "http://legacy.uettaxila.edu.pk/a": "http://legacy.uettaxila.edu.pk/a",
            "http://new.uettaxila.edu.pk/a": "http://new.uettaxila.edu.pk/a",
            "http://www.uettaxila.edu.pk:8080/a": "http://www.uettaxila.edu.pk:8080/a",
            "https://www.uettaxila.edu.pk/%": "",
            "https://www.uettaxila.edu.pk/%GG": "",
            "https://www.uettaxila.edu.pk/%00": "",
            "https://www.uettaxila.edu.pk/a\nb": "",
            "https://user:pass@www.uettaxila.edu.pk/": "",
        }
        for raw, expected in cases.items():
            with self.subTest(raw=raw):
                self.assertEqual(self.policy.canonicalize(raw), expected)

    def test_network_boundary(self) -> None:
        accepted = (
            "https://www.uettaxila.edu.pk/",
            "http://legacy.uettaxila.edu.pk/",
            "https://dept.uettaxila.edu.pk/",
            "https://bücher.uettaxila.edu.pk/",
        )
        rejected = (
            "http://dept.uettaxila.edu.pk/",
            "https://uettaxila.edu.pk.attacker.com/",
            "https://attacker-uettaxila.edu.pk/",
            "https://dept.uettaxila.edu.pk:444/",
            "https://127.0.0.1/",
            "https://user@www.uettaxila.edu.pk/",
        )
        for url in accepted:
            with self.subTest(url=url):
                self.assertTrue(self.policy.is_network_target(url))
        for url in rejected:
            with self.subTest(url=url):
                self.assertFalse(self.policy.is_network_target(url))

    def test_mutation_routes_and_false_positives(self) -> None:
        rejected_paths = (
            "/logout",
            "/delete.aspx?id=1",
            "/api/delete-account",
            "/index.php?action=delete",
            "/index.php?do=remove",
            "/index.php?delete=1",
            "/index.php?logout=true",
            "/%2Fdelete",
            "/%252Fdelete",
            "/index.php?action=%2564elete",
        )
        accepted_paths = (
            "/deleted-records-policy",
            "/resetting-your-password-guide",
            "/approval-process",
            "/rejected-paper-analysis",
            "/news?page=3",
            "/faculty?id=42",
            "/downloads?category=forms",
            "/departmentfaculty?departmentId=17",
        )
        for path in rejected_paths:
            with self.subTest(path=path):
                self.assertFalse(self.policy.is_crawl_candidate(self.base + path))
        for path in accepted_paths:
            with self.subTest(path=path):
                self.assertTrue(self.policy.is_crawl_candidate(self.base + path))

    def test_assets_and_pdf_detection(self) -> None:
        for extension in (
            ".css",
            ".js",
            ".mjs",
            ".woff2",
            ".jpg",
            ".png",
            ".mp4",
            ".zip",
            ".docx",
        ):
            with self.subTest(extension=extension):
                self.assertFalse(
                    self.policy.is_crawl_candidate(self.base + "/asset" + extension)
                )

        pdf_yes = (
            "/report.pdf",
            "/REPORT.PDF",
            "/report%2Epdf",
            "/report.pdf/",
            "/download?file=report.pdf",
            "/download?filename=report%252Epdf",
        )
        pdf_no = (
            "/report.pdf.html",
            "/download?page=pdf",
            "/download?other=report.pdf",
            "/report.pdfx",
            "javascript:report.pdf",
        )
        for url in pdf_yes:
            with self.subTest(url=url):
                self.assertTrue(self.policy.is_probable_pdf_url(url))
        for url in pdf_no:
            with self.subTest(url=url):
                self.assertFalse(self.policy.is_probable_pdf_url(url))

    def test_budget_semantics(self) -> None:
        limited = UrlPolicy(
            {
                "all_seeds": ["https://example.com"],
                "max_query_params": 1,
                "max_query_values_per_key": 1,
                "max_query_length": 20,
                "max_path_length": 10,
                "max_url_length": 100,
            }
        )
        self.assertEqual(
            limited.canonicalize("https://example.com/?a=1"),
            "https://example.com/?a=1",
        )
        self.assertEqual(limited.canonicalize("https://example.com/?a=1&b=2"), "")
        self.assertEqual(limited.canonicalize("https://example.com/?a=1&a=2"), "")
        self.assertEqual(limited.canonicalize("https://example.com/12345678901"), "")

        unlimited = UrlPolicy(
            {
                "all_seeds": ["https://example.com"],
                "max_query_params": -1,
                "max_query_values_per_key": -1,
            }
        )
        query = "&".join(f"a={index}" for index in range(50))
        self.assertTrue(unlimited.canonicalize("https://example.com/?" + query))

    def test_idempotence_and_determinism(self) -> None:
        random_source = random.Random(20260801)
        alphabet = string.ascii_letters + string.digits + "-._~"
        for _ in range(20_000):
            segments: list[str] = []
            for _ in range(random_source.randrange(0, 7)):
                selector = random_source.randrange(8)
                if selector == 0:
                    segment = "."
                elif selector == 1:
                    segment = ".."
                elif selector == 2:
                    segment = ""
                else:
                    segment = "".join(
                        random_source.choice(alphabet)
                        for _ in range(random_source.randrange(0, 18))
                    )
                segments.append(segment)
            path = "/" + "/".join(segments)
            query_pairs = [
                (
                    "".join(random_source.choice(alphabet) for _ in range(3)),
                    "".join(random_source.choice(alphabet) for _ in range(5)),
                )
                for _ in range(random_source.randrange(0, 8))
            ]
            query = "&".join(f"{key}={value}" for key, value in query_pairs)
            raw = self.base + path + ("?" + query if query else "")
            first = self.policy.canonicalize(raw)
            self.assertEqual(self.policy.canonicalize(raw), first)
            if first:
                self.assertEqual(self.policy.canonicalize(first), first)

    def test_malformed_fuzz_never_raises(self) -> None:
        random_source = random.Random(77)
        alphabet = (
            string.printable
            + "ü。／＠：\u2003\u00a0"
            + "\x00\x1f\x7f"
        )
        methods = (
            self.policy.canonicalize,
            self.policy.is_network_target,
            self.policy.is_crawl_candidate,
            self.policy.is_probable_pdf_url,
            normalized_origin,
        )
        for _ in range(10_000):
            value = "".join(
                random_source.choice(alphabet)
                for _ in range(random_source.randrange(0, 100))
            )
            for method in methods:
                method(value)


if __name__ == "__main__":
    unittest.main(verbosity=2)