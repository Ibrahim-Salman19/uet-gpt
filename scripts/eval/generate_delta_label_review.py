#!/usr/bin/env python3
"""Mandate §45/46/57 pool-bias fix, step 1 of 2.

hybrid-retrieval-2026-08/report.md §2 measured that the hybrid system's
fusedTop5 introduces a chunk absent from the original dense-only label pool
(label_review.md) in 50/50 queries - any such chunk is scored as a miss by
construction, because it was never eligible to be marked relevant. This
script does NOT re-review all 50 queries; it surfaces only the new,
never-labeled candidates (fusedTop5 minus denseTop5, per query, straight
from the already-computed hybrid_eval_results.json - no re-fetch, no cloud
call) so review means confirm/reject a small delta, not redo the original
250-candidate pass.

Each query also echoes its existing relevant chunk(s)/note from
golden_set_verified.jsonl for context, so the reviewer isn't flipping
between two files to remember what was already found.

Candidate provenance here is HEURISTIC (fusedTop5 rank), not a relevance
judgment - same discipline as generate_label_review.py. Nothing here is
auto-accepted."""
import json
import re

HYBRID_RESULTS = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/docs/rag-store-evaluation/hybrid-retrieval-2026-08/hybrid_eval_results.json"
GOLDEN_SET = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/golden_set_verified.jsonl"
CHUNKS = "/mnt/d/uetgpt_corpus_v1/embeddings/all_chunks.jsonl"
OUT = "/mnt/c/Users/hafiz/UETGPT/uet-gpt/scripts/eval/delta_label_review.md"

# Same boilerplate-parsing shortcut as generate_label_review.py - see that
# file's header for why (measured on a 2,000-chunk sample: ~97% coverage,
# no cross-file id join needed).
TITLE_URL_RE = re.compile(r"Document Title:\s*(.*?)\s*URL Path:\s*(\S+)")


def load_jsonl(path):
    with open(path) as f:
        return [json.loads(line) for line in f]


def describe_chunk(chunk):
    text_full = (chunk.get("text") or "") if chunk else ""
    m = TITLE_URL_RE.search(text_full[:300])
    title, url = (m.group(1), m.group(2)) if m else ("(not found in chunk text)", "(not found in chunk text)")
    heading_full = " > ".join(chunk.get("headingPath", []) or []) if chunk else "?"
    heading = heading_full[:120].replace("\n", " ") + ("..." if len(heading_full) > 120 else "")
    text = text_full[:400].replace("\n", " ") if chunk else "(chunk text not found)"
    return title, url, heading, text


def main():
    # hybrid_eval_results.json is a single JSON object, not JSONL - load directly.
    with open(HYBRID_RESULTS) as f:
        hybrid = json.load(f)
    hybrid_by_id = {r["queryId"]: r for r in hybrid["results"]}

    golden_by_id = {g["queryId"]: g for g in load_jsonl(GOLDEN_SET)}
    chunks_by_key = {c["chunkKey"]: c for c in load_jsonl(CHUNKS)}

    lines = [
        "# Delta label review - closes the pool-bias gap measured in",
        "# docs/rag-store-evaluation/hybrid-retrieval-2026-08/report.md §2",
        "",
        "Each query below lists ONLY the chunks in the hybrid system's fused top-5",
        "that were absent from the original dense-only label pool (label_review.md) -",
        "i.e. candidates that were never eligible to be marked relevant before now.",
        "The query's existing relevant chunk(s) and note (if any) are echoed for",
        "context. Mark each `[ ]` as `[x]` ONLY for chunks that genuinely, correctly",
        "answer the query. If none of the new candidates are relevant, leave them",
        "unchecked - the existing note already covers that case and nothing more is",
        "needed. Add a one-line `_delta_note:_` only if something about the new",
        "candidates specifically is worth recording. `_delta_provenance:_` defaults to",
        "LLM_JUDGED (read against the query, no independent second source checked) -",
        "change it to AUTHORITATIVE_SOURCE_MATCH only if a checked candidate was",
        "actually cross-checked against independent source content (e.g. the",
        "Prospectus PDF page image, the Rule Book, a corroborating second chunk), and",
        "say what was cross-checked. Never mark HUMAN_VERIFIED on this file's behalf -",
        "that provenance is reserved for the project's user reviewing in person.",
        "",
        "When done, run `parse_delta_label_review.py` to merge your marks into",
        "golden_set_verified.jsonl (additive: existing relevant chunks are kept,",
        "new ones you check are appended).",
        "",
        "---",
        "",
    ]

    total_delta_candidates = 0
    queries_with_delta = 0

    for i, (query_id, golden) in enumerate(golden_by_id.items(), 1):
        hybrid_row = hybrid_by_id.get(query_id)
        if hybrid_row is None:
            continue  # not in the hybrid eval run - nothing to delta-review
        dense_pool = set(hybrid_row["denseTop5"])
        delta_keys = [k for k in hybrid_row["fusedTop5"] if k not in dense_pool]
        if not delta_keys:
            continue

        queries_with_delta += 1
        total_delta_candidates += len(delta_keys)

        lines.append(f"## {i}. {golden['query']}")
        lines.append("")
        lines.append(f"queryId: `{query_id}`")
        lines.append("")
        existing = golden.get("relevantChunkKeys") or []
        if existing:
            lines.append(f"_already relevant (from original review, kept as-is):_ {len(existing)} chunk(s) - {', '.join(k[:12] + '...' for k in existing)}")
        else:
            lines.append("_already relevant (from original review, kept as-is):_ none")
        if golden.get("note"):
            lines.append(f"_original note:_ {golden['note']}")
        lines.append("")
        lines.append(f"New candidates (rank in fused top-5, never shown to a labeler before):")
        lines.append("")
        for k in delta_keys:
            chunk = chunks_by_key.get(k)
            title, url, heading, text = describe_chunk(chunk)
            fused_rank = hybrid_row["fusedTop5"].index(k) + 1
            lines.append(f"- [ ] **fused rank {fused_rank}** - {title}")
            lines.append(f"      url: {url}")
            lines.append(f"      heading: {heading}")
            lines.append(f"      chunkKey: `{k}`")
            lines.append(f"      text: {text}...")
            lines.append("")
        lines.append("_delta_note:_ ")
        lines.append("_delta_provenance:_ LLM_JUDGED")
        lines.append("")
        lines.append("---")
        lines.append("")

    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"wrote {queries_with_delta} queries x {total_delta_candidates} new candidates ({total_delta_candidates / queries_with_delta:.1f} avg/query) to {OUT}")


if __name__ == "__main__":
    main()
