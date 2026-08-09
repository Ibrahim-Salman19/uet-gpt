"""
test_html_extractor.py — smoke tests for the largest untested module.

Covers title ranking, preservation of initially-hidden but relevant content
(modals/accordions/tabs), angle-bracketed link destinations, and failure
hygiene on malformed input.  No network I/O is performed.
"""
import unittest

from html_extractor import HtmlExtractionResult, extract_html_document


class _Policy:
    """Minimal UrlPolicyLike stub restricted to the official host."""

    def canonicalize(self, url):
        return url

    def is_crawl_candidate(self, url):
        return url.startswith("https://uet.edu.pk/")

    def is_network_target(self, url):
        return url.startswith("https://uet.edu.pk/")


def extract(body: str, url: str = "https://uet.edu.pk/page"):
    return extract_html_document(
        body.encode("utf-8"), "text/html; charset=utf-8", url, _Policy()
    )


class TitleRankingTests(unittest.TestCase):
    """h1 > og:title > <title>; generic titles penalized."""

    def test_h1_beats_title_tag(self):
        result = extract(
            "<html><head><title>Generic &lt;title&gt;</title></head>"
            "<body><h1>Admissions 2026</h1><p>Body text.</p></body></html>"
        )
        self.assertEqual(result.title, "Admissions 2026")

    def test_og_title_falls_back_when_no_h1(self):
        result = extract(
            "<html><head>"
            '<meta property="og:title" content="Fee Schedule - UET Taxila">'
            "<title>Fallback title</title></head>"
            "<body><p>Body text.</p></body></html>"
        )
        self.assertEqual(result.title, "Fee Schedule - UET Taxila")

    def test_generic_title_penalized(self):
        result = extract(
            "<html><head><title>UET Taxila</title></head>"
            "<body><h1>Course Outline - CS101</h1></body></html>"
        )
        self.assertEqual(result.title, "Course Outline - CS101")


class ProtectedContentTests(unittest.TestCase):
    """Hidden but relevant DOM (modals/accordions/tabs) survives extraction."""

    def test_hidden_modal_content_preserved(self):
        result = extract(
            "<html><head><title>Page</title></head><body>"
            "<p>Visible paragraph.</p>"
            '<div class="modal" style="display:none">'
            "<p>Deadline: 31 August 2026</p>"
            "</div>"
            "</body></html>"
        )
        self.assertIn("Visible paragraph", result.markdown)
        self.assertIn("Deadline: 31 August 2026", result.markdown)

    def test_accordion_content_preserved(self):
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<button class="accordion">Eligibility</button>'
            '<div class="accordion-content" hidden>'
            "<p>3rd year students only</p>"
            "</div>"
            "</body></html>"
        )
        self.assertIn("Eligibility", result.markdown)
        self.assertIn("3rd year students only", result.markdown)


class LinkConversionTests(unittest.TestCase):
    """Links use angle-bracketed destinations for URL safety."""

    def test_link_emits_angle_destination(self):
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<a href="https://uet.edu.pk/admissions/prospectus.pdf">Prospectus</a>'
            "</body></html>"
        )
        self.assertIn("[Prospectus](<https://uet.edu.pk/admissions/prospectus.pdf>)",
                      result.markdown)

    def test_crawl_links_collected(self):
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<a href="https://uet.edu.pk/departments/mechanical">Mech</a>'
            "</body></html>"
        )
        self.assertIn("https://uet.edu.pk/departments/mechanical", result.crawl_links)


class FailureHygieneTests(unittest.TestCase):
    """Malformed or hostile input never raises."""

    def test_empty_body_returns_none(self):
        self.assertIsNone(extract_html_document(b"", "text/html", "https://uet.edu.pk/", _Policy()))

    def test_garbage_bytes_do_not_raise(self):
        for body in (b"\x00\xff\xfe", b"<html><body><script></body>", b"\x80" * 4096):
            with self.subTest(body=len(body)):
                result = extract_html_document(
                    body, "text/html", "https://uet.edu.pk/", _Policy()
                )
                self.assertTrue(result is None or isinstance(result, HtmlExtractionResult))

    def test_oversized_link_destination_does_not_raise(self):
        long_url = "https://uet.edu.pk/" + "a" * 9000
        result = extract(
            "<html><head><title>Page</title></head><body>"
            f'<a href="{long_url}">long</a>'
            "</body></html>"
        )
        self.assertIsNotNone(result)


if __name__ == "__main__":
    unittest.main(verbosity=2)
