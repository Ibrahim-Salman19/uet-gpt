# UET Taxila Crawler & Ingestion Runbook

## 1. Prerequisites & Environment Setup

Ensure Python 3.10+ is installed with required crawler dependencies.

```bash
cd /mnt/c/Users/hafiz/UETGPT/uet-gpt

# Install Python requirements
pip install -r scripts/requirements.txt

# Verify .env.local contains HTTPS Convex site URL and Auth token
# CONVEX_SITE_URL=https://adamant-stork-623.convex.site
# CONVEX_AUTH_TOKEN=700719dfc8d54dbfb6022b5150120149
```

---

## 2. Executing Crawl Operations

### 2.1 Full Production Web Crawl
Runs an async BFS crawl across all 3 UET Taxila domains up to max depth 4 (limit 500 pages):

```bash
python3 scripts/crawler.py --limit 500
```

### 2.2 Admissions-Only Scoped Crawl
Runs a targeted crawl restricted to `admissions.uettaxila.edu.pk`:

```bash
python3 scripts/crawler.py --config scripts/crawl_config_admissions.json --limit 100
```

### 2.3 Reset & Fresh Crawl (Clean Mode)
Resets crawler state files before beginning discovery:

```bash
python3 scripts/crawler.py --clean --limit 500
```

---

## 3. High-Fidelity PDF Ingestion (`scripts/ingest_pdf.py`)

For standalone or newly published official PDF documents (prospectuses, date sheets, rulebooks):

### 3.1 Layout-Aware Native Extraction (PyMuPDF4LLM)
```bash
python3 scripts/ingest_pdf.py "https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2025.pdf" "UET Taxila Prospectus 2025"
```

### 3.2 Scanned / Complex Table PDF Extraction (Gemini VLM Fallback)
For scanned PDFs or image-heavy tables requiring Vision Model extraction:

```bash
python3 scripts/ingest_pdf.py "https://web.uettaxila.edu.pk/PageContents/Transport/Bus-Routes-Morning-2025.pdf" "Morning Transport Routes 2025" --force-vlm
```

---

## 4. Monitoring & Troubleshooting

### Log Inspection
* **Crawler Log:** `tail -f crawler.log`
* **Dead Letter Queue (DLQ):** `cat dlq.jsonl`
* **Crawler State Snapshot:** `cat crawler_state.json`

### DLQ Recovery Protocol
When URLs land in `dlq.jsonl` due to transient server timeouts or WAF blocks:

```bash
# Re-run crawler to process pending DLQ items
python3 scripts/crawler.py --limit 50
```
