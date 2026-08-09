"""Selective, security-conscious Playwright renderer for the UET crawler.

The crawler performs a cheap static HTTP fetch first and calls this module only
when the response appears to be a JavaScript application shell or a thin,
script-driven document.  This renderer therefore optimizes for *high recall on
hard pages* while remaining bounded, deterministic, and safe enough to execute
untrusted public-site JavaScript.

Public compatibility contract
-----------------------------
``crawler.py`` relies on exactly these members:

* ``BrowserRenderer(...).available``
* ``await BrowserRenderer.render(url)`` returning an object with ``html``
  (UTF-8 bytes) and ``final_url``
* ``await BrowserRenderer.close()``

Additional result fields are intentionally additive.  They expose rendered
links, frame captures, selected first-party responses, Chrome DOMSnapshot data,
and diagnostics for future quality gates without requiring changes elsewhere.

Design highlights
-----------------
* one lazily started Chromium process, one isolated BrowserContext per render;
* bounded page concurrency and a hard render-attempt budget;
* every document navigation rechecked through the caller's URL policy and DNS
  safety callback, including browser-followed redirects;
* Service Workers blocked so request routing and network observations remain
  visible to Playwright;
* non-idempotent browser requests blocked (the renderer never submits forms or
  performs mutation requests);
* third-party documents/APIs blocked; only public HTTPS script/stylesheet
  dependencies may load outside the official crawl boundary;
* images, fonts and media blocked because the crawler's image pipeline fetches
  valuable images separately and autoplay video can consume extreme bandwidth;
* DOM readiness uses bounded mutation/size stability checks, not unbounded
  ``networkidle`` waits;
* bounded incremental scrolling triggers common lazy-rendered sections;
* open Shadow DOM is materialized into the serialized HTML;
* frame documents and supplemental layout text from CDP DOMSnapshot are merged
  into the returned HTML with provenance markers;
* cancellation-safe context cleanup and idempotent renderer shutdown.

Playwright is an optional dependency at import time.  When unavailable,
``available`` is false and the parent crawler can fail preflight with a clear
installation instruction.
"""

from __future__ import annotations

import asyncio
import contextlib
import html as html_stdlib
import inspect
import json
import logging
import re
import time
import urllib.parse
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Mapping, Protocol, Sequence

try:  # Optional at module-import time; production preflight requires it.
    from playwright.async_api import (  # type: ignore
        Error as PlaywrightError,
        TimeoutError as PlaywrightTimeoutError,
        async_playwright,
    )
except ImportError:  # pragma: no cover - exercised in minimal installations.
    PlaywrightError = RuntimeError  # type: ignore[assignment,misc]
    PlaywrightTimeoutError = TimeoutError  # type: ignore[assignment,misc]
    async_playwright = None  # type: ignore[assignment]


log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public result structures
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class RenderedFrame:
    """A browser frame serialized independently from the main document."""

    url: str
    name: str
    title: str
    html: bytes
    word_count: int


@dataclass(frozen=True)
class CapturedResponse:
    """A small, safe, first-party GET response observed while rendering."""

    url: str
    status: int
    content_type: str
    resource_type: str
    body: bytes


@dataclass(frozen=True)
class RenderedPage:
    """Rendered browser evidence returned to the crawl/extraction pipeline."""

    requested_url: str
    final_url: str
    title: str
    html: bytes
    links: tuple[str, ...] = ()
    frames: tuple[RenderedFrame, ...] = ()
    responses: tuple[CapturedResponse, ...] = ()
    # DOMSnapshot is experimental Chromium data.  It is retained only when it
    # remains within strict in-memory bounds; extraction never depends on it.
    dom_snapshot: Mapping[str, Any] | None = None
    diagnostics: Mapping[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class BrowserRendererError(RuntimeError):
    """Base error for deterministic browser-rendering failures."""


class BrowserRendererUnavailable(BrowserRendererError):
    """Playwright or the bundled Chromium executable is unavailable."""


class RenderLimitReached(BrowserRendererError):
    """The configured maximum number of browser render attempts was reached."""


class UnsafeBrowserNavigation(BrowserRendererError):
    """A browser navigation escaped the configured network boundary."""


class RenderedPageTooLarge(BrowserRendererError):
    """The browser-produced document exceeded a defensive size ceiling."""


# ---------------------------------------------------------------------------
# Lightweight protocols and constants
# ---------------------------------------------------------------------------


class UrlPolicyLike(Protocol):
    def canonicalize(self, url: str) -> str: ...

    def is_network_target(self, url: str) -> bool: ...

    def is_crawl_candidate(self, url: str) -> bool: ...


SafetyCallback = Callable[[str], bool | Awaitable[bool]]

_IDEMPOTENT_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
_OFFICIAL_BLOCKED_RESOURCE_TYPES = frozenset({"media", "font"})
_ALWAYS_BLOCKED_RESOURCE_TYPES = frozenset({"websocket", "eventsource"})
_THIRD_PARTY_ALLOWED_RESOURCE_TYPES = frozenset({"script", "stylesheet"})
_CAPTURE_RESOURCE_TYPES = frozenset({"xhr", "fetch"})
_CAPTURE_CONTENT_TYPES = (
    "application/json",
    "application/ld+json",
    "application/xml",
    "application/xhtml+xml",
    "text/html",
    "text/plain",
    "text/xml",
)
_TRACKER_HOST_PARTS = (
    "google-analytics",
    "googletagmanager",
    "doubleclick",
    "facebook.net",
    "connect.facebook",
    "clarity.ms",
    "hotjar",
    "segment.io",
    "segment.com",
    "mixpanel",
    "amplitude",
    "newrelic",
    "sentry.io",
    "cloudflareinsights",
)
_UNSAFE_PATH_PARTS = (
    "/logout",
    "/signout",
    "/delete",
    "/remove",
    "/destroy",
    "/unsubscribe",
)

# Hard defensive limits.  The parent crawler already applies static response
# limits; rendered HTML can expand, so it receives its own bounded ceiling.
_MAX_RENDERED_HTML_BYTES = 32 * 1024 * 1024
_MAX_FRAME_HTML_BYTES = 8 * 1024 * 1024
_MAX_ALL_FRAME_HTML_BYTES = 16 * 1024 * 1024
_MAX_FRAMES = 24
_MAX_CAPTURED_RESPONSE_BYTES = 2 * 1024 * 1024
_MAX_ALL_CAPTURED_RESPONSE_BYTES = 8 * 1024 * 1024
_MAX_CAPTURED_RESPONSES = 32
_MAX_DOM_SNAPSHOT_STRING_BYTES = 16 * 1024 * 1024
_MAX_DOM_SNAPSHOT_NODES = 250_000
_MAX_SNAPSHOT_SUPPLEMENT_CHARS = 250_000
_MAX_CONSOLE_MESSAGES = 40
_MAX_PAGE_ERRORS = 20
_MAX_FAILED_REQUESTS = 40
_MAX_LINKS = 20_000
_MAX_SCROLL_STEPS = 18
_MAX_SCROLL_DISTANCE_PX = 120_000
_STABILITY_SAMPLE_SECONDS = 0.25
_MIN_STABILITY_WINDOW_SECONDS = 0.25


# The function is executed in page/frame JavaScript.  It clones the document
# and materializes *open* shadow roots as ordinary marked sections so the
# existing HTML extractor can process their content.  Closed roots are not
# accessible to page JavaScript; CDP DOMSnapshot supplies a best-effort text
# supplement for those.
_SERIALIZE_DOCUMENT_JS = r"""
() => {
  const root = document.documentElement;
  if (!root) {
    return {
      html: '',
      title: document.title || '',
      visibleText: '',
      shadowRoots: 0,
      customElements: 0,
      linkCount: 0,
      scrollHeight: 0,
    };
  }

  let shadowRoots = 0;
  let customElements = 0;

  const cloneNodeWithOpenShadow = (original) => {
    const clone = original.cloneNode(false);
    if (original.nodeType === Node.ELEMENT_NODE) {
      if (original.localName && original.localName.includes('-')) {
        customElements += 1;
      }
    }
    for (const child of original.childNodes) {
      clone.appendChild(cloneNodeWithOpenShadow(child));
    }
    if (original.nodeType === Node.ELEMENT_NODE && original.shadowRoot) {
      shadowRoots += 1;
      const section = document.createElement('section');
      section.setAttribute('data-uet-shadow-root', 'open');
      section.setAttribute('data-uet-shadow-host', original.localName || 'unknown');
      for (const child of original.shadowRoot.childNodes) {
        section.appendChild(cloneNodeWithOpenShadow(child));
      }
      clone.appendChild(section);
    }
    return clone;
  };

  const cloneRoot = cloneNodeWithOpenShadow(root);
  const doctype = document.doctype
    ? '<!DOCTYPE ' + document.doctype.name + '>'
    : '<!DOCTYPE html>';
  const body = document.body;
  return {
    html: doctype + '\n' + cloneRoot.outerHTML,
    title: document.title || '',
    visibleText: body ? (body.innerText || '') : '',
    shadowRoots,
    customElements,
    linkCount: document.links ? document.links.length : 0,
    scrollHeight: Math.max(
      body ? body.scrollHeight : 0,
      root.scrollHeight || 0,
      body ? body.offsetHeight : 0,
      root.offsetHeight || 0
    ),
  };
}
"""


_COLLECT_LINKS_JS = r"""
() => {
  const output = [];
  const seen = new Set();
  const push = (value) => {
    if (typeof value !== 'string') return;
    const text = value.trim();
    if (!text || seen.has(text)) return;
    seen.add(text);
    output.push(text);
  };
  const visitRoot = (root) => {
    if (!root || !root.querySelectorAll) return;
    for (const element of root.querySelectorAll(
      'a[href], area[href], link[href], form[action], iframe[src], frame[src], object[data], embed[src]'
    )) {
      push(element.href || element.action || element.data || element.src || '');
      if (element.shadowRoot) visitRoot(element.shadowRoot);
    }
    for (const element of root.querySelectorAll('*')) {
      if (element.shadowRoot) visitRoot(element.shadowRoot);
    }
  };
  visitRoot(document);
  return output;
}
"""


_DOM_SIGNATURE_JS = r"""
() => {
  const root = document.documentElement;
  const body = document.body;
  return {
    ready: document.readyState,
    htmlLength: root ? root.outerHTML.length : 0,
    textLength: body ? (body.innerText || '').length : 0,
    links: document.links ? document.links.length : 0,
    nodes: root ? root.getElementsByTagName('*').length : 0,
    scrollHeight: Math.max(
      body ? body.scrollHeight : 0,
      root ? root.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      root ? root.offsetHeight : 0
    ),
  };
}
"""


# ---------------------------------------------------------------------------
# Pure helpers (kept testable without a browser binary)
# ---------------------------------------------------------------------------


def _normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _word_count(value: str) -> int:
    return len(re.findall(r"\w+", value, flags=re.UNICODE))


def _safe_content_type(headers: Mapping[str, str]) -> str:
    value = headers.get("content-type", "")
    return value.split(";", 1)[0].strip().lower()


def _content_length(headers: Mapping[str, str]) -> int | None:
    raw = headers.get("content-length", "").strip()
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _looks_like_tracker(url: str) -> bool:
    try:
        host = (urllib.parse.urlsplit(url).hostname or "").lower()
    except ValueError:
        return True
    return any(part in host for part in _TRACKER_HOST_PARTS)


def _looks_mutating_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlsplit(url)
    except ValueError:
        return True
    lowered_path = parsed.path.lower()
    if any(part in lowered_path for part in _UNSAFE_PATH_PARTS):
        return True
    query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    for key, values in query.items():
        key_lower = key.lower()
        if key_lower in {"action", "do", "operation", "cmd", "command"}:
            for value in values:
                if value.lower() in {
                    "delete",
                    "remove",
                    "destroy",
                    "logout",
                    "signout",
                    "unsubscribe",
                    "update",
                    "save",
                }:
                    return True
    return False


def _valid_public_https_dependency(url: str) -> bool:
    """Syntactic check before the caller-provided DNS safety callback."""

    try:
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme.lower() != "https" or not parsed.hostname:
            return False
        if parsed.username is not None or parsed.password is not None:
            return False
        if parsed.port not in (None, 443):
            return False
    except (ValueError, UnicodeError):
        return False
    return not _looks_like_tracker(url)


def _extract_body_fragment(document_html: str) -> str:
    match = re.search(r"<body\b[^>]*>(?P<body>.*)</body\s*>", document_html, re.I | re.S)
    if match:
        return match.group("body").strip()
    # A malformed/fragment document is still useful.  Strip top-level wrappers
    # conservatively without attempting to repair it here.
    value = re.sub(r"<!doctype[^>]*>", "", document_html, flags=re.I)
    value = re.sub(r"</?(?:html|head|body)\b[^>]*>", "", value, flags=re.I)
    return value.strip()


def _inject_before_body_end(document_html: str, supplement: str) -> str:
    if not supplement:
        return document_html
    match = list(re.finditer(r"</body\s*>", document_html, re.I))
    if match:
        index = match[-1].start()
        return document_html[:index] + supplement + "\n" + document_html[index:]
    return document_html + "\n" + supplement


def _snapshot_size_is_bounded(snapshot: Mapping[str, Any]) -> bool:
    strings = snapshot.get("strings")
    documents = snapshot.get("documents")
    if not isinstance(strings, list) or not isinstance(documents, list):
        return False
    string_bytes = 0
    for value in strings:
        if isinstance(value, str):
            string_bytes += len(value.encode("utf-8", errors="replace"))
            if string_bytes > _MAX_DOM_SNAPSHOT_STRING_BYTES:
                return False
    nodes = 0
    for document in documents:
        if not isinstance(document, Mapping):
            continue
        node_tree = document.get("nodes")
        if not isinstance(node_tree, Mapping):
            continue
        node_types = node_tree.get("nodeType")
        if isinstance(node_types, list):
            nodes += len(node_types)
            if nodes > _MAX_DOM_SNAPSHOT_NODES:
                return False
    return True


def _snapshot_layout_text(snapshot: Mapping[str, Any], existing_text: str) -> str:
    """Extract unique rendered layout text from a CDP DOMSnapshot.

    LayoutTreeSnapshot.text contains indexes into the top-level string table.
    This is intentionally a supplement—not a DOM reconstruction.  It can retain
    visible text from flattened Shadow DOM and frame documents that ordinary
    ``page.content()`` serialization omits.
    """

    strings = snapshot.get("strings")
    documents = snapshot.get("documents")
    if not isinstance(strings, list) or not isinstance(documents, list):
        return ""

    existing_normalized = _normalize_text(existing_text).casefold()
    emitted: list[str] = []
    seen: set[str] = set()
    characters = 0

    for document in documents:
        if not isinstance(document, Mapping):
            continue
        layout = document.get("layout")
        if not isinstance(layout, Mapping):
            continue
        text_indexes = layout.get("text")
        if not isinstance(text_indexes, list):
            continue
        for raw_index in text_indexes:
            if not isinstance(raw_index, int) or raw_index < 0 or raw_index >= len(strings):
                continue
            raw = strings[raw_index]
            if not isinstance(raw, str):
                continue
            text = _normalize_text(raw)
            if len(text) < 2:
                continue
            key = text.casefold()
            if key in seen or key in existing_normalized:
                continue
            # Suppress obvious source/code fragments that occasionally enter
            # layout text through unusual legacy markup.
            if "{" in text and "}" in text and ("function" in key or "=>" in text):
                continue
            seen.add(key)
            if characters + len(text) + 1 > _MAX_SNAPSHOT_SUPPLEMENT_CHARS:
                return "\n".join(emitted)
            emitted.append(text)
            characters += len(text) + 1
    return "\n".join(emitted)


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


async def _close_with_shield(awaitable: Awaitable[Any], timeout: float = 10.0) -> None:
    """Finish cleanup even when the surrounding task has been cancelled."""

    task = asyncio.create_task(awaitable)
    try:
        await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
    except asyncio.CancelledError:
        with contextlib.suppress(Exception):
            await asyncio.wait_for(asyncio.shield(task), timeout=timeout)
        raise
    except Exception:
        task.cancel()
        with contextlib.suppress(Exception, asyncio.CancelledError):
            await task


# ---------------------------------------------------------------------------
# Browser renderer
# ---------------------------------------------------------------------------


class BrowserRenderer:
    """Lazily managed Playwright Chromium renderer.

    Constructor parameters intentionally match the existing crawler.  A value
    of ``max_pages=0`` means unlimited selective render attempts.
    """

    def __init__(
        self,
        enabled: bool = False,
        policy: UrlPolicyLike | None = None,
        is_safe_url: SafetyCallback | None = None,
        user_agent: str = "",
        timeout_seconds: float = 30,
        settle_milliseconds: int = 1000,
        concurrency: int = 1,
        max_pages: int = 10,
    ) -> None:
        self.enabled = bool(enabled)
        self.policy = policy
        self.is_safe_url = is_safe_url
        self.user_agent = user_agent.strip()
        self.timeout_seconds = max(1.0, float(timeout_seconds))
        self.settle_milliseconds = max(0, int(settle_milliseconds))
        self.concurrency = max(1, int(concurrency))
        self.max_pages = max(0, int(max_pages))

        self.available = bool(self.enabled and async_playwright is not None)

        self._semaphore = asyncio.Semaphore(self.concurrency)
        self._lifecycle_lock = asyncio.Lock()
        self._counter_lock = asyncio.Lock()
        self._playwright: Any | None = None
        self._browser: Any | None = None
        self._closing = False
        self._closed = False
        self._render_attempts = 0
        self._render_successes = 0
        self._active_renders: set[asyncio.Task[Any]] = set()
        self._background_tasks: set[asyncio.Task[Any]] = set()

    # ------------------------------ lifecycle ------------------------------

    async def _ensure_started(self) -> None:
        if not self.enabled:
            raise BrowserRendererUnavailable("Browser rendering is disabled")
        if async_playwright is None:
            raise BrowserRendererUnavailable(
                "Playwright is not installed. Install the Python package and run "
                "`python -m playwright install --with-deps chromium`."
            )
        if self._closed or self._closing:
            raise BrowserRendererUnavailable("Browser renderer is closing or closed")

        browser = self._browser
        if browser is not None:
            try:
                if browser.is_connected():
                    return
            except Exception:
                pass

        async with self._lifecycle_lock:
            if self._closed or self._closing:
                raise BrowserRendererUnavailable("Browser renderer is closing or closed")
            browser = self._browser
            if browser is not None:
                try:
                    if browser.is_connected():
                        return
                except Exception:
                    pass

            await self._dispose_browser_locked()
            try:
                self._playwright = await async_playwright().start()
                self._browser = await self._playwright.chromium.launch(headless=True)
                self._browser.on("disconnected", self._on_browser_disconnected)
            except Exception as exc:
                await self._dispose_browser_locked()
                self.available = False
                raise BrowserRendererUnavailable(
                    "Could not start Playwright Chromium. Ensure the browser is installed "
                    "with `python -m playwright install --with-deps chromium`: "
                    f"{type(exc).__name__}: {exc}"
                ) from exc

    def _on_browser_disconnected(self, *_: Any) -> None:
        # The next render attempt will restart Chromium under _lifecycle_lock.
        self._browser = None

    async def _dispose_browser_locked(self) -> None:
        browser, playwright = self._browser, self._playwright
        self._browser = None
        self._playwright = None
        if browser is not None:
            with contextlib.suppress(Exception):
                await browser.close(reason="UET crawler renderer recycle")
        if playwright is not None:
            with contextlib.suppress(Exception):
                await playwright.stop()

    async def close(self) -> None:
        """Idempotently stop active callbacks, contexts, Chromium and Playwright."""

        async with self._lifecycle_lock:
            if self._closed:
                return
            self._closing = True

        current = asyncio.current_task()
        active = [task for task in self._active_renders if task is not current]
        if active:
            done, pending = await asyncio.wait(active, timeout=self.timeout_seconds + 10.0)
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)

        background = [task for task in self._background_tasks if not task.done()]
        if background:
            done, pending = await asyncio.wait(background, timeout=5.0)
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)

        async with self._lifecycle_lock:
            await self._dispose_browser_locked()
            self._closed = True
            self._closing = False
            self.available = False

    # ------------------------------- policy --------------------------------

    def _canonicalize(self, url: str) -> str:
        if self.policy is None:
            return url.strip()
        try:
            return self.policy.canonicalize(url)
        except Exception:
            return ""

    def _is_official_target(self, url: str) -> bool:
        if self.policy is None:
            return False
        try:
            return bool(self.policy.is_network_target(url))
        except Exception:
            return False

    async def _is_safe(self, url: str) -> bool:
        if self.is_safe_url is None:
            # Refuse to weaken the crawler's network boundary silently.
            return False
        try:
            return bool(await _maybe_await(self.is_safe_url(url)))
        except Exception:
            return False

    async def _validate_official_url(self, url: str) -> str:
        canonical = self._canonicalize(url)
        if not canonical or not self._is_official_target(canonical):
            raise UnsafeBrowserNavigation(
                f"Browser navigation is outside the configured crawl boundary: {url}"
            )
        if _looks_mutating_url(canonical):
            raise UnsafeBrowserNavigation(
                f"Browser navigation resembles a state-changing endpoint: {canonical}"
            )
        if not await self._is_safe(canonical):
            raise UnsafeBrowserNavigation(
                f"Browser navigation resolves to a non-public or invalid host: {canonical}"
            )
        return canonical

    async def _route_request(
        self,
        route: Any,
        request: Any,
        counters: dict[str, int],
    ) -> None:
        """Apply network boundary, method safety and bandwidth policy."""

        url = str(request.url)
        method = str(request.method).upper()
        resource_type = str(request.resource_type).lower()

        async def abort(reason: str) -> None:
            counters[reason] = counters.get(reason, 0) + 1
            with contextlib.suppress(Exception):
                await route.abort("blockedbyclient")

        if method not in _IDEMPOTENT_METHODS:
            await abort("blocked_non_idempotent")
            return
        if _looks_mutating_url(url):
            await abort("blocked_mutating_url")
            return
        if resource_type in _ALWAYS_BLOCKED_RESOURCE_TYPES:
            await abort("blocked_streaming_resource")
            return

        # Internal URLs do not require network permission.
        if url.startswith(("about:", "data:", "blob:")):
            with contextlib.suppress(Exception):
                await route.continue_()
            return

        canonical = self._canonicalize(url)
        if canonical and self._is_official_target(canonical):
            if not await self._is_safe(canonical):
                await abort("blocked_unsafe_official_host")
                return
            # Media and fonts add little extraction value.  Images are also
            # blocked; valuable page images are independently downloaded and
            # transcribed by the crawler's image-enrichment path.
            if resource_type in _OFFICIAL_BLOCKED_RESOURCE_TYPES or resource_type == "image":
                await abort("blocked_heavy_resource")
                return
            counters["allowed_official"] = counters.get("allowed_official", 0) + 1
            try:
                await route.continue_()
            except Exception:
                counters["route_continue_errors"] = counters.get("route_continue_errors", 0) + 1
            return

        # A page may require a public CDN-hosted framework to render.  Permit
        # only HTTPS scripts/stylesheets, never third-party documents or APIs.
        if (
            resource_type in _THIRD_PARTY_ALLOWED_RESOURCE_TYPES
            and _valid_public_https_dependency(url)
            and await self._is_safe(url)
        ):
            counters["allowed_public_dependency"] = counters.get(
                "allowed_public_dependency", 0
            ) + 1
            try:
                await route.continue_()
            except Exception:
                counters["route_continue_errors"] = counters.get("route_continue_errors", 0) + 1
            return

        await abort("blocked_out_of_scope")

    # ------------------------------- events --------------------------------

    def _spawn(self, awaitable: Awaitable[Any]) -> asyncio.Task[Any]:
        task = asyncio.create_task(awaitable)
        self._background_tasks.add(task)

        def done(completed: asyncio.Task[Any]) -> None:
            self._background_tasks.discard(completed)
            with contextlib.suppress(Exception, asyncio.CancelledError):
                completed.result()

        task.add_done_callback(done)
        return task

    async def _capture_response(
        self,
        response: Any,
        output: list[CapturedResponse],
        output_lock: asyncio.Lock,
        diagnostics: dict[str, Any],
    ) -> None:
        if len(output) >= _MAX_CAPTURED_RESPONSES:
            return
        request = response.request
        method = str(request.method).upper()
        resource_type = str(request.resource_type).lower()
        url = self._canonicalize(str(response.url))
        if (
            method != "GET"
            or resource_type not in _CAPTURE_RESOURCE_TYPES
            or not url
            or not self._is_official_target(url)
            or not await self._is_safe(url)
        ):
            return
        try:
            status = int(response.status)
            if not 200 <= status < 300:
                return
            headers = {str(k).lower(): str(v) for k, v in (await response.all_headers()).items()}
            content_type = _safe_content_type(headers)
            if not any(content_type == allowed for allowed in _CAPTURE_CONTENT_TYPES):
                return
            declared = _content_length(headers)
            if declared is not None and declared > _MAX_CAPTURED_RESPONSE_BYTES:
                diagnostics["responses_skipped_too_large"] += 1
                return
            body = bytes(await response.body())
        except Exception:
            diagnostics["response_capture_errors"] += 1
            return
        if len(body) > _MAX_CAPTURED_RESPONSE_BYTES:
            diagnostics["responses_skipped_too_large"] += 1
            return

        async with output_lock:
            total = sum(len(item.body) for item in output)
            if (
                len(output) >= _MAX_CAPTURED_RESPONSES
                or total + len(body) > _MAX_ALL_CAPTURED_RESPONSE_BYTES
            ):
                diagnostics["responses_skipped_budget"] += 1
                return
            output.append(
                CapturedResponse(
                    url=url,
                    status=status,
                    content_type=content_type,
                    resource_type=resource_type,
                    body=body,
                )
            )

    # ----------------------------- page waits ------------------------------

    async def _dom_signature(self, page: Any) -> tuple[Any, ...] | None:
        try:
            data = await page.evaluate(_DOM_SIGNATURE_JS)
        except Exception:
            return None
        if not isinstance(data, Mapping):
            return None
        return (
            data.get("ready"),
            int(data.get("htmlLength") or 0),
            int(data.get("textLength") or 0),
            int(data.get("links") or 0),
            int(data.get("nodes") or 0),
            int(data.get("scrollHeight") or 0),
        )

    async def _wait_for_dom_stability(self, page: Any, maximum_seconds: float) -> bool:
        required = max(
            _MIN_STABILITY_WINDOW_SECONDS,
            self.settle_milliseconds / 1000.0,
        )
        if required <= 0:
            return True
        deadline = time.monotonic() + max(0.1, maximum_seconds)
        last_signature: tuple[Any, ...] | None = None
        stable_since: float | None = None

        while time.monotonic() < deadline:
            signature = await self._dom_signature(page)
            now = time.monotonic()
            if signature is not None and signature == last_signature:
                stable_since = stable_since or now
                if now - stable_since >= required:
                    return True
            else:
                last_signature = signature
                stable_since = now if signature is not None else None
            await asyncio.sleep(_STABILITY_SAMPLE_SECONDS)
        return False

    async def _bounded_scroll(self, page: Any, deadline: float) -> int:
        """Trigger ordinary lazy sections without entering infinite feeds."""

        steps = 0
        travelled = 0
        try:
            metrics = await page.evaluate(
                "() => ({height: Math.max(document.body?.scrollHeight || 0, "
                "document.documentElement?.scrollHeight || 0), viewport: window.innerHeight || 800, "
                "y: window.scrollY || 0})"
            )
        except Exception:
            return 0
        if not isinstance(metrics, Mapping):
            return 0
        height = int(metrics.get("height") or 0)
        viewport = max(400, int(metrics.get("viewport") or 800))
        if height <= viewport * 1.25:
            return 0

        position = max(0, int(metrics.get("y") or 0))
        while (
            steps < _MAX_SCROLL_STEPS
            and travelled < _MAX_SCROLL_DISTANCE_PX
            and time.monotonic() < deadline
        ):
            target = min(height, position + max(600, int(viewport * 0.85)))
            if target <= position:
                break
            try:
                await page.evaluate("y => window.scrollTo(0, y)", target)
            except Exception:
                break
            delta = target - position
            position = target
            travelled += delta
            steps += 1
            await asyncio.sleep(0.12)
            try:
                new_metrics = await page.evaluate(
                    "() => ({height: Math.max(document.body?.scrollHeight || 0, "
                    "document.documentElement?.scrollHeight || 0), viewport: window.innerHeight || 800})"
                )
            except Exception:
                break
            if isinstance(new_metrics, Mapping):
                height = max(height, int(new_metrics.get("height") or height))
                viewport = max(400, int(new_metrics.get("viewport") or viewport))
            if position + 4 >= height:
                break

        with contextlib.suppress(Exception):
            await page.evaluate("() => window.scrollTo(0, 0)")
        return steps

    # ------------------------------ capture --------------------------------

    async def _serialize_frame(self, frame: Any) -> tuple[str, str, str, str, Mapping[str, Any]]:
        data = await frame.evaluate(_SERIALIZE_DOCUMENT_JS)
        if not isinstance(data, Mapping):
            raise BrowserRendererError("Frame serializer returned an invalid payload")
        frame_url = str(frame.url or "")
        name = str(frame.name or "")
        title = str(data.get("title") or "")
        document_html = str(data.get("html") or "")
        return frame_url, name, title, document_html, data

    async def _collect_frames(
        self,
        page: Any,
        main_frame: Any,
        diagnostics: dict[str, Any],
    ) -> tuple[list[RenderedFrame], str]:
        output: list[RenderedFrame] = []
        supplements: list[str] = []
        total_bytes = 0

        for frame in list(page.frames):
            if frame is main_frame or len(output) >= _MAX_FRAMES:
                continue
            frame_url = str(frame.url or "")
            if not frame_url or frame_url.startswith("about:blank"):
                continue
            canonical = self._canonicalize(frame_url)
            if (
                not canonical
                or not self._is_official_target(canonical)
                or not await self._is_safe(canonical)
            ):
                diagnostics["frames_skipped_out_of_scope"] += 1
                continue
            try:
                _, name, title, frame_html, frame_data = await self._serialize_frame(frame)
            except Exception:
                diagnostics["frame_capture_errors"] += 1
                continue
            encoded = frame_html.encode("utf-8", errors="replace")
            if (
                not encoded
                or len(encoded) > _MAX_FRAME_HTML_BYTES
                or total_bytes + len(encoded) > _MAX_ALL_FRAME_HTML_BYTES
            ):
                diagnostics["frames_skipped_too_large"] += 1
                continue
            visible_text = str(frame_data.get("visibleText") or "")
            output.append(
                RenderedFrame(
                    url=canonical,
                    name=name,
                    title=title,
                    html=encoded,
                    word_count=_word_count(visible_text),
                )
            )
            total_bytes += len(encoded)
            label = title or name or canonical
            fragment = _extract_body_fragment(frame_html)
            if fragment:
                supplements.append(
                    '<section data-uet-rendered-frame="true" '
                    f'data-uet-frame-url="{html_stdlib.escape(canonical, quote=True)}">\n'
                    f"<h2>Embedded frame: {html_stdlib.escape(label)}</h2>\n"
                    f"<p>Frame source: <a href=\"{html_stdlib.escape(canonical, quote=True)}\">"
                    f"{html_stdlib.escape(canonical)}</a></p>\n"
                    f"{fragment}\n</section>"
                )
        return output, "\n".join(supplements)

    async def _collect_links(self, page: Any) -> tuple[str, ...]:
        output: list[str] = []
        seen: set[str] = set()
        for frame in list(page.frames):
            try:
                raw_links = await frame.evaluate(_COLLECT_LINKS_JS)
            except Exception:
                continue
            if not isinstance(raw_links, Sequence) or isinstance(raw_links, (str, bytes)):
                continue
            for raw in raw_links:
                if not isinstance(raw, str):
                    continue
                canonical = self._canonicalize(raw)
                if not canonical or canonical in seen:
                    continue
                try:
                    crawlable = bool(
                        self.policy is not None and self.policy.is_crawl_candidate(canonical)
                    )
                except Exception:
                    crawlable = False
                if not crawlable:
                    continue
                seen.add(canonical)
                output.append(canonical)
                if len(output) >= _MAX_LINKS:
                    return tuple(output)
        return tuple(output)

    async def _capture_dom_snapshot(
        self,
        page: Any,
        existing_text: str,
        diagnostics: dict[str, Any],
    ) -> tuple[Mapping[str, Any] | None, str]:
        session = None
        try:
            session = await page.context.new_cdp_session(page)
            snapshot = await session.send(
                "DOMSnapshot.captureSnapshot",
                {
                    "computedStyles": ["display", "visibility", "content", "white-space"],
                    "includePaintOrder": False,
                    "includeDOMRects": False,
                    "includeBlendedBackgroundColors": False,
                    "includeTextColorOpacities": False,
                },
            )
        except Exception:
            diagnostics["dom_snapshot_errors"] += 1
            return None, ""
        finally:
            if session is not None:
                with contextlib.suppress(Exception):
                    await session.detach()

        if not isinstance(snapshot, Mapping):
            diagnostics["dom_snapshot_errors"] += 1
            return None, ""
        supplement = _snapshot_layout_text(snapshot, existing_text)
        if not _snapshot_size_is_bounded(snapshot):
            diagnostics["dom_snapshot_dropped_for_size"] += 1
            return None, supplement
        return snapshot, supplement

    # ------------------------------- render --------------------------------

    async def _reserve_attempt(self) -> int:
        async with self._counter_lock:
            if self.max_pages > 0 and self._render_attempts >= self.max_pages:
                raise RenderLimitReached(
                    f"Browser render limit reached ({self.max_pages} attempted page(s))"
                )
            self._render_attempts += 1
            return self._render_attempts

    async def render(self, url: str) -> RenderedPage | None:
        """Render one official URL and return complete bounded browser evidence.

        ``None`` is returned only when rendering is disabled.  Operational,
        policy, timeout, and extraction failures raise explicit exceptions so
        the parent crawler does not silently accept incomplete static content.
        """

        if not self.enabled:
            return None
        requested = await self._validate_official_url(url)
        attempt_number = await self._reserve_attempt()
        current_task = asyncio.current_task()
        if current_task is not None:
            self._active_renders.add(current_task)

        started = time.monotonic()
        try:
            async with self._semaphore:
                if self._closing or self._closed:
                    raise BrowserRendererUnavailable("Browser renderer is closing or closed")
                await self._ensure_started()
                try:
                    return await asyncio.wait_for(
                        self._render_locked(requested, attempt_number, started),
                        # Navigation and per-call timeouts are bounded
                        # separately; this is the aggregate deadline so a
                        # pathological page cannot pin a worker indefinitely.
                        timeout=self.timeout_seconds * 2,
                    )
                except asyncio.TimeoutError:
                    raise BrowserRendererError(
                        f"Browser rendering exceeded the total deadline of "
                        f"{self.timeout_seconds * 2:.0f}s for {requested}"
                    ) from None
        finally:
            if current_task is not None:
                self._active_renders.discard(current_task)

    async def _render_locked(
        self,
        requested: str,
        attempt_number: int,
        started: float,
    ) -> RenderedPage:
        browser = self._browser
        if browser is None:
            raise BrowserRendererUnavailable("Chromium is not running")

        diagnostics: dict[str, Any] = {
            "render_attempt": attempt_number,
            "route_counts": {},
            "console_messages": [],
            "page_errors": [],
            "failed_requests": [],
            "dialogs_dismissed": 0,
            "popups_closed": 0,
            "navigation_timed_out": False,
            "dom_stable_before_scroll": False,
            "dom_stable_after_scroll": False,
            "scroll_steps": 0,
            "frame_capture_errors": 0,
            "frames_skipped_out_of_scope": 0,
            "frames_skipped_too_large": 0,
            "dom_snapshot_errors": 0,
            "dom_snapshot_dropped_for_size": 0,
            "response_capture_errors": 0,
            "responses_skipped_too_large": 0,
            "responses_skipped_budget": 0,
        }
        route_counts: dict[str, int] = diagnostics["route_counts"]
        captured_responses: list[CapturedResponse] = []
        captured_lock = asyncio.Lock()
        response_tasks: set[asyncio.Task[Any]] = set()
        context = None
        page = None

        try:
            context_kwargs: dict[str, Any] = {
                "accept_downloads": False,
                "java_script_enabled": True,
                "service_workers": "block",
                "ignore_https_errors": False,
                "viewport": {"width": 1440, "height": 900},
                "locale": "en-US",
            }
            if self.user_agent:
                context_kwargs["user_agent"] = self.user_agent

            context = await browser.new_context(**context_kwargs)
            context.set_default_timeout(int(self.timeout_seconds * 1000))
            context.set_default_navigation_timeout(int(self.timeout_seconds * 1000))
            await context.route(
                "**/*",
                lambda route, request: self._route_request(route, request, route_counts),
            )
            # Playwright 1.48+ can route WebSockets separately.  Do not connect
            # crawler pages to long-lived bidirectional endpoints; they are not
            # needed for deterministic document extraction.
            if hasattr(context, "route_web_socket"):
                async def block_websocket(websocket_route: Any) -> None:
                    route_counts["blocked_websocket"] = route_counts.get(
                        "blocked_websocket", 0
                    ) + 1
                    with contextlib.suppress(Exception):
                        await websocket_route.close(
                            code=1000, reason="Blocked by read-only crawler renderer"
                        )

                await context.route_web_socket("**/*", block_websocket)
            page = await context.new_page()

            def on_console(message: Any) -> None:
                bucket = diagnostics["console_messages"]
                if len(bucket) >= _MAX_CONSOLE_MESSAGES:
                    return
                with contextlib.suppress(Exception):
                    bucket.append(
                        {
                            "type": str(message.type),
                            "text": str(message.text)[:1000],
                        }
                    )

            def on_page_error(error: Any) -> None:
                bucket = diagnostics["page_errors"]
                if len(bucket) < _MAX_PAGE_ERRORS:
                    bucket.append(str(error)[:2000])

            def on_request_failed(request: Any) -> None:
                bucket = diagnostics["failed_requests"]
                if len(bucket) >= _MAX_FAILED_REQUESTS:
                    return
                with contextlib.suppress(Exception):
                    bucket.append(
                        {
                            "url": str(request.url)[:2000],
                            "resource_type": str(request.resource_type),
                            "failure": str(request.failure or "")[:500],
                        }
                    )

            async def dismiss_dialog(dialog: Any) -> None:
                diagnostics["dialogs_dismissed"] += 1
                with contextlib.suppress(Exception):
                    await dialog.dismiss()

            async def close_popup(popup: Any) -> None:
                if popup is page:
                    return
                diagnostics["popups_closed"] += 1
                with contextlib.suppress(Exception):
                    await popup.close(run_before_unload=False)

            def on_response(response: Any) -> None:
                task = self._spawn(
                    self._capture_response(
                        response,
                        captured_responses,
                        captured_lock,
                        diagnostics,
                    )
                )
                response_tasks.add(task)
                task.add_done_callback(lambda completed: response_tasks.discard(completed))

            page.on("console", on_console)
            page.on("pageerror", on_page_error)
            page.on("requestfailed", on_request_failed)
            page.on("dialog", lambda dialog: self._spawn(dismiss_dialog(dialog)))
            context.on("page", lambda popup: self._spawn(close_popup(popup)))
            page.on("response", on_response)

            navigation_response = None
            try:
                navigation_response = await page.goto(
                    requested,
                    wait_until="domcontentloaded",
                    timeout=int(self.timeout_seconds * 1000),
                )
            except PlaywrightTimeoutError:
                diagnostics["navigation_timed_out"] = True
                # A legacy page can finish its useful DOM even when a resource
                # prevents the load milestone.  Continue only when a real
                # document exists; otherwise fail explicitly.
                with contextlib.suppress(Exception):
                    cdp = await context.new_cdp_session(page)
                    try:
                        await cdp.send("Page.stopLoading")
                    finally:
                        await cdp.detach()
                signature = await self._dom_signature(page)
                if page.url == "about:blank" or signature is None or signature[1] <= 0:
                    raise BrowserRendererError(
                        f"Browser navigation timed out before a document was available: {requested}"
                    )
            except PlaywrightError as exc:
                raise BrowserRendererError(
                    f"Browser navigation failed for {requested}: {exc}"
                ) from exc

            final_url = await self._validate_official_url(str(page.url))
            if navigation_response is not None:
                try:
                    status = int(navigation_response.status)
                except Exception:
                    status = 0
                diagnostics["navigation_status"] = status
                if status >= 400:
                    raise BrowserRendererError(
                        f"Browser navigation returned HTTP {status} for {final_url}"
                    )

            elapsed = time.monotonic() - started
            remaining = max(0.5, self.timeout_seconds - elapsed)
            diagnostics["dom_stable_before_scroll"] = await self._wait_for_dom_stability(
                page, min(remaining * 0.40, 8.0)
            )

            scroll_deadline = started + self.timeout_seconds
            diagnostics["scroll_steps"] = await self._bounded_scroll(page, scroll_deadline)
            remaining = max(0.25, self.timeout_seconds - (time.monotonic() - started))
            diagnostics["dom_stable_after_scroll"] = await self._wait_for_dom_stability(
                page, min(remaining * 0.50, 8.0)
            )

            main_url, _name, title, main_html, main_data = await self._serialize_frame(
                page.main_frame
            )
            # page.url is authoritative after browser redirects; the serializer
            # URL is diagnostic only.
            diagnostics["serialized_main_url"] = main_url
            diagnostics["shadow_roots"] = int(main_data.get("shadowRoots") or 0)
            diagnostics["custom_elements"] = int(main_data.get("customElements") or 0)
            diagnostics["rendered_visible_words"] = _word_count(
                str(main_data.get("visibleText") or "")
            )
            diagnostics["rendered_document_links"] = int(main_data.get("linkCount") or 0)
            diagnostics["rendered_scroll_height"] = int(main_data.get("scrollHeight") or 0)

            frames, frame_supplement = await self._collect_frames(
                page, page.main_frame, diagnostics
            )
            existing_text = str(main_data.get("visibleText") or "") + "\n" + "\n".join(
                frame.html.decode("utf-8", errors="replace") for frame in frames
            )
            dom_snapshot, snapshot_text = await self._capture_dom_snapshot(
                page, existing_text, diagnostics
            )

            supplements: list[str] = []
            if frame_supplement:
                supplements.append(
                    '<section data-uet-browser-supplement="frames">\n'
                    "<h2>Browser-rendered embedded documents</h2>\n"
                    f"{frame_supplement}\n</section>"
                )
            if snapshot_text:
                supplements.append(
                    '<section data-uet-browser-supplement="dom-snapshot">\n'
                    "<h2>Browser-rendered supplemental text</h2>\n"
                    f"<pre>{html_stdlib.escape(snapshot_text)}</pre>\n</section>"
                )
            if supplements:
                main_html = _inject_before_body_end(main_html, "\n".join(supplements))

            rendered_bytes = main_html.encode("utf-8", errors="replace")
            if len(rendered_bytes) > _MAX_RENDERED_HTML_BYTES:
                raise RenderedPageTooLarge(
                    f"Rendered HTML exceeds {_MAX_RENDERED_HTML_BYTES} bytes for {final_url}"
                )

            links = await self._collect_links(page)

            if response_tasks:
                done, pending = await asyncio.wait(response_tasks, timeout=2.0)
                for task in pending:
                    task.cancel()
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)

            diagnostics["frames_captured"] = len(frames)
            diagnostics["responses_captured"] = len(captured_responses)
            diagnostics["rendered_links_captured"] = len(links)
            diagnostics["rendered_html_bytes"] = len(rendered_bytes)
            diagnostics["elapsed_seconds"] = round(time.monotonic() - started, 3)

            async with self._counter_lock:
                self._render_successes += 1
                diagnostics["renderer_successes"] = self._render_successes
                diagnostics["renderer_attempts"] = self._render_attempts

            return RenderedPage(
                requested_url=requested,
                final_url=final_url,
                title=title,
                html=rendered_bytes,
                links=links,
                frames=tuple(frames),
                responses=tuple(captured_responses),
                dom_snapshot=dom_snapshot,
                diagnostics=diagnostics,
            )
        finally:
            for task in list(response_tasks):
                if not task.done():
                    task.cancel()
            if response_tasks:
                await asyncio.gather(*response_tasks, return_exceptions=True)
            if context is not None:
                try:
                    await _close_with_shield(
                        context.close(reason="UET crawler page render complete"),
                        timeout=min(10.0, self.timeout_seconds),
                    )
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    log.debug("Could not close browser context cleanly: %s", exc)


__all__ = [
    "BrowserRenderer",
    "BrowserRendererError",
    "BrowserRendererUnavailable",
    "CapturedResponse",
    "RenderedFrame",
    "RenderedPage",
    "RenderedPageTooLarge",
    "RenderLimitReached",
    "UnsafeBrowserNavigation",
]