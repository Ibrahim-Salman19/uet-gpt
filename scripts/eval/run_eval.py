import os
import json
import math
import time
import argparse
import tempfile
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

try:
    from convex import ConvexClient
except ImportError:
    print("ERROR: 'convex' package not installed. Run: pip install convex")
    raise

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv is optional; env var can be set externally


PER_QUERY_TIMEOUT_SECONDS = 20  # kill individual queries that stall


def _evaluate_single(client: "ConvexClient", item: dict, top_k: int) -> dict:
    """Run a single eval query. Isolated so it can be run in a thread with timeout."""
    query = item["query"]
    expected_url = item["expected_url"]
    expected_fragment = item["expected_fragment"].lower()
    category = item["category"]

    results = client.action("eval:evaluateSearch", {"query": query, "topK": top_k})

    # Rank-aware relevance: find the 1-based rank of the first result whose URL
    # matches the expected URL. A substring "any() in" check is rank-blind and
    # overstates quality (a hit at position 5 scores the same as position 1).
    url_rank = 0
    for idx, r in enumerate(results, start=1):
        if expected_url in r.get("url", ""):
            url_rank = idx
            break

    url_matched = url_rank > 0
    fragment_matched = any(expected_fragment in r.get("text", "").lower() for r in results)

    # MRR contribution: reciprocal of the first-relevant rank (0 if no hit).
    reciprocal_rank = (1.0 / url_rank) if url_rank > 0 else 0.0
    # nDCG@k with a single relevant document: DCG = 1/log2(rank+1); the ideal
    # DCG (relevant doc at rank 1) is 1/log2(2) = 1, so nDCG == DCG here.
    ndcg = (1.0 / math.log2(url_rank + 1)) if url_rank > 0 else 0.0

    return {
        "query": query,
        "category": category,
        "expected_url": expected_url,
        "expected_fragment": expected_fragment,
        "url_matched": url_matched,
        "fragment_matched": fragment_matched,
        "url_rank": url_rank,
        "reciprocal_rank": reciprocal_rank,
        "ndcg": ndcg,
    }


def run_eval(golden_path: str, top_k: int = 5, category_filter: str | None = None) -> dict:
    convex_url = os.getenv("CONVEX_URL")
    if not convex_url:
        return {
            "error": "CONVEX_URL environment variable is not set",
            "recall_at_5": 0.0,
            "fragment_hit_rate": 0.0,
            "per_category": {},
            "failures": [],
            "eval_error": True,
        }

    client = ConvexClient(convex_url)

    with open(golden_path, "r", encoding="utf-8") as f:
        golden_pairs = [json.loads(line) for line in f if line.strip()]

    # Apply category filter if provided
    if category_filter:
        golden_pairs = [p for p in golden_pairs if p.get("category") == category_filter]

    total = len(golden_pairs)
    if total == 0:
        return {
            "recall_at_5": 0.0,
            "fragment_hit_rate": 0.0,
            "per_category": {},
            "failures": [],
            "warning": "No golden pairs matched the given category filter.",
        }

    url_hits = 0
    fragment_hits = 0
    rr_sum = 0.0      # accumulates reciprocal ranks for MRR
    ndcg_sum = 0.0    # accumulates per-query nDCG@k
    failures = []
    categories: dict = {}

    print(f"Running evaluation against {total} golden pairs (top_k={top_k})...")
    start_time = time.time()

    for item in golden_pairs:
        query = item["query"]
        cat = item["category"]

        if cat not in categories:
            categories[cat] = {"total": 0, "url_hits": 0, "fragment_hits": 0}
        categories[cat]["total"] += 1

        try:
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(_evaluate_single, client, item, top_k)
                result = future.result(timeout=PER_QUERY_TIMEOUT_SECONDS)

            if result["url_matched"]:
                url_hits += 1
                categories[cat]["url_hits"] += 1

            if result["fragment_matched"]:
                fragment_hits += 1
                categories[cat]["fragment_hits"] += 1

            # Rank-aware aggregation (MRR / nDCG@k). Missed queries contribute 0.
            rr_sum += result.get("reciprocal_rank", 0.0)
            ndcg_sum += result.get("ndcg", 0.0)
            categories[cat]["rr_sum"] = categories[cat].get("rr_sum", 0.0) + result.get("reciprocal_rank", 0.0)
            categories[cat]["ndcg_sum"] = categories[cat].get("ndcg_sum", 0.0) + result.get("ndcg", 0.0)

            if not result["url_matched"] or not result["fragment_matched"]:
                failures.append(result)

        except FuturesTimeoutError:
            print(f"  TIMEOUT ({PER_QUERY_TIMEOUT_SECONDS}s): '{query}'")
            failures.append({"query": query, "error": "timeout", "category": cat})

        except Exception as e:
            err_msg = str(e)
            print(f"  ERROR evaluating '{query}': {err_msg}")
            failures.append({"query": query, "error": err_msg, "category": cat})

    elapsed = time.time() - start_time

    # Compute per-category recall fractions safely
    per_cat_summary: dict = {}
    for cat, stats in categories.items():
        n = stats["total"] or 1  # avoid div-by-zero
        per_cat_summary[cat] = {
            "total": stats["total"],
            "url_hits": stats["url_hits"],
            "fragment_hits": stats["fragment_hits"],
            "recall": round(stats["url_hits"] / n, 4),
            "fragment_hit_rate": round(stats["fragment_hits"] / n, 4),
            "mrr": round(stats.get("rr_sum", 0.0) / n, 4),
            "ndcg": round(stats.get("ndcg_sum", 0.0) / n, 4),
        }

    metrics = {
        # Primary keys used by CRONJOB.md
        "recall_at_5": round(url_hits / total, 4) if total > 0 else 0.0,
        "fragment_hit_rate": round(fragment_hits / total, 4) if total > 0 else 0.0,
        # Alias for backward compatibility
        "recall_at_k": round(url_hits / total, 4) if total > 0 else 0.0,
        # Rank-aware retrieval metrics (overall)
        "mrr": round(rr_sum / total, 4) if total > 0 else 0.0,
        f"ndcg_at_{top_k}": round(ndcg_sum / total, 4) if total > 0 else 0.0,
        # Metadata
        "top_k": top_k,
        "total_pairs": total,
        "elapsed_seconds": round(elapsed, 1),
        "per_category": per_cat_summary,
        "failures": failures,
        "eval_error": False,
    }

    # ── Print summary ──────────────────────────────────────────────────────────
    print(f"\n--- Evaluation Results (Top K={top_k}, {elapsed:.1f}s) ---")
    print(f"Recall@5:          {metrics['recall_at_5']:.2%}")
    print(f"Fragment Hit Rate: {metrics['fragment_hit_rate']:.2%}")
    print(f"MRR:               {metrics['mrr']:.4f}")
    print(f"nDCG@{top_k}:            {metrics[f'ndcg_at_{top_k}']:.4f}")
    print("\nPer Category Breakdown:")
    for cat, stats in per_cat_summary.items():
        print(
            f"  {cat:20s}: Recall={stats['recall']:.2%}  "
            f"Fragment={stats['fragment_hit_rate']:.2%}  "
            f"MRR={stats['mrr']:.3f}  nDCG={stats['ndcg']:.3f}  "
            f"({stats['url_hits']}/{stats['total']})"
        )

    return metrics


def compare_to_baseline(metrics: dict, baseline_path: str) -> dict:
    """Compare metrics to a stored baseline. Returns a delta dict."""
    if not os.path.exists(baseline_path):
        return {"status": "no_baseline", "delta": None}

    try:
        with open(baseline_path, "r", encoding="utf-8") as f:
            baseline = json.load(f)
    except Exception as e:
        return {"status": "baseline_parse_error", "error": str(e), "delta": None}

    baseline_recall = baseline.get("recall_at_5", 0.0)
    current_recall = metrics.get("recall_at_5", 0.0)
    delta = round(current_recall - baseline_recall, 4)

    status = "improved" if delta > 0.005 else ("regressed" if delta < -0.005 else "stable")

    print(f"\nBaseline comparison: {baseline_recall:.2%} → {current_recall:.2%} ({delta:+.2%}) [{status.upper()}]")

    return {
        "status": status,
        "baseline_recall_at_5": baseline_recall,
        "current_recall_at_5": current_recall,
        "delta": delta,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="UET Taxila RAG Evaluation Harness")
    parser.add_argument("--golden", required=True, help="Path to golden set JSONL")
    parser.add_argument("--top_k", type=int, default=5, help="Top-K for recall computation")
    parser.add_argument("--output", type=str, default=None, help="Write JSON results to this file")
    parser.add_argument("--baseline", type=str, default=None, help="Previous run JSON for regression detection")
    parser.add_argument("--verbose", action="store_true", help="Print all failure details")
    parser.add_argument("--category", type=str, default=None, help="Filter to specific category")
    args = parser.parse_args()

    metrics = run_eval(args.golden, args.top_k, category_filter=args.category)

    # Regression check against baseline
    comparison = {}
    if args.baseline:
        comparison = compare_to_baseline(metrics, args.baseline)
        metrics["comparison"] = comparison

        if comparison.get("status") == "regressed":
            print("\n⚠️  REGRESSION DETECTED — recall_at_5 dropped by "
                  f"{abs(comparison['delta']):.2%}")
            # Exit code 2 = regression signal (distinct from error exit 1)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    json.dump(metrics, f, indent=2)
            raise SystemExit(2)

    # Write output file
    if args.output:
        os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else ".", exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(metrics, f, indent=2)
        print(f"\nResults written to: {args.output}")

    # Verbose failures
    if args.verbose and metrics.get("failures"):
        print("\n--- Failures ---")
        for failure in metrics["failures"]:
            print(json.dumps(failure, ensure_ascii=False))

    # Exit 1 if eval itself errored (connection failure etc.)
    if metrics.get("eval_error"):
        raise SystemExit(1)
