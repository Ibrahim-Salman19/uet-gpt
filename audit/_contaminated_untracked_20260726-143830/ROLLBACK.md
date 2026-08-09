# UET Taxila Production Rollback Guide

## 1. Rollback Trigger Criteria

Initiate a rollback immediately if any of the following conditions occur after deployment:
1. Retrieval Recall@5 drops below 85.0% on the benchmark evaluation suite.
2. Unhandled runtime errors exceed 1% of query traffic.
3. System prompt injection or safety test failures occur.

---

## 2. Emergency Rollback Execution Steps

### Step 1: Revert Code to Pre-Migration Commit
```bash
cd /mnt/c/Users/hafiz/UETGPT/uet-gpt

# Checkout previous stable production commit
git checkout main
git reset --hard HEAD~1
```

### Step 2: Re-deploy Stable Convex Functions
```bash
npx convex deploy
```

### Step 3: Restore Database Snapshot (If Data Corrupted)
If table data was mutated during failed ingestion, restore from the snapshot created during migration Step 1:

```bash
npx convex import --table documents backup-pre-upgrade.zip
```

### Step 4: Verify Restored System Health
Run unit and integration smoke tests:

```bash
pnpm exec vitest run
python3 -m pytest scripts/test_crawler_security.py -v
```
