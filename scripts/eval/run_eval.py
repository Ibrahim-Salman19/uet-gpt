import os
import json
import argparse
from convex import ConvexClient
from dotenv import load_dotenv

load_dotenv()

def run_eval(golden_path: str, top_k: int = 5) -> dict:
    convex_url = os.getenv("CONVEX_URL")
    if not convex_url:
        print("Error: CONVEX_URL environment variable is not set in .env")
        return {}
        
    client = ConvexClient(convex_url)
    
    with open(golden_path, "r", encoding="utf-8") as f:
        golden_pairs = [json.loads(line) for line in f]
        
    total = len(golden_pairs)
    url_hits = 0
    fragment_hits = 0
    failures = []
    
    categories = {}
    
    print(f"Running evaluation against {total} golden pairs using Convex endpoint...")
    
    for item in golden_pairs:
        query = item["query"]
        expected_url = item["expected_url"]
        expected_fragment = item["expected_fragment"].lower()
        category = item["category"]
        
        if category not in categories:
            categories[category] = {"total": 0, "url_hits": 0, "fragment_hits": 0}
            
        categories[category]["total"] += 1
        
        try:
            # Call the convex action
            results = client.action("eval:evaluateSearch", {"query": query, "topK": top_k})
            
            # Check URL match
            url_matched = any(expected_url in r.get("url", "") for r in results)
            
            # Check fragment match
            fragment_matched = any(expected_fragment in r.get("text", "").lower() for r in results)
            
            if url_matched:
                url_hits += 1
                categories[category]["url_hits"] += 1
                
            if fragment_matched:
                fragment_hits += 1
                categories[category]["fragment_hits"] += 1
                
            if not url_matched or not fragment_matched:
                failures.append({
                    "query": query,
                    "expected_url": expected_url,
                    "expected_fragment": expected_fragment,
                    "url_matched": url_matched,
                    "fragment_matched": fragment_matched
                })
                
        except Exception as e:
            print(f"Error evaluating '{query}': {e}")
            failures.append({"query": query, "error": str(e)})
            
    metrics = {
        "recall_at_k": url_hits / total if total > 0 else 0,
        "fragment_hit_rate": fragment_hits / total if total > 0 else 0,
        "per_category": categories,
        "failures": failures
    }
    
    print(f"\n--- Evaluation Results (Top K={top_k}) ---")
    print(f"Recall@K: {metrics['recall_at_k']:.2%}")
    print(f"Fragment Hit Rate: {metrics['fragment_hit_rate']:.2%}")
    print("\nPer Category Breakdown:")
    for cat, stats in categories.items():
        print(f"  {cat}: Recall={stats['url_hits']/stats['total']:.2%}, Fragment={stats['fragment_hits']/stats['total']:.2%}")
        
    return metrics

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--golden", required=True, help="Path to golden set JSONL")
    parser.add_argument("--top_k", type=int, default=5)
    parser.add_argument("--verbose", action="store_true", help="Print failures")
    parser.add_argument("--category", type=str, help="Filter to specific category")
    args = parser.parse_args()
    
    # If category is provided, filter the golden set temporarily
    if args.category:
        with open(args.golden, "r", encoding="utf-8") as f:
            pairs = [json.loads(line) for line in f]
        filtered = [p for p in pairs if p["category"] == args.category]
        import tempfile
        with tempfile.NamedTemporaryFile("w", delete=False, suffix=".jsonl") as tmp:
            for p in filtered:
                tmp.write(json.dumps(p) + "\n")
            tmp_path = tmp.name
        metrics = run_eval(tmp_path, args.top_k)
        os.unlink(tmp_path)
    else:
        metrics = run_eval(args.golden, args.top_k)
        
    if args.verbose and metrics.get("failures"):
        print("\n--- Failures ---")
        for f in metrics["failures"]:
            print(f)
