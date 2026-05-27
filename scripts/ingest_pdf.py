"""
ingest_pdf.py — High-fidelity PDF ingestion into the UET Taxila Convex RAG database.

Usage:
  python ingest_pdf.py <URL or local path> "<Title>"
  python ingest_pdf.py <URL or local path> "<Title>" --force-vlm

Extraction strategy:
  1. PyMuPDF4LLM  — layout-aware Markdown with table detection (default, free)
  2. Gemini VLM   — page-by-page rasterization + vision model (--force-vlm or empty fast result)
"""
import asyncio
import base64
import hashlib
import os
import sys
import tempfile
import time
from pathlib import Path

# ── Windows UTF-8 console fix (must be before any print) ──────────────────────
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from dotenv import load_dotenv

project_root = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=project_root / ".env.local")

# ── Environment ────────────────────────────────────────────────────────────────

GEMINI_API_KEY = (
    os.environ.get("GOOGLE_API_KEY") or
    os.environ.get("GEMINI_API_KEY") or
    os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY") or
    os.environ.get("GEMINI_API_KEY_1")
)

CONVEX_SITE_URL = os.environ.get("CONVEX_SITE_URL")
CONVEX_AUTH_TOKEN = os.environ.get("CONVEX_AUTH_TOKEN") or os.environ.get("CRAWL_WEBHOOK_SECRET")

if not CONVEX_SITE_URL and os.environ.get("NEXT_PUBLIC_CONVEX_URL"):
    CONVEX_SITE_URL = os.environ.get("NEXT_PUBLIC_CONVEX_URL").replace(".convex.cloud", ".convex.site")

if not CONVEX_SITE_URL:
    print("[ERROR] CONVEX_SITE_URL is not configured in .env.local")
    sys.exit(1)

# ── PDF Extraction ─────────────────────────────────────────────────────────────

def extract_fast(path: str) -> str:
    """High-fidelity layout-aware extraction using PyMuPDF4LLM (free, no API)."""
    try:
        import pymupdf4llm
        print("  [extract] Using pymupdf4llm (layout-aware, table detection)")
        result = pymupdf4llm.to_markdown(path, table_strategy='lines')
        return result or ""
    except ImportError:
        print("  [warn] pymupdf4llm not installed — falling back to pypdf plain text")
        print("         Run: python -m pip install pymupdf4llm")
    except Exception as e:
        print(f"  [warn] pymupdf4llm failed ({e}) — falling back to pypdf")

    # pypdf fallback
    try:
        import pypdf
        reader = pypdf.PdfReader(path)
        pages = []
        for i, page in enumerate(reader.pages):
            text = page.extract_text() or ""
            if text.strip():
                pages.append(text)
        return "\n\n".join(pages)
    except Exception as e:
        print(f"  [error] pypdf also failed: {e}")
        return ""

def extract_vlm(path: str) -> str:
    """
    Rasterize each PDF page with PyMuPDF, send to Gemini vision model.
    Best for scanned documents, complex multi-column layouts, and image-heavy PDFs.
    """
    if not GEMINI_API_KEY:
        print("  [warn] No Gemini API key set — cannot run VLM extraction. Falling back to fast.")
        return extract_fast(path)

    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("  [error] PyMuPDF not installed. Run: python -m pip install pymupdf")
        return extract_fast(path)

    # Use new google-genai SDK if available, else fall back to legacy google.generativeai
    try:
        from google import genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        use_new_sdk = True
    except ImportError:
        try:
            import google.generativeai as genai  # type: ignore
            genai.configure(api_key=GEMINI_API_KEY)  # type: ignore
            model = genai.GenerativeModel("gemini-2.0-flash")  # type: ignore
            use_new_sdk = False
        except ImportError:
            print("  [error] No Gemini SDK found. Run: python -m pip install google-genai")
            return extract_fast(path)

    try:
        import cv2
        import numpy as np
    except ImportError:
        print("  [warn] OpenCV not installed. Visual table verification disabled. Run: pip install opencv-python-headless numpy")
        cv2 = None

    def has_visual_table(image_bytes: bytes) -> bool:
        if not cv2: return False
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_GRAYSCALE)
            edges = cv2.Canny(img, 50, 150, apertureSize=3)
            lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=100, minLineLength=100, maxLineGap=10)
            if lines is None: return False
            
            # Count horizontal lines
            h_lines = 0
            for line in lines:
                x1, y1, x2, y2 = line[0]
                if abs(y1 - y2) < 5:  # horizontal-ish
                    h_lines += 1
            return h_lines >= 3 # heuristic: 3+ horizontal lines implies a table
        except Exception:
            return False

    PROMPT = (
        "Convert this document page to clean Markdown.\n"
        "Rules:\n"
        "- Reproduce ALL tables using pipe | Markdown table syntax\n"
        "- Use # ## ### for headings\n"
        "- Keep every number, date, name, and amount exactly as printed\n"
        "- Skip page headers, footers, and page numbers\n"
        "- Output ONLY the Markdown content, nothing else"
    )

    doc = fitz.open(path)
    total_pages = len(doc)
    print(f"  [vlm] Processing {total_pages} pages with Gemini Vision...")
    pages_md = []

    os.makedirs(project_root / "logs", exist_ok=True)
    failure_log = project_root / "logs" / "vlm_failures.jsonl"

    for i, page in enumerate(doc, 1):
        png_bytes = page.get_pixmap(matrix=fitz.Matrix(2, 2)).tobytes("png")
        b64_png = base64.b64encode(png_bytes).decode()
        
        is_table_expected = has_visual_table(png_bytes)
        
        print(f"  [vlm] Page {i}/{total_pages} {'(Table expected)' if is_table_expected else ''}...", end=" ", flush=True)

        # Retry with exponential backoff on quota errors, and logic retries
        text = ""
        success = False
        
        for attempt in range(1, 5):
            current_prompt = PROMPT
            if attempt > 1 and is_table_expected and "|" not in text:
                current_prompt = "CRITICAL CORRECTION: You missed a table. " + PROMPT
                print("table_retry...", end=" ", flush=True)
                
            try:
                if use_new_sdk:
                    response = client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=[
                            current_prompt,
                            {"inline_data": {"mime_type": "image/png", "data": b64_png}},
                        ],
                    )
                    text = response.text or ""
                else:
                    response = model.generate_content([  # type: ignore
                        current_prompt,
                        {"mime_type": "image/png", "data": b64_png},
                    ])
                    text = response.text or ""
                    
                if is_table_expected and "|" not in text and attempt < 3:
                    continue # Try again with correction prompt
                    
                success = True
                print("done")
                break
            except Exception as e:
                err = str(e)
                if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
                    wait = 30 * attempt  # 30s, 60s, 90s
                    print(f"quota — waiting {wait}s...")
                    time.sleep(wait)
                elif attempt < 4:
                    wait = 5 * attempt
                    print(f"error ({e}) — retry in {wait}s...")
                    time.sleep(wait)
                else:
                    print(f"failed after 4 attempts: {e}")
                    break
                    
        if is_table_expected and "|" not in text:
            print("  [warn] Failed to extract expected table on page", i)
            with open(failure_log, "a", encoding="utf-8") as f:
                import json
                f.write(json.dumps({"path": path, "page": i, "reason": "Missing table pipes despite visual lines"}) + "\n")
                
        if not success and not text:
            pages_md.append("")
        else:
            pages_md.append(text)

    doc.close()
    return "\n\n---\n\n".join(p for p in pages_md if p.strip())

def extract(path: str, force_vlm: bool) -> tuple[str, str]:
    """
    Returns (markdown_text, method_used).
    Strategy:
      - Default: try fast pymupdf4llm; if output is empty, fall back to VLM.
      - --force-vlm: skip fast path entirely.
    """
    if force_vlm:
        print("  [mode] Forced VLM extraction")
        return extract_vlm(path), "gemini-vlm (forced)"

    text = extract_fast(path)
    if not text.strip():
        print("  [mode] Fast extraction yielded no text — switching to VLM")
        return extract_vlm(path), "gemini-vlm (auto-fallback)"

    return text, "pymupdf4llm"

# ── Download ───────────────────────────────────────────────────────────────────

async def download(url: str) -> str:
    """Download a PDF from a URL into a temp file. Returns local file path."""
    import httpx
    tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        print(f"  [download] {url}")
        async with httpx.AsyncClient(
            follow_redirects=True,
            timeout=60,
            headers={"User-Agent": "UET-RAG-Ingestor/2.0"},
        ) as client:
            r = await client.get(url)
            r.raise_for_status()
        with open(tmp_path, "wb") as f:
            f.write(r.content)
        size_kb = len(r.content) / 1024
        print(f"  [download] {size_kb:.1f} KB downloaded")
        return tmp_path
    except Exception:
        # Clean up temp file on failure
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise

# ── Push to Convex ─────────────────────────────────────────────────────────────

def push(title: str, markdown: str) -> str:
    """Push extracted markdown to Convex /ingest endpoint."""
    import requests
    virtual_url  = "pdf://" + title.lower().replace(" ", "-").replace("/", "-")
    content_hash = hashlib.sha256(markdown.encode("utf-8")).hexdigest()

    headers = {"Content-Type": "application/json"}
    if CONVEX_AUTH_TOKEN:
        headers["Authorization"] = f"Bearer {CONVEX_AUTH_TOKEN}"

    resp = requests.post(
        f"{CONVEX_SITE_URL}/ingest",
        json={
            "url":            virtual_url,
            "markdown":       markdown,
            "contentHash":    content_hash,
            "crawlSessionId": "pdf-manual",
            "title":          title,
        },
        headers=headers,
        timeout=30,
    )
    resp.raise_for_status()
    action = resp.json().get("action", "?")
    print(f"  [convex] {action}  ->  {virtual_url}")
    return action

# ── Main ───────────────────────────────────────────────────────────────────────

async def ingest(source: str, title: str, force_vlm: bool) -> None:
    tmp_path: str | None = None

    try:
        if source.startswith("http://") or source.startswith("https://"):
            tmp_path = await download(source)
            path = tmp_path
        else:
            path = source
            if not Path(path).exists():
                print(f"[ERROR] File not found: {path}")
                sys.exit(1)

        print("\nExtracting PDF content...")
        markdown, method = extract(path, force_vlm)

        if not markdown.strip():
            print("[ERROR] No content could be extracted from this PDF.")
            sys.exit(1)

        print(f"\nExtraction summary:")
        print(f"  Method  : {method}")
        print(f"  Output  : {len(markdown):,} chars  |  ~{len(markdown.split()):,} words")

        print("\nPushing to Convex...")
        push(title, markdown)
        print("\n[SUCCESS] PDF ingested successfully.")

    finally:
        # Always clean up temp file
        if tmp_path:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(
        description="Ingest a PDF document into the UET Taxila Convex RAG database."
    )
    p.add_argument("source", help="PDF URL (https://...) or local file path")
    p.add_argument("title",  help="Human-readable document title (e.g. 'Fee Structure 2025')")
    p.add_argument(
        "--force-vlm",
        action="store_true",
        help="Force Gemini Vision extraction (for scanned PDFs or complex layouts)",
    )
    args = p.parse_args()
    asyncio.run(ingest(args.source, args.title, args.force_vlm))
