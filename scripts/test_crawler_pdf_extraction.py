"""Regression tests for crawler.py's real PDF extraction path (extract_pdf_sync).

These deliberately call the *real*, installed pymupdf4llm rather than mocking
it. A mock would hide exactly the defect these tests exist to catch: prior to
this fix, ``_supported_to_markdown_kwargs`` filtered every candidate kwarg
(including ``ocr_function``) against ``inspect.signature(pymupdf4llm.to_markdown)
.parameters``, which for this installed version exposes only the
``*args``/``**kwargs`` catch-all - so the filter silently returned an empty
dict, no error raised, and pymupdf4llm fell back to its own default OCR
backend selection, reproducing the exact original RapidOCR ``text_detector``
crash (upstream PyMuPDF/RAG#398) that the ocr_function override was supposed
to prevent. This was invisible all session because every other verification
path (scripts/eval/run_extraction_eval.py, scripts/test_isolation.py) calls
pymupdf4llm.to_markdown directly, with no such filter in between.
"""

import asyncio
import inspect
from pathlib import Path

import pytest

from crawler import (
    PdfExtractionQualityError,
    _supported_to_markdown_kwargs,
    build_pdf_document,
    extract_pdf_sync,
)

FIXTURES = Path(__file__).parent / "corpus" / "fixtures" / "pdf-download"
HARASSMENT_POLICY = FIXTURES / "sexualharassment-policy-4b52e1" / "body.bin"


class _FakeSettings:
    pdf_table_strategy = "lines_strict"
    pdf_use_ocr = True
    pdf_ocr_language = "eng"
    describe_pdf_images = False


def _forwarding_shim(*args, **kwargs):
    """Stand-in for a (*args, **kwargs)-only to_markdown, like the installed one."""


def _explicit_signature(page_chunks=False, table_strategy="lines", unsupported_in_old=None):
    """Stand-in for a hypothetical future to_markdown with a real, literal signature."""


def test_kwargs_pass_through_unfiltered_when_target_is_a_forwarding_shim(monkeypatch):
    import crawler

    monkeypatch.setattr(crawler.pymupdf4llm, "to_markdown", _forwarding_shim, raising=False)
    candidate = {"page_chunks": True, "ocr_function": object(), "made_up_future_option": 1}
    assert _supported_to_markdown_kwargs(candidate) == candidate


def test_kwargs_still_filtered_when_target_has_explicit_named_parameters(monkeypatch):
    import crawler

    monkeypatch.setattr(crawler.pymupdf4llm, "to_markdown", _explicit_signature, raising=False)
    candidate = {"page_chunks": True, "table_strategy": "lines_strict", "ocr_function": object()}
    filtered = _supported_to_markdown_kwargs(candidate)
    assert filtered == {"page_chunks": True, "table_strategy": "lines_strict"}
    assert "ocr_function" not in filtered


def test_real_installed_to_markdown_survives_the_filter():
    # Locks in the actual installed pymupdf4llm's signature shape. If a future
    # upgrade changes it back to explicit named parameters, this documents
    # that ocr_function must remain one of them (see the explicit-signature
    # branch above) rather than silently regressing.
    import pymupdf4llm

    parameters = inspect.signature(pymupdf4llm.to_markdown).parameters
    is_forwarding_shim = any(
        p.kind is inspect.Parameter.VAR_KEYWORD for p in parameters.values()
    )
    filtered = _supported_to_markdown_kwargs({"ocr_function": object(), "page_chunks": True})
    if is_forwarding_shim:
        assert "ocr_function" in filtered
    else:
        assert "ocr_function" in parameters, (
            "installed pymupdf4llm.to_markdown no longer forwards via **kwargs "
            "and does not name ocr_function explicitly - the OCR engine "
            "override would silently stop reaching pymupdf4llm"
        )


@pytest.mark.skipif(not HARASSMENT_POLICY.exists(), reason="fixture not present")
def test_extract_pdf_sync_real_fixture_does_not_crash_and_uses_tesseract_path():
    # End-to-end through the real production call path (not a reproduction
    # script). Must not raise the upstream RapidOCR text_detector AttributeError,
    # must honor page_chunks (one string per page, not one string for the
    # whole document), and the real required policy text must be present.
    body = HARASSMENT_POLICY.read_bytes()
    title, page_texts, _candidates = extract_pdf_sync(
        body, "https://web.uettaxila.edu.pk/x.pdf", _FakeSettings()
    )
    assert len(page_texts) == 15
    full_text = "\n\n".join(page_texts)
    assert "picture text" not in full_text
    assert "THE HIGHER EDUCATION COMMISSION" in full_text
    assert "PROTECTION AGAINST SEXUAL HARASSMENT" in full_text


def test_build_pdf_document_rejects_low_quality_extraction(monkeypatch):
    # build_pdf_document is the real ingestion path that decides what becomes
    # document.markdown/word_count for the ledger's "ingested" state.
    # Before this fix it only checked word_count - a page of confident-but-
    # meaningless OCR fragments (see §3a: decorative-graphic OCR noise) could
    # clear a word-count floor while being unusable for retrieval.
    import crawler

    def fake_extract_pdf_sync(body, url, settings):
        return "x.pdf", ["zz qx vv"], []

    monkeypatch.setattr(crawler, "extract_pdf_sync", fake_extract_pdf_sync)
    with pytest.raises(PdfExtractionQualityError):
        asyncio.run(
            build_pdf_document(b"%PDF-fake", "https://web.uettaxila.edu.pk/x.pdf", _FakeSettings(), None)
        )


def test_build_pdf_document_accepts_good_extraction(monkeypatch):
    import crawler

    real_paragraph = (
        "This policy applies to actions by students, faculty, staff, and "
        "other members of the university community when misconduct occurs "
        "on campus or in connection with a recognized program or activity."
    )

    def fake_extract_pdf_sync(body, url, settings):
        return "Policy.pdf", [real_paragraph], []

    monkeypatch.setattr(crawler, "extract_pdf_sync", fake_extract_pdf_sync)
    document = asyncio.run(
        build_pdf_document(b"%PDF-fake", "https://web.uettaxila.edu.pk/x.pdf", _FakeSettings(), None)
    )
    assert document is not None
    assert real_paragraph in document.markdown


@pytest.mark.skipif(not HARASSMENT_POLICY.exists(), reason="fixture not present")
def test_build_pdf_document_real_fixture_is_not_a_false_positive():
    # The new quality gate must not reject the real, already-manually-
    # verified-clean fixture - a false positive here would silently drop a
    # good document from the corpus, which is worse than the defect it fixes.
    body = HARASSMENT_POLICY.read_bytes()
    document = asyncio.run(
        build_pdf_document(
            body, "https://web.uettaxila.edu.pk/x.pdf", _FakeSettings(), None
        )
    )
    assert document is not None
    assert "PROTECTION AGAINST SEXUAL HARASSMENT" in document.markdown
