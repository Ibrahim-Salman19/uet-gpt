from pdf_markdown_cleaner import (
    assess_pdf_markdown_quality,
    clean_pdf_markdown,
    clean_pdf_markdown_with_report,
    is_pdf_output_garbage,
    skip_ocr_if_native_text_sufficient,
)


class _FakePage:
    def __init__(self, native_text: str):
        self._native_text = native_text

    def get_text(self) -> str:
        return self._native_text


def test_removes_placeholders_but_preserves_inline_dimensions():
    source = """Intro
==> picture [222 x 64] intentionally omitted <==
[333 × 99]
The supported resolution is [222 x 64] pixels.
Figure 2: System architecture
"""
    cleaned = clean_pdf_markdown(source)
    assert "intentionally omitted" not in cleaned
    assert "[333 × 99]" not in cleaned
    assert "The supported resolution is [222 x 64] pixels." in cleaned
    assert "Figure 2: System architecture" in cleaned


def test_unsegmented_repeated_uppercase_header_removed():
    pages = []
    for i in range(1, 11):
        pages.append(f"UG PROSPECTUS 2025\nBody content for page {i} with useful details and text.\n{i}")
    cleaned = clean_pdf_markdown("\n".join(pages))
    assert "UG PROSPECTUS 2025" not in cleaned
    assert "Body content for page 10" in cleaned
    assert "\n1\n" not in f"\n{cleaned}\n"


def test_page_aware_removes_dynamic_headers_and_footers_preserves_separator():
    pages = []
    for i in range(1, 13):
        pages.append(
            "\n".join(
                [
                    f"University Prospectus | Page {i} of 12",
                    f"# Chapter {i}",
                    "Useful body paragraph with enough semantic content.",
                    "Admissions Office",
                ]
            )
        )
    source = "\n\n---\n\n".join(pages)
    cleaned, report = clean_pdf_markdown_with_report(source)
    assert "University Prospectus" not in cleaned
    assert "Admissions Office" not in cleaned
    assert "# Chapter 7" in cleaned
    assert cleaned.count("---") == 11
    assert report.used_page_aware_detection is True
    assert report.pages_detected == 12


def test_preserves_fenced_code_exactly():
    source = """Before
```text
123
==> picture [222 x 64] intentionally omitted <==


```
After
"""
    cleaned = clean_pdf_markdown(source)
    assert "123" in cleaned
    assert "==> picture [222 x 64] intentionally omitted <==" in cleaned
    assert "\n\n\n```" in cleaned


def test_preserves_standalone_year():
    source = """# Publication Year
2025
This document contains a legitimate year heading and explanatory content.
"""
    cleaned = clean_pdf_markdown(source)
    assert "2025" in cleaned


def test_preserves_horizontal_rules_when_repeated():
    source = "Page one content\n\n---\n\nPage two content\n\n---\n\nPage three content"
    cleaned = clean_pdf_markdown(source)
    assert cleaned.count("---") == 2


def test_unicode_equivalent_headers_are_detected():
    composed = "ÉCOLE PROSPECTUS"
    decomposed = "E\u0301COLE PROSPECTUS"
    pages = []
    for i in range(10):
        header = composed if i % 2 == 0 else decomposed
        pages.append(f"{header}\nUseful content number {i}.")
    cleaned = clean_pdf_markdown("\n".join(pages))
    assert "PROSPECTUS" not in cleaned


def test_explicit_page_labels_removed_even_without_boundaries():
    source = "Useful content\nPage 3 of 20\nMore useful content"
    cleaned = clean_pdf_markdown(source)
    assert "Page 3 of 20" not in cleaned


def test_sparse_scanned_output_is_garbage():
    source = "UG PROSPECTUS 2025\n1\nUG PROSPECTUS 2025\n2\nUG PROSPECTUS 2025\n3"
    quality = assess_pdf_markdown_quality(source)
    assert quality.is_garbage is True
    assert "too_few_words" in quality.reasons


def test_mangled_numeric_table_is_garbage():
    rows = ["| 12 | 34 | 56 |" for _ in range(30)]
    source = "\n".join(["| A | B | C |", "|---|---|---|", *rows])
    quality = assess_pdf_markdown_quality(source, min_word_count=20)
    assert quality.is_garbage is True
    assert "mostly_numeric_or_symbolic_table" in quality.reasons


def test_valid_textual_table_is_not_garbage():
    rows = [
        f"| Program {i} | Department of Engineering | Applications are open for qualified students |"
        for i in range(1, 20)
    ]
    source = "\n".join(
        [
            "# Admissions Programs",
            "| Program | Department | Status |",
            "|---|---|---|",
            *rows,
        ]
    )
    assert is_pdf_output_garbage(source, min_word_count=30) is False


def test_non_latin_text_is_treated_as_alphabetic_content():
    sentence = "یہ جامعہ داخلوں، پروگراموں، فیسوں اور طلبہ کی رہنمائی کے بارے میں مکمل معلومات فراہم کرتی ہے۔"
    source = "\n".join(sentence for _ in range(12))
    quality = assess_pdf_markdown_quality(source, min_word_count=40)
    assert quality.is_garbage is False
    assert quality.alphabetic_word_count >= 40



def test_preserves_legitimate_standalone_image_or_figure_heading():
    source = "# Visual Assets\nImage\nFigure\nThe following section explains the document graphics."
    cleaned = clean_pdf_markdown(source)
    assert "Image" in cleaned
    assert "Figure" in cleaned


def test_does_not_treat_unrelated_quantities_as_page_sequence():
    source = "Application fee\n5000\nTuition fee\n10000\nSecurity deposit\n15000"
    cleaned = clean_pdf_markdown(source)
    assert "5000" in cleaned
    assert "10000" in cleaned
    assert "15000" in cleaned


def test_preserves_numbered_section_titles_without_markdown_prefix():
    pages = [
        f"Section {i}\nDistinct body content for section {i}.\nAdmissions Office"
        for i in range(1, 13)
    ]
    cleaned = clean_pdf_markdown("\n\n---\n\n".join(pages))
    assert "Section 7" in cleaned
    assert "Admissions Office" not in cleaned


def test_preserves_legitimate_number_on_short_page():
    pages = [
        "Fee Notice\nApplication processing fee\n5000"
        for _ in range(4)
    ]
    cleaned = clean_pdf_markdown("\n\n---\n\n".join(pages))
    assert cleaned.count("5000") == 4

def test_cleaning_is_idempotent():
    source = "UG PROSPECTUS 2025\n" * 10 + "\nUseful body text.\nPage 4 of 10"
    once = clean_pdf_markdown(source)
    twice = clean_pdf_markdown(once)
    assert once == twice


def test_removes_ocr_picture_text_gibberish_preserves_real_heading():
    # Real output captured from pymupdf4llm's tesseract_api OCR path against
    # a UET PDF's cover crest: garbled OCR of a decorative logo, wrapped in
    # pymupdf4llm's own "picture text" markers (see picture_text_to_md in
    # pymupdf4llm/helpers/document_layout.py), immediately followed by the
    # real, correctly-recognized page title.
    source = (
        "\n\n<!-- Start of picture text -->\n"
        "el eA<br>E= Ne,<br>va =e ee Coe ia<br>— | henmrih Ia & 2°<br>gies is iLaa<br>"
        "<!-- End of picture text -->\n\n"
        "UNDERGRADUATE PROSPECTUS 2024 \n\n"
        "UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA \n\n"
    )
    cleaned, report = clean_pdf_markdown_with_report(source)
    assert "henmrih" not in cleaned
    assert "picture text" not in cleaned
    assert "UNDERGRADUATE PROSPECTUS 2024" in cleaned
    assert "UNIVERSITY OF ENGINEERING AND TECHNOLOGY, TAXILA" in cleaned
    assert report.picture_text_blocks_removed == 1


def test_removes_multiple_picture_text_blocks_across_page():
    source = (
        "<!-- Start of picture text -->\nEQ<br><!-- End of picture text -->\n\n"
        "Real Heading\n\n"
        "<!-- Start of picture text -->\n@(So<br><!-- End of picture text -->\n\n"
        "More real body text.\n"
    )
    cleaned, report = clean_pdf_markdown_with_report(source)
    assert "EQ" not in cleaned
    assert "@(So" not in cleaned
    assert "Real Heading" in cleaned
    assert "More real body text." in cleaned
    assert report.picture_text_blocks_removed == 2


def test_preserves_table_shaped_picture_text_fallback_markers_removed():
    # fallback_text_to_md (used when picture spans have varying counts) wraps
    # its markdown-table rendering in the same start/end markers as the plain
    # line-by-line form; both must be stripped by the same pattern.
    source = (
        "<!-- Start of picture text -->\n"
        "||\n|---|\n|garbled|\n"
        "\n<!-- End of picture text -->\n\n"
        "Body text after the fallback table.\n"
    )
    cleaned = clean_pdf_markdown(source)
    assert "garbled" not in cleaned
    assert "picture text" not in cleaned
    assert "Body text after the fallback table." in cleaned


def test_skip_ocr_wrapper_skips_when_native_text_already_sufficient():
    # Real defect this exists for: a table-of-contents page's dot-leader
    # layout has plenty of correct native text, but pymupdf4llm's own
    # OCR-need heuristic still fires on it, appending a redundant/garbled
    # OCR reading. 20+ real native words should suppress the OCR call.
    calls = []
    ocr_function = lambda page, **kw: calls.append(page)
    wrapped = skip_ocr_if_native_text_sufficient(ocr_function, min_word_count=20)
    page = _FakePage(" ".join(f"word{i}" for i in range(30)))
    result = wrapped(page, dpi=150, pixmap=None, language="eng", keep_ocr_text=False)
    assert result is None
    assert calls == []


def test_skip_ocr_wrapper_still_runs_ocr_when_native_text_insufficient():
    # Real case this must not break: a scanned cover page with 0 native
    # text still needs OCR to recover its title.
    calls = []

    def ocr_function(page, dpi, pixmap, language, keep_ocr_text):
        calls.append((page, dpi, language))
        return "ocr result"

    wrapped = skip_ocr_if_native_text_sufficient(ocr_function, min_word_count=20)
    page = _FakePage("")
    result = wrapped(page, dpi=150, pixmap="pix", language="eng", keep_ocr_text=True)
    assert result == "ocr result"
    assert calls == [(page, 150, "eng")]


def test_skip_ocr_wrapper_boundary_at_exact_threshold():
    calls = []
    ocr_function = lambda page, **kw: calls.append(page)
    wrapped = skip_ocr_if_native_text_sufficient(ocr_function, min_word_count=20)
    exactly_at_floor = _FakePage(" ".join(f"w{i}" for i in range(20)))
    wrapped(exactly_at_floor, dpi=150, pixmap=None, language="eng", keep_ocr_text=False)
    assert calls == []  # >= floor means sufficient, OCR skipped
    one_below_floor = _FakePage(" ".join(f"w{i}" for i in range(19)))
    wrapped(one_below_floor, dpi=150, pixmap=None, language="eng", keep_ocr_text=False)
    assert calls == [one_below_floor]