from __future__ import annotations

import io

import pytest
from PIL import Image

from image_normalization import PreparedImage, prepare_image_for_gemini


def image_bytes(
    mode: str,
    size: tuple[int, int],
    fmt: str,
    *,
    color=0,
    save_kwargs: dict | None = None,
) -> bytes:
    image = Image.new(mode, size, color)
    output = io.BytesIO()
    image.save(output, format=fmt, **(save_kwargs or {}))
    return output.getvalue()


def opened_size(prepared: PreparedImage) -> tuple[int, int]:
    with Image.open(io.BytesIO(prepared.data)) as image:
        image.load()
        return image.size


def test_empty_and_non_image_are_rejected() -> None:
    assert prepare_image_for_gemini(b"", "image/png") is None
    assert prepare_image_for_gemini(b"not an image", "image/jpeg") is None


def test_actual_format_overrides_wrong_content_type() -> None:
    raw = image_bytes("RGB", (32, 24), "JPEG", color="white")
    prepared = prepare_image_for_gemini(raw, "image/png; charset=binary")
    assert prepared == PreparedImage(raw, "image/jpeg", False)


def test_valid_supported_image_passes_through_byte_for_byte() -> None:
    raw = image_bytes("RGBA", (16, 12), "PNG", color=(1, 2, 3, 128))
    prepared = prepare_image_for_gemini(raw, "application/octet-stream")
    assert prepared == PreparedImage(raw, "image/png", False)


def test_bmp_is_converted() -> None:
    raw = image_bytes("RGB", (80, 60), "BMP", color="white")
    prepared = prepare_image_for_gemini(raw, "image/bmp")
    assert prepared is not None
    assert prepared.converted is True
    assert prepared.mime_type in {"image/png", "image/jpeg"}
    assert opened_size(prepared) == (80, 60)


def test_exif_orientation_is_applied_and_removed() -> None:
    image = Image.new("RGB", (40, 20), "white")
    exif = Image.Exif()
    exif[274] = 6
    output = io.BytesIO()
    image.save(output, format="JPEG", quality=95, exif=exif)

    prepared = prepare_image_for_gemini(output.getvalue(), "image/jpeg")
    assert prepared is not None
    assert prepared.converted is True
    assert prepared.mime_type == "image/jpeg"
    assert opened_size(prepared) == (20, 40)
    with Image.open(io.BytesIO(prepared.data)) as reopened:
        assert reopened.getexif().get(274) in (None, 1)


def test_animated_gif_uses_first_frame() -> None:
    first = Image.new("RGB", (30, 20), "white")
    second = Image.new("RGB", (30, 20), "black")
    output = io.BytesIO()
    first.save(
        output,
        format="GIF",
        save_all=True,
        append_images=[second],
        duration=100,
        loop=0,
    )

    prepared = prepare_image_for_gemini(output.getvalue(), "image/gif")
    assert prepared is not None
    assert prepared.converted is True
    assert prepared.mime_type in {"image/png", "image/jpeg"}
    assert opened_size(prepared) == (30, 20)
    with Image.open(io.BytesIO(prepared.data)) as reopened:
        reopened.seek(0)
        pixel = reopened.convert("RGB").getpixel((0, 0))
        assert pixel == (255, 255, 255)
        assert not bool(getattr(reopened, "is_animated", False))


def test_transparent_unsupported_format_becomes_png() -> None:
    # GIF supports indexed transparency and exercises the alpha-preserving path.
    image = Image.new("P", (40, 30), 0)
    image.putpalette([255, 0, 0] + [0, 0, 0] * 255)
    image.info["transparency"] = 0
    output = io.BytesIO()
    image.save(output, format="GIF", transparency=0)

    prepared = prepare_image_for_gemini(output.getvalue(), "image/gif")
    assert prepared is not None
    assert prepared.converted is True
    assert prepared.mime_type == "image/png"


def test_large_input_is_reencoded_to_output_bound() -> None:
    # Pillow's deterministic noise generator creates an image that does not
    # trivially compress, forcing quality reduction and/or resizing.
    image = Image.effect_noise((1200, 1200), 100).convert("RGB")
    output = io.BytesIO()
    image.save(output, format="PNG")
    raw = output.getvalue()
    assert len(raw) > 120_000

    prepared = prepare_image_for_gemini(
        raw,
        "image/png",
        maximum_bytes=120_000,
        maximum_input_bytes=len(raw) + 1,
    )
    assert prepared is not None
    assert prepared.converted is True
    assert 0 < len(prepared.data) <= 120_000
    assert opened_size(prepared)[0] <= 1200


def test_pixel_and_dimension_limits_are_enforced() -> None:
    raw = image_bytes("RGB", (100, 100), "PNG", color="white")
    assert (
        prepare_image_for_gemini(raw, "image/png", maximum_pixels=9_999) is None
    )
    assert (
        prepare_image_for_gemini(raw, "image/png", maximum_dimension=99) is None
    )


def test_invalid_limit_configuration_raises() -> None:
    raw = image_bytes("RGB", (1, 1), "PNG")
    with pytest.raises(ValueError):
        prepare_image_for_gemini(raw, "image/png", maximum_bytes=0)
    with pytest.raises(ValueError):
        prepare_image_for_gemini(
            raw,
            "image/png",
            maximum_bytes=10,
            maximum_input_bytes=9,
        )


def box(box_type: bytes, payload: bytes) -> bytes:
    return (8 + len(payload)).to_bytes(4, "big") + box_type + payload


def test_heic_fallback_requires_ftyp_and_meta_boxes() -> None:
    ftyp = box(b"ftyp", b"heic" + b"\x00\x00\x00\x00" + b"mif1heic")
    meta = box(b"meta", b"\x00\x00\x00\x00")
    raw = ftyp + meta

    prepared = prepare_image_for_gemini(raw, "application/octet-stream")
    assert prepared == PreparedImage(raw, "image/heic", False)
    assert prepare_image_for_gemini(ftyp, "image/heic") is None


def test_avif_is_not_mislabeled_as_heif() -> None:
    ftyp = box(b"ftyp", b"avif" + b"\x00\x00\x00\x00" + b"mif1avif")
    meta = box(b"meta", b"\x00\x00\x00\x00")
    assert prepare_image_for_gemini(ftyp + meta, "image/heif") is None


def test_undecoded_heif_can_be_disabled() -> None:
    ftyp = box(b"ftyp", b"heic" + b"\x00\x00\x00\x00" + b"mif1heic")
    meta = box(b"meta", b"\x00\x00\x00\x00")
    assert (
        prepare_image_for_gemini(
            ftyp + meta,
            "image/heic",
            allow_undecoded_heif=False,
        )
        is None
    )


def test_recognized_decoder_failure_never_uses_heif_fallback(monkeypatch) -> None:
    import image_normalization as module

    ftyp = box(b"ftyp", b"heic" + b"\x00\x00\x00\x00" + b"mif1heic")
    meta = box(b"meta", b"\x00\x00\x00\x00")

    def fail_after_recognition(*args, **kwargs):
        raise ValueError("configured pixel limit")

    monkeypatch.setattr(module, "_prepare_with_pillow", fail_after_recognition)
    assert module.prepare_image_for_gemini(ftyp + meta, "image/heic") is None