#!/usr/bin/env python3
"""Mandate §47: produce a real HUMAN_VERIFIED query/label set. Manufacturing
labels here would violate §47/§57 - what this script CAN do is make the
human review fast: for each of the 50 existing queries (golden_set.jsonl),
surface the top-5 candidates from the exact local cosine ground truth
(exact_ground_truth.py's output, already computed) with real chunk text and
source URL, so review means confirm/reject/correct rather than search the
44,792-chunk corpus from scratch per query.

Candidate provenance is HEURISTIC (nearest-neighbor similarity), not a
relevance judgment - the whole point of this file is to turn that into
HUMAN_VERIFIED via a human editing it. Nothing here is auto-accepted."""
import json
import re

GROUND_TRUTH = "/mnt/d/uetgpt_corpus_v1/embeddings/ground_truth.jsonl"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
OUT = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/label_review.md"
TOP_N = 5

# all_chunks.jsonl's documentId (32-char, Convex-style) and documents.jsonl's
# documentId (64-char, content-hash-style) are two DIFFERENT id schemes - not
# directly joinable (confirmed by inspection, not assumed). documents.jsonl
# is not used here. The crawler embeds "Document Title: X URL Path: Y" as
# boilerplate in ~97% of chunks (measured on a 2,000-chunk sample) - reused
# as the title/URL source instead, since it needs no cross-file join at all.
TITLE_URL_RE = re.compile(r"Document Title:\s*(.*?)\s*URL Path:\s*(\S+)")


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f]


def main():
    ground_truth = load_jsonl(GROUND_TRUTH)
    chunks_by_key = {c["chunkKey"]: c for c in load_jsonl(CHUNKS)}

    lines = [
        "# Label review - mandate §47 real HUMAN_VERIFIED query/label set",
        "",
        "For each query, the top 5 candidates are nearest-neighbor matches from exact",
        "cosine search (HEURISTIC provenance - not a relevance judgment). Mark each `[ ]`",
        "as `[x]` ONLY for chunks that genuinely, correctly answer the query. Leave `[ ]`",
        "for irrelevant ones. If NONE of the 5 are correct, say so in a note rather than",
        "checking one anyway - a missing answer is more honest than a wrong one. Add a",
        "one-line note under any query where something is off (ambiguous query, all",
        "candidates wrong, etc.) so it carries into the final set.",
        "",
        "When done, run `parse_label_review.py` to produce the real, provenance-labeled",
        "golden set from your marks.",
        "",
        "---",
        "",
    ]

    for i, g in enumerate(ground_truth, 1):
        lines.append(f"## {i}. {g['query']}")
        lines.append("")
        lines.append(f"queryId: `{g['queryId']}`")
        lines.append("")
        for j, cand in enumerate(g["top5"][:TOP_N], 1):
            chunk = chunks_by_key.get(cand["chunkKey"])
            text_full = (chunk.get("text") or "") if chunk else ""
            m = TITLE_URL_RE.search(text_full[:300])
            title, url = (m.group(1), m.group(2)) if m else ("(not found in chunk text)", "(not found in chunk text)")
            heading_full = " > ".join(chunk.get("headingPath", []) or []) if chunk else "?"
            heading = heading_full[:120].replace("\n", " ") + ("..." if len(heading_full) > 120 else "")
            text = text_full[:400].replace("\n", " ") if chunk else "(chunk text not found)"
            lines.append(f"- [ ] **candidate {j}** (score {cand['score']:.4f}) - {title}")
            lines.append(f"      url: {url}")
            lines.append(f"      heading: {heading}")
            lines.append(f"      chunkKey: `{cand['chunkKey']}`")
            lines.append(f"      text: {text}...")
            lines.append("")
        lines.append("_note:_ ")
        lines.append("")
        lines.append("---")
        lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"wrote {len(ground_truth)} queries x top{TOP_N} candidates to {OUT}")


if __name__ == "__main__":
    main()
