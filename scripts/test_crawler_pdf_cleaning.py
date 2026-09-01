"""Regression tests for crawler.py's ``_clean_pdf_pages`` PDF post-processing.

This is the cleaner actually wired into the live crawl path (extract_pdf_sync),
distinct from pdf_markdown_cleaner.py's clean_pdf_markdown, which is used by
the manual/batch ingest_pdf.py path. See test_pdf_markdown_cleaner.py for the
sibling suite covering that module.
"""

from crawler import _clean_pdf_pages


def test_removes_ocr_picture_text_gibberish_preserves_real_heading():
    # Real output captured from pymupdf4llm's tesseract_api OCR path against
    # a UET PDF's cover crest: garbled OCR of a decorative logo, wrapped in
    # pymupdf4llm's own "picture text" markers, immediately followed by the
    # real, correctly-recognized page title.
    page = (
        "\n\n<!-- Start of picture text -->\n"
        "el eA<br>E= Ne,<br>va =e ee Coe ia<br>— | henmrih Ia & 2°<br>gies is iLaa<br>"
        "<!-- End of picture text -->\n\n"
        "UNDERGRADUATE PROSPECTUS 2024 \n\n"
        "UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA \n\n"
    )
    (cleaned,) = _clean_pdf_pages([page])
    assert "henmrih" not in cleaned
    assert "picture text" not in cleaned
    assert "UNDERGRADUATE PROSPECTUS 2024" in cleaned
    assert "UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA" in cleaned


def test_removes_multiple_picture_text_blocks_on_one_page():
    page = (
        "<!-- Start of picture text -->\nEQ<br><!-- End of picture text -->\n\n"
        "Real Heading\n\n"
        "<!-- Start of picture text -->\n@(So<br><!-- End of picture text -->\n\n"
        "More real body text.\n"
    )
    (cleaned,) = _clean_pdf_pages([page])
    assert "EQ" not in cleaned
    assert "@(So" not in cleaned
    assert "Real Heading" in cleaned
    assert "More real body text." in cleaned


def test_preserves_existing_omission_placeholder_and_edge_repetition_behavior():
    # Pre-existing behavior of _clean_pdf_pages (image-omission placeholders,
    # repeated running headers/footers) must survive unchanged alongside the
    # new picture-text stripping.
    pages = [
        f"Running Header\n[=> 100x50]\nBody text unique to page {i}.\nRunning Header"
        for i in range(5)
    ]
    cleaned = _clean_pdf_pages(pages)
    for i, page in enumerate(cleaned):
        assert f"Body text unique to page {i}." in page
        assert "[=>" not in page
    assert all("Running Header" not in page for page in cleaned)
