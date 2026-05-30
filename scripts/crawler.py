"""
UET Taxila — Unified Reliable RAG Crawler
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Combines curl_cffi evasion, trafilatura, pymupdf4llm, and direct Convex /ingest pushes.
Handles Dead Letter Queues locally and manages transient timeouts.
"""

import asyncio
import hashlib
import logging
import random
import re
import sys
import time
import os
import json
import urllib.parse
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

CONVEX_AUTH_TOKEN = os.environ.get("CONVEX_AUTH_TOKEN")
if not CONVEX_AUTH_TOKEN:
    print("WARNING: CONVEX_AUTH_TOKEN not set — /ingest endpoint may reject the request")
    print("  Consider using CRAWL_WEBHOOK_SECRET instead: export CONVEX_AUTH_TOKEN=$CRAWL_WEBHOOK_SECRET")

SITE_ROOTS = [
    "https://web.uettaxila.edu.pk/",
    "https://uettaxila.edu.pk/",
]

ALLOWED_DOMAINS = frozenset(
    urllib.parse.urlparse(root).netloc for root in SITE_ROOTS
)

SEED_DEPARTMENT_URLS = (
    [f"https://web.uettaxila.edu.pk/CMS/AUT2012/etDeptIndex.aspx?id={i}" for i in range(1, 26)] +
    [f"https://web.uettaxila.edu.pk/departmentfaculty?departmentId={i}" for i in range(1, 26)]
)

import argparse

parser = argparse.ArgumentParser(description="UET Taxila Reliable RAG Crawler")
parser.add_argument("--limit", type=int, default=500, help="Maximum number of pages to crawl")
args, unknown = parser.parse_known_args()

MAX_PAGES       = args.limit
MAX_DEPTH       = 4
CONCURRENCY     = 5
REQUEST_TIMEOUT = 20
MAX_RETRIES     = 3
PUSH_RETRIES    = 3
MIN_WORD_COUNT  = 80
QUEUE_MAXSIZE   = 200

SKIP_EXTENSIONS = frozenset(
    ".doc .docx .ppt .pptx .xls .xlsx .zip .rar .exe "
    ".jpg .jpeg .png .gif .svg .webp .mp4 .avi .mp3 .wav".split()
)

STRIP_PARAMS = frozenset(
    "utm_source utm_medium utm_campaign utm_term utm_content "
    "fbclid gclid msclkid ref source".split()
)

DLQ_FILE = project_root / "dlq.jsonl"

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

def canonicalize_url(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    params = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
    cleaned = {k: v for k, v in params.items() if k not in STRIP_PARAMS}
    new_query = urllib.parse.urlencode(cleaned, doseq=True)
    path = parsed.path.rstrip("/") or "/"
    return urllib.parse.urlunparse((parsed.scheme, parsed.netloc, path, parsed.params, new_query, ""))

def is_allowed_url(url: str) -> bool:
    try:
        p = urllib.parse.urlparse(url)
        if p.scheme not in ("http", "https"): return False
        if p.netloc not in ALLOWED_DOMAINS: return False
        if any(p.path.lower().endswith(ext) for ext in SKIP_EXTENSIONS): return False
        if p.path.startswith(("mailto:", "javascript:", "tel:")): return False
        return True
    except Exception:
        return False

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
    if soup.title and soup.title.string: return soup.title.string.strip()
    h1 = soup.find("h1")
    return h1.get_text(strip=True) if h1 else ""

def write_to_dlq(url: str, depth: int):
    with open(DLQ_FILE, "a", encoding="utf-8") as f:
        f.write(json.dumps({"url": url, "depth": depth}) + "\n")

# ═════════════════════════════════════════════════════════════════════════════
# ADAPTIVE RATE LIMITING
# ═════════════════════════════════════════════════════════════════════════════

class TokenBucket:
    """Proactive rate limiter: ensures a maximum request rate per second."""
    def __init__(self, rate: float = 5.0, capacity: float = 10.0):
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

# Module-level instances (created after class definitions to avoid NameError)
rate_limiter = AIMDRateLimiter(min_delay=0.05, max_delay=5.0, initial_delay=0.4)
token_bucket = TokenBucket(rate=8.0, capacity=15.0)

# ═════════════════════════════════════════════════════════════════════════════
# FETCH & PUSH LOGIC
# ═════════════════════════════════════════════════════════════════════════════

async def fetch_and_extract(url: str, session: AsyncSession) -> tuple[str | None, str, list[str], str | None, int]:
    """Returns: (markdown, title, links, error_reason, status_code)"""
    try:
        resp = await asyncio.wait_for(
            session.get(url, timeout=REQUEST_TIMEOUT),
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
    
    # Handle PDF
    if "application/pdf" in content_type or url.lower().endswith(".pdf"):
        try:
            doc = fitz.open(stream=resp.content, filetype="pdf")
            markdown = pymupdf4llm.to_markdown(doc, table_strategy='lines')
            title = os.path.basename(urllib.parse.urlparse(url).path) or url
            return markdown, title, [], None, status
        except Exception as e:
            return None, "", [], f"PDF extract failed: {e}", status

    # Handle HTML
    raw_html = resp.text
    clean_html = decode_all_emails(raw_html)
    title = extract_title(raw_html)
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
    lower = url.lower()
    if lower in ("https://web.uettaxila.edu.pk/", "https://uettaxila.edu.pk/") or "admission" in lower or "academic" in lower:
        return "high"
    elif "department" in lower or "faculty" in lower:
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

    for attempt in range(1, PUSH_RETRIES + 1):
        try:
            resp = await push_session.post(endpoint, json=payload, headers=headers, timeout=15)
            if resp.status_code == 200:
                data = resp.json()
                return data.get("action", "unknown")
            if 400 <= resp.status_code < 500:
                raise RuntimeError(f"Client error HTTP {resp.status_code}: {resp.text}")
        except Exception as e:
            if attempt == PUSH_RETRIES:
                raise RuntimeError(f"Failed to push to Convex after {PUSH_RETRIES} tries: {e}")
            await asyncio.sleep(retry_delay(attempt, base=1.0))
    return "failed"

# ═════════════════════════════════════════════════════════════════════════════
# WORKER
# ═════════════════════════════════════════════════════════════════════════════

async def worker(
    worker_id: int, queue: asyncio.Queue, visited: set, visited_lock: asyncio.Lock,
    stats: CrawlStats, stats_lock: asyncio.Lock, active_workers: list, active_lock: asyncio.Lock,
    pbar: atqdm, session: AsyncSession, push_session: AsyncSession, session_id: str,
    rate_limiter: AIMDRateLimiter, token_bucket: TokenBucket
):
    while True:
        async with stats_lock:
            total_processed = stats.fetched + stats.skipped + stats.failed
            if total_processed >= MAX_PAGES:
                break

        try:
            item = queue.get_nowait()
        except asyncio.QueueEmpty:
            async with active_lock:
                if active_workers[0] == 0:
                    break
            await asyncio.sleep(0.5)
            continue

        url, depth = item
        async with active_lock: active_workers[0] += 1

        try:
            await rate_limiter.wait()
            await token_bucket.acquire()

            markdown, title, links = None, "", []
            error_reason, status_code = None, 0
            
            for attempt in range(MAX_RETRIES):
                markdown, title, links, error_reason, status_code = await fetch_and_extract(url, session)
                
                if error_reason is None:
                    rate_limiter.on_success()
                    break
                
                if status_code in (404, 400, 500):
                    break
                
                rate_limiter.on_failure(status_code)
                log.warning(f"Retry {attempt+1}/{MAX_RETRIES} on {url}: {error_reason}")
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(retry_delay(attempt))
            
            async with stats_lock: stats.fetched += 1

            if error_reason:
                rate_limiter.on_failure(status_code)
                if status_code not in (404, 500) and status_code != 400:
                    write_to_dlq(url, depth)
                    async with stats_lock: stats.dlq += 1
                    
                async with stats_lock: stats.failed += 1
                if status_code != 500:
                    log.error(f"[fail] {url} — {error_reason}")
                continue

            if not markdown or len(markdown.split()) < MIN_WORD_COUNT:
                async with stats_lock: stats.skipped += 1
                continue

            source_type = "pdf" if url.lower().endswith(".pdf") else "html"
            
            action = await push_to_convex(url, markdown, title or url, source_type, session_id, push_session)
            async with stats_lock: stats.saved += 1
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
                            await queue.put((link, depth + 1))
                            new_links += 1

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

    queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
    visited = set()
    
    # 1. Load Dead Letter Queue first
    if DLQ_FILE.exists():
        with open(DLQ_FILE, "r", encoding="utf-8") as f:
            for line in f:
                try:
                    data = json.loads(line)
                    url, depth = data["url"], data["depth"]
                    if url not in visited:
                        visited.add(url)
                        await queue.put((url, depth))
                except Exception: pass
        # Clear DLQ so we don't accumulate forever
        os.remove(DLQ_FILE)
        log.info(f"Loaded {queue.qsize()} URLs from Dead Letter Queue.")

    # 2. Add normal seeds
    all_seeds = [canonicalize_url(u) for u in (SEED_DEPARTMENT_URLS + SITE_ROOTS)]
    for seed in all_seeds:
        if seed not in visited:
            visited.add(seed)
            await queue.put((seed, 0))

    session_id = str(int(time.time() * 1000))
    visited_lock = asyncio.Lock()
    stats = CrawlStats()
    stats_lock = asyncio.Lock()
    active_workers = [0]
    active_lock = asyncio.Lock()

    pbar = atqdm(total=MAX_PAGES, desc="Crawling", unit="pg", dynamic_ncols=True, colour="green")

    rate_limiter.reset()
    async with AsyncSession(impersonate="chrome", connections_limit=10) as session, \
              AsyncSession(max_clients=10) as push_session:
        worker_tasks = [
            asyncio.create_task(worker(
                i, queue, visited, visited_lock, stats, stats_lock,
                active_workers, active_lock, pbar, session, push_session, session_id,
                rate_limiter, token_bucket
            )) for i in range(CONCURRENCY)
        ]
        await asyncio.gather(*worker_tasks, return_exceptions=True)

    pbar.close()
    log.info("=" * 60)
    log.info(f"CRAWL COMPLETE  |  {stats.summary()}")
    log.info("=" * 60)

if __name__ == "__main__":
    asyncio.run(crawl())
