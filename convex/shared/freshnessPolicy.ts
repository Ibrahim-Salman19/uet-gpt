/**
 * Single source of truth for the staleness-MVP freshness policy.
 *
 * Amendment #3 of the staleness-MVP verdict: TTLs, multiplier, risk classes,
 * and policy version live in ONE place. The flagger (convex/crawl/staleness.ts),
 * observability (convex/observability/internal.ts), retrieval
 * (convex/embeddings/search.ts), context formatter (convex/rag/context.ts),
 * prompts (convex/rag/prompts.ts), and tests MUST import from here — no
 * duplicated day counts elsewhere.
 *
 * This is a PURE module: no Convex runtime imports (no `v`, no `ctx`). It is
 * safe to import from queries, mutations, actions, AND unit tests. Every
 * time-sensitive helper accepts a `now` argument so tests are deterministic.
 *
 * Status-scope decision (locked): use ONLY the existing schema status literals.
 *   - documents.status union = pending | processing | indexed | failed | stale | active | pending_embed
 *   - ELIGIBLE for retrieval:  active, indexed
 *   - HARD-EXCLUDED:           stale, failed, pending, processing, pending_embed
 *   - DEFERRED (post-MVP schema migration): superseded, quarantined, deleted, withdrawn
 *
 * See docs/audit/STALENESS_MVP_MANIFEST.json for the immutable pre-change record.
 */

// ---------------------------------------------------------------------------
// Policy identity
// ---------------------------------------------------------------------------

export const FRESHNESS_POLICY_VERSION = "2026-07-staleness-mvp-1";
export const FRESHNESS_POLICY_OWNER = "rag-maintainers";
export const FRESHNESS_POLICY_LAST_REVIEWED = "2026-07-28";

// ---------------------------------------------------------------------------
// Tier definitions + TTLs (amendment #3: provisional operating policy)
// ---------------------------------------------------------------------------
// These thresholds are an INTERNAL risk policy, not externally proven
// constants. high = admissions/fees/merit/schedules (most time-sensitive);
// medium = departments/faculty/programs; low = about/history/contact.

export type FreshnessTier = "high" | "medium" | "low";

export const FRESHNESS_TTL_DAYS: Readonly<Record<FreshnessTier, number>> = {
  high: 14,
  medium: 60,
  low: 180,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const FRESHNESS_TTL_MS: Readonly<Record<FreshnessTier, number>> = {
  high: FRESHNESS_TTL_DAYS.high * MS_PER_DAY,
  medium: FRESHNESS_TTL_DAYS.medium * MS_PER_DAY,
  low: FRESHNESS_TTL_DAYS.low * MS_PER_DAY,
};

/**
 * Default score multiplier applied to documents that are aged beyond their
 * tier TTL but whose status is still retrieval-eligible (active/indexed) and
 * whose `isStale` flag is true. The multiplier is a penalty in [0,1] folded
 * into computeDecayedScore's output. Configurable for local ablation.
 */
export const DEFAULT_STALE_SCORE_MULTIPLIER = 0.3;

/**
 * Grid for local-only ablation of the stale-score multiplier
 * (amendment #3). The hosted pipeline uses DEFAULT_STALE_SCORE_MULTIPLIER;
 * this grid is consumed by local test harnesses / FAISS ablations only.
 * 0   = hard suppress aged-eligible docs (effectively exclude)
 * 0.1 = strong penalty
 * 0.3 = MVP default
 * 0.5 = moderate penalty
 * 1.0 = no penalty (baseline, disables staleness scoring)
 */
export const STALE_MULTIPLIER_GRID = [0, 0.1, 0.3, 0.5, 1.0] as const;

// ---------------------------------------------------------------------------
// Candidate overfetch (amendment #5: prevent post-filter top-k starvation)
// ---------------------------------------------------------------------------
// The Convex vector index does NOT have `status` as a filterField, and changing
// vector-index filter names is FORBIDDEN (AGENTS.md). So we overfetch candidates
// BEFORE metadata enrichment, hard-exclude invalid statuses AFTER enrichment,
// then re-sort and truncate to the originally requested k.
// Convex vectorSearch caps candidates at 256.

export const STALE_OVERFETCH_FACTOR = 3;
export const MIN_CANDIDATES = 30;
export const MAX_CANDIDATES = 256;

/**
 * Compute the candidate-pool size for a retrieval channel given the requested
 * final k. Always at least MIN_CANDIDATES, scaled by STALE_OVERFETCH_FACTOR,
 * capped at the Convex hard limit of 256.
 *
 *   candidateLimit(8)  = min(256, max(8*3, 30))   = 30
 *   candidateLimit(20) = min(256, max(20*3, 30))  = 60
 *   candidateLimit(5)  = min(256, max(5*3, 30))   = 30  (floor)
 *   candidateLimit(100)= min(256, max(100*3, 30)) = 256 (cap)
 */
export function candidateLimit(requestedK: number): number {
  const k = Math.max(1, Math.floor(requestedK));
  return Math.min(MAX_CANDIDATES, Math.max(k * STALE_OVERFETCH_FACTOR, MIN_CANDIDATES));
}

// ---------------------------------------------------------------------------
// State precedence (amendment #4: existing schema literals only)
// ---------------------------------------------------------------------------

export type DocumentStatus =
  | "pending"
  | "processing"
  | "indexed"
  | "failed"
  | "stale"
  | "active"
  | "pending_embed";

/**
 * Statuses that MAY appear in retrieval results (subject to freshness + risk).
 * Everything else in the union is hard-excluded before scoring.
 */
export const RETRIEVAL_ELIGIBLE_STATUSES: readonly DocumentStatus[] = ["active", "indexed"];

/**
 * Statuses that are hard-excluded from retrieval regardless of age or score.
 * These represent documents that are not yet ready, have failed, or have been
 * explicitly invalidated. Note: superseded/quarantined/deleted/withdrawn are
 * DEFERRED to a post-MVP schema migration.
 */
export const RETRIEVAL_EXCLUDED_STATUSES: readonly DocumentStatus[] = [
  "stale",
  "failed",
  "pending",
  "processing",
  "pending_embed",
];

export function isRetrievalEligibleStatus(status: string | undefined | null): boolean {
  // Only genuine "missing" (undefined/null) is treated as not-a-hard-exclusion;
  // downstream classifyFreshness then reports unknown freshness for the row.
  // An empty string or any unrecognized literal is treated as EXCLUDED so a
  // data-quality bug or a future status literal never silently surfaces.
  if (status === undefined || status === null) return true;
  return (RETRIEVAL_ELIGIBLE_STATUSES as readonly string[]).includes(status);
}

/**
 * documents.lifecycleStatus gate (shared/invariants.ts: retrievable only while
 * lifecycleStatus is active). Unset means active: no production document had the
 * field set when this gate was added, so treating unset as excluded would empty
 * retrieval. Any other value (superseded, withdrawn, ...) is excluded.
 */
export function isRetrievalEligibleLifecycle(lifecycleStatus: string | undefined | null): boolean {
  return lifecycleStatus === undefined || lifecycleStatus === null || lifecycleStatus === "active";
}

// ---------------------------------------------------------------------------
// Freshness state classification
// ---------------------------------------------------------------------------

export type FreshnessState = "fresh" | "aged" | "unknown";
export type Applicability = "current" | "unknown";

export interface FreshnessInput {
  /** documents.status literal (or undefined for legacy rows). */
  status?: string;
  /** documents.isStale flag set by flagExpiredDocuments. */
  isStale?: boolean;
  /** documents.crawledAt epoch ms. Missing => freshness unknown (never fresh). */
  crawledAt?: number;
  /** documents.freshnessTier. Defaults to "low" (most permissive TTL). */
  freshnessTier?: string;
  /** Evaluation time, epoch ms. Passed explicitly so tests are deterministic. */
  now: number;
}

export interface FreshnessDecision {
  /** fresh = within TTL and not flagged; aged = beyond TTL or flagged; unknown = missing data. */
  state: FreshnessState;
  /** current = a fresh source; unknown = aged/unknown sources are never "current". */
  applicability: Applicability;
  /** Whether the document may appear in retrieval at all (status not hard-excluded). */
  eligible: boolean;
  /** Whether a score penalty (DEFAULT_STALE_SCORE_MULTIPLIER) should be applied. */
  penalized: boolean;
  /** Human-readable reason for diagnostics / smoke output. */
  reason: string;
}

/**
 * Classify a document's freshness. Pure function.
 *
 * Precedence (amendment #4):
 *   1. Hard-excluded status  -> { state: unknown, eligible: false }
 *   2. Missing crawledAt     -> { state: unknown, eligible: true, applicability: unknown }
 *                               (NEVER treated as fresh — amendment #8)
 *   3. isStale === true      -> { state: aged, penalized: true }
 *   4. crawledAt older than TTL[tier] -> { state: aged, penalized: true }
 *   5. otherwise             -> { state: fresh, applicability: current }
 *
 * Future-dated crawledAt is treated as fresh (clock-skew tolerant; we do not
 * punish a source for a slightly-ahead server clock).
 */
export function classifyFreshness(input: FreshnessInput): FreshnessDecision {
  const { status, isStale, crawledAt, freshnessTier, now } = input;

  // 1. Hard-exclusion by status (takes precedence over everything).
  if (status && !isRetrievalEligibleStatus(status)) {
    return {
      state: "unknown",
      applicability: "unknown",
      eligible: false,
      penalized: false,
      reason: `excluded_status:${status}`,
    };
  }

  // 2. Missing crawledAt => unknown, never fresh.
  if (crawledAt === undefined || crawledAt === null || !Number.isFinite(crawledAt)) {
    return {
      state: "unknown",
      applicability: "unknown",
      eligible: true,
      penalized: false,
      reason: "missing_crawledAt",
    };
  }

  const tier = normalizeTier(freshnessTier);
  const ttlMs = FRESHNESS_TTL_MS[tier];
  const ageMs = now - crawledAt;

  // Tolerate small future skew (up to 1 day) — treat as fresh.
  const futureSkewMs = MS_PER_DAY;
  const isFuture = ageMs < -futureSkewMs;

  // 3. Explicit stale flag (set by the age flagger cron).
  if (isStale === true) {
    return {
      state: "aged",
      applicability: "unknown",
      eligible: true,
      penalized: true,
      reason: `isStale_flagged tier=${tier}`,
    };
  }

  // 4. Beyond TTL for the tier.
  if (!isFuture && ageMs > ttlMs) {
    const daysOver = Math.floor((ageMs - ttlMs) / MS_PER_DAY);
    return {
      state: "aged",
      applicability: "unknown",
      eligible: true,
      penalized: true,
      reason: `beyond_ttl tier=${tier} daysOver=${daysOver}`,
    };
  }

  // 5. Fresh.
  return {
    state: "fresh",
    applicability: "current",
    eligible: true,
    penalized: false,
    reason: `fresh tier=${tier}`,
  };
}

function normalizeTier(tier: string | undefined | null): FreshnessTier {
  if (tier === "high" || tier === "medium" || tier === "low") return tier;
  return "low"; // most permissive TTL — safest default for untagged docs
}

// ---------------------------------------------------------------------------
// Risk classification (amendment #6: deterministic, NOT LLM)
// ---------------------------------------------------------------------------
// A retrieval/answer-policy decision must NOT rely on the LLM to infer whether
// a query is high-risk. We classify deterministically from keywords.

export type QueryRisk = "high" | "medium" | "low";

/**
 * High-impact current-information topics. If ONLY stale/unknown evidence is
 * available for one of these, the system must abstain and direct the user to
 * the official UET Taxila source (amendment #6).
 */
export const HIGH_IMPACT_KEYWORDS: readonly string[] = [
  "fee",
  "fees",
  "tuition",
  "deadline",
  "last date",
  "merit",
  "merit list",
  "entry test",
  "entry-test",
  "admission",
  "admissions",
  "date sheet",
  "datesheet",
  "schedule",
  "eligibility",
  "eligible",
  "result",
  "results",
  "registration",
  "register",
  "submit",
  "submission",
  "apply",
  "application",
  "last date to apply",
];

/**
 * Medium-impact topics. Aged evidence may be used with an explicit verification
 * warning if no better source exists.
 */
export const MEDIUM_IMPACT_KEYWORDS: readonly string[] = [
  "contact",
  "email",
  "phone",
  "faculty",
  "teacher",
  "professor",
  "department",
  "departments",
  "programme",
  "program",
  "programmes",
  "programs",
  "course",
  "courses",
];

function containsAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Classify a user query's risk band from its text. Deterministic.
 * Lowercase substring match. high beats medium beats low.
 */
export function classifyQueryRisk(query: string): QueryRisk {
  const q = (query ?? "").toLowerCase();
  if (!q.trim()) return "low";
  if (containsAny(q, HIGH_IMPACT_KEYWORDS)) return "high";
  if (containsAny(q, MEDIUM_IMPACT_KEYWORDS)) return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Stale-only abstention (amendment #6)
// ---------------------------------------------------------------------------

export interface AbstainInput {
  risk: QueryRisk;
  /** True if at least one retrieved source is fresh (state === "fresh"). */
  anyFreshSource: boolean;
  /** True if there are sources but NONE are fresh (all aged/unknown). */
  allSourcesAgedOrUnknown: boolean;
}

/**
 * Decide whether the system must abstain because only stale/unknown evidence
 * is available for a high-impact current-information query.
 *
 *   high-impact + no fresh source + (has aged/unknown evidence) => ABSTAIN
 *   high-impact + at least one fresh source                       => do not force-abstain
 *   medium/low-impact                                            => never force-abstain
 *                                                               (warn via prompt instead)
 *
 * An empty result set (allSourcesAgedOrUnknown === false because there are
 * zero sources) does NOT trigger abstention here — that is the ordinary
 * "no results" path handled by the prompt's rule #2.
 */
export function shouldAbstainOnStaleOnly(input: AbstainInput): boolean {
  if (input.risk !== "high") return false;
  if (input.anyFreshSource) return false;
  return input.allSourcesAgedOrUnknown;
}

// ---------------------------------------------------------------------------
// Sweep policy (amendment #2: resumable cursor-based sweep)
// ---------------------------------------------------------------------------

/**
 * Per-batch row cap for the staleness-flag sweep. Convex warns that later cron
 * invocations can be skipped when the preceding invocation is still running,
 * so each batch must be small and fast. Continuation is via ctx.scheduler.runAfter.
 */
export const SWEEP_BATCH_SIZE = 100;

/**
 * Return the TTL cutoff epoch-ms for a tier at a given evaluation time.
 * A document whose crawledAt <= cutoff is considered aged for that tier.
 * Shared by the flagger (flagExpiredDocuments) and observability
 * (computeStaleness) so they cannot drift — the original bug had the flagger
 * at 30/90/180d and observability at 14/60/180d.
 */
export function ttlCutoffMs(tier: FreshnessTier, now: number): number {
  return now - FRESHNESS_TTL_MS[tier];
}
