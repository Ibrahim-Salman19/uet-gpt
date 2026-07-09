"""
UET Taxila — Unified Reliable RAG Crawler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Combines curl_cffi evasion, trafilatura, pymupdf4llm, and direct Convex /ingest pushes.
Handles Dead Letter Queues locally and manages transient timeouts.
"""

import asyncio
import fnmatch
import hashlib
import ipaddress
import logging
import random
import re
import socket
import sys
import time
import os
import json
import urllib.parse
import urllib.robotparser
from dataclasses import dataclass, field
from pathlib import Path

# third-party
from bs4 import BeautifulSoup
from curl_cffi.requests import AsyncSession
from curl_cffi.requests.errors import RequestsError
import markdownify
from tqdm.asyncio import tqdm as atqdm
import trafilatura
from trafilatura.settings import use_config
import fitz
import pymupdf4llm
from dotenv import load_dotenv

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

project_root = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=project_root / ".env.local")

# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════

CONVEX_SITE_URL = os.environ.get("CONVEX_SITE_URL")
if not CONVEX_SITE_URL and os.environ.get("NEXT_PUBLIC_CONVEX_URL"):
    CONVEX_SITE_URL = os.environ.get("NEXT_PUBLIC_CONVEX_URL").replace(".convex.cloud", ".convex.site")

if not CONVEX_SITE_URL:
    print("[ERROR] CONVEX_SITE_URL is not configured in .env.local")
    sys.exit(1)

# Never send the Bearer ingest token over cleartext http://.
if not CONVEX_SITE_URL.startswith("https://"):
    print(f"[ERROR] CONVEX_SITE_URL must be https:// (got: {CONVEX_SITE_URL})")
    sys.exit(1)

CONVEX_AUTH_TOKEN = os.environ.get("CONVEX_AUTH_TOKEN")
if not CONVEX_AUTH_TOKEN:
    print("WARNING: CONVEX_AUTH_TOKEN not set — /ingest endpoint may reject the request")
    print("  Consider using CRAWL_WEBHOOK_SECRET instead: export CONVEX_AUTH_TOKEN=$CRAWL_WEBHOOK_SECRET")

import argparse

parser = argparse.ArgumentParser(description="UET Taxila Reliable RAG Crawler")
parser.add_argument("--limit", type=int, default=500, help="Maximum number of pages to crawl")
parser.add_argument("--clean", action="store_true", help="Reset pipeline data before crawling")
parser.add_argument(
    "--config",
    type=str,
    default="scripts/crawl_config.json",
    help="Path to crawl config JSON (relative to repo root). Use a scoped config "
    "to crawl a subset of domains, e.g. scripts/crawl_config_admissions.json.",
)
args, unknown = parser.parse_known_args()

# Load crawl config. The --config flag lets you run a targeted crawl (e.g.
# admissions-only) without editing the default crawl_config.json.
CRAWL_CONFIG_PATH = (project_root / args.config).resolve()
if not CRAWL_CONFIG_PATH.exists():
    print(f"[ERROR] crawl config not found at {CRAWL_CONFIG_PATH}")
    sys.exit(1)

with open(CRAWL_CONFIG_PATH, encoding="utf-8") as _cf:
    CONFIG = json.loads(_cf.read())

SITE_ROOTS = CONFIG.get("seedUrls", [
    "https://web.uettaxila.edu.pk/",
    "https://uettaxila.edu.pk/",
])

ALLOWED_DOMAINS = frozenset(
    urllib.parse.urlparse(root).netloc for root in SITE_ROOTS
)

# Department faculty pages. Previously hardcoded in this file (departmentId 1-25),
# bypassing crawl_config.json as the documented source of truth. Now read from
# config so all seeds live in one place. Falls back to the legacy auto-generated
# range only if the config omits the key (backward compatibility).
_DEPT_RANGE = CONFIG.get("departmentFacultyRange", {"start": 1, "end": 25})
DEPARTMENT_FACULTY_URLS = CONFIG.get("departmentFacultyUrls") or [
    f"https://web.uettaxila.edu.pk/departmentfaculty?departmentId={i}"
    for i in range(_DEPT_RANGE.get("start", 1), _DEPT_RANGE.get("end", 25) + 1)
]

# Include patterns: URLs must match at least one (if any are defined) in addition
# to the domain allowlist. Previously defined in crawl_config.json but never read
# — making the config misleading. Now enforced so crawl_config.json is the true
# single source of truth for both inclusion and exclusion.
INCLUDE_PATTERNS = CONFIG.get("includePatterns", [])

MAX_PAGES       = args.limit
MAX_DEPTH       = CONFIG.get("maxDepth", 4)
CONCURRENCY     = CONFIG.get("concurrency", 5)
REQUEST_TIMEOUT = CONFIG.get("requestTimeout", 20)
MAX_RETRIES     = CONFIG.get("maxRetries", 3)
PUSH_RETRIES    = CONFIG.get("pushRetries", 3)
MIN_WORD_COUNT  = CONFIG.get("minWordCount", 80)
QUEUE_MAXSIZE   = CONFIG.get("queueMaxSize", 500)
EXCLUDE_PATTERNS = CONFIG.get("excludePatterns", [])
# Cap on a single fetched response body (defends against decompression bombs /
# huge PDFs exhausting memory). Default 25 MiB, overridable via config.
MAX_RESPONSE_BYTES = CONFIG.get("maxResponseBytes", 25 * 1024 * 1024)

SKIP_EXTENSIONS = frozenset(
    ".doc .docx .ppt .pptx .xls .xlsx .zip .rar .exe "
    ".jpg .jpeg .png .gif .svg .webp .mp4 .avi .mp3 .wav".split()
)

STRIP_PARAMS = frozenset(
    "utm_source utm_medium utm_campaign utm_term utm_content "
    "fbclid gclid msclkid ref source".split()
)

DLQ_FILE = project_root / "dlq.jsonl"
DLQ_PROCESSING_SUFFIX = ".processing"
STATE_FILE = project_root / "crawler_state.json"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("crawler.log", encoding="utf-8"),
    ],
)
log = logging.getLogger("uet_crawler")

# Trafilatura config
_traf_config = use_config()
_traf_config.set("DEFAULT", "MIN_EXTRACTED_SIZE", "100")
_traf_config.set("DEFAULT", "EXTRACTION_TIMEOUT", "0")

# ═════════════════════════════════════════════════════════════════════════════
# ROBOTS.TXT CACHE
# ═════════════════════════════════════════════════════════════════════════════

_robot_parsers: dict[str, urllib.robotparser.RobotFileParser | None] = {}

# The UA we actually send (curl_cffi impersonate="chrome"). robots.txt must be
# fetched with the SAME UA and evaluated against it — fetching with urllib's
# default "Python-urllib" UA both trips the WAF and checks the wrong agent.
ROBOTS_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

def _get_robot_parser(netloc: str) -> urllib.robotparser.RobotFileParser | None:
    if netloc not in _robot_parsers:
        rp = urllib.robotparser.RobotFileParser()
        rp.set_url(f"https://{netloc}/robots.txt")
        try:
            # Fetch through curl_cffi with chrome impersonation so the WAF does
            # not block/serve a challenge page (which urllib would silently turn
            # into allow-all). Parse the body ourselves with RobotFileParser.parse.
            from curl_cffi import requests as _cffi_requests
            resp = _cffi_requests.get(
                f"https://{netloc}/robots.txt",
                impersonate="chrome",
                timeout=10,
                allow_redirects=True,
            )
            # Per RFC 9309: 4xx/5xx (or empty) ⇒ unrestricted (allow-all).
            if 200 <= resp.status_code < 300 and resp.text.strip():
                rp.parse(resp.text.splitlines())
                _robot_parsers[netloc] = rp
                log.info(f"Loaded robots.txt for {netloc}")
            else:
                log.info(
                    f"robots.txt for {netloc} returned HTTP {resp.status_code}/empty "
                    f"— treating as allow-all (RFC 9309)"
                )
                _robot_parsers[netloc] = None
        except Exception as e:
            # Network/parse failure ⇒ allow-all rather than silently blocking,
            # matching RFC 9309 guidance for unreachable robots.txt.
            log.warning(f"Could not fetch robots.txt for {netloc}: {e}")
            _robot_parsers[netloc] = None
    return _robot_parsers[netloc]

# ═════════════════════════════════════════════════════════════════════════════
# DATA STRUCTURES
# ═════════════════════════════════════════════════════════════════════════════

@dataclass
class CrawlStats:
    fetched:  int = 0
    saved:    int = 0
    skipped:  int = 0
    failed:   int = 0
    dlq:      int = 0
    start_ts: float = field(default_factory=time.monotonic)

    def summary(self) -> str:
        s = int(time.monotonic() - self.start_ts)
        el = f"{s // 60}m{s % 60:02d}s"
        return f"Elap {el} | Fetch {self.fetched} | Save {self.saved} | Skip {self.skipped} | Fail {self.failed} | DLQ {self.dlq}"


# ═════════════════════════════════════════════════════════════════════════════
# SIMHASH NEAR-DUPLICATE DETECTION (R6 fix)
# ═════════════════════════════════════════════════════════════════════════════

class SimHash:
    """64-bit SimHash for near-duplicate content detection (Hamming distance ≤8)."""
    def __init__(self, bits: int = 64):
        self.bits = bits
        self.fingerprints: list[int] = []

    def _hash_token(self, token: str) -> int:
        h = hashlib.md5(token.encode()).digest()
        return int.from_bytes(h[:8], "big")

    def _fingerprint(self, text: str) -> int:
        words = re.findall(r'\w{2,}', text.lower())[:2000]
        if not words:
            return 0
        v = [0] * self.bits
        for word in set(words):
            h = self._hash_token(word)
            for i in range(self.bits):
                if h & (1 << i):
                    v[i] += 1
                else:
                    v[i] -= 1
        fp = 0
        for i in range(self.bits):
            if v[i] > 0:
                fp |= (1 << i)
        return fp

    @staticmethod
    def _hamming_distance(a: int, b: int) -> int:
        return (a ^ b).bit_count()

    def is_near_dup(self, text: str, threshold: int = 8) -> bool:
        if not text:
            return False
        fp = self._fingerprint(text[:5000])
        if fp == 0:
            return False
        for existing in self.fingerprints:
            if self._hamming_distance(fp, existing) <= threshold:
                return True
        self.fingerprints.append(fp)
        return False


# ═════════════════════════════════════════════════════════════════════════════
# UTILITIES
# ═════════════════════════════════════════════════════════════════════════════

def decode_cf_email(encoded: str) -> str:
    try:
        key = int(encoded[:2], 16)
        return "".join(chr(int(encoded[i:i+2], 16) ^ key) for i in range(2, len(encoded), 2))
    except Exception:
        return encoded

def decode_all_emails(html: str) -> str:
    html = re.sub(r'<input[^>]+value="[^"]{1000,}"[^>]*>', '', html, flags=re.IGNORECASE)
    html = re.sub(r'<input[^>]+name="__(VIEWSTATE|EVENTVALIDATION|VIEWSTATEGENERATION)"[^>]*>', '', html, flags=re.IGNORECASE)
    soup = BeautifulSoup(html, "lxml")
    for tag in soup.select("a.__cf_email__, span.__cf_email__, [data-cfemail]"):
        raw = tag.get("data-cfemail", "")
        if raw:
            tag.replace_with(decode_cf_email(raw))
    return str(soup)


# UET Taxila site-specific non-content elements that must be removed BEFORE
# main-content extraction, otherwise their text leaks into chunks. The old
# web.uettaxila.edu.pk site loads a first-visit announcement popup
# (firstvisitpopup.css) and rotating news/marquee sliders with time-sensitive
# items (merit lists, deadlines, event dates) that go stale quickly. Stripping
# them here means: (1) popup chrome never enters a chunk, (2) dated news items
# are not indexed as if they were permanent page content. Real announcement
# pages linked from these elements are still crawled normally via BFS link
# discovery, so no information is lost — only the transient chrome is dropped.
BOILERPLATE_SELECTORS = [
    # First-visit announcement popup (firstvisitpopup.css on web.uettaxila.edu.pk)
    "[id*=popup i]", "[class*=popup i]", "[class*=firstvisit i]",
    # Generic modal/dialog overlays
    "[class*=modal i]", "[id*=modal i]", "[class*=dialog i]",
    "[role=dialog]", "[aria-modal=true]",
    # Rotating news sliders / tickers / carousels — transient, high churn
    "marquee", "[class*=news-ticker i]", "[class*=ticker i]",
    "[class*=carousel i]", "[class*=slider i]",
    # Cookie banners and floating notices
    "[class*=cookie i]", "[id*=cookie i]", "[class*=floating-notice i]",
]

def strip_boilerplate_html(html: str) -> str:
    """Remove popup/modal/news-slider/cookie chrome before content extraction.

    Runs after decode_all_emails (which handles CF emails + ASP.NET ViewState)
    and before trafilatura. Removing non-content DOM up front is the standard
    text-extraction best practice: it prevents transient UI text from leaking
    into the main-content extraction and keeps chunks focused on real page body.
    """
    try:
        soup = BeautifulSoup(html, "lxml")
        for selector in BOILERPLATE_SELECTORS:
            for tag in soup.select(selector):
                tag.decompose()
        return str(soup)
    except Exception:
        # If BeautifulSoup fails, fall back to the raw HTML — trafilatura's own
        # boilerplate detection still runs as the backstop.
        return html

_DEFAULT_PORTS = {"http": "80", "https": "443"}


def canonicalize_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    # Normalize scheme + host case and strip the default port so that
    # Host vs host and example.com:443 collapse to one canonical form.
    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()
    netloc = hostname
    if parsed.port is not None and str(parsed.port) != _DEFAULT_PORTS.get(scheme):
        netloc = f"{hostname}:{parsed.port}"
    # Strip tracking params, then sort the remaining keys so that
    # ?a=1&b=2 and ?b=2&a=1 yield the same canonical string.
    params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    cleaned = {k: params[k] for k in sorted(params) if k not in STRIP_PARAMS}
    new_query = urllib.parse.urlencode(cleaned, doseq=True)
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunparse((scheme, netloc, path, parsed.params, new_query, ""))

def _matches_exclude(url: str) -> bool:
    path = urllib.parse.urlparse(url).path
    for pattern in EXCLUDE_PATTERNS:
        if pattern.startswith("http"):
            if fnmatch.fnmatch(url, pattern):
                return True
        else:
            if fnmatch.fnmatch(path, pattern):
                return True
    return False

def _matches_include(url: str) -> bool:
    """If INCLUDE_PATTERNS is defined, the URL must match at least one.
    An empty list means 'allow any URL within the domain allowlist' (the
    historical behavior), so a misconfigured/empty includePatterns never
    accidentally blocks the whole crawl."""
    if not INCLUDE_PATTERNS:
        return True
    for pattern in INCLUDE_PATTERNS:
        if pattern.startswith("http"):
            if fnmatch.fnmatch(url, pattern):
                return True
        else:
            # Treat non-absolute patterns as path globs for convenience.
            if fnmatch.fnmatch(urllib.parse.urlparse(url).path, pattern):
                return True
    return False

def is_allowed_url(url: str) -> bool:
    try:
        p = urllib.parse.urlparse(url)
        if p.scheme not in ("http", "https"):
            return False
        if p.netloc not in ALLOWED_DOMAINS:
            return False
        if any(p.path.lower().endswith(ext) for ext in SKIP_EXTENSIONS):
            return False
        # NOTE: mailto/javascript/tel are URL *schemes*, not path prefixes —
        # they are already rejected by the scheme allowlist above. A previous
        # p.path.startswith(("mailto:", ...)) check here was dead code.
        if _matches_exclude(url):
            return False
        if not _matches_include(url):
            return False
        rp = _get_robot_parser(p.netloc)
        if rp is not None and not rp.can_fetch(ROBOTS_USER_AGENT, url):
            return False
        return True
    except Exception:
        return False

# ─── SSRF / redirect re-validation (security fix) ────────────────────────────
MAX_REDIRECTS = 5


def _is_public_ip(ip_str: str) -> bool:
    """Return True only if the IP is a routable, public address."""
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return False
    # Reject IPv4-mapped / 6to4 / Teredo embedded private addresses too.
    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            ip = ip.ipv4_mapped
        elif ip.sixtofour is not None:
            ip = ip.sixtofour
    return not (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_reserved
        or ip.is_multicast
        or ip.is_unspecified
    )


def is_safe_host(netloc: str) -> bool:
    """
    Resolve the host and confirm every resolved IP is public.
    Defends against DNS-rebinding / internal-range hosts and IP-literal hosts
    (decimal/octal/hex/IPv4-mapped) that bypass the string allowlist.
    """
    # Robustly extract the host, handling bracketed IPv6 literals ("[::1]:8080")
    # so the port-colon split does not corrupt an IPv6 address.
    netloc_noauth = netloc.rsplit("@", 1)[-1]
    if netloc_noauth.startswith("["):
        host = netloc_noauth[1:].split("]", 1)[0]
    else:
        host = netloc_noauth.rsplit(":", 1)[0] if ":" in netloc_noauth else netloc_noauth
    if not host:
        return False
    # If the host is itself an IP literal, validate it directly.
    try:
        ipaddress.ip_address(host)
        return _is_public_ip(host)
    except ValueError:
        pass
    try:
        infos = socket.getaddrinfo(host, None)
    except (socket.gaierror, UnicodeError, OSError):
        return False
    if not infos:
        return False
    for info in infos:
        ip_str = info[4][0]
        if not _is_public_ip(ip_str):
            log.warning(f"Blocked SSRF: {host} resolves to non-public IP {ip_str}")
            return False
    return True


def is_fetchable_url(url: str) -> bool:
    """Allowlist check + resolved-IP public check, used before any network fetch."""
    if not is_allowed_url(url):
        return False
    try:
        netloc = urllib.parse.urlparse(url).netloc
    except Exception:
        return False
    return is_safe_host(netloc)


async def safe_get(session: AsyncSession, url: str, timeout: int):
    """
    Perform a GET with manual redirect handling so every hop is re-validated
    against the domain allowlist AND the resolved-IP public check. curl_cffi
    follows 3xx by default, which would let an on-domain open-redirect bounce
    the crawler to internal/metadata hosts — so redirects are disabled and
    walked manually here.
    """
    current = url
    for _ in range(MAX_REDIRECTS + 1):
        if not is_fetchable_url(current):
            raise RequestsError(f"Blocked disallowed/unsafe URL: {current}")
        resp = await session.get(current, timeout=timeout, allow_redirects=False)
        if resp.status_code in (301, 302, 303, 307, 308):
            location = resp.headers.get("Location") or resp.headers.get("location")
            if not location:
                return resp
            current = urllib.parse.urljoin(current, location)
            continue
        return resp
    raise RequestsError(f"Too many redirects (>{MAX_REDIRECTS}) for {url}")


def extract_links(html: str, base_url: str) -> list[str]:
    soup = BeautifulSoup(html, "lxml")
    seen, links = set(), []
    for tag in soup.find_all("a", href=True):
        full = urllib.parse.urljoin(base_url, tag["href"].strip()).split("#")[0]
        canonical = canonicalize_url(full)
        if is_allowed_url(canonical) and canonical not in seen:
            seen.add(canonical)
            links.append(canonical)
    return links

def extract_title(html: str) -> str:
    soup = BeautifulSoup(html, "lxml")
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    return h1.get_text(strip=True) if h1 else ""

def write_to_dlq(url: str, depth: int):
    with open(DLQ_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"url": url, "depth": depth}) + "\n")

def url_priority(url: str, depth: int) -> float:
    lower = url.lower()
    score = 0.0
    if lower in ("https://web.uettaxila.edu.pk/", "https://uettaxila.edu.pk/"):
        score += 50
    if "web.uettaxila.edu.pk" in lower:
        score += 20
    if "admission" in lower or "academic" in lower:
        score += 100
    if "department" in lower or "faculty" in lower:
        score += 50
    path_segments = [s for s in urllib.parse.urlparse(url).path.split("/") if s]
    score += max(0, 10 - len(path_segments))
    return score


# ═════════════════════════════════════════════════════════════════════════════
# SITEMAP DISCOVERY (Mo1 fix)
# ═════════════════════════════════════════════════════════════════════════════

async def discover_sitemap(base_url: str) -> list[str]:
    sitemap_url = base_url.rstrip("/") + "/sitemap.xml"
    try:
        async with AsyncSession(impersonate="chrome", timeout=10) as s_session:
            resp = await safe_get(s_session, sitemap_url, timeout=10)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "xml")
                urls = [loc.text.strip() for loc in soup.find_all("loc")]
                log.info(f"Discovered {len(urls)} URLs from sitemap: {sitemap_url}")
                return urls
            else:
                log.debug(f"No sitemap at {sitemap_url} (HTTP {resp.status_code})")
    except Exception as e:
        log.debug(f"Sitemap discovery failed for {sitemap_url}: {e}")
    return []


# ═════════════════════════════════════════════════════════════════════════════
# PIPELINE RESET (M11 fix)
# ═════════════════════════════════════════════════════════════════════════════

async def reset_pipeline():
    log.info("Resetting pipeline data via /api/reset ...")
    headers = {"Content-Type": "application/json"}
    if CONVEX_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {CONVEX_AUTH_TOKEN}"
    try:
        async with AsyncSession() as reset_session:
            resp = await reset_session.post(
                f"{CONVEX_SITE_URL}/api/reset",
                headers=headers,
                timeout=30,
                allow_redirects=False,
            )
            if resp.status_code == 200:
                log.info("Pipeline data reset successfully")
            else:
                # Avoid echoing the raw response body into crawler.log — it can
                # carry server detail / secrets. Log only the status code.
                log.warning(f"Reset returned HTTP {resp.status_code}")
    except Exception as e:
        log.error(f"Reset failed: {e}")


# ═════════════════════════════════════════════════════════════════════════════
# CRASH RECOVERY (E8 fix)
# ═════════════════════════════════════════════════════════════════════════════

def save_crawl_state(queue_items: list, visited: set, stats: CrawlStats):
    """Save crawl state to disk for crash recovery."""
    state = {
        "queue": queue_items[:100],
        "visited_count": len(visited),
        "stats": {
            "fetched": stats.fetched,
            "saved": stats.saved,
            "skipped": stats.skipped,
            "failed": stats.failed,
            "dlq": stats.dlq,
        },
        "timestamp": time.time(),
    }
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except Exception as e:
        log.debug(f"Failed to save crawl state: {e}")

def load_crawl_state() -> dict | None:
    """Check for saved crawl state for crash recovery."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                state = json.load(f)
            log.info(f"Found saved crawl state ({state.get('visited_count', 0)} visited)")
            return state
        except Exception as e:
            log.warning(f"Could not load crawl state: {e}")
    return None

def remove_crawl_state():
    """Clean up saved crawl state on clean shutdown."""
    try:
        if STATE_FILE.exists():
            STATE_FILE.unlink()
    except Exception:
        pass


# ═════════════════════════════════════════════════════════════════════════════
# ADAPTIVE RATE LIMITING
# ═════════════════════════════════════════════════════════════════════════════

class TokenBucket:
    """Proactive rate limiter: ensures a maximum request rate per second."""
    def __init__(self, rate: float = 8.0, capacity: float = 15.0):
        self.rate = rate
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.monotonic()

    def acquire(self, tokens: float = 1.0) -> float:
        now = time.monotonic()
        self.tokens = min(self.capacity, self.tokens + (now - self.last_refill) * self.rate)
        self.last_refill = now
        if self.tokens >= tokens:
            self.tokens -= tokens
            return 0.0
        wait = (tokens - self.tokens) / self.rate
        jitter = wait * random.random() * 0.1
        return wait + jitter


class AIMDRateLimiter:
    """
    Adaptive rate limiter using Additive Increase / Multiplicative Decrease.
    Speeds up after sustained successes, slows aggressively on errors.
    """
    def __init__(self, min_delay: float = 0.05, max_delay: float = 5.0,
                 initial_delay: float = 0.4, ai_step: float = 0.01,
                 md_factor: float = 2.0, success_threshold: int = 10):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.current_delay = initial_delay
        self.ai_step = ai_step
        self.md_factor = md_factor
        self.success_threshold = success_threshold
        self.success_streak = 0

    async def wait(self):
        full_delay = self.current_delay + self.current_delay * random.random() * 0.1
        await asyncio.sleep(full_delay)

    def on_success(self):
        self.success_streak += 1
        if self.success_streak >= self.success_threshold:
            self.current_delay = max(self.min_delay, self.current_delay - self.ai_step)
            self.success_streak = 0

    def on_failure(self, status: int = 0):
        if status == 429 or status == 503 or status == 0:
            self.current_delay = min(self.max_delay, self.current_delay * self.md_factor)
            self.success_streak = 0

    def reset(self):
        self.current_delay = (self.min_delay + self.max_delay) / 2
        self.success_streak = 0


def retry_delay(attempt: int, base: float = 1.0, max_delay: float = 60.0) -> float:
    """Exponential backoff with jitter to prevent thundering herd."""
    delay = base * (2 ** attempt)
    delay = min(delay, max_delay)
    jitter = delay * random.random() * 0.5
    return delay + jitter

# Module-level instances — read from CONFIG for rateLimiter/tokenBucket
_rl = CONFIG.get("rateLimiter", {})
_tb = CONFIG.get("tokenBucket", {})
rate_limiter = AIMDRateLimiter(
    min_delay=_rl.get("minDelay", 0.05),
    max_delay=_rl.get("maxDelay", 5.0),
    initial_delay=_rl.get("initialDelay", 0.4),
    ai_step=_rl.get("aiStep", 0.01),
    md_factor=_rl.get("mdFactor", 2.0),
    success_threshold=_rl.get("successThreshold", 10),
)
token_bucket = TokenBucket(
    rate=_tb.get("rate", 8.0),
    capacity=_tb.get("capacity", 15.0),
)

# ═════════════════════════════════════════════════════════════════════════════
# FETCH & PUSH LOGIC
# ═════════════════════════════════════════════════════════════════════════════

def clean_pdf_markdown(markdown: str) -> str:
    """Clean pymupdf4llm PDF output: drop image placeholders, repeating page
    headers/footers, and standalone page artifacts that pollute chunks.

    Problem seen on the UET Prospectus 2025 (165 pages): 760 image-placeholder
    lines like '**==> picture [222 x 64] intentionally omitted <==' and 300+
    repeating header/footer lines ('UG PROSPECTUS 2025', 'UET, TAXILA', bare
    page numbers) bled into chunks as noise. A student asking 'what programs
    are offered?' would retrieve a fragment of a degree list with no heading.

    Two-pass approach:
    1. Remove image/figure placeholders outright (they carry no text signal).
    2. Detect lines that repeat across many pages (headers/footers) and drop
       them when they appear as standalone lines, keeping them only when they
       are part of a real heading line with surrounding content.
    """
    import re as _re

    # 1. Drop image/figure placeholders entirely.
    lines = [
        ln for ln in markdown.split("\n")
        if "intentionally omitted" not in ln
        and not _re.search(r"\[=>?\s*\d+\s*[x×]\s*\d+\s*\]", ln)  # [222 x 64]
    ]

    # 2. Detect repeating page headers/footers: short lines appearing many times
    #    AND looking like running headers (not real content sentences). A real
    #    content paragraph repeated across pages is rare; a header like
    #    "UG PROSPECTUS 2025" repeating 157× is an artifact. Require BOTH high
    #    repetition (>8) AND short length (<=40 chars) AND no sentence ending
    #    (no period) to avoid stripping legitimate repeated content.
    from collections import Counter
    short_lines = [
        ln.strip() for ln in lines
        if 0 < len(ln.strip()) <= 40 and not ln.strip().endswith(".")
    ]
    counts = Counter(short_lines)
    boilerplate = {ln for ln, c in counts.items() if c > 8}

    cleaned = []
    for ln in lines:
        if ln.strip() in boilerplate:
            continue
        # 3. Drop bare page numbers (digits only, possibly wrapped in markdown).
        if _re.fullmatch(r"\s*\**\d+\**\s*", ln):
            continue
        cleaned.append(ln)

    text = "\n".join(cleaned)
    # Collapse excessive blank lines left by removals.
    text = _re.sub(r"\n{3,}", "\n\n", text).strip()
    return text


async def fetch_and_extract(url: str, session: AsyncSession) -> tuple[str | None, str, list[str], str | None, int]:
    """Returns: (markdown, title, links, error_reason, status_code)"""
    try:
        resp = await asyncio.wait_for(
            safe_get(session, url, timeout=REQUEST_TIMEOUT),
            timeout=REQUEST_TIMEOUT + 5
        )
    except asyncio.TimeoutError:
        return None, "", [], "timeout", 0
    except Exception as e:
        return None, "", [], str(e), 0

    status = resp.status_code
    if status == 404:
        return None, "", [], "404 Not Found", status
    if status != 200:
        return None, "", [], f"HTTP {status}", status

    content_type = resp.headers.get("Content-Type", "").lower()

    # Reject oversized responses up front via Content-Length, and cap the
    # buffered body to guard against decompression bombs / multi-GB downloads
    # exhausting memory.
    declared_len = resp.headers.get("Content-Length") or resp.headers.get("content-length")
    if declared_len and declared_len.isdigit() and int(declared_len) > MAX_RESPONSE_BYTES:
        return None, "", [], f"response too large ({declared_len} bytes)", status

    is_pdf = "application/pdf" in content_type or url.lower().endswith(".pdf")
    # Content-Type allowlist: only HTML and PDF are parseable here. Anything
    # else (octet-stream, video, etc.) is rejected before buffering/parsing.
    if not is_pdf and "text/html" not in content_type and "application/xhtml" not in content_type:
        return None, "", [], f"unsupported content-type: {content_type or 'unknown'}", status

    body = resp.content
    if body is not None and len(body) > MAX_RESPONSE_BYTES:
        return None, "", [], f"response body exceeds {MAX_RESPONSE_BYTES} bytes", status

    # Handle PDF
    if is_pdf:
        try:
            doc = fitz.open(stream=body, filetype="pdf")
            markdown = pymupdf4llm.to_markdown(
                doc, table_strategy='lines', write_images=False, show_progress=False,
            )
            markdown = clean_pdf_markdown(markdown)
            title = os.path.basename(urllib.parse.urlparse(url).path) or url
            return markdown, title, [], None, status
        except Exception as e:
            return None, "", [], f"PDF extract failed: {e}", status

    # Handle HTML
    raw_html = resp.text
    # Decode Cloudflare-obfuscated emails + strip ASP.NET ViewState, then remove
    # popup/modal/news-slider chrome BEFORE extraction so transient UI text
    # (announcement popups, dated news tickers) doesn't leak into chunks.
    clean_html = strip_boilerplate_html(decode_all_emails(raw_html))
    title = extract_title(raw_html)
    # Links are extracted from the cleaned HTML too, so we don't enqueue links
    # that only existed inside a removed popup (those are usually close buttons
    # or JS-driven, not crawlable content anyway).
    links = extract_links(clean_html, url)

    markdown = trafilatura.extract(
        clean_html, output_format="markdown", include_tables=True,
        include_links=False, favor_recall=True, config=_traf_config
    )
    if not markdown:
        soup = BeautifulSoup(clean_html, "lxml")
        for tag in soup(["nav", "footer", "header", "script", "style", "noscript", "iframe"]):
            tag.decompose()
        markdown = markdownify.markdownify(str(soup), heading_style="ATX").strip()

    return markdown or None, title, links, None, status


def assign_tier(url: str) -> str:
    """Freshness tier drives decay scoring + staleness re-crawl priority.

    HIGH = churns often / students depend on it being current (admissions,
    fees, merit lists, schedules, results, deadlines, notices). These get the
    steepest decay penalty when stale so stale answers rank lower, and the
    staleness cron flags them for re-crawl first.
    MEDIUM = semi-static reference (departments, faculty, programs).
    LOW = rarely changes (history, about, contact).
    """
    lower = url.lower()
    # Time-sensitive student-critical content: admissions portal + keywords that
    # appear in both paths (Merit_List.php) and the admissions subdomain itself.
    high_keywords = (
        "admission", "academic", "merit", "fee", "schedule", "seat",
        "result", "exam", "deadline", "notice", "scholarship", "prospectus",
    )
    if lower in ("https://web.uettaxila.edu.pk/", "https://uettaxila.edu.pk/") or any(
        kw in lower for kw in high_keywords
    ):
        return "high"
    if "department" in lower or "faculty" in lower or "program" in lower:
        return "medium"
    return "low"

async def push_to_convex(url: str, markdown: str, title: str, source_type: str, session_id: str, push_session: AsyncSession) -> str:
    content_hash = hashlib.sha256(markdown.encode("utf-8")).hexdigest()
    payload = {
        "url": url,
        "markdown": markdown,
        "contentHash": content_hash,
        "crawlSessionId": session_id,
        "title": title,
        "sourceType": source_type,
        "freshnessTier": assign_tier(url),
    }
    
    headers = {"Content-Type": "application/json"}
    if CONVEX_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {CONVEX_AUTH_TOKEN}"
        
    endpoint = f"{CONVEX_SITE_URL}/ingest"

    last_error = "unknown"
    for attempt in range(1, PUSH_RETRIES + 1):
        try:
            resp = await push_session.post(endpoint, json=payload, headers=headers, timeout=15, allow_redirects=False)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("action", "unknown")
            if 400 <= resp.status_code < 500:
                # Client error — not retryable.
                raise RuntimeError(f"Client error HTTP {resp.status_code}")
            # 5xx / other — transient, record and fall through to retry.
            last_error = f"HTTP {resp.status_code}"
        except RuntimeError:
            raise
        except Exception as e:
            last_error = str(e)
        if attempt == PUSH_RETRIES:
            raise RuntimeError(f"Failed to push to Convex after {PUSH_RETRIES} tries: {last_error}")
        await asyncio.sleep(retry_delay(attempt, base=1.0))
    # Unreachable: the final attempt either returns 200 or raises above.
    raise RuntimeError(f"Failed to push to Convex: {last_error}")

# ═════════════════════════════════════════════════════════════════════════════
# WORKER
# ═════════════════════════════════════════════════════════════════════════════

async def worker(
    worker_id: int, queue: asyncio.PriorityQueue, visited: set, visited_lock: asyncio.Lock,
    stats: CrawlStats, stats_lock: asyncio.Lock, active_workers: list, active_lock: asyncio.Lock,
    pbar: atqdm, session: AsyncSession, push_session: AsyncSession, session_id: str,
    rate_limiter: AIMDRateLimiter, token_bucket: TokenBucket, simhash: SimHash,
    state_counter: list,
):
    while True:
        async with stats_lock:
            total_processed = stats.fetched + stats.skipped + stats.failed
            if total_processed >= MAX_PAGES:
                break

        try:
            item = queue.get_nowait()
        except asyncio.QueueEmpty:
            # Termination must be unanimous-safe: a worker that just finished an
            # item may have enqueued children that no other worker has dequeued
            # yet. Only exit when the queue is empty AND no worker is currently
            # processing an item, confirmed across a short grace re-check so a
            # transient empty window doesn't abandon queued URLs.
            async with active_lock:
                idle = active_workers[0] == 0
            if idle and queue.empty():
                await asyncio.sleep(0.5)
                async with active_lock:
                    still_idle = active_workers[0] == 0
                if still_idle and queue.empty():
                    break
                continue
            await asyncio.sleep(0.5)
            continue

        # PriorityQueue items are (priority, (url, depth)) — unpack the nested
        # payload, not the outer (priority, payload) wrapper. Previously
        # `url, depth = item` assigned url=priority tuple and depth=(url,depth),
        # causing every fetch to fail with "Blocked disallowed/unsafe URL".
        _priority, (url, depth) = item
        async with active_lock: active_workers[0] += 1

        try:
            await rate_limiter.wait()
            # TokenBucket.acquire() is synchronous and returns the time the
            # caller must wait before a token is available; we must actually
            # sleep that duration, otherwise the proactive rate cap is a no-op.
            bucket_wait = token_bucket.acquire()
            if bucket_wait > 0:
                await asyncio.sleep(bucket_wait)

            markdown, title, links = None, "", []
            error_reason, status_code = None, 0
            
            # Only client errors (4xx) are terminal/non-retryable. Transient
            # 5xx (500/502/503/504) and 429 are retried with backoff.
            NON_RETRYABLE = (400, 401, 403, 404)
            for attempt in range(MAX_RETRIES):
                markdown, title, links, error_reason, status_code = await fetch_and_extract(url, session)

                if error_reason is None:
                    rate_limiter.on_success()
                    break

                if status_code in NON_RETRYABLE:
                    break

                # Transient failure — slow the limiter once per attempt and back off.
                rate_limiter.on_failure(status_code)
                log.warning(f"Retry {attempt+1}/{MAX_RETRIES} on {url}: {error_reason}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(retry_delay(attempt))

            # Account each page in exactly ONE terminal bucket so the MAX_PAGES
            # stop condition (fetched + skipped + failed) is not double-counted.
            if error_reason:
                # DLQ everything except hard client errors so transient failures
                # (5xx/429/timeouts) get retried on a later run.
                if status_code not in NON_RETRYABLE:
                    write_to_dlq(url, depth)
                    async with stats_lock: stats.dlq += 1

                async with stats_lock: stats.failed += 1
                log.error(f"[fail] {url} — {error_reason} (HTTP {status_code})")
                continue

            # NOTE: a page lands in EXACTLY ONE terminal bucket
            # (fetched / skipped / failed) so MAX_PAGES accounting via
            # total_processed = fetched + skipped + failed never double-counts.
            if not markdown or len(markdown.split()) < MIN_WORD_COUNT:
                async with stats_lock: stats.skipped += 1
                continue

            # Near-dup check via SimHash
            if simhash.is_near_dup(markdown):
                async with stats_lock: stats.skipped += 1
                log.debug(f"[near-dup] {url}")
                continue

            source_type = "pdf" if url.lower().endswith(".pdf") else "html"

            try:
                action = await push_to_convex(url, markdown, title or url, source_type, session_id, push_session)
            except Exception as push_exc:
                # Ingestion did not persist — do NOT count as saved. Route to DLQ for retry.
                write_to_dlq(url, depth)
                async with stats_lock:
                    stats.failed += 1
                    stats.dlq += 1
                log.error(f"[push_fail] {url} — {push_exc}")
                continue

            # Terminal success bucket: count once toward both fetched (the
            # MAX_PAGES budget) and saved.
            async with stats_lock:
                stats.fetched += 1
                stats.saved += 1
            log.info(f"[{action:8}] depth={depth} words={len(markdown.split()):>5} | {url}")

            if depth < MAX_DEPTH:
                async with stats_lock:
                    capacity = MAX_PAGES - (stats.fetched + stats.skipped + stats.failed)
                new_links = 0
                for link in links:
                    if capacity - new_links <= 0: break
                    async with visited_lock:
                        if link not in visited:
                            visited.add(link)
                            priority = (depth + 1, -url_priority(link, depth + 1))
                            try:
                                queue.put_nowait((priority, (link, depth + 1)))
                                new_links += 1
                            except asyncio.QueueFull:
                                log.warning(f"Queue full, dropping link: {link}")
                                break

            # Crash recovery: save state every 50 pages
            state_counter[0] += 1
            if state_counter[0] % 50 == 0:
                async with visited_lock:
                    queue_snapshot = [(u, d) for _, (u, d) in list(queue._queue)[:100]]
                    save_crawl_state(queue_snapshot, visited, stats)

        except Exception as exc:
            async with stats_lock: stats.failed += 1
            log.error(f"[fail_crit] {url} — {exc}")
        finally:
            queue.task_done()
            async with active_lock: active_workers[0] -= 1
            pbar.update(1)
            pbar.set_postfix_str(stats.summary(), refresh=False)

# ═════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ═════════════════════════════════════════════════════════════════════════════

async def crawl():
    log.info("=" * 60)
    log.info("UET Taxila RAG Crawler — Unified Reliable Edition")
    log.info("=" * 60)

    # Handle --clean flag
    if args.clean:
        await reset_pipeline()

    # Crash recovery: check for saved state
    saved_state = load_crawl_state()
    if not saved_state:
        remove_crawl_state()

    queue: asyncio.PriorityQueue = asyncio.PriorityQueue(maxsize=QUEUE_MAXSIZE)
    visited: set = set()

    # Crash recovery: actually repopulate the queue/visited set from the saved
    # snapshot instead of merely logging "resuming" (previously the loaded state
    # was discarded, making recovery cosmetic).
    if saved_state:
        recovered = 0
        for entry in saved_state.get("queue", []):
            try:
                url, depth = entry[0], entry[1]
            except (TypeError, IndexError, KeyError):
                continue
            canonical = canonicalize_url(url)
            if canonical in visited:
                continue
            visited.add(canonical)
            priority = (depth, -url_priority(canonical, depth))
            try:
                queue.put_nowait((priority, (canonical, depth)))
                recovered += 1
            except asyncio.QueueFull:
                break
        log.info(
            f"Crash recovery: re-enqueued {recovered} URL(s) from saved state "
            f"(snapshot was capped at 100 entries; non-snapshot URLs resume via DLQ/seeds)"
        )
    simhash = SimHash()

    # 0. Recover orphaned DLQ processing files
    for orphan in sorted(project_root.glob(f"dlq*{DLQ_PROCESSING_SUFFIX}*")):
        log.info(f"Recovering orphaned DLQ file: {orphan.name}")
        try:
            with open(orphan, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        url, depth = data["url"], data["depth"]
                        if url not in visited:
                            visited.add(url)
                            priority = (depth, -url_priority(url, depth))
                            try:
                                queue.put_nowait((priority, (url, depth)))
                            except asyncio.QueueFull:
                                log.warning("Queue full during DLQ recovery, dropping entry")
                                break
                    except Exception:
                        pass
            os.remove(orphan)
            log.info(f"Recovered {queue.qsize()} entries from orphaned DLQ")
        except Exception as e:
            log.error(f"Failed to recover {orphan}: {e}")

    # 1. Load Dead Letter Queue with atomic swap (M6 fix)
    if DLQ_FILE.exists():
        ts = int(time.time() * 1000)
        processing_file = DLQ_FILE.with_name(f"dlq_{DLQ_PROCESSING_SUFFIX}_{ts}.jsonl")
        try:
            DLQ_FILE.rename(processing_file)
            loaded_count = 0
            with open(processing_file, "r", encoding="utf-8") as f:
                for line in f:
                    try:
                        data = json.loads(line)
                        url, depth = data["url"], data["depth"]
                        if url not in visited:
                            visited.add(url)
                            priority = (depth, -url_priority(url, depth))
                            try:
                                queue.put_nowait((priority, (url, depth)))
                                loaded_count += 1
                            except asyncio.QueueFull:
                                log.warning("Queue full during DLQ load, dropping entry")
                                break
                    except Exception:
                        pass
            os.remove(processing_file)
            log.info(f"Loaded {loaded_count} URLs from Dead Letter Queue (atomic swap).")
        except Exception as e:
            log.error(f"DLQ atomic swap failed: {e}")

    # 2. Sitemap discovery (Mo1 fix)
    for root_url in ("https://web.uettaxila.edu.pk/", "https://uettaxila.edu.pk/"):
        sitemap_urls = await discover_sitemap(root_url)
        for s_url in sitemap_urls:
            canonical = canonicalize_url(s_url)
            if is_allowed_url(canonical) and canonical not in visited:
                visited.add(canonical)
                priority = (0, -url_priority(canonical, 0))
                try:
                    queue.put_nowait((priority, (canonical, 0)))
                except asyncio.QueueFull:
                    break

    # 3. Add seeds from config + auto-generated department faculty URLs
    all_seeds = [canonicalize_url(u) for u in (SITE_ROOTS + DEPARTMENT_FACULTY_URLS)]
    for seed in all_seeds:
        if seed not in visited:
            visited.add(seed)
            priority = (0, -url_priority(seed, 0))
            try:
                queue.put_nowait((priority, (seed, 0)))
            except asyncio.QueueFull:
                log.warning("Queue full during seed loading, dropping seed")

    log.info(f"Queue initialized with {queue.qsize()} URLs ({len(visited)} visited)")

    session_id = str(int(time.time() * 1000))
    visited_lock = asyncio.Lock()
    stats = CrawlStats()
    stats_lock = asyncio.Lock()
    active_workers = [0]
    active_lock = asyncio.Lock()
    state_counter = [0]

    pbar = atqdm(total=MAX_PAGES, desc="Crawling", unit="pg", dynamic_ncols=True, colour="green")

    rate_limiter.reset()
    # curl_cffi >=0.10 renamed connections_limit -> max_clients. CONCURRENCY (from
    # crawl_config.json) bounds active in-flight fetches via the worker task pool;
    # max_clients caps the underlying connection pool.
    async with AsyncSession(impersonate="chrome", max_clients=CONCURRENCY * 2) as session, \
              AsyncSession(max_clients=10) as push_session:
        worker_tasks = [
            asyncio.create_task(worker(
                i, queue, visited, visited_lock, stats, stats_lock,
                active_workers, active_lock, pbar, session, push_session, session_id,
                rate_limiter, token_bucket, simhash, state_counter
            )) for i in range(CONCURRENCY)
        ]
        await asyncio.gather(*worker_tasks, return_exceptions=True)

    pbar.close()

    # Clean up saved state on success
    remove_crawl_state()

    log.info("=" * 60)
    log.info(f"CRAWL COMPLETE  |  {stats.summary()}")
    log.info("=" * 60)

if __name__ == "__main__":
    asyncio.run(crawl())
