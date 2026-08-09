"""Reliable, high-recall HTML extraction for the UET Taxila RAG crawler.

Live-site-maximal hardened edition (August 2026).

The module is intentionally independent of crawler orchestration.  It accepts a
small URL-policy protocol and returns:

* normalized Markdown from the meaningful *active* DOM;
* crawlable URLs discovered from anchors and secondary navigation mechanisms;
* a resource manifest for documents, media, forms, and external references;
* ranked informational image candidates for optional vision transcription;
* integer diagnostics suitable for logs, audits, and regression tests.

UET's public sites retain superseded notices inside HTML comments while current
student-critical notices can start inside hidden Bootstrap modals, accordions,
tabs, and collapse panels.  Comments and inert templates are therefore removed,
but content is never discarded merely because it initially has ``hidden``,
``aria-hidden=true``, ``display:none``, or ``visibility:hidden``.

Discovery is completed before scripts, frames, forms, and embedded-document
containers are removed from the Markdown tree.  This ordering preserves JSON-LD
URLs, pagination, meta refreshes, GET-form destinations, iframe/object/embed
pages, safe data attributes, and conservative JavaScript navigation routes
without indexing executable source code.
"""

from __future__ import annotations

import codecs
import hashlib
import heapq
import html as html_stdlib
import ipaddress
import itertools
import json
import re
import unicodedata
import urllib.parse
import warnings
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import PurePosixPath
from typing import Any, Iterable, Iterator, Protocol, Sequence

from bs4 import (
    BeautifulSoup,
    Comment,
    MarkupResemblesLocatorWarning,
    Tag,
    UnicodeDammit,
)
import markdownify

try:
    import idna as _idna  # IDNA 2008 with optional UTS #46 processing.
except ImportError:  # pragma: no cover - conservative standard-library fallback.
    _idna = None

try:
    import tinycss2 as _tinycss2  # Standards-shaped CSS tokenization when available.
except ImportError:  # pragma: no cover - regex fallback remains bounded.
    _tinycss2 = None

class _SafeMarkdownConverter(markdownify.MarkdownConverter):
    """Markdownify converter that emits angle-bracketed link destinations."""

    def convert_a(self, el: Tag, text: str, parent_tags: Any) -> str:  # type: ignore[override]
        if parent_tags and "_noformat" in parent_tags:
            return text
        prefix_length = len(text) - len(text.lstrip())
        suffix_length = len(text) - len(text.rstrip())
        prefix = text[:prefix_length]
        suffix = text[len(text) - suffix_length :] if suffix_length else ""
        core_end = len(text) - suffix_length if suffix_length else len(text)
        core = text[prefix_length:core_end]
        if not core:
            return ""
        href = str(el.get("href") or "").strip()
        if not href:
            return text
        try:
            scheme = urllib.parse.urlsplit(href).scheme.casefold()
        except (ValueError, UnicodeError):
            return text
        if not (href.startswith("#") or scheme in {"http", "https", "mailto", "tel"}):
            return text
        # Angle destinations avoid Markdown ambiguity from parentheses in valid
        # URLs. Literal angle brackets are encoded defensively.
        safe_href = href.replace("<", "%3C").replace(">", "%3E")
        return f"{prefix}[{core}](<{safe_href}>){suffix}"


try:  # Production installs Trafilatura; tests can use the complete DOM path.
    import trafilatura  # type: ignore
except ImportError:  # pragma: no cover - exercised only in dependency-light runs.
    trafilatura = None  # type: ignore[assignment]
except Exception:  # pragma: no cover - optional extractor must not break crawling.
    trafilatura = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


class UrlPolicyLike(Protocol):
    """Minimal URL-policy interface required by this extractor."""

    def canonicalize(self, url: str) -> str: ...

    def is_crawl_candidate(self, url: str) -> bool: ...

    def is_network_target(self, url: str) -> bool: ...


@dataclass(frozen=True)
class HtmlExtractorOptions:
    """High-recall extraction and discovery controls.

    Defaults are deliberately bounded so one malformed page cannot create an
    unbounded amount of work.  Existing crawler call sites can keep constructing
    this dataclass with only the original fields.
    """

    # Hard resource limits are applied before expensive decoding/parsing and
    # before emitting large manifests.  A value of zero disables that category,
    # except ``max_input_bytes`` where zero falls back to the safe default.
    max_input_bytes: int = 25_000_000
    max_url_characters: int = 8_192
    max_contact_scan_characters: int = 2_000_000
    max_manifest_items: int = 150
    max_image_candidates: int = 8
    max_resource_links: int = 500
    max_discovered_links: int = 5_000
    include_footer_contacts: bool = True
    include_resource_manifest: bool = True
    include_visual_manifest: bool = True
    preserve_generic_links: bool = True
    follow_nofollow_links: bool = False
    avoid_state_changing_routes: bool = True

    discover_link_relations: bool = True
    discover_meta_refresh: bool = True
    discover_meta_urls: bool = True
    discover_get_forms: bool = True
    discover_embedded_documents: bool = True
    discover_data_attribute_urls: bool = True
    discover_inline_script_urls: bool = True
    discover_json_ld_urls: bool = True
    discover_microdata_urls: bool = True
    discover_rdfa_urls: bool = True
    discover_inline_style_images: bool = True

    max_inline_script_chars: int = 2_000_000
    max_inline_script_blocks: int = 500
    max_embedded_json_nodes: int = 20_000
    max_inline_style_chars: int = 1_000_000
    max_json_ld_chars: int = 1_000_000
    max_json_ld_nodes: int = 10_000
    max_json_ld_scripts: int = 100
    max_attribute_structured_nodes: int = 20_000
    max_structured_facts: int = 80
    max_supplemental_blocks: int = 80
    max_hidden_input_value_chars: int = 16_384

    # Applied only after URL/metadata discovery.  Broad selectors capable of
    # deleting live admission notices are ignored defensively.
    remove_selectors: tuple[str, ...] = ()
    minimum_block_chars_for_global_dedup: int = 80

    generic_image_alt_values: tuple[str, ...] = (
        "image",
        "photo",
        "picture",
        "main campus",
        "banner",
        "advertisement",
        "ad",
    )
    high_value_image_keywords: tuple[str, ...] = (
        "admission",
        "admissions",
        "advertisement",
        "apply",
        "deadline",
        "ecat",
        "eligibility",
        "fee",
        "fees",
        "merit",
        "notice",
        "program",
        "programs",
        "prospectus",
        "schedule",
        "seat",
        "tcat",
        "technology",
    )
    low_value_image_keywords: tuple[str, ...] = (
        "avatar",
        "campus-life",
        "gallery",
        "icon",
        "logo",
        "portrait",
        "profile",
        "staff",
        "thumbnail",
    )

    # Appended to preserve the positional order of every pre-existing option.
    # Keyword construction is strongly preferred for forward compatibility.
    max_trafilatura_tree_size: int = 200_000
    robots_meta_names: tuple[str, ...] = ("robots",)

    # Live UET estate adaptations. These are appended to preserve the complete
    # positional contract of older call sites.
    enable_uet_site_profiles: bool = True
    enable_parser_recovery: bool = True
    include_resource_context_dates: bool = True
    max_contextual_link_characters: int = 700
    max_inline_embedded_html_chars: int = 500_000
    max_priority_resource_candidates: int = 5_000
    discover_visible_text_urls: bool = True
    max_visible_text_url_characters: int = 1_000_000
    max_visible_text_urls: int = 250

    # Legacy UET/Dreamweaver and modern static-request discovery. Appended to
    # preserve positional compatibility with every earlier option field.
    discover_legacy_script_hrefs: bool = True
    discover_legacy_select_navigation: bool = True
    discover_static_get_requests: bool = True
    max_legacy_navigation_options: int = 1_000
    max_script_navigation_matches: int = 2_000


@dataclass(frozen=True)
class HtmlResourceLink:
    url: str
    text: str
    kind: str
    crawlable: bool
    nofollow: bool = False


@dataclass(frozen=True)
class HtmlImageCandidate:
    url: str
    alt_text: str
    context: str
    score: float
    source: str = "img"


@dataclass
class HtmlExtractionResult:
    canonical_url: str
    title: str
    markdown: str
    crawl_links: list[str]
    resources: list[HtmlResourceLink] = field(default_factory=list)
    image_candidates: list[HtmlImageCandidate] = field(default_factory=list)
    diagnostics: dict[str, int] = field(default_factory=dict)

    @property
    def word_count(self) -> int:
        return len(self.markdown.split())

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.markdown.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Constants and bounded parsers
# ---------------------------------------------------------------------------


_UET_SITE_GENERIC = 0
_UET_SITE_MAIN = 1
_UET_SITE_ADMISSIONS = 2
_UET_SITE_LEGACY = 3
_UET_SITE_FMS = 4
_UET_SITE_PORTAL = 5

_UET_HOST_SUFFIX = "uettaxila.edu.pk"
_UET_IMPORTANT_RESOURCE_KEYWORDS = (
    "academic calendar", "admission", "advertisement", "application form",
    "challan", "curriculum", "date sheet", "deadline", "download", "dues",
    "eligibility", "entry test", "ecat", "faq", "fee", "job", "merit",
    "migration", "notice", "notification", "prospectus", "result",
    "schedule", "scholarship", "seat", "staff required", "tcat", "tender",
)
_UET_LOW_VALUE_EXTERNAL_HOSTS = frozenset(
    {
        "facebook.com", "www.facebook.com", "instagram.com", "www.instagram.com",
        "linkedin.com", "www.linkedin.com", "twitter.com", "x.com",
        "www.freepik.com", "youtube.com", "www.youtube.com",
    }
)
_UET_DATE_RE = re.compile(
    r"(?<!\d)(?:"
    r"(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}"
    r"|(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])"
    r"|(?:0?[1-9]|[12]\d|3[01])\s*(?:st|nd|rd|th)?\s+"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"(?:,)?\s+(?:19|20)\d{2}"
    r"|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
    r"\s+(?:0?[1-9]|[12]\d|3[01])\s*(?:st|nd|rd|th)?(?:,)?\s+(?:19|20)\d{2}"
    r")",
    re.I,
)

_GENERIC_FILENAME_LABELS = frozenset({"index", "default", "home", "page", "main"})

_GENERIC_LINK_TEXT = frozenset(
    {
        "apply",
        "apply now",
        "click",
        "click here",
        "details",
        "download",
        "image",
        "learn more",
        "more",
        "open",
        "read more",
        "register",
        "view",
        "view advertisement",
        "view details",
    }
)

_RESOURCE_EXTENSIONS = {
    ".pdf": "pdf",
    ".doc": "document",
    ".docx": "document",
    ".odt": "document",
    ".rtf": "document",
    ".txt": "document",
    ".md": "document",
    ".markdown": "document",
    ".ics": "calendar",
    ".xls": "spreadsheet",
    ".xlsx": "spreadsheet",
    ".ods": "spreadsheet",
    ".csv": "data",
    ".json": "data",
    ".xml": "data",
    ".yaml": "data",
    ".yml": "data",
    ".ppt": "presentation",
    ".pptx": "presentation",
    ".odp": "presentation",
    ".epub": "ebook",
    ".zip": "archive",
    ".rar": "archive",
    ".7z": "archive",
    ".tar": "archive",
    ".gz": "archive",
    ".tgz": "archive",
    ".bz2": "archive",
    ".xz": "archive",
    ".mp4": "video",
    ".webm": "video",
    ".avi": "video",
    ".mov": "video",
    ".mkv": "video",
    ".m4v": "video",
    ".mp3": "audio",
    ".wav": "audio",
    ".ogg": "audio",
    ".m4a": "audio",
    ".aac": "audio",
    ".flac": "audio",
    ".avif": "image",
    ".heic": "image",
    ".heif": "image",
    ".jpg": "image",
    ".jpeg": "image",
    ".jxl": "image",
    ".png": "image",
    ".webp": "image",
    ".gif": "image",
    ".bmp": "image",
    ".tif": "image",
    ".tiff": "image",
    ".svg": "image",
}

_IMAGE_EXTENSIONS = frozenset(
    {
        ".avif",
        ".bmp",
        ".gif",
        ".heic",
        ".heif",
        ".jpeg",
        ".jpg",
        ".jxl",
        ".png",
        ".svg",
        ".tif",
        ".tiff",
        ".webp",
    }
)
_VISION_IMAGE_EXTENSIONS = frozenset(
    {
        ".avif",
        ".bmp",
        ".gif",
        ".heic",
        ".heif",
        ".jpeg",
        ".jpg",
        ".png",
        ".tif",
        ".tiff",
        ".webp",
    }
)
_STATIC_ASSET_EXTENSIONS = frozenset(
    {
        ".css",
        ".js",
        ".mjs",
        ".map",
        ".woff",
        ".woff2",
        ".ttf",
        ".otf",
        ".eot",
        ".ico",
        ".cur",
    }
)

# Inert templates can contain stale/sample routes and must be removed before
# discovery.  The remaining discovery-bearing nodes are removed only from the
# cloned Markdown tree after their URLs and structured data have been harvested.
_INERT_SOURCE_TAGS = ("template",)
_VALID_BUILTIN_SHADOW_HOSTS = frozenset(
    {
        "article", "aside", "blockquote", "body", "div", "footer",
        "h1", "h2", "h3", "h4", "h5", "h6", "header", "main",
        "nav", "p", "section", "span",
    }
)
_RESERVED_CUSTOM_ELEMENT_NAMES = frozenset(
    {
        "annotation-xml", "color-profile", "font-face", "font-face-src",
        "font-face-uri", "font-face-format", "font-face-name",
        "missing-glyph",
    }
)
_DISCOVERY_ONLY_TAGS = (
    "script",
    "style",
    "noscript",
    "iframe",
    "frame",
    "object",
    "embed",
    "canvas",
    "video",
    "audio",
    "source",
    "track",
)

_UI_ONLY_SELECTORS = (
    ".modal-backdrop",
    ".offcanvas-backdrop",
    ".btn-close",
    "[data-bs-dismiss=modal]",
    "[data-dismiss=modal]",
    "[aria-label='Close' i]",
    "[class*='cookie-banner' i]",
    "[id*='cookie-banner' i]",
    "[class*='cookie-consent' i]",
    "[id*='cookie-consent' i]",
)

# Never allow a generic boilerplate configuration to erase these containers;
# UET pages use them for current merit lists, deadlines, and fee notices.
_PROTECTED_SELECTOR_TOKENS = (
    "modal",
    "dialog",
    "announcement",
    "notice",
    "alert",
    "accordion",
    "tab-content",
    "collapse",
    "role=alert",
    "aria-live",
)

_DATA_URL_ATTRIBUTES = frozenset(
    {
        "hx-get",
        "data-hx-get",
        "data-url",
        "data-href",
        "data-link",
        "data-action",
        "data-route",
        "data-page-url",
        "data-target-url",
        "data-download",
        "data-file",
        "data-document",
    }
)

_UNSAFE_ACTION_NAMES = frozenset(
    {
        "delete",
        "destroy",
        "remove",
        "logout",
        "logoff",
        "signout",
        "unsubscribe",
        "approve",
        "reject",
        "activate",
        "deactivate",
        "reset",
        "purge",
    }
)
_UNSAFE_ACTION_QUERY_KEYS = frozenset(
    {"action", "do", "cmd", "command", "operation", "op", "task"}
)

_EMBEDDED_RESOURCE_ATTRS = {
    "iframe": ("src", "data-src", "data-url"),
    "frame": ("src",),
    "object": ("data", "data-src"),
    "embed": ("src", "data-src"),
    "input": ("src",),
}

_LINK_RELATIONS = frozenset(
    {
        "alternate",
        "bookmark",
        "canonical",
        "help",
        "license",
        "sitemap",
        "archives",
        "first",
        "last",
        "up",
        "index",
        "contents",
        "chapter",
        "section",
        "subsection",
        "shortlink",
        "next",
        "prev",
        "previous",
        "privacy-policy",
        "terms-of-service",
    }
)

_JSON_URL_KEYS = frozenset(
    {
        "@id",
        "url",
        "sameas",
        "mainentityofpage",
        "contenturl",
        "embedurl",
        "thumbnailurl",
        "significantlink",
        "relatedlink",
        "subjectof",
        "ispartof",
    }
)
_JSON_IMAGE_KEYS = frozenset({"image", "logo", "thumbnail", "photo"})
_JSON_IMAGE_URL_KEYS = frozenset({"@id", "url", "contenturl", "embedurl", "thumbnailurl"})
_JSON_FACT_KEYS = {
    "@type": "Type",
    "name": "Name",
    "headline": "Headline",
    "description": "Description",
    "startdate": "Start date",
    "enddate": "End date",
    "datepublished": "Published",
    "datemodified": "Modified",
    "applicationdeadline": "Application deadline",
    "telephone": "Telephone",
    "email": "Email",
    "educationalcredentialawarded": "Credential",
    "price": "Price",
    "pricecurrency": "Currency",
    "eventstatus": "Event status",
    "streetaddress": "Street address",
    "addresslocality": "Locality",
    "addressregion": "Region",
    "postalcode": "Postal code",
}

# URL-valued structured-data properties.  Property names are normalized from
# plain names, compact IRIs (``schema:url``), and absolute vocabulary URLs.
_STRUCTURED_URL_PROPERTIES = frozenset(
    {
        "url",
        "sameas",
        "mainentityofpage",
        "contenturl",
        "embedurl",
        "thumbnailurl",
        "significantlink",
        "relatedlink",
        "subjectof",
        "ispartof",
        "image",
        "logo",
        "photo",
        "item",
        "downloadurl",
        "discussionurl",
        "license",
    }
)

_STRUCTURED_FACT_KEYS = {
    **_JSON_FACT_KEYS,
    "title": "Title",
    "datecreated": "Created",
    "expires": "Expires",
    "validfrom": "Valid from",
    "validthrough": "Valid through",
    "doorTime": "Door time",
    "organizer": "Organizer",
    "provider": "Provider",
    "location": "Location",
    "address": "Address",
    "openinghours": "Opening hours",
    "price": "Price",
    "pricecurrency": "Currency",
}
# Normalize the one mixed-case literal above once at import time.
_STRUCTURED_FACT_KEYS = {key.casefold(): value for key, value in _STRUCTURED_FACT_KEYS.items()}

_META_FACTS = {
    "description": "Description",
    "author": "Author",
    "date": "Date",
    "dcterms.date": "Date",
    "article:published_time": "Published",
    "article:modified_time": "Modified",
    "og:description": "Description",
    "citation_title": "Title",
    "citation_author": "Author",
    "citation_publication_date": "Published",
    "citation_date": "Published",
    "dc.date": "Date",
    "dc.creator": "Author",
    "dcterms.created": "Created",
    "dcterms.modified": "Modified",
}

_META_URL_PROPERTIES = {
    # value: (manifest label, may enter crawl frontier, require path/URL syntax)
    "og:url": ("Open Graph URL", True, False),
    "twitter:url": ("Twitter card URL", True, False),
    "article:author": ("Article author", True, True),
    "article:publisher": ("Article publisher", True, True),
    "og:video": ("Open Graph video", False, False),
    "og:video:url": ("Open Graph video", False, False),
    "og:video:secure_url": ("Open Graph video", False, False),
    "og:audio": ("Open Graph audio", False, False),
    "og:audio:url": ("Open Graph audio", False, False),
    "og:audio:secure_url": ("Open Graph audio", False, False),
    "og:see_also": ("Related page", True, False),
    "twitter:player": ("Twitter player", False, False),
    "twitter:player:stream": ("Twitter player stream", False, False),
    "citation_pdf_url": ("Citation PDF", False, False),
    "citation_public_url": ("Citation public URL", True, False),
    "dc.identifier": ("Dublin Core identifier", True, True),
    "dcterms.relation": ("Dublin Core relation", True, True),
}

# Conservative navigation patterns. Generic quoted strings are intentionally not
# harvested because bundles contain thousands of API paths and static assets.
_JS_STRING_LITERAL_PATTERN = (
    r"(?P<literal>'(?:\\.|[^'\\\r\n])*'|"
    r'"(?:\\.|[^"\\\r\n])*"|'
    r"`(?:\\.|[^`\\])*`)"
)
_SCRIPT_NAVIGATION_PATTERNS = (
    re.compile(
        r"(?:(?:window|document|top|self)\s*\.\s*)?location"
        r"(?:\s*\.\s*href)?\s*=\s*" + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
    re.compile(
        r"(?:(?:window|document|top|self)\s*\.\s*)?location"
        r"\s*\.\s*(?:assign|replace)\s*\(\s*" + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
    re.compile(
        r"(?:window\s*\.\s*)?open\s*\(\s*" + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
    re.compile(
        r"(?:router\s*\.\s*(?:push|replace)|navigate)\s*\(\s*"
        + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
    re.compile(
        r"history\s*\.\s*(?:pushState|replaceState)\s*\("
        r"(?:[^,()]|\([^)]*\))*?,(?:[^,()]|\([^)]*\))*?,\s*"
        + _JS_STRING_LITERAL_PATTERN,
        re.I | re.S,
    ),
    re.compile(
        r"(?:openImage|showImage|viewImage|openNotice|showNotice|"
        r"openDocument|viewDocument|loadPage|goTo|redirectTo|"
        r"MM_openBrWindow|openWin|openWindow|newWindow|NewWindow|"
        r"popUp|popup|openPopup|showModalDialog)"
        r"\s*\(\s*" + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
)

# Read-only network requests can expose server-rendered fragments that are not
# linked in the DOM (for example UET's examinations ``LoadResults`` endpoint).
# Patterns are deliberately restricted to explicit GET helpers or a bare
# one-argument ``fetch()`` call, whose default method is GET.
_SCRIPT_STATIC_GET_PATTERNS = (
    re.compile(
        r"\bfetch\s*\(\s*" + _JS_STRING_LITERAL_PATTERN + r"\s*\)",
        re.I,
    ),
    re.compile(
        r"\bfetch\s*\(\s*" + _JS_STRING_LITERAL_PATTERN
        + r"\s*,\s*\{(?=[^{}]{0,2000}\bmethod\s*:\s*['\"]GET['\"])[^{}]{0,2000}\}\s*\)",
        re.I | re.S,
    ),
    re.compile(
        r"(?:\baxios\s*\.\s*get|(?:\$|jQuery)\s*\.\s*"
        r"(?:get|getJSON))\s*\(\s*" + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
    re.compile(
        r"\b[A-Za-z_$][A-Za-z0-9_$]*\s*\.\s*open\s*\(\s*"
        r"['\"]GET['\"]\s*,\s*" + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
    re.compile(
        r"(?:\$|jQuery)\s*\.\s*ajax\s*\(\s*\{"
        r"(?=[^{}]{0,2000}\b(?:method|type)\s*:\s*['\"]GET['\"])"
        r"(?=[^{}]{0,2000}\burl\s*:\s*" + _JS_STRING_LITERAL_PATTERN + r")"
        r"[^{}]{0,2000}\}\s*\)",
        re.I | re.S,
    ),
    re.compile(
        r"\bhtmx\s*\.\s*ajax\s*\(\s*['\"]GET['\"]\s*,\s*"
        + _JS_STRING_LITERAL_PATTERN,
        re.I,
    ),
)
_SCRIPT_ROUTE_PROPERTY_RE = re.compile(
    r"(?:['\"]?(?:url|urls|href|path|pathname|route|redirect|destination)['\"]?)"
    r"\s*:\s*" + _JS_STRING_LITERAL_PATTERN,
    re.I,
)

_CONTENT_TYPE_CHARSET_RE = re.compile(
    r"charset\s*=\s*[\"']?([^;\s\"']+)", re.I
)
_HTML_TAG_OPEN_RE = re.compile(r"<\s*(/?)\s*([A-Za-z][A-Za-z0-9:-]*)")
_HTML_ATTRIBUTE_RE = re.compile(
    r"(?P<name>[^\s=/>]+)(?:\s*=\s*(?:"
    r"(?P<quote>['\"])(?P<quoted>.*?)\2|"
    r"(?P<unquoted>[^\s>]+)))?",
    re.S,
)
_ASPNET_STATE_NAME_RE = re.compile(
    r"^__(?:VIEWSTATE(?:FIELDCOUNT|GENERATOR)?\d*|EVENTVALIDATION|"
    r"EVENTTARGET|EVENTARGUMENT|LASTFOCUS|SCROLLPOSITION[XY])$",
    re.I,
)
_META_REFRESH_RE = re.compile(
    r"^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*"
    r"(?:(['\"])(?P<quoted>.*?)\1|(?P<bare>.+?))\s*$",
    re.I | re.S,
)
_CONTACT_EMAIL_RE = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.I)
_VISIBLE_HTTP_URL_RE = re.compile(r"https?://[^\s<>\"'`]+", re.I)
_VISIBLE_BARE_UET_URL_RE = re.compile(
    r"(?<![A-Z0-9@/])(?:[A-Z0-9-]+\.)*uettaxila\.edu\.pk"
    r"(?:/[^\s<>\"'`]*)?",
    re.I,
)
_CONTACT_PHONE_RE = re.compile(r"(?<!\w)\+?\d[\d\s().\-/]{5,}\d(?!\w)")
_CSS_URL_RE = re.compile(r"url\(\s*(['\"]?)(?P<url>.*?)\1\s*\)", re.I)
_MARKDOWN_LINK_RE = re.compile(
    r"!?\[([^\]]*)\]\((?:<[^>\n]*>|[^)\n]+)\)"
)
_WORD_RE = re.compile(r"[^\W_]+(?:['’\-][^\W_]+)*", re.UNICODE)


# ---------------------------------------------------------------------------
# Defensive helpers
# ---------------------------------------------------------------------------


def _bounded_nonnegative(value: int, default: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return min(max(0, parsed), maximum)


def _bounded_positive(
    value: int,
    default: int,
    maximum: int,
    *,
    minimum: int = 1,
) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError, OverflowError):
        return default
    if parsed < minimum:
        return default
    return min(parsed, maximum)


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _bounded_string_tuple(value: Any, maximum: int = 1_000) -> tuple[str, ...]:
    """Normalize an option sequence while resisting strings/invalid iterables."""

    limit = _bounded_positive(maximum, 1_000, 10_000)
    if value is None:
        return ()
    if isinstance(value, str):
        return (value,) if value else ()
    output: list[str] = []
    try:
        iterator = iter(value)
    except TypeError:
        return ()
    for item in iterator:
        if len(output) >= limit:
            break
        text = str(item or "").strip()
        if text:
            output.append(text)
    return tuple(output)


def _bounded_text(node: Tag, maximum: int = 500) -> str:
    """Return normalized descendant text without materializing an unbounded string."""

    limit = _bounded_positive(maximum, 500, 2_000_000)
    chunks: list[str] = []
    length = 0
    try:
        strings = node.stripped_strings
        for raw in strings:
            chunk = _normalize_space(str(raw))
            if not chunk:
                continue
            separator = 1 if chunks else 0
            remaining = limit - length - separator
            if remaining <= 0:
                break
            chunks.append(chunk[:remaining])
            length += separator + min(len(chunk), remaining)
            if length >= limit:
                break
    except Exception:
        return ""
    return " ".join(chunks).strip()


def _detect_uet_site_family(url: str, soup: BeautifulSoup | None = None) -> int:
    """Classify the live UET estate without making network assumptions."""

    try:
        parsed = urllib.parse.urlsplit(url)
        host = (parsed.hostname or "").casefold().rstrip(".")
        path = parsed.path.casefold()
    except (ValueError, UnicodeError):
        return _UET_SITE_GENERIC
    if host == "fms.uettaxila.edu.pk" or host.startswith("fms."):
        return _UET_SITE_FMS
    if host == "admissions.uettaxila.edu.pk":
        return _UET_SITE_ADMISSIONS
    if host in {"admission.uettaxila.edu.pk", "entrytest.uettaxila.edu.pk"}:
        return _UET_SITE_PORTAL
    if host == "web.uettaxila.edu.pk":
        return _UET_SITE_LEGACY
    if host in {"uettaxila.edu.pk", "www.uettaxila.edu.pk"}:
        return _UET_SITE_MAIN
    if host.endswith("." + _UET_HOST_SUFFIX):
        if "/profile/" in path:
            return _UET_SITE_FMS
        return _UET_SITE_LEGACY
    if soup is not None:
        title = _normalize_space(_bounded_text(soup.title, 300) if soup.title else "").casefold()
        if "faculty management system" in title and "uet taxila" in title:
            return _UET_SITE_FMS
    return _UET_SITE_GENERIC


def _site_family_diagnostics(site_family: int) -> dict[str, int]:
    return {
        "uet_site_family": int(site_family),
        "uet_main_site_profile": int(site_family == _UET_SITE_MAIN),
        "uet_admissions_profile": int(site_family == _UET_SITE_ADMISSIONS),
        "uet_legacy_site_profile": int(site_family == _UET_SITE_LEGACY),
        "uet_fms_profile": int(site_family == _UET_SITE_FMS),
        "uet_application_portal_profile": int(site_family == _UET_SITE_PORTAL),
    }


def _looks_severely_malformed_table_html(raw_html: str) -> bool:
    """Identify legacy table markup where a recovery parse can add content."""

    sample = raw_html[:5_000_000].casefold()
    if "<table" not in sample:
        return False
    pairs = (("<table", "</table"), ("<tr", "</tr"), ("<td", "</td"))
    for opening, closing in pairs:
        opened = sample.count(opening)
        closed = sample.count(closing)
        if opened >= 3 and abs(opened - closed) >= max(2, opened // 10):
            return True
    return False


def _soup_content_score(soup: BeautifulSoup) -> tuple[int, int, int]:
    body = soup.body or soup
    text_length = len(_bounded_text(body, 2_000_000))
    links = len(body.find_all("a", href=True, limit=10_000))
    rows = len(body.find_all("tr", limit=20_000))
    return text_length, links, rows


def _new_soup(markup: str, parser: str) -> BeautifulSoup:
    """Parse markup without emitting locator warnings into crawler logs."""

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", MarkupResemblesLocatorWarning)
        return BeautifulSoup(markup, parser)


def _make_soup_with_recovery(
    raw_html: str,
    options: HtmlExtractorOptions,
    site_family: int,
) -> tuple[BeautifulSoup, dict[str, int]]:
    diagnostics = {
        "parser_lxml_used": 0,
        "parser_html_parser_used": 0,
        "parser_html5lib_used": 0,
        "parser_recovery_compared": 0,
        "parser_recovery_selected": 0,
    }
    try:
        primary = _new_soup(raw_html, "lxml")
        diagnostics["parser_lxml_used"] = 1
    except Exception:
        primary = _new_soup(raw_html, "html.parser")
        diagnostics["parser_html_parser_used"] = 1
        return primary, diagnostics

    should_compare = bool(
        options.enable_parser_recovery
        and site_family in {_UET_SITE_MAIN, _UET_SITE_LEGACY, _UET_SITE_FMS}
        and _looks_severely_malformed_table_html(raw_html)
    )
    if not should_compare:
        return primary, diagnostics
    diagnostics["parser_recovery_compared"] = 1
    candidates: list[tuple[str, BeautifulSoup]] = []
    try:
        candidates.append(("html.parser", _new_soup(raw_html, "html.parser")))
    except Exception:
        pass
    # html5lib most closely follows the browser tree-construction algorithm.
    # It remains optional because lxml is substantially faster on normal pages.
    try:
        candidates.append(("html5lib", _new_soup(raw_html, "html5lib")))
    except Exception:
        pass
    primary_score = _soup_content_score(primary)
    selected_name = "lxml"
    selected = primary
    selected_score = primary_score
    for parser_name, candidate in candidates:
        candidate_score = _soup_content_score(candidate)
        # A recovery parser must add material content without catastrophically
        # losing another major signal. A single malformed table can inflate row
        # counts while dropping most prose or links.
        no_severe_regression = bool(
            candidate_score[0] >= max(0, int(selected_score[0] * 0.75))
            and candidate_score[1] >= max(0, int(selected_score[1] * 0.60))
            and candidate_score[2] >= max(0, int(selected_score[2] * 0.60))
        )
        materially_better = bool(
            no_severe_regression
            and (
                candidate_score[0] > selected_score[0] * 1.12 + 200
                or candidate_score[1] > selected_score[1] + 10
                or candidate_score[2] > selected_score[2] + 10
            )
        )
        if materially_better:
            selected_name = parser_name
            selected = candidate
            selected_score = candidate_score
    if selected_name != "lxml":
        diagnostics["parser_recovery_selected"] = 1
        diagnostics[
            "parser_html5lib_used" if selected_name == "html5lib" else "parser_html_parser_used"
        ] = 1
    return selected, diagnostics


def _markdown_escape_text(value: str) -> str:
    """Escape untrusted text inserted directly into generated Markdown."""

    escaped = html_stdlib.escape(str(value or ""), quote=False)
    return re.sub(r"([\\`*_\[\]])", r"\\\1", escaped)


def _markdown_link(label: str, url: str) -> str:
    return f"[{_markdown_escape_text(label)}](<{url}>)"


def _safe_policy_canonicalize(policy: UrlPolicyLike, url: str) -> str:
    try:
        return str(policy.canonicalize(url) or "")
    except Exception:
        return ""


def _safe_is_network_target(policy: UrlPolicyLike, url: str) -> bool:
    try:
        return bool(policy.is_network_target(url))
    except Exception:
        return False


def _safe_is_crawl_candidate(policy: UrlPolicyLike, url: str) -> bool:
    try:
        return bool(policy.is_crawl_candidate(url))
    except Exception:
        return False


def _normalize_percent_component(value: str, safe: str) -> str:
    # Keep valid escapes intact (including encoded slashes), encode malformed
    # percent signs, and uppercase hex digits for stable identities.
    protected = re.sub(r"%(?![0-9A-Fa-f]{2})", "%25", value)
    quoted = urllib.parse.quote(protected, safe=safe + "%")
    return re.sub(
        r"%[0-9a-fA-F]{2}",
        lambda match: match.group(0).upper(),
        quoted,
    )


_SINGLE_DOT_PATH_SEGMENTS = frozenset({".", "%2e"})
_DOUBLE_DOT_PATH_SEGMENTS = frozenset({"..", ".%2e", "%2e.", "%2e%2e"})


def _normalize_special_url_path(path: str) -> str:
    """Normalize HTTP(S) dot segments using special-URL path semantics.

    Percent-encoded dot forms participate in navigation, while encoded slashes
    remain data. Empty segments are retained so repeated slashes are not silently
    collapsed. A terminal dot segment produces the browser-equivalent trailing
    slash.
    """

    source = path or "/"
    segments = source.split("/")
    output: list[str] = []
    last_index = len(segments) - 1

    for index, segment in enumerate(segments):
        folded = segment.casefold()
        if folded in _SINGLE_DOT_PATH_SEGMENTS:
            if index == last_index:
                output.append("")
            continue
        if folded in _DOUBLE_DOT_PATH_SEGMENTS:
            # Keep the leading empty segment that represents the origin root.
            if len(output) > 1:
                output.pop()
            if index == last_index:
                output.append("")
            continue
        output.append(segment)

    normalized = "/".join(output)
    if not normalized.startswith("/"):
        normalized = "/" + normalized
    return normalized or "/"


def _normalize_http_url(url: str, maximum: int = 8_192) -> str:
    """Validate and normalize an absolute HTTP(S) URL without fetching it.

    ``urllib.parse`` is a permissive parser, not a validator.  Reject ambiguous
    controls, credentials, malformed ports, backslashes, missing hosts and
    unsupported schemes before a value reaches policy code or diagnostics.
    """

    limit = _bounded_positive(maximum, 8_192, 65_536)
    value = html_stdlib.unescape(str(url or "")).strip(" \t\r\n\f")
    forbidden_bidi = {"\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069"}
    if (
        not value
        or len(value) > limit
        or "\\" in value
        or any(
            ord(character) < 0x20
            or 0x7F <= ord(character) <= 0x9F
            or character in forbidden_bidi
            or unicodedata.category(character) in {"Cc", "Cf", "Cs"}
            or (character.isspace() and character != " ")
            for character in value
        )
    ):
        return ""

    try:
        parsed = urllib.parse.urlsplit(value)
        scheme = parsed.scheme.casefold()
        if scheme not in {"http", "https"} or not parsed.hostname:
            return ""
        if parsed.username is not None or parsed.password is not None:
            return ""
        port = parsed.port
        raw_host = parsed.hostname.rstrip(".")
        if not raw_host or "%" in raw_host:
            return ""

        try:
            ip_value = ipaddress.ip_address(raw_host)
        except ValueError:
            last_label = raw_host.rsplit(".", 1)[-1]
            if last_label.isascii() and (
                last_label.isdigit()
                or bool(re.fullmatch(r"0[xX][0-9A-Fa-f]*", last_label))
            ):
                # Special-scheme URL parsers can reinterpret shorthand, octal,
                # hexadecimal or single-integer hosts as IPv4 addresses. Reject
                # non-canonical numeric hosts instead of risking policy/parser
                # disagreement (for example 127.1 or 0x7f000001).
                return ""
            if _idna is not None:
                ascii_host = _idna.encode(
                    raw_host,
                    uts46=True,
                    std3_rules=True,
                    transitional=False,
                ).decode("ascii").casefold()
            else:
                ascii_host = raw_host.encode("idna").decode("ascii").casefold()
            if not ascii_host or len(ascii_host) > 253:
                return ""
            ascii_last = ascii_host.rsplit(".", 1)[-1]
            if ascii_last.isdigit() or re.fullmatch(r"0[xX][0-9A-Fa-f]*", ascii_last):
                return ""
            labels = ascii_host.split(".")
            if any(
                not label
                or len(label) > 63
                or label.startswith("-")
                or label.endswith("-")
                for label in labels
            ):
                return ""
            host = ascii_host
        else:
            host = f"[{ip_value.compressed}]" if ip_value.version == 6 else ip_value.compressed

        default_port = (scheme == "http" and port == 80) or (
            scheme == "https" and port == 443
        )
        netloc = host if port is None or default_port else f"{host}:{port}"
        path = _normalize_percent_component(
            _normalize_special_url_path(parsed.path or "/"),
            safe="/:@!$&'()*+,;=-._~",
        )
        query = _normalize_percent_component(
            parsed.query, safe="/?@:!$&'()*+,;=-._~[]"
        )
        normalized = urllib.parse.urlunsplit((scheme, netloc, path, query, ""))
        return normalized if len(normalized) <= limit else ""
    except (UnicodeError, ValueError, OverflowError):
        return ""

def _decode_body(body: bytes, content_type: str) -> tuple[str, dict[str, int]]:
    """Decode HTML using BOM/header hints and Beautiful Soup's detector."""

    diagnostics = {
        "decoded_with_bom": 0,
        "decoded_with_declared_charset": 0,
        "decoded_with_unicode_dammit": 0,
        "declared_charset_failed": 0,
        "decode_replacement_characters": 0,
    }
    if not body:
        return "", diagnostics

    # BOMs are authoritative and avoid an unnecessary statistical guess.
    for bom, encoding in (
        (codecs.BOM_UTF8, "utf-8-sig"),
        (codecs.BOM_UTF32_LE, "utf-32"),
        (codecs.BOM_UTF32_BE, "utf-32"),
        (codecs.BOM_UTF16_LE, "utf-16"),
        (codecs.BOM_UTF16_BE, "utf-16"),
    ):
        if body.startswith(bom):
            try:
                text = body.decode(encoding)
                diagnostics["decoded_with_bom"] = 1
                diagnostics["decode_replacement_characters"] = text.count("\ufffd")
                return text, diagnostics
            except UnicodeDecodeError:
                break

    declared: str | None = None
    match = _CONTENT_TYPE_CHARSET_RE.search(content_type or "")
    if match:
        declared = match.group(1).strip()
        try:
            text = body.decode(declared)
            diagnostics["decoded_with_declared_charset"] = 1
            diagnostics["decode_replacement_characters"] = text.count("\ufffd")
            return text, diagnostics
        except (LookupError, UnicodeDecodeError):
            diagnostics["declared_charset_failed"] = 1

    try:
        dammit = UnicodeDammit(
            body,
            known_definite_encodings=[declared] if declared else None,
            is_html=True,
        )
        if dammit.unicode_markup is not None:
            text = dammit.unicode_markup
            diagnostics["decoded_with_unicode_dammit"] = 1
            diagnostics["decode_replacement_characters"] = text.count("\ufffd")
            return text, diagnostics
    except Exception:
        pass

    for encoding in ("utf-8", "windows-1252"):
        try:
            text = body.decode(encoding)
            diagnostics["decode_replacement_characters"] = text.count("\ufffd")
            return text, diagnostics
        except UnicodeDecodeError:
            continue
    text = body.decode("utf-8", errors="replace")
    diagnostics["decode_replacement_characters"] = text.count("\ufffd")
    return text, diagnostics

def _decode_cf_email(encoded: str) -> str:
    try:
        if len(encoded) < 4 or len(encoded) % 2:
            return encoded
        key = int(encoded[:2], 16)
        return "".join(
            chr(int(encoded[index : index + 2], 16) ^ key)
            for index in range(2, len(encoded), 2)
        )
    except (ValueError, UnicodeError):
        return encoded


def _parse_input_attributes(tag_source: str) -> dict[str, str]:
    attributes: dict[str, str] = {}
    match = re.match(r"\s*<input\b", tag_source, flags=re.I)
    if match is None:
        return attributes
    inner = tag_source[match.end():]
    if inner.endswith(">"):
        inner = inner[:-1]
    if inner.rstrip().endswith("/"):
        inner = inner.rstrip()[:-1]
    for attribute_match in _HTML_ATTRIBUTE_RE.finditer(inner):
        name = str(attribute_match.group("name") or "").strip().casefold()
        if not name or name in attributes:
            continue
        value = attribute_match.group("quoted")
        if value is None:
            value = attribute_match.group("unquoted") or ""
        attributes[name] = html_stdlib.unescape(value)
    return attributes

def _remove_large_aspnet_state(
    raw_html: str,
    maximum_hidden_value_chars: int,
) -> tuple[str, int, int, int, int]:
    """Remove ASP.NET state and oversized hidden inputs before DOM parsing.

    A small quote-aware HTML scanner is used instead of ``<input[^>]*>`` so a
    ``>`` inside an attribute does not terminate the tag and markup-like strings
    inside script/style/textarea raw text are never altered.
    """

    state_field_count = 0
    state_field_chars = 0
    oversized_hidden_count = 0
    oversized_hidden_chars = 0
    maximum = _bounded_nonnegative(maximum_hidden_value_chars, 16_384, 2_000_000)
    raw_text_tags = {"script", "style", "textarea", "title", "xmp", "iframe", "noembed", "noframes", "plaintext"}
    closing_patterns = {
        name: re.compile(rf"</\s*{name}\b", re.I) for name in raw_text_tags
    }

    def tag_end(start: int) -> int:
        quote = ""
        index = start
        hard_end = min(len(raw_html), start + 25_000_000)
        while index < hard_end:
            character = raw_html[index]
            if quote:
                if character == quote:
                    quote = ""
            elif character in {"'", '"'}:
                quote = character
            elif character == ">":
                return index + 1
            index += 1
        return -1

    output: list[str] = []
    cursor = 0
    index = 0
    length = len(raw_html)
    while index < length:
        opening = raw_html.find("<", index)
        if opening < 0:
            break
        if raw_html.startswith("<!--", opening):
            close = raw_html.find("-->", opening + 4)
            index = length if close < 0 else close + 3
            continue
        name_match = _HTML_TAG_OPEN_RE.match(raw_html, opening)
        if name_match is None:
            index = opening + 1
            continue
        closing = bool(name_match.group(1))
        name = name_match.group(2).casefold()
        end = tag_end(opening)
        if end < 0:
            break
        source = raw_html[opening:end]

        if not closing and name == "input":
            attributes = _parse_input_attributes(source)
            names = (attributes.get("name", ""), attributes.get("id", ""))
            state_field = any(
                bool(value and _ASPNET_STATE_NAME_RE.fullmatch(value.strip()))
                for value in names
            )
            value = attributes.get("value", "")
            input_type = attributes.get("type", "text").strip().casefold()
            oversized_hidden = bool(
                maximum > 0 and input_type == "hidden" and len(value) > maximum
            )
            if state_field or oversized_hidden:
                output.append(raw_html[cursor:opening])
                cursor = end
                if state_field:
                    state_field_count += 1
                    state_field_chars += end - opening
                elif oversized_hidden:
                    oversized_hidden_count += 1
                    oversized_hidden_chars += end - opening

        index = end
        if not closing and name in raw_text_tags and not source.rstrip().endswith("/>"):
            # The obsolete plaintext element has no end-tag recognition: every
            # remaining byte is text. Other raw/RCDATA elements resume scanning
            # at their tokenizer-recognized closing tag.
            if name == "plaintext":
                index = length
                continue
            close_match = closing_patterns[name].search(raw_html, end)
            if close_match is None:
                index = length
            else:
                index = close_match.start()

    if not output:
        return raw_html, 0, 0, 0, 0
    output.append(raw_html[cursor:])
    return (
        "".join(output),
        state_field_count,
        state_field_chars,
        oversized_hidden_count,
        oversized_hidden_chars,
    )

def _pretruncate_prune_aspnet_state_bytes(
    body: bytes,
    maximum_hidden_value_chars: int,
    maximum_scan_bytes: int = 100_000_000,
) -> tuple[bytes, int, int, int]:
    """Remove large ASCII-compatible WebForms fields before byte truncation.

    HTML markup and ASP.NET field names are ASCII. Latin-1 provides a reversible
    one-byte mapping, allowing the quote/raw-text-aware string scanner above to
    remove state without first guessing the document's character encoding.
    UTF-16/32 documents bypass this optimization and follow the normal decoder.
    """

    if not body or body.startswith((
        codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE,
        codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE,
    )):
        return body, 0, 0, 0
    scan_limit = min(
        len(body),
        _bounded_positive(maximum_scan_bytes, 100_000_000, 200_000_000),
    )
    prefix = body[:scan_limit]
    lowered_probe = prefix[: min(len(prefix), 4_000_000)].lower()
    hidden_type_hint = bool(
        re.search(br"\btype\s*=\s*(?:hidden\b|[\"']hidden[\"'])", lowered_probe)
    )
    if not (
        b"__viewstate" in lowered_probe
        or b"__eventvalidation" in lowered_probe
        or hidden_type_hint
    ):
        return body, 0, 0, int(scan_limit < len(body))
    source = prefix.decode("latin-1")
    cleaned, state_count, state_chars, hidden_count, hidden_chars = (
        _remove_large_aspnet_state(source, maximum_hidden_value_chars)
    )
    removed_count = state_count + hidden_count
    removed_bytes = state_chars + hidden_chars
    if removed_count == 0:
        return body, 0, 0, int(scan_limit < len(body))
    rebuilt = cleaned.encode("latin-1") + body[scan_limit:]
    return rebuilt, removed_count, removed_bytes, int(scan_limit < len(body))


def _make_soup(raw_html: str) -> BeautifulSoup:
    try:
        return _new_soup(raw_html, "lxml")
    except Exception:
        return _new_soup(raw_html, "html.parser")


def _selector_is_protected(selector: str) -> bool:
    compact = re.sub(r"\s+", "", selector).casefold()
    return any(token in compact for token in _PROTECTED_SELECTOR_TOKENS)


def _is_valid_shadow_host(tag: Tag) -> bool:
    name = (tag.name or "").casefold()
    if name in _VALID_BUILTIN_SHADOW_HOSTS:
        return True
    # Static extraction cannot know whether a custom-element definition opts out
    # of shadow roots. Preserve standards-shaped custom hosts for high recall.
    return bool(
        "-" in name
        and name not in _RESERVED_CUSTOM_ELEMENT_NAMES
        and re.fullmatch(r"[a-z][.0-9_a-z-]*", name)
    )


def _activate_declarative_shadow_dom(
    soup: BeautifulSoup,
) -> tuple[int, int]:
    """Flatten valid declarative shadow roots and count inert templates left.

    Only the first valid declaration for a host is activated. Subsequent or
    malformed declarations remain ordinary templates and are removed later.
    """

    activated = 0
    shadow_hosts: set[int] = set()
    templates = list(soup.find_all("template"))
    for template in templates:
        if template.parent is None:
            continue
        mode = str(template.get("shadowrootmode") or "").strip().casefold()
        parent = template.parent if isinstance(template.parent, Tag) else None
        if (
            mode not in {"open", "closed"}
            or parent is None
            or not _is_valid_shadow_host(parent)
            or id(parent) in shadow_hosts
        ):
            continue
        shadow_hosts.add(id(parent))
        template.unwrap()
        activated += 1
    return activated, len(templates) - activated


def _activate_noscript_fallback_markup(soup: BeautifulSoup) -> int:
    """Expose body-level no-script fallbacks for discovery and Markdown."""

    activated = 0
    for tag in list(soup.find_all("noscript")):
        if tag.parent is None or tag.find_parent("head") is not None:
            continue
        if tag.find(True) is not None:
            tag.unwrap()
            activated += 1
            continue
        raw = str(tag.string or "").strip()
        decoded = html_stdlib.unescape(raw)
        if "<" not in decoded or ">" not in decoded:
            continue
        fragment = _make_soup(decoded)
        fragment_body = fragment.body or fragment
        children = list(fragment_body.contents)
        if not children:
            continue
        for child in children:
            tag.insert_before(child.extract())
        tag.decompose()
        activated += 1
    return activated


def _activate_inline_srcdoc(
    soup: BeautifulSoup, maximum_characters: int
) -> tuple[int, int]:
    """Insert bounded iframe ``srcdoc`` content as an explicit fallback tree."""

    maximum = _bounded_nonnegative(maximum_characters, 500_000, 5_000_000)
    if maximum == 0:
        return 0, 0
    remaining = maximum
    activated = 0
    truncated = 0
    for iframe in list(soup.find_all("iframe", srcdoc=True)):
        raw = str(iframe.get("srcdoc") or "")
        if not raw:
            continue
        if len(raw) > remaining:
            truncated = 1
            continue
        remaining -= len(raw)
        fragment = _make_soup(raw)
        fragment_body = fragment.body or fragment
        wrapper = soup.new_tag("section")
        wrapper["data-extracted-srcdoc"] = "true"
        title = _normalize_space(str(iframe.get("title") or ""))
        if title:
            heading = soup.new_tag("h2")
            heading.string = title[:500]
            wrapper.append(heading)
        for child in list(fragment_body.contents):
            wrapper.append(child.extract())
        iframe.insert_after(wrapper)
        activated += 1
    return activated, truncated


def _parse_active_dom(
    raw_html: str,
    options: HtmlExtractorOptions,
    site_family: int = _UET_SITE_GENERIC,
) -> tuple[BeautifulSoup, dict[str, int]]:
    (
        cleaned_html,
        state_count,
        state_chars,
        oversized_hidden_count,
        oversized_hidden_chars,
    ) = _remove_large_aspnet_state(
            raw_html,
            options.max_hidden_input_value_chars,
        )
    soup, parser_diagnostics = _make_soup_with_recovery(
        cleaned_html, options, site_family
    )
    diagnostics = {
        **parser_diagnostics,
        # Historical keys counted all pre-DOM input removals. Preserve that
        # contract and expose precise state-only counters alongside it.
        "aspnet_state_fields_removed": state_count + oversized_hidden_count,
        "aspnet_state_characters_removed": state_chars + oversized_hidden_chars,
        "aspnet_state_only_fields_removed": state_count,
        "aspnet_state_only_characters_removed": state_chars,
        "oversized_hidden_inputs_removed": oversized_hidden_count,
        "oversized_hidden_input_characters_removed": oversized_hidden_chars,
        "input_fields_removed_total": state_count + oversized_hidden_count,
        "input_field_characters_removed_total": state_chars + oversized_hidden_chars,
        "html_comments_removed": 0,
        "inert_templates_removed": 0,
        "declarative_shadow_roots_preserved": 0,
        "noscript_markup_activated": 0,
        "iframe_srcdoc_activated": 0,
        "iframe_srcdoc_truncated": 0,
        "noise_nodes_removed": 0,
        "cloudflare_emails_decoded": 0,
        "initially_hidden_nodes_preserved": 0,
        "invalid_remove_selectors": 0,
        "protected_remove_selectors_ignored": 0,
    }

    # UET keeps old announcements and superseded links in comments.
    for node in list(soup.find_all(string=lambda item: isinstance(item, Comment))):
        diagnostics["html_comments_removed"] += 1
        node.extract()

    # Declarative shadow roots and no-script fallbacks represent rendered or
    # accessibility-relevant DOM. Activate them before inert templates vanish.
    activated, _ = _activate_declarative_shadow_dom(soup)
    diagnostics["declarative_shadow_roots_preserved"] = activated
    diagnostics["noscript_markup_activated"] = _activate_noscript_fallback_markup(soup)
    srcdoc_activated, srcdoc_truncated = _activate_inline_srcdoc(
        soup, options.max_inline_embedded_html_chars
    )
    diagnostics["iframe_srcdoc_activated"] = srcdoc_activated
    diagnostics["iframe_srcdoc_truncated"] = srcdoc_truncated
    for tag in list(soup.find_all(_INERT_SOURCE_TAGS)):
        diagnostics["inert_templates_removed"] += 1
        tag.decompose()

    # Remove only unambiguous UI chrome before discovery.  User selectors are
    # intentionally deferred until all URLs and structured data are harvested.
    removed_ids: set[int] = set()
    for selector in _UI_ONLY_SELECTORS:
        try:
            matches = list(soup.select(selector))
        except Exception:
            diagnostics["invalid_remove_selectors"] += 1
            continue
        for tag in matches:
            identity = id(tag)
            if identity in removed_ids or tag.parent is None:
                continue
            removed_ids.add(identity)
            diagnostics["noise_nodes_removed"] += 1
            tag.decompose()

    # Preserve current modals/tabs/collapse panels even when their initial state
    # is hidden.  The browser renderer can later provide their post-JS state.
    for node in soup.descendants:
        if not isinstance(node, Tag):
            continue
        tag = node
        style = re.sub(r"\s+", "", str(tag.get("style") or "")).casefold()
        if (
            tag.has_attr("hidden")
            or str(tag.get("aria-hidden") or "").casefold() == "true"
            or "display:none" in style
            or "visibility:hidden" in style
        ):
            diagnostics["initially_hidden_nodes_preserved"] += 1

    for tag in list(soup.select("a.__cf_email__, span.__cf_email__, [data-cfemail]")):
        raw = str(tag.get("data-cfemail") or "")
        if not raw:
            continue
        decoded = _decode_cf_email(raw)
        # data-cfemail is untrusted input. Only replace a node when the decoded
        # payload is actually an email address; arbitrary hex can decode to
        # control characters or binary-looking text.
        if decoded == raw or _CONTACT_EMAIL_RE.fullmatch(decoded) is None:
            continue
        if tag.name == "a" and str(tag.get("href") or "").startswith("/cdn-cgi/l/email"):
            tag["href"] = f"mailto:{decoded}"
        tag.replace_with(decoded)
        diagnostics["cloudflare_emails_decoded"] += 1

    return soup, diagnostics


# ---------------------------------------------------------------------------
# Metadata, structured data, and URL normalization
# ---------------------------------------------------------------------------


def _extract_fms_profile_name(soup: BeautifulSoup) -> str:
    for row in soup.find_all("tr", limit=200):
        cells = row.find_all(["th", "td"], recursive=False)
        if len(cells) < 2:
            continue
        label = _normalize_space(_bounded_text(cells[0], 100)).casefold().rstrip(":")
        if label == "name":
            value = _normalize_space(_bounded_text(cells[1], 500))
            if value:
                return value
    # FMS one-page views sometimes use adjacent labels rather than table rows.
    for node in soup.find_all(string=re.compile(r"^\s*name\s*:?[\s]*$", re.I), limit=20):
        parent = node.parent if isinstance(node.parent, Tag) else None
        if parent is None:
            continue
        sibling = parent.find_next_sibling()
        if isinstance(sibling, Tag):
            value = _normalize_space(_bounded_text(sibling, 500))
            if value:
                return value
    return ""


def _clean_uet_title(value: str) -> str:
    title = _normalize_space(value).strip("-|–—: ")[:500]
    suffixes = (
        " | University of Engineering and Technology, Taxila",
        " | University of Engineering & Technology Taxila",
        " - University of Engineering and Technology, Taxila",
        " - UET Taxila",
        " | UET Taxila",
    )
    lowered = title.casefold()
    for suffix in suffixes:
        if lowered.endswith(suffix.casefold()) and len(title) > len(suffix):
            title = title[: -len(suffix)].rstrip("-|–—: ")
            break
    return title


def _extract_title(
    soup: BeautifulSoup, site_family: int = _UET_SITE_GENERIC
) -> str:
    if site_family == _UET_SITE_FMS:
        profile_name = _extract_fms_profile_name(soup)
        if profile_name:
            return profile_name
    candidates: list[tuple[float, int, str]] = []
    order = 0
    for h1 in soup.find_all("h1", limit=12):
        score = 4.0
        if h1.find_parent(["main", "article"]):
            score += 1.5
        if h1.find_parent(["nav", "footer"]):
            score -= 4.0
        ancestor = h1.find_parent(True)
        while ancestor is not None:
            role = str(ancestor.get("role") or "").casefold()
            classes = " ".join(str(value) for value in (ancestor.get("class") or [])).casefold()
            identifier = str(ancestor.get("id") or "").casefold()
            style = re.sub(r"\s+", "", str(ancestor.get("style") or "")).casefold()
            if role in {"dialog", "navigation", "menu", "contentinfo"}:
                score -= 2.5
                break
            if any(token in f"{classes} {identifier}" for token in ("modal", "offcanvas", "popup", "cookie")):
                score -= 2.0
                break
            if ancestor.has_attr("hidden") or str(ancestor.get("aria-hidden") or "").casefold() == "true" or "display:none" in style or "visibility:hidden" in style:
                score -= 1.5
                break
            ancestor = ancestor.parent if isinstance(ancestor.parent, Tag) else None
        candidates.append((score, order, _bounded_text(h1, 500)))
        order += 1
    if site_family != _UET_SITE_GENERIC:
        for heading in soup.find_all(["h2", "h3"], limit=30):
            score = 3.2
            if heading.find_parent(["main", "article"]):
                score += 1.5
            classes = " ".join(str(value) for value in (heading.get("class") or [])).casefold()
            identifier = str(heading.get("id") or "").casefold()
            if any(token in f"{classes} {identifier}" for token in (
                "page-title", "news-title", "event-title", "entry-title", "content-title"
            )):
                score += 1.5
            if heading.find_parent(["nav", "footer"]):
                score -= 4.0
            ancestor = heading.find_parent(True)
            while ancestor is not None:
                style = re.sub(r"\s+", "", str(ancestor.get("style") or "")).casefold()
                if (
                    ancestor.has_attr("hidden")
                    or str(ancestor.get("aria-hidden") or "").casefold() == "true"
                    or "display:none" in style
                    or "visibility:hidden" in style
                ):
                    score -= 2.0
                    break
                ancestor = ancestor.parent if isinstance(ancestor.parent, Tag) else None
            candidates.append((score, order, _bounded_text(heading, 500)))
            order += 1
    for selector, score in (
        ('meta[property="og:title" i]', 4.2),
        ('meta[name="twitter:title" i]', 4.0),
    ):
        tag = soup.select_one(selector)
        if isinstance(tag, Tag) and tag.get("content"):
            candidates.append((score, order, str(tag.get("content"))))
            order += 1
    if soup.title:
        candidates.append((3.8, order, _bounded_text(soup.title, 500)))

    generic = {
        "home", "welcome", "untitled document", "index", "menu", "navigation",
        "search", "close", "uet taxila", "uet taxila admissions",
        "undergraduate admissions", "university of engineering and technology taxila",
        "university of engineering technology taxila",
    }
    generic_keys = {
        _normalize_space(re.sub(r"[^a-z0-9]+", " ", value.casefold()))
        for value in generic
    }
    ranked: list[tuple[float, int, str]] = []
    for score, source_order, candidate in candidates:
        normalized = _clean_uet_title(candidate)
        if not normalized:
            continue
        lowered = normalized.casefold()
        score += min(len(normalized), 160) / 160.0
        normalized_generic_key = _normalize_space(
            re.sub(r"[^a-z0-9]+", " ", lowered)
        )
        if normalized_generic_key in generic_keys:
            score -= 10.0
        ranked.append((score, source_order, normalized))
    if not ranked:
        return ""
    ranked.sort(key=lambda item: (-item[0], item[1], len(item[2])))
    return ranked[0][2]

def _extract_canonical_url(
    soup: BeautifulSoup,
    final_url: str,
    base_url: str,
    policy: UrlPolicyLike,
    maximum_url_characters: int = 8_192,
) -> str:
    head = soup.head
    valid: list[str] = []
    if head is not None:
        for tag in head.find_all("link", href=True):
            rels = _rel_values(tag)
            if "canonical" not in rels or tag.get("hreflang") or tag.get("media"):
                continue
            type_hint = str(tag.get("type") or "").split(";", 1)[0].strip().casefold()
            if type_hint and type_hint not in {"text/html", "application/xhtml+xml"}:
                continue
            candidate = _absolute_url(
                str(tag.get("href") or ""), base_url, policy, maximum_url_characters
            )
            if (
                candidate
                and _safe_is_network_target(policy, candidate)
                and _resource_kind(candidate) == "page"
                and candidate not in valid
            ):
                valid.append(candidate)
    if len(valid) == 1:
        return valid[0]
    # Invalid or conflicting declarations are ignored conservatively.
    return _absolute_url(
        final_url, final_url, policy, maximum_url_characters
    ) or _normalize_http_url(final_url, maximum_url_characters)

def _document_base_url(
    soup: BeautifulSoup,
    final_url: str,
    policy: UrlPolicyLike,
    maximum_url_characters: int = 8_192,
) -> str:
    """Return the first valid document ``base href`` per HTML semantics."""

    del policy  # Base resolution is parsing semantics, not crawl authorization.
    tag = soup.find("base", href=True)
    if isinstance(tag, Tag):
        raw = _clean_raw_url(str(tag.get("href") or ""), maximum_url_characters)
        if raw:
            try:
                candidate = _normalize_http_url(
                    urllib.parse.urljoin(final_url, raw), maximum_url_characters
                )
            except (ValueError, UnicodeError):
                candidate = ""
            if candidate:
                return candidate
    return final_url

def _clean_raw_url(raw: str, maximum: int = 8_192) -> str:
    limit = _bounded_positive(maximum, 8_192, 65_536)
    value = html_stdlib.unescape(str(raw or "")).strip(" \t\r\n\f")
    forbidden_bidi = {"\u202a", "\u202b", "\u202c", "\u202d", "\u202e", "\u2066", "\u2067", "\u2068", "\u2069"}
    if (
        not value
        or len(value) > limit
        or any(
            ord(character) < 0x20
            or 0x7F <= ord(character) <= 0x9F
            or character in forbidden_bidi
            for character in value
        )
    ):
        return ""
    lowered = value.casefold()
    if lowered.startswith(("#", "javascript:", "data:", "blob:", "about:")):
        return ""
    return value

def _absolute_url(
    raw: str,
    base_url: str,
    policy: UrlPolicyLike,
    maximum: int = 8_192,
) -> str:
    value = _clean_raw_url(raw, maximum)
    if not value:
        return ""
    try:
        joined = urllib.parse.urljoin(base_url, value)
    except (ValueError, UnicodeError):
        return ""

    normalized = _normalize_http_url(joined, maximum)
    if not normalized:
        return ""

    canonical = _safe_policy_canonicalize(policy, normalized)
    if canonical:
        normalized_canonical = _normalize_http_url(canonical, maximum)
        if normalized_canonical:
            return normalized_canonical

    # Resource manifests may retain external HTTP(S) references even when the
    # crawl policy intentionally rejects them as automatic network targets.
    return normalized

def _query_resource_filename(url: str) -> str:
    """Return a file-bearing query value from a legacy download handler URL."""

    try:
        parsed = urllib.parse.urlsplit(url)
        pairs = urllib.parse.parse_qsl(
            parsed.query,
            keep_blank_values=False,
            max_num_fields=200,
        )
    except (TypeError, ValueError, UnicodeError):
        return ""
    filename_keys = {
        "attachment", "doc", "document", "download", "file", "fileid",
        "filename", "filepath", "fileurl", "image", "media", "name",
        "path", "resource", "src", "target", "url",
    }
    for key, raw_value in pairs:
        normalized_key = re.sub(r"[^a-z0-9]+", "", key.casefold())
        if normalized_key not in filename_keys:
            continue
        value = urllib.parse.unquote(str(raw_value or "")).strip()
        if not value or len(value) > 8_192:
            continue
        try:
            candidate_path = urllib.parse.urlsplit(value).path or value
        except (ValueError, UnicodeError):
            candidate_path = value
        candidate_path = candidate_path.replace("\\", "/").split("#", 1)[0]
        filename = PurePosixPath(candidate_path).name
        if filename and PurePosixPath(filename.casefold()).suffix in _RESOURCE_EXTENSIONS:
            return filename[:1_000]
    return ""


def _resource_kind(url: str) -> str:
    try:
        parsed = urllib.parse.urlsplit(url)
        path = urllib.parse.unquote(parsed.path).casefold()
    except (ValueError, UnicodeError):
        return "page"
    kind = _RESOURCE_EXTENSIONS.get(PurePosixPath(path).suffix)
    if kind:
        return kind
    query_filename = _query_resource_filename(url)
    if query_filename:
        return _RESOURCE_EXTENSIONS.get(
            PurePosixPath(query_filename.casefold()).suffix,
            "page",
        )
    return "page"


def _filename_label(url: str) -> str:
    try:
        path = urllib.parse.unquote(urllib.parse.urlsplit(url).path)
    except (ValueError, UnicodeError):
        return ""
    filename = PurePosixPath(path).name
    query_filename = _query_resource_filename(url)
    path_suffix = PurePosixPath(filename).suffix.casefold() if filename else ""
    path_stem = PurePosixPath(filename).stem.casefold() if filename else ""
    if query_filename and (
        not filename
        or path_suffix in {".asp", ".aspx", ".ashx", ".php"}
        or path_stem in {
            "attachment", "download", "downloadfile", "file", "getfile",
            "openfile", "resource", "viewfile",
        }
    ):
        filename = query_filename
    if not filename:
        return ""
    stem = PurePosixPath(filename).stem
    return _normalize_space(re.sub(r"[_-]+", " ", stem))[:500]

def _meaningful_link_text(tag: Tag | None, url: str, fallback: str = "") -> str:
    candidates: list[str] = []
    if tag is not None:
        candidates.extend(
            [
                _bounded_text(tag, 500),
                str(tag.get("aria-label") or ""),
                str(tag.get("title") or ""),
            ]
        )
        child_image = tag.find("img")
        if child_image is not None:
            candidates.append(str(child_image.get("alt") or ""))
    candidates.append(fallback)
    generic_fallback = ""
    for candidate in candidates:
        normalized = _normalize_space(candidate)[:500]
        if not normalized:
            continue
        if normalized.casefold() not in _GENERIC_LINK_TEXT:
            return normalized
        if not generic_fallback:
            generic_fallback = normalized

    filename = _filename_label(url)
    if filename and filename.casefold() not in _GENERIC_FILENAME_LABELS:
        return filename
    return generic_fallback or filename or url





def _uet_nearest_link_context(tag: Tag | None, maximum: int = 700) -> str:
    """Return bounded row/card/section context around a UET resource link."""

    if tag is None:
        return ""
    limit = _bounded_positive(maximum, 700, 5_000)
    pieces: list[str] = []
    container = tag.find_parent(
        ["tr", "li", "article", "section", "aside", "figure", "div"]
    )
    if isinstance(container, Tag):
        classes = " ".join(str(value) for value in (container.get("class") or [])).casefold()
        identifier = str(container.get("id") or "").casefold()
        # Avoid swallowing a full page wrapper or mega-menu into one label.
        if (
            container.name in {"tr", "li", "article", "section", "aside", "figure"}
            or any(token in f"{classes} {identifier}" for token in (
                "card", "notice", "announcement", "alert", "download", "news", "event"
            ))
        ):
            value = _bounded_text(container, limit)
            if value:
                pieces.append(value)
    # Row/card context is already specific and avoids a potentially quadratic
    # backward scan on giant notice tables. Use the nearest heading only when no
    # bounded container context was available.
    if not pieces:
        previous = tag.find_previous(["h1", "h2", "h3", "h4", "h5", "h6"])
        if isinstance(previous, Tag):
            value = _bounded_text(previous, min(300, limit))
            if value:
                pieces.append(value)
    return _normalize_space(" — ".join(dict.fromkeys(pieces)))[:limit]


def _uet_contextual_link_label(
    tag: Tag | None,
    url: str,
    fallback: str,
    site_family: int,
    options: HtmlExtractorOptions,
) -> str:
    label = _meaningful_link_text(tag, url, fallback)
    if not options.enable_uet_site_profiles or site_family == _UET_SITE_GENERIC:
        return label
    lowered = label.casefold()
    # Filename stems such as "home" and "index" are weak only when inferred
    # from a URL. As visible anchor text they are legitimate navigation labels
    # and should not trigger an expensive contextual back-scan.
    generic = lowered in _GENERIC_LINK_TEXT
    direct_haystack = f"{label} {url}".casefold()
    direct_important = any(
        token in direct_haystack for token in _UET_IMPORTANT_RESOURCE_KEYWORDS
    )
    # Context lookup can be expensive on enormous legacy menus. Avoid walking
    # ancestors/previous headings unless it can improve a generic or important
    # resource label.
    if not generic and label != url and not direct_important:
        return label[:700]
    context = _uet_nearest_link_context(tag, options.max_contextual_link_characters)
    important = direct_important or any(
        token in context.casefold() for token in _UET_IMPORTANT_RESOURCE_KEYWORDS
    )
    if context and (generic or label == url or len(label) < 5):
        label = context
    if options.include_resource_context_dates and important:
        date_match = _UET_DATE_RE.search(context)
        if date_match and date_match.group(0).casefold() not in label.casefold():
            label = f"{label} — {date_match.group(0)}"
    return _normalize_space(label)[:700] or _filename_label(url) or url


def _resource_kind_from_context(url: str, tag: Tag | None) -> str:
    kind = _resource_kind(url)
    if kind != "page" or tag is None:
        return kind
    type_hint = str(tag.get("type") or tag.get("data-type") or "").casefold()
    download_name = str(tag.get("download") or "")
    hint = f"{type_hint} {download_name}".casefold()
    if "pdf" in hint:
        return "pdf"
    if any(token in hint for token in ("word", "docx", "msword")):
        return "document"
    if any(token in hint for token in ("excel", "spreadsheet", "xlsx")):
        return "spreadsheet"
    if any(token in hint for token in ("image/", "jpeg", "png", "webp")):
        return "image"
    return kind


def _resource_priority(
    url: str,
    label: str,
    kind: str,
    tag: Tag | None,
    site_family: int,
) -> int:
    """Rank late student-critical resources above early mega-menu links."""

    haystack = f"{label} {url}".casefold()
    score = 0
    if kind != "page":
        score += 120
    if kind in {"pdf", "document", "spreadsheet", "calendar"}:
        score += 60
    score += 18 * sum(token in haystack for token in _UET_IMPORTANT_RESOURCE_KEYWORDS)
    if _UET_DATE_RE.search(label):
        score += 35
    try:
        host = (urllib.parse.urlsplit(url).hostname or "").casefold()
    except (ValueError, UnicodeError):
        host = ""
    if host.endswith(_UET_HOST_SUFFIX):
        score += 15
    if host in _UET_LOW_VALUE_EXTERNAL_HOSTS:
        score -= 100
    if tag is not None:
        if _has_named_ancestor(tag, {"nav", "header", "footer"}):
            score -= 55
        rels = _rel_values(tag)
        if "download" in rels or tag.has_attr("download"):
            score += 30
        classes = " ".join(str(value) for value in (tag.get("class") or [])).casefold()
        if any(token in classes for token in ("notice", "announcement", "download", "merit")):
            score += 25
    if site_family != _UET_SITE_GENERIC:
        score += 5
    return score


def _has_named_ancestor(
    tag: Tag,
    names: set[str] | frozenset[str],
    maximum_depth: int = 64,
) -> bool:
    """Return whether a bounded ancestor chain contains a named element.

    Beautiful Soup's ``find_parent`` walks an unbounded chain. On adversarially
    deep markup, repeating that walk for every link becomes quadratic. Site
    chrome is practically near its descendants, so a bounded direct walk keeps
    the heuristic useful while guaranteeing predictable work.
    """

    accepted = {name.casefold() for name in names}
    parent = tag.parent
    depth = 0
    while isinstance(parent, Tag) and depth < maximum_depth:
        if (parent.name or "").casefold() in accepted:
            return True
        parent = parent.parent
        depth += 1
    return False


def _link_label_quality(label: str, url: str) -> tuple[int, int]:
    normalized = _normalize_space(label)
    if not normalized:
        return (0, 0)
    lowered = normalized.casefold()
    if normalized == url or lowered.startswith(("http://", "https://")):
        return (0, len(normalized))
    if lowered in _GENERIC_FILENAME_LABELS:
        return (1, len(normalized))
    if lowered in _GENERIC_LINK_TEXT:
        return (2, len(normalized))
    return (3, min(len(normalized), 500))

def _rel_values(tag: Tag) -> set[str]:
    raw = tag.get("rel") or []
    if isinstance(raw, str):
        raw = raw.split()
    return {str(value).casefold() for value in raw}


def _meta_robots_directives(
    soup: BeautifulSoup,
    names: Sequence[str] = ("robots",),
) -> set[str]:
    """Return directives for explicitly configured robots meta names.

    User-agent-specific names such as ``googlebot`` are not merged into generic
    crawler policy unless the caller opts in through ``robots_meta_names``.
    """

    accepted = {value.casefold() for value in _bounded_string_tuple(names, 100)}
    if not accepted:
        return set()
    directives: set[str] = set()
    for tag in soup.find_all("meta", attrs={"name": True}):
        if str(tag.get("name") or "").strip().casefold() not in accepted:
            continue
        content = str(tag.get("content") or "")
        directives.update(
            token.strip().casefold()
            for token in re.split(r"[,\s]+", content)
            if token.strip()
        )
    return directives

@dataclass
class _StructuredData:
    facts: list[str] = field(default_factory=list)
    urls: list[tuple[str, str]] = field(default_factory=list)
    scripts_seen: int = 0
    scripts_parsed: int = 0
    parse_errors: int = 0
    nodes_visited: int = 0
    truncated: int = 0
    microdata_nodes_seen: int = 0
    rdfa_nodes_seen: int = 0
    microdata_urls: int = 0
    rdfa_urls: int = 0
    microdata_facts: int = 0
    rdfa_facts: int = 0
    json_ld_scripts_skipped_oversize: int = 0
    attribute_structured_truncated: int = 0


def _clean_json_ld_text(value: str) -> str:
    """Remove common legacy wrappers around an otherwise complete JSON value."""

    text = str(value or "").lstrip("\ufeff").strip()
    for _ in range(4):
        previous = text
        if text.endswith(";"):
            text = text[:-1].rstrip()
        if text.startswith("<!--") and text.endswith("-->"):
            text = text[4:-3].strip()
        if text.startswith("<![CDATA[") and text.endswith("]]>"):
            text = text[9:-3].strip()
        if text == previous:
            break
    return text


def _strict_json_loads(text: str) -> Any:
    def reject_constant(value: str) -> None:
        raise ValueError(f"non-standard JSON constant: {value}")

    return json.loads(text, parse_constant=reject_constant)


def _bounded_mapping_items(
    mapping: dict[Any, Any], maximum: int = 1_000
) -> tuple[list[tuple[Any, Any]], bool]:
    items = list(itertools.islice(mapping.items(), maximum + 1))
    return items[:maximum], len(items) > maximum

def _flatten_structured_scalar(
    value: Any,
    *,
    depth: int = 0,
    maximum_depth: int = 8,
) -> str:
    """Return a compact, bounded human-readable structured-data value."""

    if depth > maximum_depth:
        return ""
    if isinstance(value, (str, int, float)) and not isinstance(value, bool):
        return _normalize_space(str(value))[:2_000]
    if isinstance(value, list):
        values = [
            _flatten_structured_scalar(
                item,
                depth=depth + 1,
                maximum_depth=maximum_depth,
            )
            for item in value[:20]
        ]
        return "; ".join(item for item in values if item)[:2_000]
    if isinstance(value, dict):
        # Prefer a direct human label for nested entities such as organizer,
        # provider, or location. Fall back to a compact postal address/value.
        for key in ("name", "headline", "@value", "value"):
            item = _flatten_structured_scalar(
                value.get(key),
                depth=depth + 1,
                maximum_depth=maximum_depth,
            )
            if item:
                return item[:2_000]
        parts: list[str] = []
        for key in (
            "streetAddress",
            "addressLocality",
            "addressRegion",
            "postalCode",
            "addressCountry",
        ):
            item = _flatten_structured_scalar(
                value.get(key),
                depth=depth + 1,
                maximum_depth=maximum_depth,
            )
            if item:
                parts.append(item)
        if parts:
            return ", ".join(parts)[:2_000]
        price = _flatten_structured_scalar(
            value.get("price"),
            depth=depth + 1,
            maximum_depth=maximum_depth,
        )
        currency = _flatten_structured_scalar(
            value.get("priceCurrency"),
            depth=depth + 1,
            maximum_depth=maximum_depth,
        )
        if price or currency:
            return " ".join(item for item in (price, currency) if item)[:2_000]
    return ""

def _structured_property_names(raw: Any) -> list[str]:
    """Normalize Microdata/RDFa property tokens without resolving vocabularies.

    Absolute property URLs and compact IRIs are reduced to their terminal name
    solely for matching a small allowlist.  The original markup is never
    rewritten, and unknown properties remain available as visible DOM text.
    """

    if raw is None:
        return []
    values = raw if isinstance(raw, (list, tuple)) else str(raw).split()
    output: list[str] = []
    for value in values:
        token = _normalize_space(str(value))
        if not token:
            continue
        terminal = token.strip("[]").rstrip("/#").rsplit("#", 1)[-1].rsplit("/", 1)[-1]
        if ":" in terminal:
            terminal = terminal.rsplit(":", 1)[-1]
        terminal = terminal.strip("[]").casefold()
        if terminal and terminal not in output:
            output.append(terminal)
    return output


def _structured_element_value(tag: Tag, *, rdfa: bool) -> tuple[str, bool]:
    """Return ``(value, is_url_value)`` using common Microdata/RDFa rules."""

    name = (tag.name or "").casefold()
    if rdfa:
        # RDFa resource-valued properties use @resource, @href, or @src unless
        # @content/@datatype explicitly makes the object a literal.
        if tag.has_attr("content"):
            return _normalize_space(str(tag.get("content") or "")), False
        if not tag.has_attr("datatype"):
            for attribute in ("resource", "href", "src"):
                if tag.has_attr(attribute):
                    return str(tag.get(attribute) or "").strip(), True
    if name == "meta":
        return _normalize_space(str(tag.get("content") or "")), False
    if name in {"audio", "embed", "iframe", "img", "source", "track", "video"}:
        return str(tag.get("src") or "").strip(), True
    if name in {"a", "area", "link"}:
        return str(tag.get("href") or "").strip(), True
    if name == "object":
        return str(tag.get("data") or "").strip(), True
    if name in {"data", "meter"}:
        return _normalize_space(str(tag.get("value") or "")), False
    if name == "time":
        value = str(tag.get("datetime") or "").strip()
        return _normalize_space(value or _bounded_text(tag, 2_000)), False
    return _bounded_text(tag, 2_000), False

def _append_structured_url(
    result: _StructuredData,
    seen: set[tuple[str, str]],
    raw_url: str,
    label: str,
    source: str,
) -> None:
    value = _clean_raw_url(raw_url)
    if not value or value.startswith("_:"):
        return
    try:
        parsed = urllib.parse.urlsplit(value)
    except (ValueError, UnicodeError):
        return
    # RDFa compact IRIs, URNs, mailto/tel links, and other non-HTTP absolute
    # identifiers are metadata identifiers rather than fetchable page URLs.
    if parsed.scheme and parsed.scheme.casefold() not in {"http", "https"}:
        return
    pair = (value, label)
    if pair in seen:
        return
    seen.add(pair)
    result.urls.append(pair)
    if source == "microdata":
        result.microdata_urls += 1
    elif source == "rdfa":
        result.rdfa_urls += 1


def _append_structured_fact(
    result: _StructuredData,
    seen: set[str],
    properties: Sequence[str],
    value: str,
    source: str,
    maximum: int,
) -> None:
    if len(result.facts) >= maximum:
        return
    normalized = _normalize_space(value)
    if not normalized or len(normalized) > 2_000:
        return
    for prop in properties:
        label = _STRUCTURED_FACT_KEYS.get(prop.casefold())
        if not label:
            continue
        fact = f"{label}: {normalized}"
        key = fact.casefold()
        if key in seen:
            return
        seen.add(key)
        result.facts.append(fact)
        if source == "microdata":
            result.microdata_facts += 1
        elif source == "rdfa":
            result.rdfa_facts += 1
        return


def _extract_attribute_structured_data(
    soup: BeautifulSoup,
    options: HtmlExtractorOptions,
    result: _StructuredData,
    fact_seen: set[str],
    url_seen: set[tuple[str, str]],
) -> None:
    """Harvest bounded Microdata and RDFa facts/URLs from the active DOM.

    The DOM is traversed once. This matters on large legacy pages, where three
    independent ``find_all`` calls would allocate three result sets and revisit
    the same nodes. Unknown properties remain represented by visible page text;
    only a conservative allowlist becomes supplemental facts or frontier URLs.
    """

    maximum_nodes = _bounded_nonnegative(
        options.max_attribute_structured_nodes, 20_000, 200_000
    )
    maximum_facts = _bounded_nonnegative(options.max_structured_facts, 80, 1_000)
    visited = 0

    for node in soup.descendants:
        if not isinstance(node, Tag):
            continue
        tag = node
        has_microdata = tag.has_attr("itemscope") or tag.has_attr("itemprop")
        has_rdfa = any(
            tag.has_attr(attribute)
            for attribute in (
                "about",
                "resource",
                "property",
                "typeof",
                "vocab",
                "prefix",
                "rev",
            )
        )
        if not has_microdata and not has_rdfa:
            continue
        if visited >= maximum_nodes:
            result.attribute_structured_truncated = 1
            return
        visited += 1

        if has_microdata:
            result.microdata_nodes_seen += 1
            itemid = str(tag.get("itemid") or "").strip()
            if options.discover_microdata_urls and itemid:
                _append_structured_url(
                    result, url_seen, itemid, "Microdata item", "microdata"
                )

            if tag.has_attr("itemprop"):
                properties = _structured_property_names(tag.get("itemprop"))
                value, is_url = _structured_element_value(tag, rdfa=False)
                if value:
                    if options.discover_microdata_urls and (
                        is_url
                        or any(
                            prop in _STRUCTURED_URL_PROPERTIES
                            for prop in properties
                        )
                    ):
                        label = (
                            f"Microdata {properties[0]}"
                            if properties
                            else "Microdata URL"
                        )
                        _append_structured_url(
                            result, url_seen, value, label, "microdata"
                        )
                    if not is_url:
                        _append_structured_fact(
                            result,
                            fact_seen,
                            properties,
                            value,
                            "microdata",
                            maximum_facts,
                        )

        if not has_rdfa:
            continue
        result.rdfa_nodes_seen += 1

        # Subjects and resources can be URL references without a visible link.
        # Vocabulary declarations and typeof values identify schemas/classes,
        # not crawl destinations, and are therefore intentionally excluded.
        if options.discover_rdfa_urls:
            for attribute, label in (
                ("about", "RDFa subject"),
                ("resource", "RDFa resource"),
            ):
                raw = str(tag.get(attribute) or "").strip()
                if raw:
                    _append_structured_url(
                        result, url_seen, raw, label, "rdfa"
                    )

        properties = _structured_property_names(tag.get("property"))
        if properties:
            value, is_url = _structured_element_value(tag, rdfa=True)
            if value:
                if options.discover_rdfa_urls and (
                    is_url
                    or any(
                        prop in _STRUCTURED_URL_PROPERTIES
                        for prop in properties
                    )
                ):
                    _append_structured_url(
                        result,
                        url_seen,
                        value,
                        f"RDFa {properties[0]}",
                        "rdfa",
                    )
                if not is_url:
                    _append_structured_fact(
                        result,
                        fact_seen,
                        properties,
                        value,
                        "rdfa",
                        maximum_facts,
                    )

        # RDFa rel/rev triples may put their object in href/src when resource is
        # absent. Standard anchors are deduplicated by _DiscoveryCollector.
        if options.discover_rdfa_urls and (
            tag.has_attr("rel") or tag.has_attr("rev")
        ):
            raw = str(
                tag.get("resource")
                or tag.get("href")
                or tag.get("src")
                or ""
            ).strip()
            if raw:
                _append_structured_url(
                    result, url_seen, raw, "RDFa relation", "rdfa"
                )


def _extract_structured_data(
    soup: BeautifulSoup, options: HtmlExtractorOptions
) -> _StructuredData:
    result = _StructuredData()
    max_chars = _bounded_nonnegative(options.max_json_ld_chars, 1_000_000, 20_000_000)
    max_nodes = _bounded_nonnegative(options.max_json_ld_nodes, 10_000, 100_000)
    max_facts = _bounded_nonnegative(options.max_structured_facts, 80, 1_000)
    fact_seen: set[str] = set()
    url_seen: set[tuple[str, str]] = set()
    remaining_chars = max_chars
    max_scripts = _bounded_nonnegative(options.max_json_ld_scripts, 100, 10_000)

    # Stream through descendants instead of materializing a CSS-selection result
    # for every JSON-LD script. Oversized scripts are skipped as whole invalid
    # units rather than truncated into guaranteed JSON parse errors; the budget
    # remains available for later, smaller metadata blocks.
    for node in soup.descendants:
        if not isinstance(node, Tag) or (node.name or "").casefold() != "script":
            continue
        type_value = (
            str(node.get("type") or "")
            .split(";", 1)[0]
            .strip()
            .casefold()
        )
        if type_value != "application/ld+json":
            continue
        if result.scripts_seen >= max_scripts:
            result.truncated = 1
            break
        result.scripts_seen += 1
        if remaining_chars <= 0 or result.nodes_visited >= max_nodes:
            result.truncated = 1
            break
        raw = node.string if node.string is not None else node.get_text("", strip=False)
        if not raw:
            continue
        raw_text = str(raw)
        if len(raw_text) > remaining_chars:
            result.json_ld_scripts_skipped_oversize += 1
            result.truncated = 1
            continue
        text = _clean_json_ld_text(raw_text)
        remaining_chars -= len(raw_text)
        if not text:
            continue
        try:
            payload = _strict_json_loads(text)
        except (json.JSONDecodeError, TypeError, ValueError, RecursionError):
            result.parse_errors += 1
            continue
        result.scripts_parsed += 1

        # One bounded traversal extracts both URL references and useful facts.
        # The previous implementation walked every JSON-LD tree twice and could
        # not emit composite values such as PostalAddress dictionaries.
        stack: list[tuple[str, str, Any]] = [("", "", payload)]
        while stack and result.nodes_visited < max_nodes:
            key, parent_key, node = stack.pop()
            result.nodes_visited += 1
            lowered_key = key.casefold()
            lowered_parent = parent_key.casefold()

            label = _STRUCTURED_FACT_KEYS.get(lowered_key)
            if label and len(result.facts) < max_facts:
                value = _flatten_structured_scalar(node)
                if value and len(value) <= 2_000:
                    fact = f"{label}: {value}"
                    key_value = fact.casefold()
                    if key_value not in fact_seen:
                        fact_seen.add(key_value)
                        result.facts.append(fact)

            if isinstance(node, list):
                if len(node) > 1_000:
                    result.truncated = 1
                stack.extend(
                    (key, parent_key, item) for item in reversed(node[:1_000])
                )
                continue
            if isinstance(node, dict):
                items, container_truncated = _bounded_mapping_items(node)
                if container_truncated:
                    result.truncated = 1
                for child_key, child in reversed(items):
                    stack.append((str(child_key), lowered_key, child))
                continue
            if not isinstance(node, (str, int, float)) or isinstance(node, bool):
                continue

            text_value = _normalize_space(str(node))
            if not text_value:
                continue
            is_image_url = (
                lowered_key in _JSON_IMAGE_KEYS
                or (
                    lowered_parent in _JSON_IMAGE_KEYS
                    and lowered_key in _JSON_IMAGE_URL_KEYS
                )
            )
            if is_image_url:
                _append_structured_url(
                    result,
                    url_seen,
                    text_value,
                    "Structured-data image",
                    "jsonld",
                )
            elif lowered_key in _JSON_URL_KEYS:
                _append_structured_url(
                    result,
                    url_seen,
                    text_value,
                    "Structured-data URL",
                    "jsonld",
                )

        if result.nodes_visited >= max_nodes:
            result.truncated = 1

    _extract_attribute_structured_data(
        soup, options, result, fact_seen, url_seen
    )
    return result


def _extract_meta_facts(soup: BeautifulSoup, maximum: int) -> list[str]:
    limit = _bounded_nonnegative(maximum, 80, 1_000)
    if limit == 0:
        return []
    facts: list[str] = []
    seen: set[str] = set()
    for tag in soup.find_all("meta"):
        key = str(tag.get("name") or tag.get("property") or "").strip().casefold()
        label = _META_FACTS.get(key)
        if not label:
            continue
        value = _normalize_space(str(tag.get("content") or ""))
        if not value or len(value) > 2_000:
            continue
        fact = f"{label}: {value}"
        if fact.casefold() in seen:
            continue
        seen.add(fact.casefold())
        facts.append(fact)
        if len(facts) >= limit:
            return facts

    for tag in soup.find_all("time", datetime=True):
        value = _normalize_space(str(tag.get("datetime") or ""))
        visible = _bounded_text(tag, 2_000)
        if value and value not in visible:
            fact = f"Date/time: {value}"
            if fact.casefold() not in seen:
                seen.add(fact.casefold())
                facts.append(fact)
                if len(facts) >= limit:
                    return facts
    return facts


# ---------------------------------------------------------------------------
# Link and resource discovery
# ---------------------------------------------------------------------------


def _looks_state_changing_route(url: str) -> bool:
    """Conservatively identify GET targets that look like mutation actions.

    RFC 9110 defines GET as safe for automated retrieval, but also warns about
    applications that encode unsafe operations in query parameters. Such URLs
    remain in the resource manifest for auditability and are merely withheld
    from the automatic crawl frontier.
    """

    try:
        parsed = urllib.parse.urlsplit(url)
    except (ValueError, UnicodeError):
        return True
    segments = [
        urllib.parse.unquote(segment).casefold()
        for segment in parsed.path.split("/")
        if segment
    ]
    for segment in segments:
        basename = PurePosixPath(segment).stem
        normalized = re.sub(r"[^a-z0-9]+", "-", basename).strip("-")
        tokens = {token for token in normalized.split("-") if token}
        if tokens.intersection(_UNSAFE_ACTION_NAMES):
            return True
    try:
        query = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True, max_num_fields=256)
    except ValueError:
        return True
    false_like_values = {"0", "false", "no", "off", "none", "null"}
    for key, value in query:
        normalized_key = re.sub(r"[^a-z0-9]+", "-", key.casefold()).strip("-")
        key_tokens = {token for token in normalized_key.split("-") if token}
        if (
            key_tokens.intersection(_UNSAFE_ACTION_NAMES)
            and value.strip().casefold() not in false_like_values
        ):
            return True
        if key.casefold() not in _UNSAFE_ACTION_QUERY_KEYS:
            continue
        normalized = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
        if set(normalized.split("-")).intersection(_UNSAFE_ACTION_NAMES):
            return True
    return False


class _DiscoveryCollector:
    def __init__(
        self,
        base_url: str,
        canonical_url: str,
        document_url: str,
        policy: UrlPolicyLike,
        options: HtmlExtractorOptions,
        page_nofollow: bool,
        site_family: int = _UET_SITE_GENERIC,
    ) -> None:
        self.base_url = base_url
        self.canonical_url = canonical_url
        self.document_url = document_url
        self.page_identity_urls = {
            value for value in (canonical_url, document_url) if value
        }
        self.policy = policy
        self.options = options
        self.page_nofollow = page_nofollow
        self.site_family = site_family
        self.max_links = _bounded_nonnegative(options.max_discovered_links, 5_000, 100_000)
        self.max_resources = _bounded_nonnegative(options.max_resource_links, 500, 20_000)
        self.crawl_links: list[str] = []
        self._crawl_seen: set[str] = set()
        self._crawl_priorities: dict[str, int] = {}
        self._crawl_sources: dict[str, str] = {}
        self._crawl_priority_heap: list[tuple[int, int, str]] = []
        self._crawl_sequence = 0
        self._resources: "OrderedDict[str, HtmlResourceLink]" = OrderedDict()
        self._resource_priorities: dict[str, int] = {}
        self._resource_priority_heap: list[tuple[int, int, str]] = []
        self._resource_sequence = 0
        self._resource_candidates_limit = _bounded_nonnegative(
            options.max_priority_resource_candidates, 5_000, 100_000
        )
        self.counts: dict[str, int] = {
            "anchor_links": 0,
            "area_links": 0,
            "link_relation_links": 0,
            "meta_refresh_links": 0,
            "meta_url_links": 0,
            "embedded_document_links": 0,
            "get_form_links": 0,
            "data_attribute_links": 0,
            "legacy_script_href_links": 0,
            "legacy_select_option_links": 0,
            "static_get_request_links": 0,
            "script_navigation_matches_truncated": 0,
            "visible_text_links": 0,
            "visible_text_urls_truncated": 0,
            "json_ld_links": 0,
            "microdata_links": 0,
            "rdfa_links": 0,
            "inline_event_links": 0,
            "inline_script_links": 0,
            "inline_script_blocks_scanned": 0,
            "inline_script_blocks_skipped_type": 0,
            "inline_script_scan_truncated": 0,
            "embedded_json_blocks_parsed": 0,
            "embedded_json_parse_errors": 0,
            "embedded_json_nodes_visited": 0,
            "embedded_json_truncated": 0,
            "invalid_urls_rejected": 0,
            "unsafe_anchor_hrefs_removed": 0,
            "nofollow_links_seen": 0,
            "crawl_links_truncated": 0,
            "crawl_priority_replacements": 0,
            "low_priority_crawl_links_dropped": 0,
            "resource_links_truncated": 0,
            "unsafe_action_links_suppressed": 0,
            "static_asset_links_suppressed": 0,
            "form_submitters_truncated": 0,
            "aspnet_postback_controls": 0,
            "resource_candidates_seen": 0,
            "resource_candidate_budget_exceeded": 0,
            "resource_priority_replacements": 0,
            "low_priority_resources_dropped": 0,
            "crawl_priority_upgrades": 0,
            "resource_priority_upgrades": 0,
            "crawl_priority_heap_compactions": 0,
            "resource_priority_heap_compactions": 0,
        }

    def _remember_crawl_priority(self, url: str, priority: int) -> bool:
        current = self._crawl_priorities.get(url)
        if current is not None and priority <= current:
            return False
        self._crawl_priorities[url] = priority
        self._crawl_sequence += 1
        heapq.heappush(
            self._crawl_priority_heap,
            (priority, self._crawl_sequence, url),
        )
        maximum_heap = max(256, self.max_links * 4)
        if len(self._crawl_priority_heap) > maximum_heap:
            self._crawl_priority_heap = [
                (value, index, candidate)
                for index, (candidate, value) in enumerate(
                    self._crawl_priorities.items(), start=1
                )
                if candidate in self._crawl_seen
            ]
            heapq.heapify(self._crawl_priority_heap)
            self._crawl_sequence = max(self._crawl_sequence, len(self._crawl_priority_heap))
            self.counts["crawl_priority_heap_compactions"] += 1
        return current is not None

    def _worst_crawl_link(self) -> tuple[str, int] | None:
        while self._crawl_priority_heap:
            priority, _, url = self._crawl_priority_heap[0]
            if url in self._crawl_seen and self._crawl_priorities.get(url) == priority:
                return url, priority
            heapq.heappop(self._crawl_priority_heap)
        return None

    def _add_crawl_link(self, url: str, source: str, priority: int) -> None:
        if url in self.page_identity_urls:
            return
        if url in self._crawl_seen:
            upgraded = self._remember_crawl_priority(url, priority)
            if upgraded:
                self.counts["crawl_priority_upgrades"] += 1
            return
        if len(self.crawl_links) < self.max_links:
            self._crawl_seen.add(url)
            self.crawl_links.append(url)
            self._crawl_sources[url] = source
            self._remember_crawl_priority(url, priority)
            self.counts[source] = self.counts.get(source, 0) + 1
            return

        self.counts["crawl_links_truncated"] = 1
        if self.max_links <= 0:
            self.counts["low_priority_crawl_links_dropped"] += 1
            return
        # Preserve the legacy first-seen contract for non-UET pages. The live
        # UET estate needs a bounded priority reservoir because giant global
        # menus can otherwise consume the complete frontier before a late merit
        # list, date sheet, tender, or admission notice is encountered.
        if self.site_family == _UET_SITE_GENERIC:
            self.counts["low_priority_crawl_links_dropped"] += 1
            return
        worst = self._worst_crawl_link()
        if worst is None or priority <= worst[1]:
            self.counts["low_priority_crawl_links_dropped"] += 1
            return
        worst_url, _ = worst
        try:
            position = self.crawl_links.index(worst_url)
        except ValueError:
            self.counts["low_priority_crawl_links_dropped"] += 1
            return
        old_source = self._crawl_sources.pop(worst_url, "")
        if old_source and self.counts.get(old_source, 0) > 0:
            self.counts[old_source] -= 1
        self._crawl_seen.remove(worst_url)
        self._crawl_priorities.pop(worst_url, None)
        self.crawl_links[position] = url
        self._crawl_seen.add(url)
        self._crawl_sources[url] = source
        self._remember_crawl_priority(url, priority)
        self.counts[source] = self.counts.get(source, 0) + 1
        self.counts["crawl_priority_replacements"] += 1

    def _remember_resource_priority(self, url: str, priority: int) -> bool:
        current = self._resource_priorities.get(url)
        if current is not None and priority <= current:
            return False
        self._resource_priorities[url] = priority
        self._resource_sequence += 1
        heapq.heappush(
            self._resource_priority_heap,
            (priority, self._resource_sequence, url),
        )
        maximum_heap = max(256, self.max_resources * 4)
        if len(self._resource_priority_heap) > maximum_heap:
            self._resource_priority_heap = [
                (value, index, candidate)
                for index, (candidate, value) in enumerate(
                    self._resource_priorities.items(), start=1
                )
                if candidate in self._resources
            ]
            heapq.heapify(self._resource_priority_heap)
            self._resource_sequence = max(
                self._resource_sequence, len(self._resource_priority_heap)
            )
            self.counts["resource_priority_heap_compactions"] += 1
        return current is not None

    def _worst_resource(self) -> tuple[str, int] | None:
        while self._resource_priority_heap:
            priority, _, url = self._resource_priority_heap[0]
            if (
                url in self._resources
                and self._resource_priorities.get(url) == priority
            ):
                return url, priority
            heapq.heappop(self._resource_priority_heap)
        return None

    @property
    def resources(self) -> list[HtmlResourceLink]:
        return list(self._resources.values())

    def add(
        self,
        raw_url: str,
        label: str,
        source: str,
        *,
        tag: Tag | None = None,
        nofollow: bool = False,
        allow_crawl: bool = True,
    ) -> str:
        absolute = _absolute_url(
            raw_url,
            self.base_url,
            self.policy,
            self.options.max_url_characters,
        )
        if not absolute:
            if str(raw_url or "").strip():
                self.counts["invalid_urls_rejected"] += 1
            return ""

        effective_nofollow = nofollow or self.page_nofollow
        if effective_nofollow:
            self.counts["nofollow_links_seen"] += 1
        unsafe_action = bool(
            self.options.avoid_state_changing_routes
            and _looks_state_changing_route(absolute)
        )
        if unsafe_action:
            self.counts["unsafe_action_links_suppressed"] += 1
        try:
            static_asset = PurePosixPath(
                urllib.parse.urlsplit(absolute).path.casefold()
            ).suffix in _STATIC_ASSET_EXTENSIONS
        except (ValueError, UnicodeError):
            static_asset = True
        if static_asset:
            self.counts["static_asset_links_suppressed"] += 1
        crawlable = bool(
            allow_crawl
            and not unsafe_action
            and not static_asset
            and (self.options.follow_nofollow_links or not effective_nofollow)
            and _safe_is_network_target(self.policy, absolute)
            and _safe_is_crawl_candidate(self.policy, absolute)
        )

        contextual_label = _uet_contextual_link_label(
            tag, absolute, label, self.site_family, self.options
        )
        contextual_kind = _resource_kind_from_context(absolute, tag)
        priority = _resource_priority(
            absolute, contextual_label, contextual_kind, tag, self.site_family
        )
        if crawlable:
            self._add_crawl_link(absolute, source, priority)

        if absolute in self._resources:
            existing = self._resources[absolute]
            best_label = (
                contextual_label
                if _link_label_quality(contextual_label, absolute)
                > _link_label_quality(existing.text, absolute)
                else existing.text
            )
            merged_crawlable = existing.crawlable or crawlable
            merged_nofollow = existing.nofollow and effective_nofollow
            if (
                best_label != existing.text
                or merged_crawlable != existing.crawlable
                or merged_nofollow != existing.nofollow
                or contextual_kind != existing.kind
            ):
                self._resources[absolute] = HtmlResourceLink(
                    url=absolute,
                    text=best_label,
                    kind=contextual_kind if contextual_kind != "page" else existing.kind,
                    crawlable=merged_crawlable,
                    nofollow=merged_nofollow,
                )
            remembered_priority = max(
                priority, self._resource_priorities.get(absolute, priority)
            )
            if self._remember_resource_priority(absolute, remembered_priority):
                self.counts["resource_priority_upgrades"] += 1
            return absolute

        self.counts["resource_candidates_seen"] += 1
        over_candidate_budget = bool(
            self._resource_candidates_limit > 0
            and self.counts["resource_candidates_seen"] > self._resource_candidates_limit
        )
        if over_candidate_budget:
            self.counts["resource_candidate_budget_exceeded"] = 1

        item = HtmlResourceLink(
            url=absolute,
            text=contextual_label,
            kind=contextual_kind,
            crawlable=crawlable,
            nofollow=effective_nofollow,
        )
        if len(self._resources) < self.max_resources:
            self._resources[absolute] = item
            self._remember_resource_priority(absolute, priority)
            return absolute

        self.counts["resource_links_truncated"] = 1
        if self.max_resources <= 0:
            self.counts["low_priority_resources_dropped"] += 1
            return absolute
        worst = self._worst_resource()
        if worst is None:
            self.counts["low_priority_resources_dropped"] += 1
            return absolute
        worst_url, worst_priority = worst
        # After the bounded candidate budget, only resources that can improve
        # the reservoir are retained. This keeps late critical notices eligible
        # without allowing giant pages to grow memory use.
        if priority <= worst_priority:
            self.counts["low_priority_resources_dropped"] += 1
            return absolute
        del self._resources[worst_url]
        del self._resource_priorities[worst_url]
        self._resources[absolute] = item
        self._remember_resource_priority(absolute, priority)
        self.counts["resource_priority_replacements"] += 1
        return absolute


def _looks_like_route(value: str) -> bool:
    candidate = _clean_raw_url(value)
    if not candidate:
        return False
    lowered = candidate.casefold()
    if lowered.startswith(("http://", "https://", "//", "/", "./", "../", "?")):
        return True
    if "/" in candidate and not re.search(r"\s", candidate):
        return True
    return bool(
        re.search(
            r"\.(?:php\d?|asp|aspx|html?|shtml|pdf)(?:[?#]|$)", lowered
        )
    )


def _form_method(value: Any) -> str:
    method = str(value or "").strip().casefold()
    return method if method in {"get", "post", "dialog"} else "get"


def _control_is_disabled(control: Tag) -> bool:
    if control.has_attr("disabled"):
        return True
    for fieldset in control.find_parents("fieldset"):
        if not fieldset.has_attr("disabled"):
            continue
        first_legend = fieldset.find("legend", recursive=False)
        if isinstance(first_legend, Tag) and control in first_legend.descendants:
            continue
        return True
    return False


def _control_belongs_to_form(control: Tag, form: Tag) -> bool:
    """Return whether HTML form-owner rules associate ``control`` with ``form``."""

    explicit_owner = str(control.get("form") or "").strip()
    if explicit_owner:
        return bool(form.get("id") and explicit_owner == str(form.get("id")))
    return control.find_parent("form") is form


def _iter_form_controls(
    form: Tag,
    soup: BeautifulSoup | None,
    maximum: int = 200,
) -> Iterator[Tag]:
    """Yield bounded descendant and externally-associated controls once."""

    limit = _bounded_positive(maximum, 200, 2_000)
    seen: set[int] = set()
    yielded = 0
    names = {"input", "select", "button"}

    for control in form.find_all(tuple(names), limit=limit):
        if not isinstance(control, Tag) or not _control_belongs_to_form(control, form):
            continue
        identity = id(control)
        if identity in seen:
            continue
        seen.add(identity)
        yield control
        yielded += 1
        if yielded >= limit:
            return

    form_id = str(form.get("id") or "").strip()
    if not form_id or soup is None:
        return
    for node in soup.descendants:
        if yielded >= limit:
            return
        if not isinstance(node, Tag) or (node.name or "").casefold() not in names:
            continue
        if str(node.get("form") or "").strip() != form_id:
            continue
        identity = id(node)
        if identity in seen:
            continue
        seen.add(identity)
        yield node
        yielded += 1


def _option_is_disabled(option: Tag) -> bool:
    if option.has_attr("disabled"):
        return True
    group = option.find_parent("optgroup")
    return bool(isinstance(group, Tag) and group.has_attr("disabled"))


def _safe_form_pair(
    name: str,
    value: str,
    sensitive_tokens: set[str],
) -> tuple[str, str] | None:
    normalized_name = _normalize_space(name)
    normalized_value = str(value or "").strip()
    lowered_name = normalized_name.casefold()
    normalized_identifier = re.sub(r"[^a-z0-9]+", "_", lowered_name).strip("_")
    identifier_tokens = {
        token for token in normalized_identifier.split("_") if token
    }
    sensitive = bool(
        identifier_tokens.intersection(sensitive_tokens)
        or normalized_identifier.startswith(("__viewstate", "__eventvalidation"))
        or "csrf" in normalized_identifier
        or "xsrf" in normalized_identifier
    )
    # Preset GET URLs can be logged, cached, indexed, and emailed. Never copy
    # obvious personal identifiers from hidden controls into a crawl target.
    personal_identifier_tokens = {
        "account", "applicant", "cnic", "email", "login", "mobile", "nic",
        "otp", "passport", "phone", "registration", "roll", "student",
        "username",
    }
    digits = re.sub(r"\D", "", normalized_value)
    looks_personal = bool(
        identifier_tokens.intersection(personal_identifier_tokens)
        or _CONTACT_EMAIL_RE.fullmatch(normalized_value)
        or (
            len(digits) >= 10
            and re.fullmatch(r"[+\d\s()./-]+", normalized_value) is not None
        )
    )
    if (
        not normalized_name
        or len(normalized_name) > 100
        or len(normalized_value) > 256
        or sensitive
        or looks_personal
    ):
        return None
    return normalized_name, normalized_value


def _get_form_preset_url(
    form: Tag,
    action: str,
    *,
    soup: BeautifulSoup | None = None,
    submitter: Tag | None = None,
) -> str:
    """Return a bounded GET URL containing only deterministic safe controls.

    User-editable text/file controls are excluded. Fixed hidden values, checked
    checkbox/radio values, selected options, and the activated submit button are
    retained when they are non-sensitive. Existing action-query parameters are
    replaced, matching GET form submission semantics.
    """

    sensitive_tokens = {
        "csrf", "xsrf", "token", "nonce", "session", "viewstate",
        "eventvalidation", "password", "secret", "auth", "signature",
    }
    pairs: list[tuple[str, str]] = []
    try:
        parsed = urllib.parse.urlsplit(action)
    except (ValueError, TypeError):
        return ""

    def append_pair(name: str, value: str) -> bool:
        pair = _safe_form_pair(name, value, sensitive_tokens)
        if pair is None:
            return False
        pairs.append(pair)
        return True

    for control in _iter_form_controls(form, soup, 200):
        if len(pairs) >= 32:
            break
        if _control_is_disabled(control):
            continue
        name = (control.name or "").casefold()
        if name == "input":
            input_type = str(control.get("type") or "text").strip().casefold()
            if input_type == "hidden":
                append_pair(
                    str(control.get("name") or ""),
                    str(control.get("value") or ""),
                )
            elif input_type in {"checkbox", "radio"} and control.has_attr("checked"):
                append_pair(
                    str(control.get("name") or ""),
                    str(control.get("value") if control.has_attr("value") else "on"),
                )
        elif name == "select":
            select_name = str(control.get("name") or "")
            options = [
                option
                for option in control.find_all("option", limit=200)
                if isinstance(option, Tag) and not _option_is_disabled(option)
            ]
            selected = [option for option in options if option.has_attr("selected")]
            if not control.has_attr("multiple") and not selected and options:
                selected = options[:1]
            if not control.has_attr("multiple") and len(selected) > 1:
                selected = selected[-1:]
            for option in selected:
                if len(pairs) >= 32:
                    break
                value = (
                    str(option.get("value"))
                    if option.has_attr("value")
                    else _bounded_text(option, 256)
                )
                append_pair(select_name, value)

    if (
        submitter is not None
        and len(pairs) < 32
        and _control_belongs_to_form(submitter, form)
        and not _control_is_disabled(submitter)
    ):
        submitter_name = (submitter.name or "").casefold()
        submitter_type = str(
            submitter.get("type")
            or ("submit" if submitter_name == "button" else "text")
        ).strip().casefold()
        # Image submitters contribute click coordinates; inventing them would be
        # semantically misleading, so only the action itself is retained.
        if not (submitter_name == "input" and submitter_type == "image"):
            append_pair(
                str(submitter.get("name") or ""),
                str(submitter.get("value") or ""),
            )

    if not pairs:
        return ""
    query = urllib.parse.urlencode(pairs, doseq=True)
    if len(query) > 2_048:
        return ""
    return urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, parsed.path, query, "")
    )

def _parse_meta_refresh(content: str) -> str:
    match = _META_REFRESH_RE.match(content or "")
    if not match:
        return ""
    return _clean_raw_url(match.group("quoted") or match.group("bare") or "")


def _script_type_is_discovery_source(type_value: str) -> bool:
    """Return whether an inline script can contain active routes/state data."""

    media_type = (type_value or "").split(";", 1)[0].strip().casefold()
    if not media_type or media_type in {"module", "importmap", "speculationrules"}:
        return True
    if media_type in {
        "text/javascript", "application/javascript", "application/ecmascript",
        "text/ecmascript", "application/json", "text/json",
    }:
        return True
    return media_type.endswith("+json") and "ld+json" not in media_type

def _script_type_is_json_payload(type_value: str) -> bool:
    media_type = (type_value or "").split(";", 1)[0].strip().casefold()
    return bool(
        media_type in {
            "application/json", "text/json", "importmap", "speculationrules"
        }
        or (media_type.endswith("+json") and "ld+json" not in media_type)
    )

def _extract_routes_from_embedded_json(
    payload: Any,
    maximum_nodes: int,
) -> tuple[list[str], int, int]:
    """Extract URL-like values under conservative navigation property names."""

    limit = _bounded_nonnegative(maximum_nodes, 20_000, 200_000)
    if limit == 0:
        return [], 0, 0
    route_keys = {
        "url", "urls", "href", "path", "pathname", "route", "link",
        "permalink", "canonical", "canonicalurl", "resolvedurl", "aspath",
        "destination", "redirect", "downloadurl", "contenturl", "embedurl",
    }
    output: list[str] = []
    seen: set[str] = set()
    visited = 0
    truncated = 0
    stack: list[tuple[str, Any]] = [("", payload)]
    while stack:
        if visited >= limit:
            truncated = 1
            break
        key, node = stack.pop()
        visited += 1
        lowered_key = key.casefold()
        if isinstance(node, dict):
            items, container_truncated = _bounded_mapping_items(node)
            truncated |= int(container_truncated)
            for child_key, child in reversed(items):
                stack.append((str(child_key), child))
            continue
        if isinstance(node, list):
            if len(node) > 1_000:
                truncated = 1
            stack.extend((key, item) for item in reversed(node[:1_000]))
            continue
        if not isinstance(node, str) or lowered_key not in route_keys:
            continue
        candidate = _normalize_space(node)
        if candidate and _looks_like_route(candidate) and candidate not in seen:
            seen.add(candidate)
            output.append(candidate)
    return output, visited, truncated

def _strip_javascript_comments(text: str) -> str:
    """Remove JS comments without damaging strings or joining source lines.

    URL-looking snippets in commented-out JavaScript are source history rather
    than active navigation. Regex-only stripping corrupts strings such as
    ``"https://..."``. This bounded lexer tracks quotes, template literals,
    escapes, line/block comments, and legacy HTML comment wrappers. HTML-style
    markers are recognized only before the first non-whitespace character on a
    line, avoiding false positives for ordinary ``-->`` operators/expressions.
    """

    if not text:
        return ""
    output: list[str] = []
    state = "normal"
    escaped = False
    line_only_whitespace = True
    index = 0
    length = len(text)

    while index < length:
        char = text[index]
        nxt = text[index + 1] if index + 1 < length else ""

        if state == "line_comment":
            if char in "\r\n":
                output.append(char)
                state = "normal"
                line_only_whitespace = True
            else:
                output.append(" ")
            index += 1
            continue

        if state == "block_comment":
            if char == "*" and nxt == "/":
                output.extend((" ", " "))
                index += 2
                state = "normal"
                continue
            if char in "\r\n":
                output.append(char)
                line_only_whitespace = True
            else:
                output.append(" ")
            index += 1
            continue

        if state in {"single", "double", "template"}:
            output.append(char)
            if char in "\r\n":
                line_only_whitespace = True
            elif not char.isspace():
                line_only_whitespace = False
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif (
                (state == "single" and char == "'")
                or (state == "double" and char == '"')
                or (state == "template" and char == "`")
            ):
                state = "normal"
            index += 1
            continue

        if line_only_whitespace and (
            text.startswith("<!--", index) or text.startswith("-->", index)
        ):
            marker_length = 4 if text.startswith("<!--", index) else 3
            output.extend(" " for _ in range(marker_length))
            index += marker_length
            state = "line_comment"
            continue
        if char == "/" and nxt == "/":
            output.extend((" ", " "))
            index += 2
            state = "line_comment"
            continue
        if char == "/" and nxt == "*":
            output.extend((" ", " "))
            index += 2
            state = "block_comment"
            continue

        if char == "'":
            state = "single"
        elif char == '"':
            state = "double"
        elif char == "`":
            state = "template"

        output.append(char)
        if char in "\r\n":
            line_only_whitespace = True
        elif not char.isspace():
            line_only_whitespace = False
        index += 1

    return "".join(output)


def _decode_javascript_string_literal(literal: str, maximum: int = 8_192) -> str:
    """Decode a bounded single/double-quoted JavaScript string without eval."""

    if len(literal) < 2 or literal[0] not in {"'", '"', "`"} or literal[-1] != literal[0]:
        return ""
    if literal[0] == "`" and "${" in literal:
        return ""
    limit = _bounded_positive(maximum, 8_192, 65_536)
    source = literal[1:-1]
    output: list[str] = []
    index = 0
    escape_map = {
        "b": "\b",
        "f": "\f",
        "n": "\n",
        "r": "\r",
        "t": "\t",
        "v": "\v",
        "0": "\0",
        "\\": "\\",
        "/": "/",
        "'": "'",
        '"': '"',
    }
    while index < len(source) and len(output) < limit:
        char = source[index]
        if char != "\\":
            output.append(char)
            index += 1
            continue
        if index + 1 >= len(source):
            return ""
        nxt = source[index + 1]
        if nxt in "\r\n":
            index += 2
            if nxt == "\r" and index < len(source) and source[index] == "\n":
                index += 1
            continue
        if nxt in escape_map:
            output.append(escape_map[nxt])
            index += 2
            continue
        if nxt == "x" and index + 3 < len(source):
            digits = source[index + 2 : index + 4]
            if re.fullmatch(r"[0-9A-Fa-f]{2}", digits):
                output.append(chr(int(digits, 16)))
                index += 4
                continue
        if nxt == "u":
            if index + 2 < len(source) and source[index + 2] == "{":
                close = source.find("}", index + 3, min(len(source), index + 12))
                if close != -1:
                    digits = source[index + 3 : close]
                    if re.fullmatch(r"[0-9A-Fa-f]{1,6}", digits):
                        codepoint = int(digits, 16)
                        if codepoint <= 0x10FFFF:
                            output.append(chr(codepoint))
                            index = close + 1
                            continue
            elif index + 5 < len(source):
                digits = source[index + 2 : index + 6]
                if re.fullmatch(r"[0-9A-Fa-f]{4}", digits):
                    output.append(chr(int(digits, 16)))
                    index += 6
                    continue
        # In non-strict JavaScript, an unknown escape denotes the escaped
        # character itself. Preserve that behavior without executing code.
        output.append(nxt)
        index += 2
    value = "".join(output)
    return value if len(value) <= limit else ""


def _iter_script_navigation_urls(
    text: str,
    maximum: int = 2_000,
) -> Iterator[str]:
    """Yield bounded, statically-decidable navigation destinations."""

    limit = _bounded_nonnegative(maximum, 2_000, 20_000)
    if limit == 0:
        return
    seen: set[str] = set()
    for pattern in (*_SCRIPT_NAVIGATION_PATTERNS, _SCRIPT_ROUTE_PROPERTY_RE):
        for match in pattern.finditer(text):
            value = _decode_javascript_string_literal(match.group("literal"))
            if value and value not in seen:
                seen.add(value)
                yield value
                if len(seen) >= limit:
                    return


def _iter_static_get_request_urls(
    text: str,
    maximum: int = 2_000,
) -> Iterator[str]:
    """Yield bounded URL literals from explicit static HTTP GET calls."""

    limit = _bounded_nonnegative(maximum, 2_000, 20_000)
    if limit == 0:
        return
    seen: set[str] = set()
    for pattern in _SCRIPT_STATIC_GET_PATTERNS:
        for match in pattern.finditer(text):
            value = _decode_javascript_string_literal(match.group("literal"))
            if value and value not in seen:
                seen.add(value)
                yield value
                if len(seen) >= limit:
                    return


def _collect_script_url_discoveries(
    text: str,
    maximum: int = 2_000,
    *,
    include_static_get: bool = True,
) -> tuple[list[tuple[str, bool]], int]:
    """Return bounded unique script URLs and whether the cap was reached.

    The boolean in each tuple is true for an explicit static GET request and
    false for a navigation literal.  A shared budget prevents a page from using
    separate pattern families to exceed ``max_script_navigation_matches``.
    """

    limit = _bounded_nonnegative(maximum, 2_000, 20_000)
    if limit == 0:
        return [], 0
    output: list[tuple[str, bool]] = []
    seen: set[str] = set()

    def consume(values: Iterable[str], is_static_get: bool) -> bool:
        for value in values:
            if value in seen:
                continue
            seen.add(value)
            output.append((value, is_static_get))
            if len(output) >= limit:
                return True
        return False

    if consume(_iter_script_navigation_urls(text, limit), False):
        return output, 1
    if include_static_get and consume(
        _iter_static_get_request_urls(text, max(0, limit - len(output))), True
    ):
        return output, 1
    return output, 0


_EXTRACTED_SCRIPT_IMAGE_ATTRIBUTE = "data-uet-extractor-script-images"


def _remember_script_image_on_tag(tag: Tag, url: str) -> None:
    """Retain a safely normalized scripted image target for vision ranking."""

    if not url or _resource_kind(url) != "image":
        return
    current = tag.get(_EXTRACTED_SCRIPT_IMAGE_ATTRIBUTE)
    values: list[str]
    if isinstance(current, list):
        values = [str(item) for item in current]
    elif current:
        try:
            parsed = json.loads(str(current))
            values = [str(item) for item in parsed] if isinstance(parsed, list) else []
        except (TypeError, ValueError, json.JSONDecodeError):
            values = []
    else:
        values = []
    if url not in values and len(values) < 32:
        values.append(url)
    tag[_EXTRACTED_SCRIPT_IMAGE_ATTRIBUTE] = json.dumps(
        values, ensure_ascii=False, separators=(",", ":")
    )


def _select_looks_like_navigation(select: Tag) -> bool:
    """Identify legacy jump-menu selects without treating normal forms as links."""

    handler = " ".join(
        str(select.get(attribute) or "")
        for attribute in ("onchange", "onclick", "oninput")
    ).casefold()
    identity = " ".join(
        [
            str(select.get("id") or ""),
            str(select.get("name") or ""),
            " ".join(str(value) for value in (select.get("class") or [])),
        ]
    ).casefold()
    handler_signal = any(
        token in handler
        for token in (
            "mm_jumpmenu", "location", "window.open", "navigate",
            "redirect", "selectedindex", "this.options", "document.url",
        )
    )
    identity_signal = bool(
        re.search(r"(?:^|[-_\s])(?:jump|quick[-_ ]?link|navigation|navmenu)(?:$|[-_\s])", identity)
    )
    return handler_signal or identity_signal


def _iter_visible_text_urls(
    soup: BeautifulSoup,
    maximum_characters: int,
    maximum_urls: int,
) -> tuple[list[tuple[str, Tag | None]], int]:
    char_limit = _bounded_nonnegative(maximum_characters, 1_000_000, 10_000_000)
    url_limit = _bounded_nonnegative(maximum_urls, 250, 5_000)
    if char_limit == 0 or url_limit == 0:
        return [], 0
    output: list[tuple[str, Tag | None]] = []
    seen: set[str] = set()
    scanned = 0
    truncated = 0
    excluded = {"script", "style", "template", "noscript", "textarea", "code", "pre"}
    for node in soup.descendants:
        if not isinstance(node, str) or isinstance(node, Comment):
            continue
        parent = node.parent if isinstance(node.parent, Tag) else None
        if parent is not None and (parent.name or "").casefold() in excluded:
            continue
        value = str(node)
        remaining = char_limit - scanned
        if remaining <= 0:
            truncated = 1
            break
        fragment = value[:remaining]
        scanned += len(fragment)
        if len(value) > remaining:
            truncated = 1
        matches: list[tuple[int, str]] = [
            (match.start(), match.group(0))
            for match in _VISIBLE_HTTP_URL_RE.finditer(fragment)
        ]
        matches.extend(
            (match.start(), "https://" + match.group(0))
            for match in _VISIBLE_BARE_UET_URL_RE.finditer(fragment)
        )
        for _, raw_candidate in sorted(matches, key=lambda item: item[0]):
            candidate = raw_candidate.rstrip(".,;:!?)]}\\\"'")
            # Trim a closing parenthesis only when it is unmatched.
            while candidate.endswith(")") and candidate.count("(") < candidate.count(")"):
                candidate = candidate[:-1]
            if not candidate or candidate in seen:
                continue
            seen.add(candidate)
            output.append((candidate, parent))
            if len(output) >= url_limit:
                return output, 1
        if truncated:
            break
    return output, truncated


def _discover_links_and_resources(
    soup: BeautifulSoup,
    base_url: str,
    document_url: str,
    canonical_url: str,
    policy: UrlPolicyLike,
    options: HtmlExtractorOptions,
    structured: _StructuredData,
    robots_directives: set[str],
    site_family: int = _UET_SITE_GENERIC,
) -> tuple[list[str], list[HtmlResourceLink], dict[str, int]]:
    page_nofollow = "nofollow" in robots_directives or "none" in robots_directives
    document_identity = _absolute_url(
        document_url, document_url, policy, options.max_url_characters
    ) or document_url
    collector = _DiscoveryCollector(
        base_url,
        canonical_url,
        document_identity,
        policy,
        options,
        page_nofollow,
        site_family,
    )

    # Standard hyperlinks.  Normalize hrefs in the source tree so Markdown uses
    # the same canonical URLs that enter the frontier.
    for tag in soup.find_all("a", href=True):
        href = str(tag.get("href") or "")
        stripped_href = href.strip()
        lowered = stripped_href.casefold()
        if lowered.startswith("javascript:__dopostback"):
            collector.counts["aspnet_postback_controls"] += 1
        if lowered.startswith("javascript:"):
            if options.discover_legacy_script_hrefs:
                script_text = _strip_javascript_comments(
                    stripped_href[len("javascript:") :]
                )
                discoveries, truncated = _collect_script_url_discoveries(
                    script_text,
                    options.max_script_navigation_matches,
                    include_static_get=options.discover_static_get_requests,
                )
                for raw, is_static_get in discoveries:
                    absolute = collector.add(
                        raw,
                        str(
                            tag.get("aria-label")
                            or tag.get("title")
                            or (
                                "Scripted GET resource"
                                if is_static_get
                                else "Legacy scripted link"
                            )
                        ),
                        "static_get_request_links"
                        if is_static_get
                        else "legacy_script_href_links",
                        tag=tag,
                        nofollow="nofollow" in _rel_values(tag),
                        allow_crawl=_resource_kind(
                            _absolute_url(
                                raw,
                                base_url,
                                policy,
                                options.max_url_characters,
                            )
                        )
                        not in {"image", "audio", "video", "archive"},
                    )
                    _remember_script_image_on_tag(tag, absolute)
                collector.counts["script_navigation_matches_truncated"] |= truncated
            tag.attrs.pop("href", None)
            collector.counts["unsafe_anchor_hrefs_removed"] += 1
            continue
        if lowered.startswith(("mailto:", "tel:")):
            if (
                len(stripped_href) > _bounded_positive(
                    options.max_url_characters, 8_192, 65_536
                )
                or any(ord(character) < 0x20 for character in stripped_href)
            ):
                tag.attrs.pop("href", None)
                collector.counts["unsafe_anchor_hrefs_removed"] += 1
            continue
        if stripped_href.startswith("#"):
            if any(ord(character) < 0x20 for character in stripped_href):
                tag.attrs.pop("href", None)
                collector.counts["unsafe_anchor_hrefs_removed"] += 1
            continue
        nofollow = "nofollow" in _rel_values(tag)
        absolute = collector.add(
            href,
            "",
            "anchor_links",
            tag=tag,
            nofollow=nofollow,
        )
        if absolute:
            tag["href"] = absolute
        else:
            tag.attrs.pop("href", None)
            collector.counts["unsafe_anchor_hrefs_removed"] += 1

    for tag in soup.find_all("area", href=True):
        nofollow = "nofollow" in _rel_values(tag)
        absolute = collector.add(
            str(tag.get("href") or ""),
            str(tag.get("alt") or "Image-map link"),
            "area_links",
            tag=tag,
            nofollow=nofollow,
        )
        if absolute:
            tag["href"] = absolute
        else:
            tag.attrs.pop("href", None)

    if options.discover_link_relations:
        for tag in soup.find_all("link", href=True):
            rels = _rel_values(tag)
            if not rels.intersection(_LINK_RELATIONS):
                continue
            collector.add(
                str(tag.get("href") or ""),
                str(tag.get("title") or tag.get("hreflang") or "Related page"),
                "link_relation_links",
                tag=tag,
                allow_crawl=not bool(rels.intersection({"canonical"})),
            )

    if options.discover_meta_refresh:
        for tag in soup.select('meta[http-equiv="refresh" i][content]'):
            raw = _parse_meta_refresh(str(tag.get("content") or ""))
            if raw:
                collector.add(raw, "Meta refresh destination", "meta_refresh_links")

    if options.discover_meta_urls:
        for tag in soup.find_all("meta", content=True):
            key = str(tag.get("property") or tag.get("name") or "").strip().casefold()
            definition = _META_URL_PROPERTIES.get(key)
            if definition is None:
                continue
            label, allow_crawl, require_route_hint = definition
            raw_content = str(tag.get("content") or "")
            if require_route_hint and not _looks_like_route(raw_content):
                continue
            collector.add(
                raw_content,
                label,
                "meta_url_links",
                tag=tag,
                allow_crawl=allow_crawl,
            )

    if options.discover_embedded_documents:
        for tag_name, attributes in _EMBEDDED_RESOURCE_ATTRS.items():
            for tag in soup.find_all(tag_name):
                for attribute in attributes:
                    raw = str(tag.get(attribute) or "")
                    if raw:
                        collector.add(
                            raw,
                            str(tag.get("title") or f"Embedded {tag_name}"),
                            "embedded_document_links",
                            tag=tag,
                        )

        # Preserve image formats that cannot enter the raster vision manifest
        # (notably SVG/JXL) without flooding resources with gallery thumbnails.
        for tag in soup.find_all("img"):
            raw_values: list[str] = []
            for attribute in (
                "src", "data-src", "data-original", "data-original-src",
                "data-lazy", "data-lazy-src",
            ):
                raw = str(tag.get(attribute) or "").strip()
                if raw:
                    raw_values.append(raw)
            for attribute in ("srcset", "data-srcset", "data-lazy-srcset"):
                raw_values.extend(_iter_srcset_urls(str(tag.get(attribute) or "")))
            for raw in raw_values:
                try:
                    suffix = PurePosixPath(
                        urllib.parse.urlsplit(urllib.parse.urljoin(base_url, raw)).path.casefold()
                    ).suffix
                except (ValueError, UnicodeError):
                    continue
                if suffix not in _IMAGE_EXTENSIONS or suffix in _VISION_IMAGE_EXTENSIONS:
                    continue
                collector.add(
                    raw,
                    str(tag.get("alt") or tag.get("title") or "Page image"),
                    "embedded_document_links",
                    tag=tag,
                    allow_crawl=False,
                )

        for param in soup.find_all("param", attrs={"value": True}):
            name = str(param.get("name") or "").strip().casefold()
            if name in {"movie", "src", "url", "href", "filename"}:
                collector.add(
                    str(param.get("value") or ""),
                    str(param.get("title") or f"Embedded {name} resource"),
                    "embedded_document_links",
                    tag=param,
                )

        # Media source URLs belong in the resource manifest. Static media does
        # not consume automatic crawl slots.
        for tag_name, attribute in (("source", "src"), ("track", "src"), ("video", "poster")):
            for tag in soup.find_all(tag_name):
                raw = str(tag.get(attribute) or "")
                if raw:
                    collector.add(
                        raw,
                        str(tag.get("title") or f"{tag_name.title()} resource"),
                        "embedded_document_links",
                        tag=tag,
                    )

    if options.discover_get_forms:
        for form in soup.find_all("form"):
            method = _form_method(form.get("method"))
            raw_action = str(form.get("action") or "").strip()
            action = document_url if not raw_action or raw_action.startswith("#") else raw_action
            rels = _rel_values(form)
            label = str(
                form.get("aria-label")
                or form.get("name")
                or f"{method.upper()} form destination"
            )
            collector.add(
                action,
                label,
                "get_form_links",
                tag=form,
                nofollow="nofollow" in rels,
                allow_crawl=method == "get",
            )
            if method == "get":
                absolute_action = _absolute_url(
                    action, base_url, policy, options.max_url_characters
                )
                preset_url = (
                    _get_form_preset_url(form, absolute_action, soup=soup)
                    if absolute_action
                    else ""
                )
                if preset_url:
                    collector.add(
                        preset_url,
                        f"{label} (preset)",
                        "get_form_links",
                        tag=form,
                        nofollow="nofollow" in rels,
                    )

        submitter_candidates = soup.find_all(("button", "input"), limit=1_001)
        if len(submitter_candidates) > 1_000:
            collector.counts["form_submitters_truncated"] = 1
            submitter_candidates = submitter_candidates[:1_000]
        for control in submitter_candidates:
            control_name = (control.name or "").casefold()
            control_type = str(
                control.get("type") or ("submit" if control_name == "button" else "text")
            ).strip().casefold()
            if (
                _control_is_disabled(control)
                or (control_name == "button" and control_type != "submit")
                or (control_name == "input" and control_type not in {"submit", "image"})
            ):
                continue
            form: Tag | None = None
            explicit_owner = str(control.get("form") or "").strip()
            if explicit_owner:
                referenced = soup.find("form", id=explicit_owner)
                form = referenced if isinstance(referenced, Tag) else None
            else:
                parent_form = control.find_parent("form")
                form = parent_form if isinstance(parent_form, Tag) else None
            if form is None:
                continue
            raw_method = (
                control.get("formmethod")
                if control.has_attr("formmethod")
                else (form.get("method") if form is not None else "get")
            )
            method = _form_method(raw_method)
            if control.has_attr("formaction"):
                raw_action = str(control.get("formaction") or "").strip()
            else:
                raw_action = str(form.get("action") or "").strip() if form is not None else ""
            action = document_url if not raw_action or raw_action.startswith("#") else raw_action
            collector.add(
                action,
                str(
                    control.get("aria-label")
                    or control.get("value")
                    or f"{method.upper()} form destination"
                ),
                "get_form_links",
                tag=control,
                nofollow=bool(form is not None and "nofollow" in _rel_values(form)),
                allow_crawl=method == "get",
            )
            if method == "get" and form is not None:
                absolute_action = _absolute_url(
                    action, base_url, policy, options.max_url_characters
                )
                preset_url = (
                    _get_form_preset_url(
                        form, absolute_action, soup=soup, submitter=control
                    )
                    if absolute_action
                    else ""
                )
                if preset_url:
                    collector.add(
                        preset_url,
                        str(control.get("aria-label") or control.get("value") or "GET form preset"),
                        "get_form_links",
                        tag=control,
                        nofollow="nofollow" in _rel_values(form),
                    )

    if options.discover_legacy_select_navigation:
        remaining_options = _bounded_nonnegative(
            options.max_legacy_navigation_options, 1_000, 20_000
        )
        for select in soup.find_all("select"):
            if remaining_options <= 0:
                break
            if not _select_looks_like_navigation(select):
                continue
            for option in select.find_all("option", limit=remaining_options):
                if remaining_options <= 0:
                    break
                remaining_options -= 1
                raw = str(option.get("value") or "").strip()
                if not _looks_like_route(raw):
                    continue
                collector.add(
                    raw,
                    _bounded_text(option, 500) or "Legacy navigation option",
                    "legacy_select_option_links",
                    tag=option,
                )

    if options.discover_data_attribute_urls:
        for node in soup.descendants:
            if not isinstance(node, Tag):
                continue
            tag = node
            for attribute in _DATA_URL_ATTRIBUTES:
                raw_value = tag.get(attribute)
                if raw_value is None:
                    continue
                values = raw_value if isinstance(raw_value, (list, tuple)) else [raw_value]
                for value in values:
                    raw = str(value)
                    if _looks_like_route(raw):
                        collector.add(
                            raw,
                            str(tag.get("aria-label") or tag.get("title") or "Data-linked page"),
                            "data_attribute_links",
                            tag=tag,
                        )

    if options.discover_visible_text_urls:
        visible_urls, visible_truncated = _iter_visible_text_urls(
            soup,
            options.max_visible_text_url_characters,
            options.max_visible_text_urls,
        )
        collector.counts["visible_text_urls_truncated"] = visible_truncated
        for raw, parent in visible_urls:
            collector.add(
                raw,
                "Visible page URL",
                "visible_text_links",
                tag=parent,
            )

    # Inline event handlers are small and often contain the only path to an
    # advertisement image or legacy PHP page.
    for node in soup.descendants:
        if not isinstance(node, Tag):
            continue
        tag = node
        for attribute in ("onclick", "onchange", "onsubmit"):
            text = str(tag.get(attribute) or "")
            if not text:
                continue
            text = _strip_javascript_comments(text)
            discoveries, truncated = _collect_script_url_discoveries(
                text,
                options.max_script_navigation_matches,
                include_static_get=options.discover_static_get_requests,
            )
            for raw, is_static_get in discoveries:
                absolute = collector.add(
                    raw,
                    str(
                        tag.get("aria-label")
                        or tag.get("title")
                        or (
                            "Interactive GET resource"
                            if is_static_get
                            else "Interactive link"
                        )
                    ),
                    "static_get_request_links"
                    if is_static_get
                    else "inline_event_links",
                    tag=tag,
                    allow_crawl=_resource_kind(
                        _absolute_url(
                            raw,
                            base_url,
                            policy,
                            options.max_url_characters,
                        )
                    )
                    not in {"image", "audio", "video", "archive"},
                )
                _remember_script_image_on_tag(tag, absolute)
            collector.counts["script_navigation_matches_truncated"] |= truncated

    for raw, label in structured.urls:
        if label.startswith("Microdata"):
            if not options.discover_microdata_urls:
                continue
            source = "microdata_links"
        elif label.startswith("RDFa"):
            if not options.discover_rdfa_urls:
                continue
            source = "rdfa_links"
        else:
            if not options.discover_json_ld_urls:
                continue
            source = "json_ld_links"
        absolute_guess = _absolute_url(
            raw,
            base_url,
            policy,
            options.max_url_characters,
        )
        kind = _resource_kind(absolute_guess) if absolute_guess else "page"
        collector.add(
            raw,
            label,
            source,
            allow_crawl=kind not in {"image", "audio", "video"},
        )

    if options.discover_inline_script_urls:
        remaining = _bounded_nonnegative(
            options.max_inline_script_chars, 2_000_000, 20_000_000
        )
        maximum_blocks = _bounded_nonnegative(
            options.max_inline_script_blocks, 500, 10_000
        )
        remaining_json_nodes = _bounded_nonnegative(
            options.max_embedded_json_nodes, 20_000, 200_000
        )
        blocks_seen = 0
        for node in soup.descendants:
            if not isinstance(node, Tag) or (node.name or "").casefold() != "script":
                continue
            type_value = str(node.get("type") or "")
            if "ld+json" in type_value.casefold():
                continue
            if not _script_type_is_discovery_source(type_value):
                collector.counts["inline_script_blocks_skipped_type"] += 1
                continue
            if blocks_seen >= maximum_blocks or remaining <= 0:
                collector.counts["inline_script_scan_truncated"] = 1
                break
            blocks_seen += 1
            collector.counts["inline_script_blocks_scanned"] = blocks_seen
            raw_text = (
                node.string
                if node.string is not None
                else node.get_text("", strip=False)
            )
            if not raw_text:
                continue
            raw_string = str(raw_text)

            if _script_type_is_json_payload(type_value):
                # Truncated JSON is guaranteed to be invalid. Skip an oversized
                # block as a unit so later, smaller hydration payloads can still
                # use the remaining character budget.
                if len(raw_string) > remaining:
                    collector.counts["inline_script_scan_truncated"] = 1
                    continue
                remaining -= len(raw_string)
                try:
                    payload = _strict_json_loads(_clean_json_ld_text(raw_string))
                except (json.JSONDecodeError, TypeError, ValueError, RecursionError):
                    collector.counts["embedded_json_parse_errors"] += 1
                    continue
                collector.counts["embedded_json_blocks_parsed"] += 1
                routes, visited, truncated = _extract_routes_from_embedded_json(
                    payload,
                    remaining_json_nodes,
                )
                collector.counts["embedded_json_nodes_visited"] += visited
                collector.counts["embedded_json_truncated"] |= truncated
                remaining_json_nodes = max(0, remaining_json_nodes - visited)
                for raw in routes:
                    absolute = _absolute_url(
                        raw,
                        base_url,
                        policy,
                        options.max_url_characters,
                    )
                    if not absolute:
                        continue
                    kind = _resource_kind(absolute)
                    if PurePosixPath(
                        urllib.parse.urlsplit(absolute).path.casefold()
                    ).suffix in _STATIC_ASSET_EXTENSIONS:
                        collector.counts["static_asset_links_suppressed"] += 1
                        continue
                    collector.add(
                        absolute,
                        "Embedded JSON navigation",
                        "inline_script_links",
                        allow_crawl=kind
                        not in {"image", "audio", "video", "archive"},
                    )
                continue

            text = raw_string[:remaining]
            if len(raw_string) > remaining:
                collector.counts["inline_script_scan_truncated"] = 1
            remaining -= min(len(raw_string), remaining)
            text = _strip_javascript_comments(text)
            discovered, truncated = _collect_script_url_discoveries(
                text,
                options.max_script_navigation_matches,
                include_static_get=options.discover_static_get_requests,
            )
            for raw, is_static_get in discovered:
                source_name = (
                    "static_get_request_links"
                    if is_static_get
                    else "inline_script_links"
                )
                absolute = _absolute_url(
                    raw,
                    base_url,
                    policy,
                    options.max_url_characters,
                )
                if not absolute:
                    continue
                try:
                    suffix = PurePosixPath(
                        urllib.parse.urlsplit(absolute).path.casefold()
                    ).suffix
                except (ValueError, UnicodeError):
                    continue
                if suffix in _STATIC_ASSET_EXTENSIONS:
                    collector.counts["static_asset_links_suppressed"] += 1
                    continue
                kind = _resource_kind(absolute)
                collector.add(
                    absolute,
                    "Static GET resource"
                    if source_name == "static_get_request_links"
                    else "JavaScript navigation",
                    source_name,
                    allow_crawl=kind
                    not in {"image", "audio", "video", "archive"},
                )
            collector.counts["script_navigation_matches_truncated"] |= truncated

    return collector.crawl_links, collector.resources, collector.counts


# ---------------------------------------------------------------------------
# Informational image discovery
# ---------------------------------------------------------------------------


def _strip_css_comments(text: str) -> str:
    """Remove CSS block comments while preserving strings and newlines."""

    if not text:
        return ""
    output: list[str] = []
    state = "normal"
    escaped = False
    index = 0
    while index < len(text):
        char = text[index]
        nxt = text[index + 1] if index + 1 < len(text) else ""
        if state == "comment":
            if char == "*" and nxt == "/":
                output.extend((" ", " "))
                index += 2
                state = "normal"
                continue
            output.append(char if char in "\r\n" else " ")
            index += 1
            continue
        if state in {"single", "double"}:
            output.append(char)
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif (state == "single" and char == "'") or (
                state == "double" and char == '"'
            ):
                state = "normal"
            index += 1
            continue
        if char == "/" and nxt == "*":
            output.extend((" ", " "))
            index += 2
            state = "comment"
            continue
        if char == "'":
            state = "single"
        elif char == '"':
            state = "double"
        output.append(char)
        index += 1
    return "".join(output)



def _iter_css_urls(value: str) -> Iterator[str]:
    """Yield CSS URL tokens without confusing comments or quoted punctuation."""

    source = str(value or "")
    seen: set[str] = set()
    if _tinycss2 is not None:
        try:
            roots = _tinycss2.parse_component_value_list(source, skip_comments=True)

            def walk(tokens: Iterable[Any]) -> Iterator[str]:
                for token in tokens:
                    token_type = str(getattr(token, "type", ""))
                    if token_type == "url":
                        candidate = str(getattr(token, "value", "")).strip()
                        if candidate:
                            yield candidate
                    elif token_type == "function" and str(
                        getattr(token, "lower_name", getattr(token, "name", ""))
                    ).casefold() == "url":
                        serialized = _tinycss2.serialize(getattr(token, "arguments", [])).strip()
                        candidate = serialized.strip(" \\t\\r\\n\\f\\\"'")
                        if candidate:
                            yield candidate
                    for attribute in ("content", "arguments", "value", "prelude"):
                        nested = getattr(token, attribute, None)
                        if isinstance(nested, (list, tuple)):
                            yield from walk(nested)

            for candidate in walk(roots):
                if candidate not in seen:
                    seen.add(candidate)
                    yield candidate
            return
        except Exception:
            pass
    for match in _CSS_URL_RE.finditer(_strip_css_comments(source)):
        candidate = match.group("url").strip()
        if candidate and candidate not in seen:
            seen.add(candidate)
            yield candidate


def _image_label(tag: Tag | None, url: str, options: HtmlExtractorOptions) -> str:
    candidates: list[str] = []
    if tag is not None:
        candidates.extend(
            str(tag.get(name) or "")
            for name in ("alt", "title", "aria-label")
        )
        if (tag.name or "").casefold() == "a":
            candidates.append(_bounded_text(tag, 500))
            child_image = tag.find("img")
            if isinstance(child_image, Tag):
                candidates.append(str(child_image.get("alt") or ""))
    candidates.append(_filename_label(url))
    generic = {
        value.casefold()
        for value in _bounded_string_tuple(options.generic_image_alt_values)
    }
    fallback = ""
    for candidate in candidates:
        normalized = _normalize_space(candidate)[:500]
        if not normalized:
            continue
        if not fallback:
            fallback = normalized
        if normalized.casefold() not in generic:
            return normalized
    return fallback or "Page image"


def _nearby_context(tag: Tag, max_chars: int = 700) -> str:
    limit = _bounded_positive(max_chars, 700, 5_000)
    texts: list[str] = []
    parent = tag.find_parent(
        ["figure", "article", "section", "li", "td", "th", "aside", "div"]
    )
    if isinstance(parent, Tag):
        text = _bounded_text(parent, limit)
        if text:
            texts.append(text)
    previous = tag.find_previous(["h1", "h2", "h3", "h4", "h5", "h6", "p"])
    if isinstance(previous, Tag):
        text = _bounded_text(previous, limit)
        if text:
            texts.append(text)
    return _normalize_space(" ".join(texts))[:limit]


def _parse_css_dimension(tag: Tag, name: str) -> int:
    raw = str(tag.get(name) or "").strip()
    match = re.fullmatch(r"(\d+)(?:px)?", raw, flags=re.I)
    if match:
        return int(match.group(1))
    style = str(tag.get("style") or "")
    match = re.search(
        rf"(?:^|;)\s*{re.escape(name)}\s*:\s*(\d+)(?:px)?"
        rf"\s*(?:!important\s*)?(?:;|$)",
        style,
        re.I,
    )
    return int(match.group(1)) if match else 0

def _score_image(
    url: str,
    label: str,
    context: str,
    tag: Tag | None,
    options: HtmlExtractorOptions,
    site_family: int = _UET_SITE_GENERIC,
) -> float:
    try:
        parsed_image_url = urllib.parse.urlsplit(url)
        image_path = urllib.parse.unquote(parsed_image_url.path)
    except (ValueError, UnicodeError):
        image_path = url
    # Hostnames such as admissions.uettaxila.edu.pk must not make every image
    # look admission-critical. Score the resource path, label and nearby prose.
    haystack = f"{image_path} {label} {context}".casefold()
    direct = f"{image_path} {label}".casefold()

    strong_visual_signal = any(
        token in direct
        for token in (
            "advertisement",
            "prospectus",
            "fee",
            "merit",
            "notice",
            "schedule",
            "tcat",
            "ecat",
            "technology",
            "programs",
        )
    ) or bool(re.search(r"(?:^|[\s_/-])ad(?:[\s_.?/-]|$)", direct))

    generic_visual_label = bool(
        label.casefold() in {
            value.casefold() for value in _bounded_string_tuple(options.generic_image_alt_values)
        }
        or any(token in label.casefold() for token in (
            "main campus", "campus hero", "hero image", "site banner"
        ))
    )
    generic_decorative_path = any(
        token in image_path.casefold()
        for token in ("campus", "hero", "slider", "carousel", "banner", "background")
    )
    if generic_visual_label and generic_decorative_path and not strong_visual_signal:
        return -100.0

    hard_low_signal = any(
        token in direct
        for token in (
            "logo",
            "avatar",
            "portrait",
            "profile",
            "admissionstaff",
            "admissioncommitee",
            "admissioncommittee",
            "controllerexamoffice",
            "convenor",
            "convener",
            "programmer",
            "clerk",
            "attendant",
        )
    )
    if hard_low_signal and not strong_visual_signal:
        return -100.0

    decorative_legacy = any(
        token in direct
        for token in ("new.gif", "spacer", "bullet", "arrow", "loading", "spinner")
    )
    if decorative_legacy and not strong_visual_signal:
        return -100.0

    score = 0.0
    for keyword in _bounded_string_tuple(options.high_value_image_keywords):
        if keyword.casefold() in haystack:
            score += 4.0
    for keyword in _bounded_string_tuple(options.low_value_image_keywords):
        if keyword.casefold() in haystack:
            score -= 5.0
    if strong_visual_signal:
        score += 6.0
    if site_family != _UET_SITE_GENERIC:
        for keyword in ("challan", "date sheet", "result", "tender", "notification", "merit list"):
            if keyword in haystack:
                score += 5.0

    if tag is not None:
        width = _parse_css_dimension(tag, "width")
        height = _parse_css_dimension(tag, "height")
        for value in (width, height):
            if value >= 500:
                score += 1.5
            elif value >= 250:
                score += 0.75
            elif 0 < value < 80:
                score -= 4.0
        classes = " ".join(str(value) for value in (tag.get("class") or [])).casefold()
        role = str(tag.get("role") or "").casefold()
        if any(token in classes for token in ("logo", "icon", "avatar", "profile")):
            score -= 6.0
        if role == "presentation" or str(tag.get("aria-hidden") or "").casefold() == "true":
            score -= 4.0

    if _resource_kind(url) == "image":
        score += 1.0
    if context:
        score += min(2.0, len(context) / 350.0)
    return score


def _iter_srcset_urls(value: str) -> Iterable[str]:
    """Yield URLs using the structure of HTML's srcset parsing algorithm.

    Commas are legal inside a URL token, so splitting or matching on every
    comma corrupts valid candidates. Candidate separators are recognized only
    after the URL token; descriptor text is skipped without selecting a DPR.
    """

    source = str(value or "")
    length = len(source)
    position = 0
    ascii_whitespace = "\t\n\f\r "
    while position < length:
        while position < length and (
            source[position] in ascii_whitespace or source[position] == ","
        ):
            position += 1
        if position >= length:
            return

        start = position
        while position < length and source[position] not in ascii_whitespace:
            position += 1
        candidate = source[start:position]

        if candidate.endswith(","):
            candidate = candidate.rstrip(",")
            if candidate:
                yield candidate
            continue

        if candidate:
            yield candidate

        parentheses = 0
        while position < length:
            character = source[position]
            if character == "(":
                parentheses += 1
            elif character == ")" and parentheses:
                parentheses -= 1
            elif character == "," and parentheses == 0:
                position += 1
                break
            position += 1


def _image_identity(url: str) -> str:
    """Deduplicate responsive transforms without merging semantic image IDs."""

    transform_keys = {
        "w",
        "width",
        "h",
        "height",
        "q",
        "quality",
        "fit",
        "crop",
        "dpr",
        "format",
        "fm",
        "auto",
    }
    try:
        parsed = urllib.parse.urlsplit(url)
        retained: list[tuple[str, str]] = []
        for key, value in urllib.parse.parse_qsl(
            parsed.query,
            keep_blank_values=True,
            max_num_fields=256,
        ):
            if key.casefold() not in transform_keys:
                retained.append((key, value))
        query = urllib.parse.urlencode(retained, doseq=True)
        return urllib.parse.urlunsplit(
            (
                parsed.scheme.casefold(),
                parsed.netloc.casefold(),
                parsed.path,
                query,
                "",
            )
        )
    except (ValueError, UnicodeError):
        return url

def _collect_image_candidates(
    soup: BeautifulSoup,
    base_url: str,
    policy: UrlPolicyLike,
    options: HtmlExtractorOptions,
    structured: _StructuredData,
    site_family: int = _UET_SITE_GENERIC,
) -> tuple[list[HtmlImageCandidate], dict[str, int]]:
    candidates: dict[str, HtmlImageCandidate] = {}
    source_counts: dict[str, int] = {
        "image_meta_candidates": 0,
        "image_structured_candidates": 0,
        "image_css_candidates": 0,
        "image_anchor_candidates": 0,
    }

    def add(raw_url: str, tag: Tag | None, source: str, context: str = "") -> None:
        absolute = _absolute_url(
            raw_url,
            base_url,
            policy,
            options.max_url_characters,
        )
        if not absolute or not _safe_is_network_target(policy, absolute):
            return
        try:
            suffix = PurePosixPath(
                urllib.parse.unquote(urllib.parse.urlsplit(absolute).path).casefold()
            ).suffix
        except (ValueError, UnicodeError):
            return
        if suffix and suffix not in _VISION_IMAGE_EXTENSIONS:
            # Explicit non-raster image formats (SVG/JXL) stay in the resource
            # manifest but are not sent to the raster vision pipeline. A web
            # handler suffix such as .aspx may still carry a raster filename in
            # a query parameter and is accepted through _resource_kind().
            if suffix in _IMAGE_EXTENSIONS or _resource_kind(absolute) != "image":
                return
        label = _image_label(tag, absolute, options)
        if not context and tag is not None:
            context = _nearby_context(tag)
        score = _score_image(
            absolute, label, context, tag, options, site_family
        )
        candidate = HtmlImageCandidate(
            url=absolute,
            alt_text=label,
            context=context,
            score=score,
            source=source,
        )
        identity = _image_identity(absolute)
        existing = candidates.get(identity)
        if existing is None or candidate.score > existing.score:
            candidates[identity] = candidate
            if source.startswith("meta:") or source == "link:image_src":
                source_counts["image_meta_candidates"] += int(existing is None)
            elif source.startswith("structured-data"):
                source_counts["image_structured_candidates"] += int(existing is None)
            elif source.startswith("style") or source == "inline-style":
                source_counts["image_css_candidates"] += int(existing is None)
            elif source in {"anchor:href", "anchor:scripted-href"}:
                source_counts["image_anchor_candidates"] += int(existing is None)

    # Machine-readable preview and representative images can exist only in page
    # metadata, especially on modern templates with CSS/JS-rendered bodies.
    for tag in soup.find_all("meta"):
        key = str(tag.get("property") or tag.get("name") or "").strip().casefold()
        if key in {
            "og:image",
            "og:image:url",
            "og:image:secure_url",
            "twitter:image",
            "twitter:image:src",
            "thumbnail",
        }:
            raw = str(tag.get("content") or "").strip()
            if raw:
                add(raw, None, f"meta:{key}")
    for tag in soup.find_all("link", href=True):
        if "image_src" in _rel_values(tag):
            add(str(tag.get("href") or ""), tag, "link:image_src")

    for raw, label in structured.urls:
        lowered = label.casefold()
        if any(token in lowered for token in ("image", "photo", "logo", "thumbnail")):
            add(raw, None, f"structured-data:{label}")

    # Script-wrapped legacy anchors are sanitized during discovery. Their
    # normalized image targets are retained in a private bounded attribute so
    # image-only notices still reach the optional vision pipeline.
    for tag in soup.find_all(attrs={_EXTRACTED_SCRIPT_IMAGE_ATTRIBUTE: True}):
        raw_payload = tag.get(_EXTRACTED_SCRIPT_IMAGE_ATTRIBUTE)
        try:
            values = json.loads(str(raw_payload or "[]"))
        except (TypeError, ValueError, json.JSONDecodeError):
            values = []
        if not isinstance(values, list):
            continue
        for raw in values[:32]:
            add(str(raw), tag, "anchor:scripted-href")

    # Legacy university sites frequently link a notice/advertisement image from
    # text instead of embedding it. Treat explicit raster targets and strongly
    # image-signaled extensionless endpoints as optional vision candidates.
    for tag in soup.find_all("a", href=True):
        raw = str(tag.get("href") or "").strip()
        if not raw:
            continue
        try:
            path = urllib.parse.urlsplit(raw).path.casefold()
            suffix = PurePosixPath(urllib.parse.unquote(path)).suffix
        except (ValueError, UnicodeError):
            continue
        link_signal = f"{_bounded_text(tag, 500)} {raw}".casefold()
        strong_link_signal = any(
            phrase in link_signal
            for phrase in (
                "view advertisement",
                "advertisement image",
                "notice image",
                "merit list image",
                "fee structure image",
                "poster image",
            )
        )
        if (
            suffix in _VISION_IMAGE_EXTENSIONS
            or _resource_kind(raw) == "image"
            or (not suffix and strong_link_signal)
        ):
            add(raw, tag, "anchor:href")

    for tag in soup.find_all("img"):
        for attribute in (
            "src",
            "data-src",
            "data-original",
            "data-original-src",
            "data-lazy",
            "data-lazy-src",
        ):
            raw = str(tag.get(attribute) or "").strip()
            if raw:
                add(raw, tag, f"img:{attribute}")
        for attribute in ("srcset", "data-srcset", "data-lazy-srcset"):
            for raw in _iter_srcset_urls(str(tag.get(attribute) or "")):
                add(raw, tag, f"img:{attribute}")

    for tag in soup.select('input[type="image"][src], video[poster]'):
        attribute = "poster" if tag.name == "video" else "src"
        add(str(tag.get(attribute) or ""), tag, f"{tag.name}:{attribute}")

    for tag in soup.find_all("source"):
        for attribute in ("src", "srcset", "data-src", "data-srcset"):
            raw_value = str(tag.get(attribute) or "")
            values = _iter_srcset_urls(raw_value) if "srcset" in attribute else [raw_value]
            for raw in values:
                if raw:
                    add(raw, tag, f"source:{attribute}")

    for node in soup.descendants:
        if not isinstance(node, Tag):
            continue
        tag = node
        style = str(tag.get("style") or "")
        for raw in _iter_css_urls(style):
            add(raw, tag, "inline-style", _nearby_context(tag))
        for attribute in (
            "data-background", "data-bg", "data-background-image",
            "data-bg-image", "background",
        ):
            raw = str(tag.get(attribute) or "").strip()
            if raw:
                add(raw, tag, f"{attribute}:image", _nearby_context(tag))
        for attribute in ("onclick", "onchange"):
            text = _strip_javascript_comments(str(tag.get(attribute) or ""))
            for raw in _iter_script_navigation_urls(text):
                absolute = _absolute_url(
                    raw,
                    base_url,
                    policy,
                    options.max_url_characters,
                )
                if not absolute:
                    continue
                try:
                    suffix = PurePosixPath(
                        urllib.parse.urlsplit(absolute).path.casefold()
                    ).suffix
                except (ValueError, UnicodeError):
                    continue
                if suffix in _IMAGE_EXTENSIONS:
                    add(absolute, tag, f"{attribute}:navigation", _nearby_context(tag))

    if options.discover_inline_style_images:
        remaining_style_chars = _bounded_nonnegative(
            options.max_inline_style_chars, 1_000_000, 10_000_000
        )
        for style_tag in soup.find_all("style"):
            if remaining_style_chars <= 0:
                break
            raw_text = (
                style_tag.string
                if style_tag.string is not None
                else style_tag.get_text("", strip=False)
            )
            if not raw_text:
                continue
            raw_string = str(raw_text)
            text = _strip_css_comments(raw_string[:remaining_style_chars])
            remaining_style_chars -= min(len(raw_string), remaining_style_chars)
            for raw in _iter_css_urls(text):
                add(raw, style_tag, "style:block")

    ranked = sorted(
        candidates.values(),
        key=lambda item: (-item.score, item.url.casefold()),
    )
    maximum = _bounded_nonnegative(options.max_image_candidates, 8, 100)
    selected = [candidate for candidate in ranked if candidate.score > 0][:maximum]
    source_counts["image_candidates_considered"] = len(candidates)
    source_counts["image_candidates_selected"] = len(selected)
    return selected, source_counts


# ---------------------------------------------------------------------------
# Markdown preparation and de-duplication
# ---------------------------------------------------------------------------


def _is_site_chrome_header(tag: Tag) -> bool:
    if tag.name != "header":
        return False
    if tag.find_parent(["main", "article", "section"]):
        return False
    if tag.find("nav") is not None or tag.find(attrs={"role": "navigation"}) is not None:
        return True
    classes = " ".join(str(value) for value in (tag.get("class") or [])).casefold()
    identifier = str(tag.get("id") or "").casefold()
    role = str(tag.get("role") or "").casefold()
    chrome_signal = any(
        token in f"{classes} {identifier}"
        for token in (
            "site-header",
            "main-header",
            "masthead",
            "navbar",
            "topbar",
            "top-bar",
            "global-header",
        )
    )
    links = tag.find_all("a", href=True, limit=6)
    logo = tag.find(
        ["img", "svg"],
        attrs={"class": re.compile(r"logo|brand", re.I)},
    )
    return bool(
        chrome_signal
        or (role == "banner" and (logo is not None or len(links) >= 3))
        or len(links) >= 5
    )

def _is_site_chrome_footer(tag: Tag) -> bool:
    if tag.name == "footer" or str(tag.get("role") or "").casefold() == "contentinfo":
        return tag.find_parent(["main", "article", "section"]) is None
    classes = " ".join(str(value) for value in (tag.get("class") or [])).casefold()
    identifier = str(tag.get("id") or "").casefold()
    return (
        ("footer" in classes or "footer" in identifier)
        and tag.find_parent(["main", "article", "section"]) is None
    )



def _replace_disclosure_controls(soup: BeautifulSoup, body: Tag) -> int:
    """Promote Bootstrap/ARIA/native disclosure labels to stable headings."""

    converted = 0
    candidates = list(body.find_all(["button", "a", "summary"]))
    for control in candidates:
        if control.parent is None:
            continue
        name = (control.name or "").casefold()
        classes = " ".join(
            str(value) for value in (control.get("class") or [])
        ).casefold()
        toggle = str(
            control.get("data-bs-toggle") or control.get("data-toggle") or ""
        ).casefold()
        is_disclosure = bool(
            name == "summary"
            or "accordion-button" in classes
            or toggle in {"collapse", "tab", "pill"}
            or control.has_attr("aria-controls")
        )
        if not is_disclosure:
            continue
        text = _bounded_text(control, 700)
        if not text:
            continue
        parent = control.parent if isinstance(control.parent, Tag) else None
        if parent is not None and parent.name in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            control.unwrap()
        else:
            heading = soup.new_tag("h3")
            heading.string = text
            control.replace_with(heading)
        converted += 1
    return converted

def _unwrap_layout_tables(body: Tag) -> int:
    """Flatten only unmistakable one-cell/presentation tables."""

    unwrapped = 0
    for table in list(body.find_all("table")):
        if table.parent is None:
            continue
        # Only the distinction between zero/one and two-or-more matters. Limits
        # avoid repeatedly traversing every descendant row in nested legacy
        # layout tables.
        rows = table.find_all("tr", limit=2)
        cells = table.find_all(["td", "th"], limit=2)
        role = str(table.get("role") or "").casefold()
        data_table = bool(table.find("th") or table.find("caption"))
        layout = role == "presentation" or (
            not data_table and len(rows) <= 1 and len(cells) <= 1
        )
        if not layout:
            continue
        for wrapper in list(table.find_all(["tbody", "thead", "tfoot", "tr", "td"], recursive=True)):
            if wrapper.parent is not None:
                wrapper.unwrap()
        table.unwrap()
        unwrapped += 1
    return unwrapped



def _remove_uet_legacy_chrome(body: Tag, site_family: int) -> tuple[int, int]:
    """Remove strongly signalled legacy menus and standard footer tables."""

    if site_family == _UET_SITE_GENERIC:
        return 0, 0
    menus_removed = 0
    footers_removed = 0
    candidates = list(body.find_all(["div", "table", "ul", "aside", "section"]))
    for tag in candidates:
        if tag.parent is None or tag.find_parent(["main", "article"]):
            continue
        tag_name = (tag.name or "").casefold()
        classes = " ".join(str(value) for value in (tag.get("class") or [])).casefold()
        identifier = str(tag.get("id") or "").casefold()
        signal = f"{classes} {identifier}"
        explicit_footer = any(token in signal for token in ("footer", "bottom-links", "site-info"))
        explicit_menu = any(token in signal for token in (
            "main-menu", "top-menu", "side-menu", "sidebar-menu", "navigation",
            "navbar", "quick-links", "quicklinks", "topnav", "sidenav"
        ))
        likely_top_level = tag.parent is body
        footer_candidate = bool(
            explicit_footer
            or tag_name in {"table", "aside", "section"}
            or likely_top_level
        )
        menu_candidate = bool(
            explicit_menu
            or tag_name in {"ul", "table", "aside"}
            or likely_top_level
        )
        if not footer_candidate and not menu_candidate:
            continue

        links = tag.find_all("a", href=True, limit=80)
        # Strong class/id signals do not require expensive descendant-text
        # analysis. This also prevents quadratic work on deeply nested divs.
        if explicit_menu and len(links) >= 3:
            tag.decompose()
            menus_removed += 1
            continue

        text = _bounded_text(tag, 12_000) if footer_candidate or len(links) >= 12 else ""
        lowered = text.casefold()
        footer_signature = bool(
            ("about the university" in lowered and "important websites" in lowered)
            or ("about the department" in lowered and "©" in text)
            or ("quick links" in lowered and "contact info" in lowered and "©" in text)
        )
        if (
            footer_signature
            and len(text) < 12_000
            and (explicit_footer or tag.find(["h1", "h2", "h3"]) is None)
        ):
            tag.decompose()
            footers_removed += 1
            continue

        if not menu_candidate or len(links) < 12:
            continue
        navigation_terms = {
            "home", "about", "faculty", "academics", "contact", "downloads",
            "news", "research", "admissions", "examinations", "directory",
            "mission", "programs", "departments",
        }
        nav_like_labels = 0
        for link in links:
            label = _plain_block_key(_bounded_text(link, 120))
            if any(term in label for term in navigation_terms):
                nav_like_labels += 1
        link_dense_menu = bool(
            site_family in {_UET_SITE_MAIN, _UET_SITE_LEGACY, _UET_SITE_ADMISSIONS}
            and len(links) >= 12
            and nav_like_labels >= max(6, len(links) // 2)
            and len(text) <= len(links) * 55
            and tag.find(["p", "table", "form"]) is None
        )
        if link_dense_menu:
            tag.decompose()
            menus_removed += 1
    return menus_removed, footers_removed


def _replace_form_controls(soup: BeautifulSoup, body: Tag) -> None:
    for select in list(body.find_all("select")):
        if select.parent is None or select.attrs is None:
            continue
        values: list[str] = []
        for option in select.find_all("option", limit=100):
            text = _bounded_text(option, 500)
            if text and text not in values:
                values.append(text)
        if values:
            marker = soup.new_tag("span")
            marker.string = "Options: " + "; ".join(values)
            select.replace_with(marker)
        else:
            select.decompose()

    for textarea in list(body.find_all("textarea")):
        if textarea.parent is None or textarea.attrs is None:
            continue
        text = _bounded_text(textarea, 2_000)
        if text:
            marker = soup.new_tag("span")
            marker.string = f" Prefilled text: {text} "
            textarea.replace_with(marker)
        else:
            textarea.decompose()

    for tag in list(body.find_all("input")):
        if tag.parent is None or tag.attrs is None:
            continue
        input_type = str(tag.get("type") or "text").casefold()
        if input_type in {"hidden", "password", "file", "image", "reset", "button", "submit"}:
            tag.decompose()
            continue
        # Labels and surrounding instructions are retained; empty fields are UI.
        tag.decompose()

    for button in list(body.find_all("button")):
        if button.parent is None or button.attrs is None:
            continue
        text = _bounded_text(button, 500)
        aria = str(button.get("aria-label") or "").casefold()
        if not text or aria == "close" or button.has_attr("data-bs-dismiss"):
            button.decompose()
            continue
        marker = soup.new_tag("span")
        marker.string = f" Action: {text} "
        button.replace_with(marker)


def _replace_inline_svgs(soup: BeautifulSoup, body: Tag) -> tuple[int, int]:
    """Preserve bounded semantic SVG text while dropping vector/icon markup."""

    preserved = 0
    removed = 0
    for svg in list(body.find_all("svg")):
        if svg.parent is None:
            continue
        labels: list[str] = []
        aria = _normalize_space(
            str(svg.get("aria-label") or svg.get("title") or "")
        )
        if aria:
            labels.append(aria[:500])
        for child in svg.find_all(["title", "desc", "text"], limit=100):
            text = _bounded_text(child, 1_000)
            if text and text not in labels:
                labels.append(text)
        combined = _normalize_space(" ".join(labels))[:2_000]
        classes = " ".join(str(value) for value in (svg.get("class") or [])).casefold()
        role = str(svg.get("role") or "").casefold()
        icon_like = any(token in classes for token in ("icon", "logo", "spinner"))
        if combined and len(combined) >= 3 and not (
            icon_like and len(combined.split()) <= 3
        ) and role != "presentation":
            marker = soup.new_tag("span")
            marker.string = f" Inline visual text: {combined} "
            svg.replace_with(marker)
            preserved += 1
        else:
            svg.decompose()
            removed += 1
    return preserved, removed


def _replace_fallback_containers(
    soup: BeautifulSoup, body: Tag
) -> tuple[int, int]:
    preserved = 0
    removed = 0
    for tag in list(body.find_all(["noscript", "canvas"])):
        if tag.parent is None:
            continue
        value = _bounded_text(tag, 4_000)
        if value and len(value) >= 3:
            marker = soup.new_tag("span")
            prefix = "No-script fallback" if tag.name == "noscript" else "Canvas fallback"
            marker.string = f" {prefix}: {value} "
            tag.replace_with(marker)
            preserved += 1
        else:
            tag.decompose()
            removed += 1
    return preserved, removed


def _prepare_dom_for_markdown(
    source_soup: BeautifulSoup,
    document_base_url: str,
    policy: UrlPolicyLike,
    image_candidates: Sequence[HtmlImageCandidate],
    options: HtmlExtractorOptions,
    site_family: int = _UET_SITE_GENERIC,
) -> tuple[BeautifulSoup, dict[str, int]]:
    soup = _make_soup(str(source_soup))
    body = soup.body or soup
    diagnostics = {
        "markdown_noise_nodes_removed": 0,
        "custom_selector_nodes_removed": 0,
        "protected_remove_selectors_ignored": 0,
        "invalid_remove_selectors": 0,
        "image_text_markers": 0,
        "inline_svg_text_markers": 0,
        "inline_svgs_removed": 0,
        "fallback_containers_preserved": 0,
        "fallback_containers_removed": 0,
        "disclosure_controls_promoted": 0,
        "layout_tables_unwrapped": 0,
        "uet_legacy_menu_nodes_removed": 0,
        "uet_legacy_footer_nodes_removed": 0,
    }

    if soup.head is not None:
        soup.head.decompose()

    legacy_menus, legacy_footers = _remove_uet_legacy_chrome(body, site_family)
    diagnostics["uet_legacy_menu_nodes_removed"] = legacy_menus
    diagnostics["uet_legacy_footer_nodes_removed"] = legacy_footers

    # Remove repeated navigation/chrome after links and contacts have been read.
    for tag in list(body.find_all("nav")) + list(body.select('[role="navigation" i]')):
        if tag.parent is not None:
            diagnostics["markdown_noise_nodes_removed"] += 1
            tag.decompose()
    for tag in list(body.find_all("header")):
        if tag.parent is not None and _is_site_chrome_header(tag):
            diagnostics["markdown_noise_nodes_removed"] += 1
            tag.decompose()
    for tag in list(body.find_all(True)):
        if tag.parent is not None and _is_site_chrome_footer(tag):
            diagnostics["markdown_noise_nodes_removed"] += 1
            tag.decompose()

    for selector in (".breadcrumb", '[aria-label="breadcrumb" i]', ".pagination"):
        try:
            matches = list(body.select(selector))
        except Exception:
            continue
        for tag in matches:
            if tag.parent is not None:
                diagnostics["markdown_noise_nodes_removed"] += 1
                tag.decompose()

    diagnostics["disclosure_controls_promoted"] = _replace_disclosure_controls(soup, body)
    diagnostics["layout_tables_unwrapped"] = _unwrap_layout_tables(body)
    fallback_preserved, fallback_removed = _replace_fallback_containers(soup, body)
    diagnostics["fallback_containers_preserved"] = fallback_preserved
    diagnostics["fallback_containers_removed"] = fallback_removed

    # Discovery-bearing source is never indexed as prose.
    for tag in list(body.find_all(_DISCOVERY_ONLY_TAGS)):
        if tag.parent is not None:
            diagnostics["markdown_noise_nodes_removed"] += 1
            tag.decompose()

    for selector in _bounded_string_tuple(options.remove_selectors):
        if _selector_is_protected(selector):
            diagnostics["protected_remove_selectors_ignored"] += 1
            continue
        try:
            matches = list(body.select(selector))
        except Exception:
            diagnostics["invalid_remove_selectors"] += 1
            continue
        for tag in matches:
            if tag.parent is not None:
                diagnostics["custom_selector_nodes_removed"] += 1
                tag.decompose()

    selected_by_identity = {
        _image_identity(candidate.url): candidate for candidate in image_candidates
    }
    for tag in list(body.find_all("img")):
        raw_candidates: list[str] = []
        for attribute in (
            "src",
            "data-src",
            "data-original",
            "data-original-src",
            "data-lazy",
            "data-lazy-src",
        ):
            raw = str(tag.get(attribute) or "").strip()
            if raw:
                raw_candidates.append(raw)
        for attribute in ("srcset", "data-srcset", "data-lazy-srcset"):
            raw_candidates.extend(
                _iter_srcset_urls(str(tag.get(attribute) or ""))
            )

        candidate: HtmlImageCandidate | None = None
        absolute = ""
        for raw in raw_candidates:
            absolute = _absolute_url(
                raw,
                document_base_url,
                policy,
                options.max_url_characters,
            )
            candidate = selected_by_identity.get(_image_identity(absolute))
            if candidate is not None:
                break
        if not absolute and raw_candidates:
            absolute = _absolute_url(
                raw_candidates[0],
                document_base_url,
                policy,
                options.max_url_characters,
            )
        label = candidate.alt_text if candidate is not None else _normalize_space(
            str(tag.get("alt") or tag.get("title") or "")
        )
        generic = {
            value.casefold()
            for value in _bounded_string_tuple(options.generic_image_alt_values)
        }
        direct = f"{absolute} {label}".casefold()
        low_signal = any(
            token.casefold() in direct
            for token in (
                *_bounded_string_tuple(options.low_value_image_keywords),
                "admissionstaff",
                "admissioncommitee",
                "admissioncommittee",
                "controllerexamoffice",
                "convenor",
                "convener",
                "programmer",
                "clerk",
                "attendant",
            )
        )
        if candidate is not None or (
            label and label.casefold() not in generic and not low_signal
        ):
            marker = soup.new_tag("span")
            marker.string = f" Visual resource: {label[:500]} "
            tag.replace_with(marker)
            diagnostics["image_text_markers"] += 1
        else:
            tag.decompose()

    svg_markers, svgs_removed = _replace_inline_svgs(soup, body)
    diagnostics["inline_svg_text_markers"] = svg_markers
    diagnostics["inline_svgs_removed"] = svgs_removed
    _replace_form_controls(soup, body)
    return soup, diagnostics


def _markdownify_dom(soup: BeautifulSoup) -> str:
    body = soup.body or soup
    try:
        converter = _SafeMarkdownConverter(
            heading_style="ATX",
            bullets="-",
            strip=["svg"],
        )
        return converter.convert_soup(body).strip()
    except Exception:
        # A plain-text fallback is preferable to losing the document when a
        # malformed table or custom tag triggers a converter edge case.
        return _bounded_text(body, 2_000_000)


def _trafilatura_markdown(
    soup: BeautifulSoup,
    canonical_url: str,
    options: HtmlExtractorOptions,
) -> str:
    if trafilatura is None:
        return ""
    html_text = str(soup)
    maximum_tree = _bounded_positive(
        options.max_trafilatura_tree_size, 200_000, 2_000_000
    )
    kwargs: dict[str, Any] = {
        "url": canonical_url,
        "output_format": "markdown",
        "include_tables": True,
        "include_links": False,
        "include_comments": False,
        "include_formatting": True,
        "deduplicate": False,
        "favor_recall": True,
        "max_tree_size": maximum_tree,
    }
    try:
        return (trafilatura.extract(html_text, **kwargs) or "").strip()
    except (TypeError, ValueError):
        # Trafilatura 2.1 still exposes ``max_tree_size`` but marks it for
        # removal in favor of settings/options. Retry without modern optional
        # keywords so supplemental extraction survives API transitions.
        try:
            return (
                trafilatura.extract(
                    html_text,
                    url=canonical_url,
                    output_format="markdown",
                    include_tables=True,
                    include_comments=False,
                )
                or ""
            ).strip()
        except Exception:
            return ""
    except Exception:
        return ""

def _remove_duplicate_title_heading(markdown: str, title: str) -> str:
    """Remove a leading H1 already emitted as the normalized document title."""

    if not markdown or not title:
        return markdown
    blocks = _split_markdown_blocks(markdown)
    if not blocks:
        return markdown
    first = blocks[0]
    match = re.fullmatch(r"#{1,2}\s+(.+?)\s*#*", first, flags=re.S)
    if not match:
        return markdown
    heading_key = _plain_block_key(match.group(1))
    title_key = _plain_block_key(title)
    if heading_key != title_key:
        return markdown
    return "\n\n".join(blocks[1:]).strip()


def _remove_uet_boilerplate_blocks(
    markdown: str, site_family: int, title: str
) -> tuple[str, int]:
    if site_family == _UET_SITE_GENERIC or not markdown:
        return markdown, 0
    blocks = _split_markdown_blocks(markdown)
    removed = 0
    output: list[str] = []
    footer_mode = False
    title_key = _plain_block_key(title)
    footer_headings = {
        "connect with us", "about uet taxila", "important links", "quick links",
        "uet taxila", "contact us",
    }
    for index, block in enumerate(blocks):
        key = _plain_block_key(block)
        heading = re.match(r"^#{1,6}\s+(.+)$", block.strip(), flags=re.S)
        heading_key = _plain_block_key(heading.group(1)) if heading else ""
        late = index >= max(2, len(blocks) // 2)
        if (
            late
            and heading_key in footer_headings
            and heading_key not in title_key
            and not (heading_key == "contact us" and "contact" in title_key)
        ):
            footer_mode = True
            removed += 1
            continue
        if footer_mode:
            if heading and heading_key not in footer_headings:
                footer_mode = False
            else:
                removed += 1
                continue
        if re.search(r"©\s*20\d{2}.*(?:UET|NARC)", block, flags=re.I):
            removed += 1
            continue
        if late and (
            ("about the university" in key and "important websites" in key)
            or ("uet taxila quick links contact info" in key)
            or ("about the department" in key and "copyright" in key)
        ):
            footer_mode = True
            removed += 1
            continue
        if site_family == _UET_SITE_FMS and key in {"list view", "one page view", "login"}:
            removed += 1
            continue
        output.append(block)
    return "\n\n".join(output).strip(), removed


def _deduplicate_fms_markdown(markdown: str) -> tuple[str, int]:
    """Remove the repeated FMS one-page rendering while preserving unique facts."""

    blocks = _split_markdown_blocks(markdown)
    if not blocks:
        return markdown, 0
    prefix_tokens: set[str] = set()
    prefix_keys: set[str] = set()
    output: list[str] = []
    after_profile_information = False
    removed = 0
    for block in blocks:
        key = _plain_block_key(block)
        if key == "profile information" or key.endswith(" profile information"):
            after_profile_information = True
            removed += 1
            continue
        tokens = _block_tokens(block)
        if after_profile_information:
            exact_duplicate = bool(key and key in prefix_keys)
            coverage = len(tokens & prefix_tokens) / len(tokens) if tokens else 0.0
            # FMS emits a second near-duplicate layout, but a faculty member
            # can occasionally add one unique publication/project to only one
            # rendering. Exact structural duplicates are safe to remove. For
            # prose, require every substantive token to have appeared already;
            # even one new token preserves the block.
            repeated_prose = bool(
                not _is_structural_block(block)
                and len(tokens) >= 2
                and coverage >= 1.0
            )
            if exact_duplicate or repeated_prose:
                removed += 1
                continue
        output.append(block)
        prefix_tokens.update(tokens)
        if key:
            prefix_keys.add(key)
    return "\n\n".join(output).strip(), removed


def _plain_block_key(block: str) -> str:
    value = _MARKDOWN_LINK_RE.sub(r"\1", block)
    value = re.sub(r"[`*_>#|~]", " ", value)
    return _normalize_space(value).casefold()


def _block_tokens(block: str) -> set[str]:
    return {token.casefold() for token in _WORD_RE.findall(_plain_block_key(block))}


def _split_markdown_blocks(markdown: str) -> list[str]:
    return [
        block.strip()
        for block in re.split(r"\n\s*\n", markdown or "")
        if block.strip()
    ]


def _is_structural_block(block: str) -> bool:
    stripped = block.lstrip()
    if stripped.startswith(("#", "- ", "* ", "+ ", "> ")):
        return True
    lines = [line.strip() for line in block.splitlines() if line.strip()]
    return bool(lines and sum(line.startswith("|") for line in lines) >= 2)


def _supplemental_markdown_blocks(
    full_markdown: str,
    supplemental_markdown: str,
    maximum: int,
) -> list[str]:
    limit = _bounded_nonnegative(maximum, 80, 1_000)
    if not supplemental_markdown or limit == 0:
        return []
    full_blocks = _split_markdown_blocks(full_markdown)
    full_keys = {_plain_block_key(block) for block in full_blocks}
    full_tokens = _block_tokens(full_markdown)
    output: list[str] = []
    output_keys: set[str] = set()

    for block in _split_markdown_blocks(supplemental_markdown):
        key = _plain_block_key(block)
        if not key or key in full_keys or key in output_keys:
            continue
        tokens = _block_tokens(block)
        if not tokens:
            continue
        coverage = len(tokens & full_tokens) / len(tokens)
        # Structural fragments require exact de-duplication; prose is considered
        # already represented when almost all of its vocabulary exists in the
        # complete DOM extraction.
        threshold = 0.98 if _is_structural_block(block) else 0.90
        if coverage >= threshold:
            continue
        if len(tokens) < 4 and not _is_structural_block(block):
            continue
        output.append(block)
        output_keys.add(key)
        if len(output) >= limit:
            break
    return output


def _normalize_markdown(
    markdown: str, *, minimum_block_chars_for_global_dedup: int
) -> str:
    text = markdown.replace("\x00", "")
    text = re.sub(r"[\u200b\ufeff]", "", text)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\[\s*\]\(<[^>]+>\)", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()

    minimum = _bounded_nonnegative(
        minimum_block_chars_for_global_dedup,
        80,
        100_000,
    )
    output: list[str] = []
    prose_seen: set[str] = set()
    previous_key = ""

    for block in _split_markdown_blocks(text):
        key = _plain_block_key(block)
        if not key:
            continue
        if key == previous_key:
            continue
        if (
            not _is_structural_block(block)
            and len(key) >= minimum
            and key in prose_seen
        ):
            continue
        if not _is_structural_block(block) and len(key) >= minimum:
            prose_seen.add(key)
        output.append(block)
        previous_key = key
    return "\n\n".join(output).strip()


# ---------------------------------------------------------------------------
# Contacts and manifests
# ---------------------------------------------------------------------------


def _extract_contacts(
    soup: BeautifulSoup,
    maximum_scan_characters: int = 2_000_000,
    site_family: int = _UET_SITE_GENERIC,
) -> tuple[list[str], list[str]]:
    limit = _bounded_nonnegative(
        maximum_scan_characters,
        2_000_000,
        20_000_000,
    )
    emails: dict[str, str] = {}
    phones: set[str] = set()

    # URI-based contacts are authoritative and do not require scanning visible
    # prose. Process them even when the visible-text budget is zero.
    for tag in soup.find_all("a", href=True):
        href = html_stdlib.unescape(str(tag.get("href") or "")).strip()
        lowered = href.casefold()
        if lowered.startswith("mailto:"):
            raw_addresses = urllib.parse.unquote(href[7:].split("?", 1)[0])
            for address in re.split(r"[,;]", raw_addresses):
                address = address.strip()
                if _CONTACT_EMAIL_RE.fullmatch(address):
                    emails.setdefault(address.casefold(), address)
        elif lowered.startswith("tel:"):
            raw = urllib.parse.unquote(href[4:].split("?", 1)[0]).strip()
            digits = re.sub(r"\D", "", raw)
            if 7 <= len(digits) <= 15:
                phones.add(_normalize_space(raw))

    if limit == 0:
        return sorted(emails.values(), key=str.casefold), sorted(phones)

    chunks: list[str] = []
    length = 0
    excluded_parents = {
        "script",
        "style",
        "noscript",
        "template",
        "canvas",
    }
    for node in soup.descendants:
        if not isinstance(node, str) or isinstance(node, Comment):
            continue
        parent = node.parent
        if isinstance(parent, Tag) and (parent.name or "").casefold() in excluded_parents:
            continue
        text = _normalize_space(str(node))
        if not text:
            continue
        separator = 1 if chunks else 0
        remaining = limit - length - separator
        if remaining <= 0:
            break
        chunks.append(text[:remaining])
        length += separator + min(len(text), remaining)
        if length >= limit:
            break
    visible = " ".join(chunks)

    for value in _CONTACT_EMAIL_RE.findall(visible):
        emails.setdefault(value.casefold(), value)

    for match in _CONTACT_PHONE_RE.finditer(visible):
        raw = _normalize_space(match.group(0))
        digits = re.sub(r"\D", "", raw)
        if not (7 <= len(digits) <= 15):
            continue
        compact = re.sub(r"\s+", "", raw)
        if (
            re.fullmatch(r"(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.](?:19|20)\d{2}", compact)
            or re.fullmatch(r"(?:19|20)\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])", compact)
            or re.fullmatch(r"\d{5}-\d{7}-\d", compact)
        ):
            continue
        # Avoid interpreting compact years, fees, tracking IDs, and long digit
        # runs as phone numbers. Visible phones usually include '+' or separators.
        separator_count = sum(raw.count(char) for char in (" ", "-", "(", ")", "/"))
        prefix = visible[max(0, match.start() - 32) : match.start()].casefold()
        labelled_compact = bool(
            site_family != _UET_SITE_GENERIC
            and separator_count < 2
            and re.search(r"(?:phone|cell|mobile|fax|contact)\s*(?:no\.?|number)?\s*:?\s*$", prefix)
        )
        if "+" not in raw and separator_count < 2 and not labelled_compact:
            continue
        if re.search(r"(?:rs\.?|pkr)\s*$", prefix):
            continue
        warning_prefix = visible[max(0, match.start() - 160) : match.start()].casefold()
        if re.search(
            r"(?:only for (?:the )?sms|sms service|do not call|don't try|"
            r"don’t try|fake/fraud|not for calls)[^.!?]{0,80}$",
            warning_prefix,
        ):
            continue
        phones.add(raw)

    return sorted(emails.values(), key=str.casefold), sorted(phones)

def _fact_not_already_present(fact: str, body_key: str) -> bool:
    # Visible prose commonly contains the value but not the structured-data
    # label. Compare both forms so supplemental facts add information rather
    # than duplicating the same date, name, or description.
    _, separator, value = fact.partition(":")
    candidates = [_plain_block_key(fact)]
    if separator:
        candidates.append(_plain_block_key(value))
    meaningful = [candidate for candidate in candidates if candidate]
    return bool(
        meaningful
        and all(candidate not in body_key for candidate in meaningful)
    )

def _resource_manifest(
    resources: Sequence[HtmlResourceLink],
    options: HtmlExtractorOptions,
    canonical_url: str = "",
) -> str:
    maximum = _bounded_nonnegative(options.max_manifest_items, 150, 5_000)
    if maximum == 0:
        return ""

    keywords = _UET_IMPORTANT_RESOURCE_KEYWORDS
    ranked: list[tuple[int, int, HtmlResourceLink]] = []
    for index, item in enumerate(resources):
        if canonical_url and item.url == canonical_url:
            continue
        haystack = f"{item.text} {item.url}".casefold()
        try:
            item_host = (urllib.parse.urlsplit(item.url).hostname or "").casefold()
        except (ValueError, UnicodeError):
            item_host = ""
        generic = item.text.casefold() in _GENERIC_LINK_TEXT
        keyword_hit = any(token in haystack for token in keywords)
        include = bool(
            item.kind != "page"
            or keyword_hit
            or (options.preserve_generic_links and generic)
            or not item.crawlable
        )
        if item_host in _UET_LOW_VALUE_EXTERNAL_HOSTS and item.kind == "page" and not keyword_hit:
            continue
        if not include:
            continue
        score = 0
        if item.kind != "page":
            score += 100
        if keyword_hit:
            score += 60
        if options.preserve_generic_links and generic:
            score += 20
        if not item.crawlable:
            score += 10
        ranked.append((score, index, item))

    if not ranked:
        return ""
    ranked.sort(key=lambda row: (-row[0], row[1]))
    lines = ["## Official resources"]
    seen: set[tuple[str, str]] = set()
    for _, _, item in ranked:
        label = item.text or item.kind.title()
        key = (label.casefold(), item.url)
        if key in seen:
            continue
        seen.add(key)
        suffix = f" ({item.kind})" if item.kind != "page" else ""
        lines.append(f"- {_markdown_link(label, item.url)}{suffix}")
        if len(lines) - 1 >= maximum:
            break
    return "\n".join(lines)

def _visual_manifest(candidates: Sequence[HtmlImageCandidate]) -> str:
    if not candidates:
        return ""
    lines = ["## Visual resources requiring text extraction"]
    for candidate in candidates:
        context = (
            f" — {_markdown_escape_text(candidate.context)}"
            if candidate.context
            else ""
        )
        lines.append(
            f"- {_markdown_link(candidate.alt_text, candidate.url)}{context}"
        )
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Public extraction entry point
# ---------------------------------------------------------------------------


def extract_html_document(
    body: bytes,
    content_type: str,
    final_url: str,
    policy: UrlPolicyLike,
    options: HtmlExtractorOptions | None = None,
) -> HtmlExtractionResult | None:
    """Extract meaningful active content and all bounded official discoveries.

    The function is synchronous by design because the crawler already runs it in
    a worker thread.  It performs no network I/O and never executes JavaScript.
    """

    if not body:
        return None
    options = options or HtmlExtractorOptions()
    maximum_input = _bounded_positive(
        options.max_input_bytes,
        25_000_000,
        100_000_000,
    )
    original_input_bytes = len(body)
    prefiltered_body = body
    pretruncate_fields = 0
    pretruncate_bytes = 0
    pretruncate_scan_truncated = 0
    if original_input_bytes > maximum_input:
        (
            prefiltered_body,
            pretruncate_fields,
            pretruncate_bytes,
            pretruncate_scan_truncated,
        ) = _pretruncate_prune_aspnet_state_bytes(
            body,
            options.max_hidden_input_value_chars,
        )
    bounded_body = bytes(prefiltered_body[:maximum_input])
    input_diagnostics = {
        "input_bytes": original_input_bytes,
        "input_bytes_after_pretruncate_pruning": len(prefiltered_body),
        "input_bytes_parsed": len(bounded_body),
        "input_truncated": int(len(prefiltered_body) > len(bounded_body)),
        "pretruncate_aspnet_fields_removed": pretruncate_fields,
        "pretruncate_aspnet_bytes_removed": pretruncate_bytes,
        "pretruncate_scan_truncated": pretruncate_scan_truncated,
    }

    maximum_url_characters = _bounded_positive(
        options.max_url_characters,
        8_192,
        65_536,
    )
    document_url = _normalize_http_url(
        final_url,
        maximum_url_characters,
    )
    if not document_url or not _safe_is_network_target(policy, document_url):
        return None

    # Keep the fetched URL separate from crawler identity. Browser base-URL and
    # empty-form-action semantics use the fetched address, while policy
    # canonicalization is still applied to frontier/resource identities.
    normalized_final_url = document_url
    policy_final_url = _safe_policy_canonicalize(policy, document_url)
    if policy_final_url:
        normalized_policy_final = _normalize_http_url(
            policy_final_url,
            maximum_url_characters,
        )
        if not normalized_policy_final or not _safe_is_network_target(
            policy, normalized_policy_final
        ):
            return None
        normalized_final_url = normalized_policy_final

    site_family = (
        _detect_uet_site_family(document_url)
        if options.enable_uet_site_profiles
        else _UET_SITE_GENERIC
    )

    raw_html, decode_diagnostics = _decode_body(bounded_body, content_type)
    if not raw_html.strip():
        return None

    soup, parse_diagnostics = _parse_active_dom(raw_html, options, site_family)
    if options.enable_uet_site_profiles and site_family == _UET_SITE_GENERIC:
        site_family = _detect_uet_site_family(document_url, soup)
    diagnostics = {
        **input_diagnostics,
        **decode_diagnostics,
        **parse_diagnostics,
        **_site_family_diagnostics(site_family),
    }
    if pretruncate_fields:
        diagnostics["aspnet_state_fields_removed"] += pretruncate_fields
        diagnostics["aspnet_state_characters_removed"] += pretruncate_bytes
        diagnostics["input_fields_removed_total"] += pretruncate_fields
        diagnostics["input_field_characters_removed_total"] += pretruncate_bytes
    title = _extract_title(soup, site_family)
    base_url = _document_base_url(
        soup,
        document_url,
        policy,
        maximum_url_characters,
    )
    canonical_url = _extract_canonical_url(
        soup,
        document_url,
        base_url,
        policy,
        maximum_url_characters,
    )
    if not canonical_url:
        canonical_url = normalized_final_url
    robots_directives = _meta_robots_directives(soup, options.robots_meta_names)
    diagnostics["meta_robots_noindex"] = int(
        "noindex" in robots_directives or "none" in robots_directives
    )
    diagnostics["meta_robots_nofollow"] = int(
        "nofollow" in robots_directives or "none" in robots_directives
    )

    structured = _extract_structured_data(soup, options)
    diagnostics.update(
        {
            "json_ld_scripts_seen": structured.scripts_seen,
            "json_ld_scripts_parsed": structured.scripts_parsed,
            "json_ld_parse_errors": structured.parse_errors,
            "json_ld_nodes_visited": structured.nodes_visited,
            "json_ld_truncated": structured.truncated,
            "microdata_nodes_seen": structured.microdata_nodes_seen,
            "rdfa_nodes_seen": structured.rdfa_nodes_seen,
            "microdata_urls": structured.microdata_urls,
            "rdfa_urls": structured.rdfa_urls,
            "microdata_facts": structured.microdata_facts,
            "rdfa_facts": structured.rdfa_facts,
            "json_ld_scripts_skipped_oversize": structured.json_ld_scripts_skipped_oversize,
            "attribute_structured_truncated": structured.attribute_structured_truncated,
        }
    )

    crawl_links, resources, discovery_diagnostics = _discover_links_and_resources(
        soup,
        base_url,
        document_url,
        canonical_url,
        policy,
        options,
        structured,
        robots_directives,
        site_family,
    )
    diagnostics.update(discovery_diagnostics)

    image_candidates, image_diagnostics = _collect_image_candidates(
        soup, base_url, policy, options, structured, site_family
    )
    diagnostics.update(image_diagnostics)
    emails, phones = (
        _extract_contacts(soup, options.max_contact_scan_characters, site_family)
        if options.include_footer_contacts
        else ([], [])
    )
    meta_facts = _extract_meta_facts(
        soup,
        _bounded_nonnegative(options.max_structured_facts, 80, 1_000),
    )

    markdown_soup, markdown_diagnostics = _prepare_dom_for_markdown(
        soup,
        base_url,
        policy,
        image_candidates,
        options,
        site_family,
    )
    for key, value in markdown_diagnostics.items():
        diagnostics[key] = diagnostics.get(key, 0) + value

    full_dom_markdown = _remove_duplicate_title_heading(
        _markdownify_dom(markdown_soup),
        title,
    )
    full_dom_markdown, boilerplate_removed = _remove_uet_boilerplate_blocks(
        full_dom_markdown, site_family, title
    )
    diagnostics["uet_boilerplate_blocks_removed"] = boilerplate_removed
    if site_family == _UET_SITE_FMS:
        full_dom_markdown, fms_duplicates_removed = _deduplicate_fms_markdown(
            full_dom_markdown
        )
    else:
        fms_duplicates_removed = 0
    diagnostics["fms_duplicate_blocks_removed"] = fms_duplicates_removed
    trafilatura_markdown = _trafilatura_markdown(markdown_soup, canonical_url, options)
    supplemental = _supplemental_markdown_blocks(
        full_dom_markdown,
        trafilatura_markdown,
        _bounded_nonnegative(options.max_supplemental_blocks, 80, 1_000),
    )
    diagnostics["trafilatura_supplemental_blocks"] = len(supplemental)

    parts: list[str] = []
    if title:
        parts.append(f"# {_markdown_escape_text(title)}")
    parts.append(f"Source: <{canonical_url}>")
    if full_dom_markdown:
        parts.append(full_dom_markdown)
    if supplemental:
        parts.append("## Additional extracted content\n\n" + "\n\n".join(supplemental))

    body_key = _plain_block_key("\n\n".join(parts))
    facts: list[str] = []
    seen_facts: set[str] = set()
    for fact in [*structured.facts, *meta_facts]:
        key = fact.casefold()
        if key in seen_facts or not _fact_not_already_present(fact, body_key):
            continue
        seen_facts.add(key)
        facts.append(fact)
    diagnostics["structured_facts_emitted"] = len(facts)
    if facts:
        parts.append(
            "## Structured page facts\n\n"
            + "\n".join(f"- {_markdown_escape_text(fact)}" for fact in facts)
        )

    contact_lines: list[str] = []
    for email in emails:
        if email.casefold() not in body_key:
            contact_lines.append(f"- Email: {_markdown_escape_text(email)}")
    for phone in phones:
        if _normalize_space(phone).casefold() not in body_key:
            contact_lines.append(f"- Phone: {_markdown_escape_text(phone)}")
    diagnostics["contact_emails_found"] = len(emails)
    diagnostics["contact_phones_found"] = len(phones)
    diagnostics["contact_lines_emitted"] = len(contact_lines)
    if contact_lines:
        parts.append("## Contact details\n\n" + "\n".join(contact_lines))

    if options.include_resource_manifest:
        manifest = _resource_manifest(resources, options, canonical_url)
        if manifest:
            parts.append(manifest)
    if options.include_visual_manifest:
        manifest = _visual_manifest(image_candidates)
        if manifest:
            parts.append(manifest)

    markdown = _normalize_markdown(
        "\n\n".join(part for part in parts if part),
        minimum_block_chars_for_global_dedup=options.minimum_block_chars_for_global_dedup,
    )
    if not markdown:
        return None

    diagnostics.update(
        {
            "body_markdown_characters": len(full_dom_markdown),
            "body_markdown_empty": int(not bool(full_dom_markdown.strip())),
            "crawl_links": len(crawl_links),
            "resource_links": len(resources),
            "image_candidates": len(image_candidates),
            "markdown_words": len(markdown.split()),
            "markdown_characters": len(markdown),
        }
    )

    return HtmlExtractionResult(
        canonical_url=canonical_url,
        title=title or canonical_url,
        markdown=markdown,
        crawl_links=crawl_links,
        resources=resources,
        image_candidates=image_candidates,
        diagnostics=diagnostics,
    )