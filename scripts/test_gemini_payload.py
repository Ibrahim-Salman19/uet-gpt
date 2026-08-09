"""
test_gemini_payload.py — v1/interactions vision payload shape.

The Gemini Interactions endpoint rejects non-content input items; the text
prompt and inline image must be wrapped in a single content item whose parts
use the documented types text/image.
"""
import base64
import unittest

import crawler as c


class GeminiPayloadTests(unittest.TestCase):
    """Payload structure consumed by the live v1/interactions endpoint."""

    def _payload(self):
        return c.build_gemini_interaction_payload(
            "transcribe",
            b"\x89PNG\r\n\x1a\nfake",
            "image/png",
            "gemini-3.6-flash",
        )

    def test_model_and_store_fields(self):
        payload = self._payload()
        self.assertEqual(payload["model"], "gemini-3.6-flash")
        self.assertIs(payload["store"], False)

    def test_input_is_single_content_item(self):
        payload = self._payload()
        self.assertEqual(len(payload["input"]), 1)
        self.assertEqual(payload["input"][0]["type"], "content")

    def test_text_and_image_are_content_parts(self):
        parts = self._payload()["input"][0]["content"]
        self.assertEqual(len(parts), 2)
        self.assertEqual(parts[0], {"type": "text", "text": "transcribe"})
        self.assertEqual(parts[1]["type"], "image")
        self.assertEqual(parts[1]["mime_type"], "image/png")
        self.assertEqual(parts[1]["resolution"], "high")

    def test_image_data_is_base64(self):
        parts = self._payload()["input"][0]["content"]
        decoded = base64.b64decode(parts[1]["data"])
        self.assertEqual(decoded, b"\x89PNG\r\n\x1a\nfake")

    def test_response_schema_required_fields(self):
        schema = self._payload()["response_format"]["schema"]
        self.assertEqual(
            schema["required"], ["decorative", "markdown", "unreadable_items"]
        )
        self.assertIs(schema["additionalProperties"], False)

    def test_generation_config_is_deterministic(self):
        config = self._payload()["generation_config"]
        self.assertEqual(config["temperature"], 0.0)
        self.assertEqual(config["max_output_tokens"], 700)


if __name__ == "__main__":
    unittest.main(verbosity=2)
