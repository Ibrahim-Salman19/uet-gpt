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
            '<meta property="og:title" content="Admissions Fee Schedule">'
            "<title>Fallback title</title></head>"
            "<body><p>Body text.</p></body></html>"
        )
        self.assertEqual(result.title, "Admissions Fee Schedule")

    def test_known_site_branding_suffix_stripped_from_title(self):
        # _clean_uet_title intentionally strips a fixed list of redundant
        # site-branding suffixes (e.g. so a title doesn't repeat "UET
        # Taxila" when the source/site context already establishes it) -
        # this is separate, deliberate behavior from ranking which
        # candidate (h1/og:title/<title>) wins, and deserves its own test:
        # the pre-existing version of test_og_title_falls_back_when_no_h1
        # asserted the *un-cleaned* value, which this test's addition
        # corrects it away from testing by accident.
        result = extract(
            "<html><head>"
            '<meta property="og:title" content="Fee Schedule - UET Taxila">'
            "</head><body><p>Body text.</p></body></html>"
        )
        self.assertEqual(result.title, "Fee Schedule")

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


class LayoutTableUnwrapTests(unittest.TestCase):
    """border="0" presentation tables are unwrapped; real data tables survive."""

    def test_nested_presentation_wrapper_unwrapped_preserves_inner_table(self):
        # Mirrors the real defect: a legacy .asp page wraps genuine course
        # data (styled <td> "headers", not semantic <th> - typical of
        # pre-CSS3 markup) in a border="0" positioning table
        # (width/cellpadding/cellspacing layout attributes), which
        # markdownify then serializes as one mega-cell of blank-pipe noise
        # instead of a clean table.
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<table width="100%" border="0" cellpadding="0" cellspacing="0">'
            "<tr><td>"
            "<table border=\"1\">"
            "<tr><td><b>Course Code</b></td><td><b>Course Title</b></td><td><b>Credit</b></td></tr>"
            "<tr><td>CE-101</td><td>Engineering Drawing</td><td>3</td></tr>"
            "</table>"
            "</td></tr>"
            "</table>"
            "</body></html>"
        )
        self.assertIn("CE-101", result.markdown)
        self.assertIn("Engineering Drawing", result.markdown)
        self.assertGreaterEqual(result.diagnostics.get("layout_tables_unwrapped", 0), 1)

    def test_data_table_with_border_one_not_unwrapped(self):
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<table border="1">'
            "<tr><th>Course Code</th><th>Course Title</th></tr>"
            "<tr><td>CE-101</td><td>Engineering Drawing</td></tr>"
            "<tr><td>CE-102</td><td>Applied Mechanics</td></tr>"
            "</table>"
            "</body></html>"
        )
        self.assertIn("CE-101", result.markdown)
        self.assertIn("CE-102", result.markdown)
        self.assertEqual(result.diagnostics.get("layout_tables_unwrapped", 0), 0)

    def test_unstyled_data_table_not_unwrapped(self):
        result = extract(
            "<html><head><title>Page</title></head><body>"
            "<table>"
            "<tr><th>Course Code</th><th>Course Title</th></tr>"
            "<tr><td>CE-101</td><td>Engineering Drawing</td></tr>"
            "<tr><td>CE-102</td><td>Applied Mechanics</td></tr>"
            "</table>"
            "</body></html>"
        )
        self.assertIn("CE-101", result.markdown)
        self.assertEqual(result.diagnostics.get("layout_tables_unwrapped", 0), 0)

    def test_nested_th_does_not_exempt_outer_wrapper_from_unwrapping(self):
        # Real defect: a border="0" positioning wrapper with many rows of its
        # own (spacer/menu cells - no th/caption of its own) contains a nested
        # real data table with genuine <th> headers. table.find("th") searches
        # all descendants by default, so the nested child's <th> made the
        # *outer* wrapper's own data_table check true too, exempting the
        # wrapper from unwrapping. markdownify then converted the wrapper and
        # its nested table together in one pass, producing one long garbled
        # line instead of two independently well-formed conversions (confirmed
        # against real legacy-asp fixtures: curriculum-e38252 and
        # betsoftwareengineering-a27271 each had exactly this shape).
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<table width="100%" border="0" cellpadding="0" cellspacing="0">'
            "<tr><td>Menu</td></tr>"
            "<tr><td>"
            "<table border=\"1\">"
            "<tr><th>Course Code</th><th>Course Title</th></tr>"
            "<tr><td>CE-101</td><td>Engineering Drawing</td></tr>"
            "</table>"
            "</td></tr>"
            "<tr><td>Footer</td></tr>"
            "</table>"
            "</body></html>"
        )
        self.assertIn("CE-101", result.markdown)
        self.assertIn("Engineering Drawing", result.markdown)
        self.assertGreaterEqual(result.diagnostics.get("layout_tables_unwrapped", 0), 1)

    def test_table_with_own_direct_th_and_nested_wrapper_not_unwrapped(self):
        # Guards the fix above from overcorrecting: a table's *own* direct
        # <th> (not a nested child's) must still count as a real data marker,
        # even when that same table also contains a further-nested border="0"
        # wrapper of its own (only the inner trivial wrapper should unwrap).
        result = extract(
            "<html><head><title>Page</title></head><body>"
            '<table border="1">'
            "<tr><th>Course Code</th><th>Course Title</th></tr>"
            "<tr><td>CE-101</td><td>"
            '<table border="0"><tr><td>note</td></tr></table>'
            "</td></tr>"
            "</table>"
            "</body></html>"
        )
        self.assertIn("CE-101", result.markdown)
        self.assertEqual(result.diagnostics.get("layout_tables_unwrapped", 0), 1)


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
