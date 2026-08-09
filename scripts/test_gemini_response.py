from __future__ import annotations

import pytest

from gemini_response import (
    _strip_code_fence,
    extract_interaction_output_text,
    parse_transcription_text,
)


@pytest.mark.parametrize("bad_payload", [None, [], "text", 1])
def test_extract_rejects_non_mapping_payloads(bad_payload: object) -> None:
    assert extract_interaction_output_text(bad_payload) == ""  # type: ignore[arg-type]


def test_extract_prefers_nonempty_sdk_output_text() -> None:
    payload = {
        "output_text": "  final\r\nanswer  ",
        "steps": [
            {
                "type": "model_output",
                "content": [{"type": "text", "text": "fallback"}],
            }
        ],
    }
    assert extract_interaction_output_text(payload) == "final\nanswer"


def test_extract_uses_latest_usable_model_output_only() -> None:
    payload = {
        "steps": [
            {"type": "user_input", "content": [{"type": "text", "text": "secret"}]},
            {"type": "model_output", "content": [{"type": "text", "text": "draft"}]},
            {"type": "thought", "summary": [{"type": "text", "text": "reasoning"}]},
            {"type": "function_result", "result": "tool output"},
            {
                "type": "model_output",
                "status": "done",
                "content": [
                    {"type": "text", "text": "final"},
                    {"type": "image", "data": "ignored"},
                    {"type": "text", "text": "answer"},
                ],
            },
        ]
    }
    assert extract_interaction_output_text(payload) == "final\nanswer"


def test_extract_does_not_fall_back_past_unusable_final_model_output() -> None:
    payload = {
        "steps": [
            {
                "type": "model_output",
                "content": [{"type": "text", "text": "intermediate preamble"}],
            },
            {"type": "function_call", "name": "search"},
            {
                "type": "model_output",
                "error": {"code": 13, "message": "failed"},
                "content": [{"type": "text", "text": "bad final"}],
            },
        ]
    }
    assert extract_interaction_output_text(payload) == ""


def test_extract_rejects_unfinished_final_model_output() -> None:
    payload = {
        "steps": [
            {
                "type": "model_output",
                "status": "in-progress",
                "content": [{"type": "text", "text": "partial"}],
            }
        ]
    }
    assert extract_interaction_output_text(payload) == ""


def test_extract_supports_legacy_outputs() -> None:
    payload = {
        "outputs": [
            {"type": "text", "text": "one"},
            {"type": "function_call", "name": "ignored"},
            {"type": "text", "text": "two"},
        ]
    }
    assert extract_interaction_output_text(payload) == "one\ntwo"


def test_extract_handles_malformed_shapes_without_raising() -> None:
    payload = {
        "output_text": 1,
        "steps": [None, "bad", {"type": "model_output", "content": {}}, {"type": "model_output", "content": [{"type": "text", "text": None}]}],
        "outputs": "bad",
    }
    assert extract_interaction_output_text(payload) == ""


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("```json\n{\"markdown\": \"ok\"}\n```", '{"markdown": "ok"}'),
        ("````application/json\n{}\n`````", "{}"),
        ("~~~json\n{}\n~~~~", "{}"),
        ("```json\n{}\n~~~", "```json\n{}\n~~~"),
        ("\ufeff  {\"markdown\": \"ok\"}", '{"markdown": "ok"}'),
    ],
)
def test_strip_code_fence(raw: str, expected: str) -> None:
    assert _strip_code_fence(raw) == expected


@pytest.mark.parametrize(
    "text",
    ["", "   ", "DECORATIVE", " decorative ", "```text\nDECORATIVE\n```", '"DECORATIVE"'],
)
def test_parse_decorative_or_empty_returns_none(text: str) -> None:
    assert parse_transcription_text(text) is None


def test_parse_structured_markdown() -> None:
    text = '{"decorative": false, "markdown": "# Title\\r\\nBody"}'
    assert parse_transcription_text(text) == "# Title\nBody"


def test_parse_decorative_true_wins_over_other_fields() -> None:
    text = '{"decorative": true, "markdown": "must not index", "unreadable_items": ["x"]}'
    assert parse_transcription_text(text) is None


def test_parse_unreadable_items_are_validated_flattened_and_deduplicated() -> None:
    text = (
        '{"markdown":"Visible",'
        '"unreadable_items":["  tiny   text ","line\\nbreak","tiny text",7,null,{"x":1}]}'
    )
    assert parse_transcription_text(text) == (
        "Visible\n\nUnreadable or uncertain items:\n"
        "- tiny text\n"
        "- line break"
    )


def test_parse_unreadable_items_without_markdown() -> None:
    text = '{"markdown": null, "unreadable_items": ["logo"]}'
    assert parse_transcription_text(text) == "Unreadable or uncertain items:\n- logo"


@pytest.mark.parametrize(
    "text",
    [
        "[]",
        "{}",
        "null",
        "true",
        "123",
        '{"markdown": 123}',
        '{"unreadable_items": "not-a-list"}',
    ],
)
def test_parse_valid_but_nonconforming_json_returns_none(text: str) -> None:
    assert parse_transcription_text(text) is None


def test_parse_json_string_fallback() -> None:
    assert parse_transcription_text('"plain text"') == "plain text"


def test_parse_plain_markdown_fallback() -> None:
    assert parse_transcription_text("# Heading\r\n\r\nBody") == "# Heading\n\nBody"


def test_parse_malformed_json_is_preserved_as_plain_text() -> None:
    malformed = '{"markdown": "unfinished"'
    assert parse_transcription_text(malformed) == malformed


def test_parse_removes_unsafe_control_characters() -> None:
    text = '{"markdown": "hello\\u0000world\\tkept"}'
    assert parse_transcription_text(text) == "hello world\tkept"


def test_parse_non_string_runtime_input_returns_none() -> None:
    assert parse_transcription_text(None) is None  # type: ignore[arg-type]