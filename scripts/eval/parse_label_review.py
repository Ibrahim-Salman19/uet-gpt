#!/usr/bin/env python3
"""Parses a completed label_review.md (see generate_label_review.py) into a
real HUMAN_VERIFIED query/label set - mandate §47. Only chunks the human
actually checked `[x]` become labels; nothing here infers or defaults a
relevance judgment. A query with zero checks AND no note is flagged as
UNREVIEWED (distinct from "reviewed, nothing was relevant", which requires
an explicit note) so an unfinished review can't silently look complete."""
import json
import re
import sys

REVIEW = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/label_review.md"
OUT = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/golden_set_verified.jsonl"

QUERY_RE = re.compile(r"^## \d+\. (.+)$")
QUERY_ID_RE = re.compile(r"^queryId: `([0-9a-f]+)`$")
CANDIDATE_RE = re.compile(r"^- \[( |x|X)\] \*\*candidate \d+\*\* \(score ([\d.]+)\)")
CHUNK_KEY_RE = re.compile(r"^\s*chunkKey: `([0-9a-f]+)`$")
NOTE_RE = re.compile(r"^_note:_\s*(.*)$")
# Per-query provenance override (mandate §47: not every reviewed query in this
# file is HUMAN_VERIFIED - some queries were reviewed by the AI, checking
# candidates against independently-verifiable source content, when the user
# could not answer from personal knowledge. Default stays HUMAN_VERIFIED for
# any query without this line, since that remains the plan for the rest of
# the file.
PROVENANCE_RE = re.compile(r"^_provenance:_\s*(.*)$")


def main():
    with open(REVIEW) as f:
        text = f.read()

    entries = []
    current = None
    current_checked = False  # whether the candidate line just seen was checked
    for line in text.splitlines():
        qm = QUERY_RE.match(line)
        if qm:
            if current:
                entries.append(current)
            current = {
                "query": qm.group(1),
                "queryId": None,
                "checked": [],
                "note": "",
                "provenance": "HUMAN_VERIFIED",
            }
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
        nm = NOTE_RE.match(line)
        if nm and nm.group(1).strip():
            current["note"] = nm.group(1).strip()
            continue
        pm = PROVENANCE_RE.match(line)
        if pm and pm.group(1).strip():
            current["provenance"] = pm.group(1).strip()
    if current:
        entries.append(current)

    unreviewed = [e for e in entries if not e["checked"] and not e["note"]]
    reviewed_none_relevant = [e for e in entries if not e["checked"] and e["note"]]
    reviewed_with_labels = [e for e in entries if e["checked"]]

    reviewed = reviewed_with_labels + reviewed_none_relevant
    by_provenance: dict[str, int] = {}
    for e in reviewed:
        by_provenance[e["provenance"]] = by_provenance.get(e["provenance"], 0) + 1

    print(f"total queries in review file: {len(entries)}")
    print(f"  reviewed, relevant chunk(s) marked: {len(reviewed_with_labels)}")
    print(f"  reviewed, explicitly none relevant (has a note): {len(reviewed_none_relevant)}")
    print(f"  UNREVIEWED (no marks, no note): {len(unreviewed)}")
    if by_provenance:
        print("  reviewed queries by provenance:")
        for prov, count in sorted(by_provenance.items()):
            print(f"    {prov}: {count}")
    if unreviewed:
        print("\nUnreviewed queries (fix these before treating the set as complete):")
        for e in unreviewed:
            print(f"    - {e['query']}")

    with open(OUT, "w", encoding="utf-8") as f:
        for e in entries:
            if not e["checked"] and not e["note"]:
                continue  # unreviewed - do not write a record with no evidence either way
            record = {
                "queryId": e["queryId"],
                "query": e["query"],
                "relevantChunkKeys": e["checked"],
                "provenance": e["provenance"],
                "note": e["note"] or None,
            }
            f.write(json.dumps(record) + "\n")

    print(f"\nwrote {len(reviewed_with_labels) + len(reviewed_none_relevant)} reviewed records to {OUT}")
    if unreviewed:
        sys.exit(f"{len(unreviewed)} queries still unreviewed - re-run after completing them "
                 f"before using this set for §45/§57 benchmarking")


if __name__ == "__main__":
    main()
