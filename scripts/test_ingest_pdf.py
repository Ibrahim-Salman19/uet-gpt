from __future__ import annotations

import asyncio
import hashlib
from pathlib import Path

import pytest

import ingest_pdf as mod


def make_settings(tmp_path: Path, **overrides):
    values = dict(
        project_root=tmp_path,
        gemini_api_key=None,
        vlm_model="gemini-3.6-flash",
        # Local by default (see uet_crawler/target_guard.py): validate_for_push
        # now fails closed on a non-local target, so shared test fixtures must
        # not implicitly rely on a Convex Cloud-shaped URL passing validation.
        convex_site_url="http://127.0.0.1:3211",
        convex_auth_token="secret",
        crawl_session_id="pdf-manual",
        ocr_language="eng",
        table_strategy="lines_strict",
        max_pdf_bytes=10_000_000,
        max_markdown_bytes=10_000_000,
        max_pages=100,
        max_render_pixels=24_000_000,
        max_vlm_image_bytes=12 * 1024 * 1024,
        render_dpi=200,
        vlm_concurrency=2,
        vlm_attempts=3,
        vlm_max_output_tokens=16_384,
        download_connect_timeout=10.0,
        download_read_timeout=30.0,
        push_timeout=30.0,
        push_attempts=3,
        max_push_bytes=19_000_000,
        max_redirects=5,
        allow_private_downloads=False,
        allowed_download_hosts=(),
        require_convex_auth=True,
    )
    values.update(overrides)
    return mod.Settings(**values)


def test_derive_convex_site_url_is_host_aware():
    assert (
        mod.derive_convex_site_url(None, "https://brave-cat-123.convex.cloud")
        == "https://brave-cat-123.convex.site"
    )
    assert mod.derive_convex_site_url(None, "https://example.com/x.convex.cloud") is None


def test_metadata_normalization_preserves_legitimate_system_wording():
    # Metadata sanitization removes controls; it does not claim that a fragile
    # prompt-injection blocklist can make downstream prompting safe.
    value = mod.sanitize_metadata("  System: Academic Rules\x00\n2026  ", max_len=100)
    assert value == "System: Academic Rules 2026"


def test_freshness_uses_source_and_title():
    assert mod.infer_freshness_tier("https://uettaxila.edu.pk/files/prospectus.pdf", "Guide") == "high"
    assert mod.infer_freshness_tier("local", "Faculty Handbook") == "medium"
    assert mod.infer_freshness_tier("local", "History") == "low"


def test_stable_id_is_not_content_hash_based():
    source = "url:https://example.edu/current-prospectus.pdf"
    first = mod.stable_document_id(source, None)
    second = mod.stable_document_id(source, None)
    assert first == second
    assert first == hashlib.sha256(source.encode()).hexdigest()[:24]
    assert mod.stable_document_id(source, "Prospectus 2026") == "prospectus-2026"


def test_page_table_detection():
    md = "| Name | Fee |\n|---|---:|\n| Ali | 100 |"
    assert mod.page_has_markdown_table(md)
    assert not mod.page_has_markdown_table("Name | Fee\nAli | 100")


def test_page_needs_vlm_for_detected_missing_table():
    page = mod.PageResult(
        page_number=1,
        fast_markdown="Name Fee\nAli 100",
        final_markdown="Name Fee\nAli 100",
        method="pymupdf4llm",
        selection_reason="",
        fast_quality_score=0.8,
        final_quality_score=0.8,
        page_box_classes=("table",),
        expected_table=True,
    )
    needed, reason = mod.page_needs_vlm(page, force_vlm=False)
    assert needed
    assert "table" in reason


def test_blank_page_does_not_spend_vlm_without_visual_content():
    page = mod.PageResult(
        page_number=2,
        fast_markdown="",
        final_markdown="",
        method="empty-fast",
        selection_reason="",
        fast_quality_score=0,
        final_quality_score=0,
    )
    needed, reason = mod.page_needs_vlm(page, force_vlm=False)
    assert not needed
    assert reason == "blank page"


def test_vlm_replaces_fast_when_it_recovers_table():
    page = mod.PageResult(
        page_number=1,
        fast_markdown="Name Fee Ali 100",
        final_markdown="Name Fee Ali 100",
        method="pymupdf4llm",
        selection_reason="",
        fast_quality_score=0.5,
        final_quality_score=0.5,
        page_box_classes=("table",),
        expected_table=True,
    )
    vlm = "| Name | Fee |\n|---|---:|\n| Ali | 100 |"
    mod.choose_page_result(page, vlm, "missing table", 200)
    assert page.method == "gemini-vlm"
    assert page.final_markdown == vlm


def test_vlm_does_not_replace_good_fast_with_refusal():
    page = mod.PageResult(
        page_number=1,
        fast_markdown="This is a valid academic notice with enough meaningful words for retrieval.",
        final_markdown="",
        method="pymupdf4llm",
        selection_reason="",
        fast_quality_score=1.0,
        final_quality_score=1.0,
    )
    mod.choose_page_result(page, "I cannot assist with this request.", "forced by --force-vlm", 200)
    assert page.method == "pymupdf4llm"
    assert page.final_markdown.startswith("This is a valid")


def test_validate_pdf_magic(tmp_path: Path):
    good = tmp_path / "good.pdf"
    good.write_bytes(b"\x00\x00%PDF-1.7\nrest")
    mod.validate_pdf_magic(good)

    bad = tmp_path / "bad.pdf"
    bad.write_bytes(b"<html>not a pdf</html>")
    with pytest.raises(mod.SourceValidationError):
        mod.validate_pdf_magic(bad)


def test_local_source_identity_stable_across_paths(tmp_path: Path):
    pdf = tmp_path / "renamed.pdf"
    pdf.write_bytes(b"%PDF-1.7\n")
    settings = make_settings(tmp_path)
    prepared = mod.prepare_local_pdf(str(pdf), "Fee Structure 2026", settings)
    assert prepared.source_identity == "local-title:fee structure 2026"


def test_private_dns_is_rejected(monkeypatch, tmp_path: Path):
    settings = make_settings(tmp_path)

    async def fake_resolve(host: str, port: int):
        return (mod.ipaddress.ip_address("127.0.0.1"),)

    monkeypatch.setattr(mod, "resolve_host_addresses", fake_resolve)
    with pytest.raises(mod.SourceValidationError, match="non-public"):
        asyncio.run(mod.validate_remote_url("https://example.com/file.pdf", settings))


def test_download_host_allowlist_supports_subdomains(monkeypatch, tmp_path: Path):
    settings = make_settings(tmp_path, allowed_download_hosts=("uettaxila.edu.pk",))

    async def fake_resolve(host: str, port: int):
        return (mod.ipaddress.ip_address("8.8.8.8"),)

    monkeypatch.setattr(mod, "resolve_host_addresses", fake_resolve)
    validated = asyncio.run(
        mod.validate_remote_url("https://web.uettaxila.edu.pk/file.pdf", settings)
    )
    assert validated.startswith("https://")


def test_http_remote_url_is_rejected(tmp_path: Path):
    settings = make_settings(tmp_path)
    with pytest.raises(mod.SourceValidationError, match="https"):
        asyncio.run(mod.validate_remote_url("http://example.com/file.pdf", settings))


def test_settings_requires_auth_by_default(tmp_path: Path):
    settings = make_settings(tmp_path, convex_auth_token=None)
    with pytest.raises(mod.ConfigurationError, match="CONVEX_AUTH_TOKEN"):
        settings.validate_for_push()


def test_validate_for_push_accepts_local_target(tmp_path: Path):
    # Default fixture is now local (http://127.0.0.1:3211) with a token set -
    # must not raise.
    make_settings(tmp_path).validate_for_push()


def test_validate_for_push_rejects_cloud_target(tmp_path: Path):
    settings = make_settings(tmp_path, convex_site_url="https://rugged-bird-156.convex.site")
    with pytest.raises(mod.ConfigurationError):
        settings.validate_for_push()


def test_validate_for_push_rejects_missing_target(tmp_path: Path):
    settings = make_settings(tmp_path, convex_site_url=None)
    with pytest.raises(mod.ConfigurationError):
        settings.validate_for_push()


def test_validate_for_push_cloud_target_allowed_with_explicit_authorization(tmp_path: Path):
    from uet_crawler.target_guard import CLOUD_EXECUTION_AUTHORIZATION_PHRASE

    settings = make_settings(
        tmp_path,
        convex_site_url="https://rugged-bird-156.convex.site",
        cloud_execution_authorization=CLOUD_EXECUTION_AUTHORIZATION_PHRASE,
    )
    settings.validate_for_push()  # must not raise


def test_validate_for_push_cloud_target_wrong_phrase_still_rejected(tmp_path: Path):
    settings = make_settings(
        tmp_path,
        convex_site_url="https://rugged-bird-156.convex.site",
        cloud_execution_authorization="not-the-phrase",
    )
    with pytest.raises(mod.ConfigurationError):
        settings.validate_for_push()


def test_normalize_vlm_markdown_removes_only_full_wrapper():
    raw = "```markdown\n# Heading\n\nBody\n```"
    assert mod.normalize_vlm_markdown(raw) == "# Heading\n\nBody"
    embedded = "Text before\n```markdown\ncode\n```"
    assert "```markdown" in mod.normalize_vlm_markdown(embedded)


def test_build_initial_pages_preserves_extractor_marker():
    chunks = [
        {
            "metadata": {"page_number": 1},
            "text": "A sufficiently descriptive academic notice for enrolled engineering students.",
            "page_boxes": [],
            "tables": [],
            "_extractor": "pypdf",
        }
    ]
    pages = mod.build_initial_pages(chunks, expected_page_count=1)
    assert pages[0].method == "pypdf"


def test_vlm_retains_pypdf_method_when_refusal_is_worse():
    page = mod.PageResult(
        page_number=1,
        fast_markdown="A valid page with reliable academic content for students and faculty.",
        final_markdown="",
        method="pypdf",
        selection_reason="",
        fast_quality_score=1.0,
        final_quality_score=1.0,
    )
    mod.choose_page_result(page, "I cannot assist with this request.", "forced by --force-vlm", 200)
    assert page.method == "pypdf"


def test_document_identity_uses_stable_source_and_content_hash(tmp_path: Path):
    settings = make_settings(tmp_path)
    pdf = tmp_path / "doc.pdf"
    pdf.write_bytes(b"%PDF-1.7\n")
    source = mod.prepare_local_pdf(str(pdf), "Prospectus 2026", settings)
    quality = mod.page_quality("A valid academic document with enough useful words for retrieval.")
    extraction = mod.ExtractionResult(
        markdown="A valid academic document with enough useful words for retrieval.",
        pages=(),
        quality=quality,
        unresolved_pages=(),
        elapsed_seconds=0.1,
    )
    identity = mod.build_document_identity(
        title="Prospectus 2026",
        source=source,
        extraction=extraction,
        document_id=None,
        freshness_tier=None,
    )
    assert identity.virtual_url.endswith(identity.document_id)
    assert identity.content_hash == hashlib.sha256(extraction.markdown.encode()).hexdigest()
    assert identity.freshness_tier == "high"


def test_response_finish_reason_detects_max_tokens():
    class Reason:
        name = "MAX_TOKENS"
    class Candidate:
        finish_reason = Reason()
    class Response:
        candidates = [Candidate()]
    assert mod.response_finish_reason(Response()) == "MAX_TOKENS"


def test_missing_page_chunk_requires_vlm_and_is_unresolved():
    pages = mod.build_initial_pages([], expected_page_count=1)
    page = pages[0]
    needed, reason = mod.page_needs_vlm(page, force_vlm=False)
    assert needed
    assert "no page chunk" in reason
    assert mod.page_is_unresolved(page)


def test_missing_detected_table_is_unresolved():
    page = mod.PageResult(
        page_number=1,
        fast_markdown="Name Fee Ali 100",
        final_markdown="Name Fee Ali 100",
        method="pymupdf4llm",
        selection_reason="",
        fast_quality_score=0.8,
        final_quality_score=0.8,
        expected_table=True,
    )
    assert mod.page_is_unresolved(page)


def test_recovered_vlm_page_clears_fast_extractor_failure():
    page = mod.PageResult(
        page_number=1,
        fast_markdown="",
        final_markdown="Recovered complete page content with meaningful academic details.",
        method="gemini-vlm",
        selection_reason="",
        fast_quality_score=0.0,
        final_quality_score=1.0,
        fast_chunk_missing=True,
        fast_error="parser failed",
    )
    assert not mod.page_is_unresolved(page)


def test_extract_document_returns_rejected_result_for_suppressed_vlm(monkeypatch, tmp_path: Path):
    settings = make_settings(tmp_path)
    chunks = [
        {
            "metadata": {"page_number": 1},
            "text": "Name Fee Ali 100",
            "page_boxes": [{"class": "table"}],
            "tables": [{"row_count": 2, "col_count": 2}],
            "_extractor": "pypdf",
        }
    ]
    monkeypatch.setattr(mod, "extract_fast_page_chunks", lambda path, cfg: chunks)
    inspection = mod.PdfInspection(
        page_count=1, metadata_title="", is_repaired=False, pdf_version="PDF 1.7"
    )
    result = asyncio.run(
        mod.extract_document(
            tmp_path / "unused.pdf",
            inspection,
            settings,
            force_vlm=False,
            no_vlm=True,
            allow_partial=False,
        )
    )
    assert not result.accepted
    assert result.unresolved_pages == (1,)
    assert any("unresolved substantive pages" in reason for reason in result.rejection_reasons)


def test_invalid_url_port_is_controlled_error(tmp_path: Path):
    settings = make_settings(tmp_path)
    with pytest.raises(mod.SourceValidationError, match="invalid port"):
        asyncio.run(mod.validate_remote_url("https://example.com:bad/file.pdf", settings))


def test_serialize_json_payload_preserves_unicode_and_rejects_oversize():
    payload = {"title": "فیس اسٹرکچر", "value": 100}
    encoded = mod.serialize_json_payload(payload, max_bytes=1_000)
    assert "فیس اسٹرکچر".encode("utf-8") in encoded
    assert b"\\u" not in encoded
    with pytest.raises(mod.PushError, match="safety limit"):
        mod.serialize_json_payload(payload, max_bytes=5)


def test_extract_page_with_gemini_uses_async_client_and_part_from_bytes():
    calls = []

    class FakePart:
        @staticmethod
        def from_bytes(*, data, mime_type):
            return {"data": data, "mime_type": mime_type}

    class FakeConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeThinkingConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    class FakeTypes:
        Part = FakePart
        GenerateContentConfig = FakeConfig
        ThinkingConfig = FakeThinkingConfig

        class ThinkingLevel:
            MINIMAL = "minimal"

    class FakeResponse:
        text = "# Fee Notice\n\nThe application fee is Rs. 1,000 for all candidates."
        candidates = []

    class FakeModels:
        async def generate_content(self, **kwargs):
            calls.append(kwargs)
            return FakeResponse()

    class FakeAsyncClient:
        models = FakeModels()

    page = mod.PageResult(
        page_number=1,
        fast_markdown="",
        final_markdown="",
        method="empty-fast",
        selection_reason="",
        fast_quality_score=0.0,
        final_quality_score=0.0,
    )
    result = asyncio.run(
        mod.extract_page_with_gemini(
            client=FakeAsyncClient(),
            types_module=FakeTypes,
            image_bytes=b"png-data",
            image_mime_type="image/png",
            page=page,
            page_count=1,
            model="gemini-test",
            attempts=1,
            max_output_tokens=1024,
        )
    )
    assert result.startswith("# Fee Notice")
    assert calls[0]["model"] == "gemini-test"
    assert calls[0]["contents"][1]["mime_type"] == "image/png"


def test_extract_page_rejects_truncated_last_response():
    class FakePart:
        @staticmethod
        def from_bytes(*, data, mime_type):
            return {"data": data, "mime_type": mime_type}

    class FakeConfig:
        def __init__(self, **kwargs):
            pass

    class FakeTypes:
        Part = FakePart
        GenerateContentConfig = FakeConfig

    class Reason:
        name = "MAX_TOKENS"

    class Candidate:
        finish_reason = Reason()

    class FakeResponse:
        text = "# Truncated but superficially useful content"
        candidates = [Candidate()]

    class FakeModels:
        async def generate_content(self, **kwargs):
            return FakeResponse()

    class FakeAsyncClient:
        models = FakeModels()

    page = mod.PageResult(
        page_number=1,
        fast_markdown="",
        final_markdown="",
        method="empty-fast",
        selection_reason="",
        fast_quality_score=0.0,
        final_quality_score=0.0,
    )
    with pytest.raises(mod.ExtractionError, match="failed after 1 attempt"):
        asyncio.run(
            mod.extract_page_with_gemini(
                client=FakeAsyncClient(),
                types_module=FakeTypes,
                image_bytes=b"png-data",
                image_mime_type="image/png",
                page=page,
                page_count=1,
                model="gemini-test",
                attempts=1,
                max_output_tokens=10,
            )
        )