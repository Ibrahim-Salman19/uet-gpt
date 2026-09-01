#!/usr/bin/env python3
"""Mandate §45/46/57 pool-bias fix, step 2 of 2.

Parses a completed delta_label_review.md (see generate_delta_label_review.py)
and merges the new marks additively into golden_set_verified.jsonl: existing
relevantChunkKeys/provenance/note for a query are kept exactly as-is, and
only genuinely-checked delta candidates are appended. A delta block with no
checks AND no delta_note is UNREVIEWED and is left untouched (not silently
treated as "confirmed nothing new") - same discipline as
parse_label_review.py, extended so an unfinished delta pass can't quietly
look complete either."""
import json
import re
import sys

DELTA_REVIEW = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/delta_label_review.md"
GOLDEN_SET = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/golden_set_verified.jsonl"

QUERY_RE = re.compile(r"^## \d+\. (.+)$")
QUERY_ID_RE = re.compile(r"^queryId: `([0-9a-f]+)`$")
CANDIDATE_RE = re.compile(r"^- \[( |x|X)\] \*\*fused rank \d+\*\*")
CHUNK_KEY_RE = re.compile(r"^\s*chunkKey: `([0-9a-f]+)`$")
DELTA_NOTE_RE = re.compile(r"^_delta_note:_\s*(.*)$")
DELTA_PROVENANCE_RE = re.compile(r"^_delta_provenance:_\s*(.*)$")


def load_golden_set():
    entries = {}
    order = []
    with open(GOLDEN_SET) as f:
        for line in f:
            rec = json.loads(line)
            entries[rec["queryId"]] = rec
            order.append(rec["queryId"])
    return entries, order


def parse_delta_review():
    with open(DELTA_REVIEW) as f:
        text = f.read()

    blocks = []
    current = None
    current_checked = False
    for line in text.splitlines():
        qm = QUERY_RE.match(line)
        if qm:
            if current:
                blocks.append(current)
            current = {"queryId": None, "checked": [], "delta_note": "", "delta_provenance": ""}
            continue
        if current is None:
            continue
        idm = QUERY_ID_RE.match(line)
        if idm:
            current["queryId"] = idm.group(1)
            continue
        cm = CANDIDATE_RE.match(line)
        if cm:
            current_checked = cm.group(1).lower() == "x"
            continue
        km = CHUNK_KEY_RE.match(line)
        if km and current_checked:
            current["checked"].append(km.group(1))
            current_checked = False
            continue
        nm = DELTA_NOTE_RE.match(line)
        if nm and nm.group(1).strip():
            current["delta_note"] = nm.group(1).strip()
            continue
        pm = DELTA_PROVENANCE_RE.match(line)
        if pm and pm.group(1).strip():
            current["delta_provenance"] = pm.group(1).strip()
            continue
    if current:
        blocks.append(current)
    return blocks


def main():
    golden, order = load_golden_set()
    blocks = parse_delta_review()

    unreviewed = []
    reviewed_new_relevant = []
    reviewed_nothing_new = []

    for b in blocks:
        qid = b["queryId"]
        if qid not in golden:
            sys.exit(f"delta review references unknown queryId {qid} - golden set and delta review are out of sync")

        if not b["checked"] and not b["delta_note"]:
            unreviewed.append(qid)
            continue

        rec = golden[qid]
        if b["checked"]:
            reviewed_new_relevant.append(qid)
            existing = rec.get("relevantChunkKeys") or []
            new_keys = [k for k in b["checked"] if k not in existing]
            if new_keys:
                rec["relevantChunkKeys"] = existing + new_keys
                delta_prov = b["delta_provenance"] or "LLM_JUDGED"
                prov_note = f"delta review ({len(new_keys)} chunk(s)): {delta_prov}"
                rec["provenance"] = f"{rec['provenance']} | {prov_note}" if rec.get("provenance") else prov_note
        else:
            reviewed_nothing_new.append(qid)

        if b["delta_note"] and b["delta_note"] not in (rec.get("note") or ""):
            rec["note"] = f"{rec['note']} | delta: {b['delta_note']}" if rec.get("note") else f"delta: {b['delta_note']}"

    print(f"total delta blocks: {len(blocks)}")
    print(f"  reviewed, new relevant chunk(s) added: {len(reviewed_new_relevant)}")
    print(f"  reviewed, confirmed nothing new relevant: {len(reviewed_nothing_new)}")
    print(f"  UNREVIEWED (no marks, no delta_note): {len(unreviewed)}")
    if unreviewed:
        print("\nUnreviewed delta blocks (fix these before treating the pool-bias fix as complete):")
        for qid in unreviewed:
            print(f"    - {qid}: {golden[qid]['query']}")

    with open(GOLDEN_SET, "w", encoding="utf-8") as f:
        for qid in order:
            f.write(json.dumps(golden[qid]) + "\n")

    print(f"\nrewrote {GOLDEN_SET} ({len(order)} total queries, {len(reviewed_new_relevant)} updated with new relevant chunks)")
    if unreviewed:
        sys.exit(f"{len(unreviewed)} delta blocks still unreviewed - re-run after completing them")


if __name__ == "__main__":
    main()
