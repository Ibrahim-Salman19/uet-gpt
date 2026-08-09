# UET Taxila Production Migration Guide

## 1. Migration Overview

This guide outlines step-by-step instructions for deploying the production upgrade of the UET Taxila RAG & Crawling pipeline without downtime or data loss.

---

## 2. Step-by-Step Migration Execution

### Step 1: Create Baseline Database Snapshot
Before running schema changes or deploying code, export existing Convex tables via the Convex dashboard or CLI export tool:

```bash
cd /mnt/c/Users/hafiz/UETGPT/uet-gpt
npx convex export --out backup-pre-upgrade.zip
```

### Step 2: Verify Environment Variables
Ensure all required environment variables are set in your production host / Vercel / Convex deployment settings:
* `CONVEX_DEPLOYMENT`
* `NEXT_PUBLIC_CONVEX_URL`
* `CONVEX_SITE_URL`
* `CONVEX_AUTH_TOKEN`
* `GROQ_API_KEY`
* `CEREBRAS_API_KEY`
* `GEMINI_API_KEY`

### Step 3: Deploy Backend Schema & Functions
Deploy the updated schema (`convex/schema.ts`) and functions to production Convex:

```bash
pnpm run typecheck
npx convex deploy
```

### Step 4: Execute Ingestion & Re-indexing
Run the updated crawler and PDF ingestion pipeline to populate the vector index:

```bash
# Run web crawl
python3 scripts/crawler.py --limit 500

# Ingest official prospectus PDF
python3 scripts/ingest_pdf.py "https://admissions.uettaxila.edu.pk/Downloads/UET-Prospectus-2025.pdf" "UET Taxila Prospectus 2025"
```

### Step 5: Run Automated Verification
Run the 210-question evaluation benchmark to confirm Recall@5 $\ge$ 90% and Factual Correctness $\ge$ 95%:

```bash
python3 scripts/eval/run_eval.py --dataset eval_dataset.jsonl --top-k 5
```
