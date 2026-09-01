#!/usr/bin/env python3
"""Mandate §32 follow-up: exact-term query coverage against the same
loopback-only local Convex deployment used in the original Phase 5 proof.
Terms are pulled from the real corpus (all_chunks.jsonl), not invented, so a
zero-result query is a genuine finding, not a bad test case. Reuses the
Phase 5 driver's exact HTTP-action call pattern (ingest-driver.py's
call_action) - no new invocation method introduced."""
import json
import urllib.request

ENV_LOCAL = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/.env.local"
CONVEX_URL = "http://127.0.0.1:3210"
ACTION_PATH = "crawl/lexicalProof:searchChunksForProof"

QUERIES = [
    ("course code",  "CS-09"),
    ("course code",  "ECAT-2026"),
    ("course code",  "ME-106"),
    ("acronym",      "HEC"),
    ("acronym",       "CGPA"),
    ("acronym",       "NUST"),
    ("department",   "Electrical Engineering"),
    ("program code", "BS Software Engineering"),
]


def read_admin_key():
    with open(ENV_LOCAL) as f:
        for line in f:
            if line.startswith("CONVEX_SELF_HOSTED_ADMIN_KEY="):
                return line.strip().split("=", 1)[1]
    raise RuntimeError("admin key not found")


def call_action(admin_key, path, args, timeout=60):
    body = json.dumps({"path": path, "args": args, "format": "json"}).encode()
    req = urllib.request.Request(
        f"{CONVEX_URL}/api/action", data=body,
        headers={"Authorization": f"Convex {admin_key}",
                 "Content-Type": "application/json"},
        method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def main():
    admin_key = read_admin_key()
    print(f"{'category':<14} {'query':<24} {'hits':<5} sample heading / text prefix")
    print("-" * 100)
    for category, q in QUERIES:
        result = call_action(admin_key, ACTION_PATH, {"query": q, "limit": 3})
        if result.get("status") != "success":
            print(f"{category:<14} {q:<24} ERROR: {result.get('errorMessage', '')[:60]}")
            continue
        rows = result["value"]
        hits = len(rows) if isinstance(rows, list) else 0
        sample = ""
        if hits:
            row = rows[0]
            text = (row.get("textPreview") or "")[:70].replace("\n", " ")
            sample = text
        print(f"{category:<14} {q:<24} {hits:<5} {sample}")


if __name__ == "__main__":
    main()
