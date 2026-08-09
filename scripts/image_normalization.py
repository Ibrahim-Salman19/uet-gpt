"""Prepare untrusted downloaded images for reliable Gemini vision requests.

The public entry point returns either a validated :class:`PreparedImage` or
``None``. It deliberately never trusts the HTTP ``Content-Type`` header:
Pillow-decoded images are identified from their bytes, while undecodable
HEIC/HEIF files are accepted only when their ISO-BMFF ``ftyp`` box identifies
an HEIC/HEIF brand.
"""

from __future__ import annotations

import io
import math
import warnings
from dataclasses import dataclass
from typing import Final

from PIL import Image, ImageOps, UnidentifiedImageError


GEMINI_IMAGE_MIME_TYPES: Final[frozenset[str]] = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"}
)

# Seven decimal MB is a conservative per-image default that also works with Vertex AI
# model endpoints that document a 7 MB inline/direct-upload image limit. The
# Gemini Developer API can accept larger total inline requests; callers using
# that API may explicitly raise this output bound while reserving room for the
# prompt, system instructions, JSON/base64 overhead, and other files.
DEFAULT_MAXIMUM_BYTES: Final[int] = 7_000_000
DEFAULT_MAXIMUM_INPUT_BYTES: Final[int] = 64 * 1024 * 1024
DEFAULT_MAXIMUM_PIXELS: Final[int] = 50_000_000
DEFAULT_MAXIMUM_DIMENSION: Final[int] = 32_768

_PIL_FORMAT_TO_MIME: Final[dict[str, str]] = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}

# HEIF is an ISO Base Media File Format family. AVIF files often also advertise
# the generic ``mif1`` brand, so AVIF must be excluded before accepting generic
# HEIF brands as Gemini-compatible HEIF input.
_HEIC_BRANDS: Final[frozenset[bytes]] = frozenset(
    {
        b"heic",
        b"heix",
        b"hevc",
        b"hevx",
        b"heim",
        b"heis",
        b"hevm",
        b"hevs",
    }
)
_HEIF_BRANDS: Final[frozenset[bytes]] = frozenset(
    {b"heif", b"mif1", b"msf1"}
)
_AVIF_BRANDS: Final[frozenset[bytes]] = frozenset({b"avif", b"avis"})

_LOSSLESS_FRIENDLY_FORMATS: Final[frozenset[str]] = frozenset(
    {"PNG", "GIF", "BMP", "ICO", "PCX", "PPM", "PBM", "PGM", "XBM"}
)
_JPEG_QUALITIES: Final[tuple[int, ...]] = (95, 92, 89, 86, 83, 80)
_MAX_RESIZE_ROUNDS: Final[int] = 8
_EXIF_ORIENTATION_TAG: Final[int] = 274


@dataclass(frozen=True)
class PreparedImage:
    """Validated bytes ready to place in a Gemini image part."""

    data: bytes
    mime_type: str
    converted: bool = False


def prepare_image_for_gemini(
    data: bytes | bytearray | memoryview,
    mime_type: str | None,
    *,
    maximum_bytes: int = DEFAULT_MAXIMUM_BYTES,
    maximum_input_bytes: int = DEFAULT_MAXIMUM_INPUT_BYTES,
    maximum_pixels: int = DEFAULT_MAXIMUM_PIXELS,
    maximum_dimension: int = DEFAULT_MAXIMUM_DIMENSION,
    allow_undecoded_heif: bool = True,
) -> PreparedImage | None:
    """Validate, orient, and size an image for a Gemini vision request.

    The supplied MIME type is treated only as a hint. For Pillow-readable
    images, the encoded format is identified from the bytes and the first frame
    is fully decoded. Single-frame JPEG, PNG, and WebP images are passed through
    unchanged only when they are valid, correctly oriented, and already within
    ``maximum_bytes``. Other raster formats, animated images, oversized images,
    and images requiring EXIF orientation are re-encoded as PNG or JPEG.

    PNG is retained for transparency and preferred for line art/screenshots.
    Opaque photographic images are encoded as high-quality progressive JPEG.
    If an encoding exceeds ``maximum_bytes``, quality is reduced only to 80
    before dimensions are reduced with Lanczos resampling, preserving OCR detail
    as far as practical.

    HEIC/HEIF files are decoded and normalized when a Pillow HEIF plugin is
    installed. Without a decoder, a file may still be passed through unchanged,
    but only if its ISO-BMFF brands identify HEIC/HEIF and it is already within
    the output byte bound. In that fallback path, decoding and orientation are
    delegated to Gemini because local dimensions and EXIF cannot be verified.

    Args:
        data: Downloaded image bytes.
        mime_type: Optional HTTP/content MIME type hint retained for caller API
            compatibility. The encoded bytes always determine the output type.
        maximum_bytes: Hard bound for returned raw image bytes.
        maximum_input_bytes: Hard bound for downloaded bytes accepted for local
            inspection or conversion.
        maximum_pixels: Maximum decoded width × height. This is an independent
            decompression-bomb and memory-safety bound.
        maximum_dimension: Maximum accepted width or height before decoding.
        allow_undecoded_heif: Permit container-validated HEIC/HEIF passthrough
            when Pillow has no decoder. Set this to ``False`` when local pixel
            and orientation validation is mandatory.

    Returns:
        A :class:`PreparedImage`, or ``None`` for empty, malformed, unsupported,
        unsafe, or unshrinkable input.

    Raises:
        ValueError: If any configured limit is not a positive integer, or if
            ``maximum_bytes`` exceeds ``maximum_input_bytes``.
    """

    _validate_limits(
        maximum_bytes=maximum_bytes,
        maximum_input_bytes=maximum_input_bytes,
        maximum_pixels=maximum_pixels,
        maximum_dimension=maximum_dimension,
    )
    if not isinstance(allow_undecoded_heif, bool):
        raise ValueError("allow_undecoded_heif must be a bool")
    if mime_type is not None and not isinstance(mime_type, str):
        return None

    if not isinstance(data, (bytes, bytearray, memoryview)):
        return None

    try:
        view = memoryview(data)
    except (TypeError, ValueError):
        return None

    if view.nbytes == 0 or view.nbytes > maximum_input_bytes:
        return None

    # Materialize a stable immutable buffer only when needed. Exact ``bytes``
    # instances are already immutable, so avoid doubling memory for large files.
    try:
        raw = data if type(data) is bytes else bytes(view.cast("B"))
    except (TypeError, ValueError, MemoryError):
        return None

    pillow_could_not_identify = False
    try:
        prepared = _prepare_with_pillow(
            raw,
            maximum_bytes=maximum_bytes,
            maximum_pixels=maximum_pixels,
            maximum_dimension=maximum_dimension,
        )
    except UnidentifiedImageError:
        # This is the expected outcome for HEIC/HEIF when no optional Pillow
        # decoder has been registered. Only this specific failure is eligible
        # for the conservative container-level passthrough below.
        prepared = None
        pillow_could_not_identify = True
    except Exception:
        # A decoder recognized the file but rejected it, a configured safety
        # limit fired, or a format-specific parser failed. Never bypass those
        # outcomes through the HEIF fallback.
        return None

    if prepared is not None:
        return prepared

    if not pillow_could_not_identify or not allow_undecoded_heif:
        # Pillow decoded the input but it could not be encoded under the output
        # bound, or strict local validation was requested. Raw passthrough would
        # violate the caller's policy.
        return None

    # Pillow commonly lacks HEIC/HEIF support unless an optional plugin is
    # installed. Never fall back merely because the server claimed a supported
    # MIME type: require a matching ISO-BMFF file signature and brand.
    detected_heif_mime = _sniff_heif_mime(raw)
    if detected_heif_mime is not None and len(raw) <= maximum_bytes:
        return PreparedImage(raw, detected_heif_mime, False)

    return None


def _prepare_with_pillow(
    raw: bytes,
    *,
    maximum_bytes: int,
    maximum_pixels: int,
    maximum_dimension: int,
) -> PreparedImage | None:
    """Prepare a Pillow-readable image, returning ``None`` on decode failure."""

    # Convert Pillow's warning-level bomb detection into an error. Our explicit
    # limits below are tighter and deterministic, but this also covers checks
    # emitted by individual format plugins while parsing nested images.
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)

        with Image.open(io.BytesIO(raw)) as verifier:
            source_format = (verifier.format or "").upper()
            _validate_dimensions(
                verifier.size,
                maximum_pixels=maximum_pixels,
                maximum_dimension=maximum_dimension,
            )
            verifier.verify()

        # ``verify()`` invalidates the image object, so reopen before decoding.
        with Image.open(io.BytesIO(raw)) as opened:
            source_format = (opened.format or source_format).upper()
            _validate_dimensions(
                opened.size,
                maximum_pixels=maximum_pixels,
                maximum_dimension=maximum_dimension,
            )

            opened.seek(0)
            is_multiframe = bool(getattr(opened, "is_animated", False)) or int(
                getattr(opened, "n_frames", 1)
            ) > 1

            try:
                orientation = opened.getexif().get(_EXIF_ORIENTATION_TAG, 1)
            except Exception:
                # Bad EXIF is not a reason to discard otherwise decodable pixels,
                # but it is a reason not to pass the original metadata through.
                orientation = 0

            try:
                image = ImageOps.exif_transpose(opened)
            except Exception:
                # Some malformed metadata can make EXIF parsing fail even though
                # the pixel stream itself is valid. Decode the first frame and
                # strip all metadata by re-encoding rather than rejecting it.
                opened.load()
                image = opened.copy()
                orientation = 0
            image.load()
            _validate_dimensions(
                image.size,
                maximum_pixels=maximum_pixels,
                maximum_dimension=maximum_dimension,
            )

            actual_mime = _mime_for_decoded_format(source_format, raw)
            can_passthrough = (
                actual_mime in GEMINI_IMAGE_MIME_TYPES
                and not is_multiframe
                and orientation in (None, 1)
                and len(raw) <= maximum_bytes
            )
            if can_passthrough:
                return PreparedImage(raw, actual_mime, False)

            # Detach pixel storage from the source stream before leaving the
            # context manager. ``copy`` also prevents subsequent operations from
            # retaining untrusted metadata objects tied to the decoder.
            detached = image.copy()

    prefer_lossless = (
        _has_transparency(detached)
        or source_format in _LOSSLESS_FRIENDLY_FORMATS
        or detached.mode in {"1", "P"}
    )
    encoded = _encode_within_bound(
        detached,
        maximum_bytes=maximum_bytes,
        prefer_lossless=prefer_lossless,
    )
    detached.close()
    return encoded


def _encode_within_bound(
    image: Image.Image,
    *,
    maximum_bytes: int,
    prefer_lossless: bool,
) -> PreparedImage | None:
    """Encode an image under ``maximum_bytes`` without unbounded retries."""

    transparent = _has_transparency(image)
    current = image.convert("RGBA" if transparent else "RGB")

    try:
        for _ in range(_MAX_RESIZE_ROUNDS + 1):
            if transparent or prefer_lossless:
                png = _encode_png(current)
                if png and len(png) <= maximum_bytes:
                    return PreparedImage(png, "image/png", True)

                # Opaque line art/screenshots may still be more useful at full
                # resolution as a high-quality JPEG than as a heavily downscaled
                # PNG. Never discard alpha by taking this fallback.
                if not transparent:
                    jpeg, smallest_size = _encode_jpeg_at_best_quality(
                        current, maximum_bytes=maximum_bytes
                    )
                    if jpeg is not None:
                        return PreparedImage(jpeg, "image/jpeg", True)
                    reference_size = smallest_size or (len(png) if png else None)
                else:
                    reference_size = len(png) if png else None
            else:
                jpeg, reference_size = _encode_jpeg_at_best_quality(
                    current, maximum_bytes=maximum_bytes
                )
                if jpeg is not None:
                    return PreparedImage(jpeg, "image/jpeg", True)

            resized = _resize_for_byte_target(
                current,
                maximum_bytes=maximum_bytes,
                encoded_size=reference_size,
            )
            if resized is None:
                return None

            if current is not image:
                current.close()
            current = resized

        return None
    finally:
        if current is not image:
            current.close()


def _encode_jpeg_at_best_quality(
    image: Image.Image,
    *,
    maximum_bytes: int,
) -> tuple[bytes | None, int | None]:
    """Return the highest configured JPEG quality that fits the byte bound."""

    smallest_size: int | None = None
    for quality in _JPEG_QUALITIES:
        payload = _encode_jpeg(image, quality=quality)
        if not payload:
            continue
        smallest_size = len(payload)
        if smallest_size <= maximum_bytes:
            return payload, smallest_size
    return None, smallest_size


def _encode_jpeg(image: Image.Image, *, quality: int) -> bytes | None:
    output = io.BytesIO()
    try:
        image.save(
            output,
            format="JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
            subsampling=0,
        )
    except OSError:
        # Some libjpeg builds cannot optimize very large images. A standards-
        # compliant non-optimized fallback is preferable to rejecting the file.
        output = io.BytesIO()
        try:
            image.save(
                output,
                format="JPEG",
                quality=quality,
                optimize=False,
                progressive=False,
                subsampling=0,
            )
        except (OSError, ValueError):
            return None
    except ValueError:
        return None
    return output.getvalue()


def _encode_png(image: Image.Image) -> bytes | None:
    output = io.BytesIO()
    try:
        # ``optimize=True`` makes Pillow use its strongest PNG compression; no
        # EXIF, ICC, XMP, comments, or arbitrary source text chunks are copied.
        image.save(output, format="PNG", optimize=True)
    except (OSError, ValueError):
        return None
    return output.getvalue()


def _resize_for_byte_target(
    image: Image.Image,
    *,
    maximum_bytes: int,
    encoded_size: int | None,
) -> Image.Image | None:
    """Downscale based on the encoded-size ratio, with guaranteed progress."""

    width, height = image.size
    if width <= 1 and height <= 1:
        return None

    if encoded_size and encoded_size > 0:
        estimated = math.sqrt(maximum_bytes / encoded_size) * 0.94
        factor = min(0.85, max(0.50, estimated))
    else:
        factor = 0.75

    new_width = max(1, int(width * factor))
    new_height = max(1, int(height * factor))

    if (new_width, new_height) == (width, height):
        if width >= height and width > 1:
            new_width -= 1
        elif height > 1:
            new_height -= 1
        else:
            return None

    try:
        return image.resize(
            (new_width, new_height),
            resample=Image.Resampling.LANCZOS,
            reducing_gap=3.0,
        )
    except (MemoryError, OSError, ValueError):
        return None


def _has_transparency(image: Image.Image) -> bool:
    if "A" in image.getbands():
        try:
            alpha_min, alpha_max = image.getchannel("A").getextrema()
            return alpha_min < 255 or alpha_max < 255
        except (ValueError, OSError):
            return True
    return image.mode == "P" and "transparency" in image.info


def _validate_limits(
    *,
    maximum_bytes: int,
    maximum_input_bytes: int,
    maximum_pixels: int,
    maximum_dimension: int,
) -> None:
    limits = {
        "maximum_bytes": maximum_bytes,
        "maximum_input_bytes": maximum_input_bytes,
        "maximum_pixels": maximum_pixels,
        "maximum_dimension": maximum_dimension,
    }
    for name, value in limits.items():
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ValueError(f"{name} must be a positive integer")
    if maximum_bytes > maximum_input_bytes:
        raise ValueError("maximum_bytes cannot exceed maximum_input_bytes")


def _validate_dimensions(
    size: tuple[int, int],
    *,
    maximum_pixels: int,
    maximum_dimension: int,
) -> None:
    width, height = size
    if width <= 0 or height <= 0:
        raise ValueError("image dimensions must be positive")
    if width > maximum_dimension or height > maximum_dimension:
        raise ValueError("image dimension exceeds configured limit")
    if width * height > maximum_pixels:
        raise ValueError("image pixel count exceeds configured limit")


def _mime_for_decoded_format(source_format: str, raw: bytes) -> str | None:
    mime = _PIL_FORMAT_TO_MIME.get(source_format)
    if mime is not None:
        return mime
    if source_format in {"HEIF", "HEIC"}:
        return _sniff_heif_mime(raw)
    return None


def _sniff_heif_mime(data: bytes) -> str | None:
    """Conservatively identify HEIC/HEIF from ISO-BMFF top-level boxes.

    A matching ``ftyp`` brand alone is too easy to spoof. This fallback also
    requires a structurally valid top-level ``meta`` box, which is fundamental
    to HEIF item storage. It is still only a container-level validation; Gemini
    remains responsible for full decoding when no local HEIF plugin is present.
    """

    offset = 0
    scan_end = min(len(data), 1024 * 1024)
    brands: set[bytes] | None = None
    has_meta_box = False

    while offset + 8 <= len(data) and offset < scan_end:
        size32 = int.from_bytes(data[offset : offset + 4], "big")
        box_type = data[offset + 4 : offset + 8]
        header_size = 8

        if size32 == 1:
            if offset + 16 > len(data):
                return None
            box_size = int.from_bytes(data[offset + 8 : offset + 16], "big")
            header_size = 16
        elif size32 == 0:
            box_size = len(data) - offset
        else:
            box_size = size32

        if box_size < header_size or offset + box_size > len(data):
            return None

        if box_type == b"ftyp":
            payload_start = offset + header_size
            payload_end = offset + box_size
            if payload_end - payload_start < 8:
                return None

            major_brand = data[payload_start : payload_start + 4]
            compatible_start = payload_start + 8
            compatible = {
                data[index : index + 4]
                for index in range(compatible_start, payload_end - 3, 4)
            }
            brands = compatible | {major_brand}

        elif box_type == b"meta":
            # FullBox ``meta`` requires at least four bytes of version/flags.
            if box_size < header_size + 4:
                return None
            has_meta_box = True

        if brands is not None and has_meta_box:
            break

        offset += box_size

    if brands is None or not has_meta_box:
        return None
    if brands & _AVIF_BRANDS:
        return None
    if brands & _HEIC_BRANDS:
        return "image/heic"
    if brands & _HEIF_BRANDS:
        return "image/heif"
    return None