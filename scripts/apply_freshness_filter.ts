// Applies the REAL production eligibility/freshness classification
// (convex/shared/freshnessPolicy.ts's classifyFreshness + isRetrievalEligibleStatus)
// to a batch of corpus documents, for the retrieval-baseline evaluator's
// exhaustive/full-corpus ground-truth mode (scripts/stage_e_retrieval_eval.py).
//
// freshnessPolicy.ts is documented as "a PURE module: no Convex runtime
// imports... safe to import from queries, mutations, actions, AND unit
// tests" - so this script reuses it directly rather than reimplementing an
// approximation in Python, per the retrieval-baseline remediation's explicit
// instruction to reuse the production filtering/freshness implementation
// where practical.
//
// Usage: npx tsx scripts/apply_freshness_filter.ts [nowEpochMs]
// Reads a JSON array from stdin: [{id, status?, isStale?, crawledAt?, freshnessTier?}, ...]
// Writes a JSON array to stdout: [{id, eligible, state, applicability, penalized, reason, scoreMultiplier}, ...]
// nowEpochMs is optional (defaults to Date.now()) - pass a fixed value for a
// reproducible baseline run, since eligibility near a TTL boundary is
// time-dependent and re-running with a fresh "now" would not otherwise be
// deterministic for reasons unrelated to retrieval quality.

import {
  classifyFreshness,
  isRetrievalEligibleStatus,
  DEFAULT_STALE_SCORE_MULTIPLIER,
} from "../convex/shared/freshnessPolicy";

type InputRow = {
  id: string;
  status?: string;
  isStale?: boolean;
  crawledAt?: number;
  freshnessTier?: string;
};

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const nowArg = process.argv[2];
  const now = nowArg !== undefined ? Number(nowArg) : Date.now();
  if (!Number.isFinite(now)) {
    console.error("nowEpochMs must be a finite number if provided");
    process.exit(2);
  }

  const raw = await readStdin();
  let rows: InputRow[];
  try {
    rows = JSON.parse(raw);
  } catch (err) {
    console.error(`invalid JSON on stdin: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
    return;
  }
  if (!Array.isArray(rows)) {
    console.error("stdin JSON must be an array");
    process.exit(2);
    return;
  }

  const output = rows.map((row) => {
    // Mirrors the exact hard-exclusion guard at the real call site
    // (convex/embeddings/search.ts:307-309: `if (docMeta?.status &&
    // !isRetrievalEligibleStatus(docMeta.status))`) - a TRUTHY check on
    // status, not a `!== undefined` check. An empty-string status is falsy,
    // so the real call site skips this exclusion entirely for that case
    // even though isRetrievalEligibleStatus("") alone would return false -
    // reproduced faithfully here rather than "improved".
    const hardExcluded = Boolean(row.status) && !isRetrievalEligibleStatus(row.status);
    const decision = classifyFreshness({
      status: row.status,
      isStale: row.isStale,
      crawledAt: row.crawledAt,
      freshnessTier: row.freshnessTier,
      now,
    });
    return {
      id: row.id,
      eligible: !hardExcluded && decision.eligible,
      state: decision.state,
      applicability: decision.applicability,
      penalized: decision.penalized,
      reason: hardExcluded ? `hard_excluded_status:${row.status}` : decision.reason,
      scoreMultiplier: decision.penalized ? DEFAULT_STALE_SCORE_MULTIPLIER : 1.0,
    };
  });

  process.stdout.write(JSON.stringify(output));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
