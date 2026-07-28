import { describe, expect, it } from "vitest";
import {
  type Applicability,
  type DocumentStatus,
  type FreshnessState,
  type QueryRisk,
  DEFAULT_STALE_SCORE_MULTIPLIER,
  FRESHNESS_POLICY_LAST_REVIEWED,
  FRESHNESS_POLICY_OWNER,
  FRESHNESS_POLICY_VERSION,
  FRESHNESS_TTL_DAYS,
  FRESHNESS_TTL_MS,
  MAX_CANDIDATES,
  MIN_CANDIDATES,
  RETRIEVAL_ELIGIBLE_STATUSES,
  RETRIEVAL_EXCLUDED_STATUSES,
  STALE_MULTIPLIER_GRID,
  STALE_OVERFETCH_FACTOR,
  SWEEP_BATCH_SIZE,
  candidateLimit,
  classifyFreshness,
  classifyQueryRisk,
  isRetrievalEligibleStatus,
  shouldAbstainOnStaleOnly,
  ttlCutoffMs,
} from "../../convex/shared/freshnessPolicy";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 6, 28, 0, 0, 0); // 2026-07-28T00:00:00Z — fixed for determinism

function dayOffset(days: number): number {
  return NOW - days * MS_PER_DAY;
}

describe("freshnessPolicy — identity", () => {
  it("exposes a stable policy version, owner, and review date", () => {
    expect(FRESHNESS_POLICY_VERSION).toBe("2026-07-staleness-mvp-1");
    expect(typeof FRESHNESS_POLICY_OWNER).toBe("string");
    expect(FRESHNESS_POLICY_OWNER.length).toBeGreaterThan(0);
    expect(FRESHNESS_POLICY_LAST_REVIEWED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("freshnessPolicy — TTL constants", () => {
  it("defines tier TTLs in days exactly as the provisional policy (high 14 / medium 60 / low 180)", () => {
    expect(FRESHNESS_TTL_DAYS).toEqual({ high: 14, medium: 60, low: 180 });
  });

  it("defines tier TTLs in ms that are exactly days*86400000", () => {
    expect(FRESHNESS_TTL_MS.high).toBe(14 * MS_PER_DAY);
    expect(FRESHNESS_TTL_MS.medium).toBe(60 * MS_PER_DAY);
    expect(FRESHNESS_TTL_MS.low).toBe(180 * MS_PER_DAY);
  });

  it("exposes the configurable default multiplier and the ablation grid", () => {
    expect(DEFAULT_STALE_SCORE_MULTIPLIER).toBe(0.3);
    expect(Array.from(STALE_MULTIPLIER_GRID)).toEqual([0, 0.1, 0.3, 0.5, 1.0]);
  });

  it("ttlCutoffMs returns now - ttl for each tier", () => {
    expect(ttlCutoffMs("high", NOW)).toBe(NOW - 14 * MS_PER_DAY);
    expect(ttlCutoffMs("medium", NOW)).toBe(NOW - 60 * MS_PER_DAY);
    expect(ttlCutoffMs("low", NOW)).toBe(NOW - 180 * MS_PER_DAY);
  });
});

describe("freshnessPolicy — candidateLimit (overfetch)", () => {
  it("honours the floor of MIN_CANDIDATES for small k", () => {
    expect(candidateLimit(8)).toBe(30); // 8*3=24 < 30 => floor
    expect(candidateLimit(5)).toBe(30); // 5*3=15 < 30 => floor
    expect(candidateLimit(1)).toBe(30); // 1*3=3  < 30 => floor
  });

  it("scales by STALE_OVERFETCH_FACTOR once k*factor exceeds the floor", () => {
    expect(STALE_OVERFETCH_FACTOR).toBe(3);
    expect(candidateLimit(20)).toBe(60); // 20*3=60 > 30
    expect(candidateLimit(50)).toBe(150); // 50*3=150
  });

  it("caps at MAX_CANDIDATES (256) for large k", () => {
    expect(MAX_CANDIDATES).toBe(256);
    expect(candidateLimit(100)).toBe(256); // 100*3=300 => capped to 256
    expect(candidateLimit(1000)).toBe(256);
  });

  it("never returns below MIN_CANDIDATES even for k=0 or negative", () => {
    expect(MIN_CANDIDATES).toBe(30);
    expect(candidateLimit(0)).toBe(30);
    expect(candidateLimit(-5)).toBe(30);
  });
});

describe("freshnessPolicy — status eligibility", () => {
  it("treats active and indexed as eligible", () => {
    expect(RETRIEVAL_ELIGIBLE_STATUSES).toEqual(["active", "indexed"]);
    expect(isRetrievalEligibleStatus("active")).toBe(true);
    expect(isRetrievalEligibleStatus("indexed")).toBe(true);
  });

  it("hard-excludes stale, failed, pending, processing, pending_embed", () => {
    expect(RETRIEVAL_EXCLUDED_STATUSES).toEqual([
      "stale",
      "failed",
      "pending",
      "processing",
      "pending_embed",
    ]);
    for (const s of RETRIEVAL_EXCLUDED_STATUSES as readonly DocumentStatus[]) {
      expect(isRetrievalEligibleStatus(s)).toBe(false);
    }
  });

  it("treats undefined/null status as eligible (missing handled as unknown-freshness downstream)", () => {
    expect(isRetrievalEligibleStatus(undefined)).toBe(true);
    expect(isRetrievalEligibleStatus(null)).toBe(true);
  });

  it("treats any unrecognized status literal as EXCLUDED (strict: never silently surface unknown states)", () => {
    // Deferred literals (superseded/quarantined/deleted/withdrawn) do not exist
    // in the schema union yet, but if one ever appears we must NOT treat it as
    // eligible by accident. Only active/indexed are eligible; everything else
    // (including unknown strings) is hard-excluded.
    expect(isRetrievalEligibleStatus("superseded")).toBe(false);
    expect(isRetrievalEligibleStatus("quarantined")).toBe(false);
    expect(isRetrievalEligibleStatus("deleted")).toBe(false);
    expect(isRetrievalEligibleStatus("")).toBe(false);
  });
});

describe("freshnessPolicy — classifyFreshness: TTL boundaries", () => {
  it("HIGH tier: 13 days old is fresh, 15 days old is aged", () => {
    const fresh = classifyFreshness({
      status: "active",
      crawledAt: dayOffset(13),
      freshnessTier: "high",
      now: NOW,
    });
    expect(fresh.state).toBe<FreshnessState>("fresh");
    expect(fresh.applicability).toBe<Applicability>("current");
    expect(fresh.eligible).toBe(true);
    expect(fresh.penalized).toBe(false);

    const aged = classifyFreshness({
      status: "indexed",
      crawledAt: dayOffset(15),
      freshnessTier: "high",
      now: NOW,
    });
    expect(aged.state).toBe("aged");
    expect(aged.penalized).toBe(true);
    expect(aged.eligible).toBe(true); // aged but still eligible — penalty, not exclusion
  });

  it("MEDIUM tier: 59 days old is fresh, 61 days old is aged", () => {
    expect(
      classifyFreshness({ status: "active", crawledAt: dayOffset(59), freshnessTier: "medium", now: NOW }).state,
    ).toBe("fresh");
    expect(
      classifyFreshness({ status: "active", crawledAt: dayOffset(61), freshnessTier: "medium", now: NOW }).state,
    ).toBe("aged");
  });

  it("LOW tier: 179 days old is fresh, 181 days old is aged", () => {
    expect(
      classifyFreshness({ status: "indexed", crawledAt: dayOffset(179), freshnessTier: "low", now: NOW }).state,
    ).toBe("fresh");
    expect(
      classifyFreshness({ status: "indexed", crawledAt: dayOffset(181), freshnessTier: "low", now: NOW }).state,
    ).toBe("aged");
  });
});

describe("freshnessPolicy — classifyFreshness: missing / future / unknown", () => {
  it("missing crawledAt => unknown state, never fresh, eligible=true", () => {
    const d = classifyFreshness({ status: "active", now: NOW });
    expect(d.state).toBe("unknown");
    expect(d.applicability).toBe("unknown");
    expect(d.eligible).toBe(true);
    expect(d.penalized).toBe(false);
    expect(d.reason).toContain("missing_crawledAt");
  });

  it("NaN crawledAt => unknown (defensive)", () => {
    const d = classifyFreshness({ status: "active", crawledAt: Number.NaN, now: NOW });
    expect(d.state).toBe("unknown");
  });

  it("future-dated crawledAt is fresh (clock-skew tolerant up to 1 day)", () => {
    const ahead6h = classifyFreshness({
      status: "active",
      crawledAt: NOW + 6 * 60 * 60 * 1000,
      freshnessTier: "high",
      now: NOW,
    });
    expect(ahead6h.state).toBe("fresh");
  });

  it("absurd future (>1 day ahead) is still treated as fresh rather than penalized", () => {
    // We do not punish a source for server clock skew; the worst case is it
    // stays "fresh" until its TTL runs from the future timestamp.
    const ahead2d = classifyFreshness({
      status: "active",
      crawledAt: NOW + 2 * MS_PER_DAY,
      freshnessTier: "high",
      now: NOW,
    });
    expect(ahead2d.state).toBe("fresh");
  });

  it("unknown tier defaults to low (most permissive)", () => {
    const d = classifyFreshness({
      status: "active",
      crawledAt: dayOffset(100), // > high(14) and medium(60), < low(180)
      freshnessTier: undefined,
      now: NOW,
    });
    expect(d.state).toBe("fresh"); // low-tier TTL=180 tolerates 100 days
    expect(d.reason).toContain("tier=low");
  });
});

describe("freshnessPolicy — classifyFreshness: status precedence", () => {
  it("excluded status wins over a recent crawledAt (hard exclusion before scoring)", () => {
    for (const status of RETRIEVAL_EXCLUDED_STATUSES as readonly DocumentStatus[]) {
      const d = classifyFreshness({
        status,
        crawledAt: NOW, // crawled just now — would be fresh otherwise
        freshnessTier: "high",
        now: NOW,
      });
      expect(d.eligible).toBe(false);
      expect(d.state).toBe("unknown");
      expect(d.penalized).toBe(false);
      expect(d.reason).toContain(`excluded_status:${status}`);
    }
  });

  it("isStale:true forces aged+penalized even if crawledAt is recent", () => {
    const d = classifyFreshness({
      status: "active",
      isStale: true,
      crawledAt: NOW, // just now — but explicitly flagged
      freshnessTier: "high",
      now: NOW,
    });
    expect(d.state).toBe("aged");
    expect(d.penalized).toBe(true);
    expect(d.eligible).toBe(true);
    expect(d.reason).toContain("isStale_flagged");
  });

  it("isStale:false + within TTL => fresh (the recrawl-clear happy path)", () => {
    const d = classifyFreshness({
      status: "indexed",
      isStale: false,
      crawledAt: NOW,
      freshnessTier: "high",
      now: NOW,
    });
    expect(d.state).toBe("fresh");
    expect(d.penalized).toBe(false);
  });
});

describe("freshnessPolicy — classifyQueryRisk (deterministic)", () => {
  it("classifies fee/deadline/merit/admission/datesheet/schedule/eligibility as high", () => {
    for (const q of [
      "What is the fee structure?",
      "when is the deadline?",
      "merit list 2026",
      "admissions open?",
      "entry test date",
      "date sheet for bsc",
      "eligibility criteria",
      "how do I apply?",
      "registration last date",
    ]) {
      expect(classifyQueryRisk(q)).toBe<QueryRisk>("high");
    }
  });

  it("classifies faculty/department/contact/programme as medium", () => {
    for (const q of [
      "who is the faculty advisor?",
      "contact the electrical department",
      "tell me about the bs programme",
      "phone number of registrar",
    ]) {
      expect(classifyQueryRisk(q)).toBe<QueryRisk>("medium");
    }
  });

  it("classifies history/about/evergreen queries as low", () => {
    for (const q of [
      "history of UET Taxila",
      "when was the university founded?",
      "campus location",
      "mascot of the university",
    ]) {
      expect(classifyQueryRisk(q)).toBe<QueryRisk>("low");
    }
  });

  it("high beats medium: a query mentioning both fee and department is high", () => {
    expect(classifyQueryRisk("fee for the computer department")).toBe("high");
  });

  it("empty/whitespace query is low (not high)", () => {
    expect(classifyQueryRisk("")).toBe("low");
    expect(classifyQueryRisk("   ")).toBe("low");
  });

  it("is case-insensitive", () => {
    expect(classifyQueryRisk("FEE STRUCTURE")).toBe("high");
    expect(classifyQueryRisk("Admissions")).toBe("high");
  });
});

describe("freshnessPolicy — shouldAbstainOnStaleOnly", () => {
  it("high-impact + no fresh + all aged/unknown => ABSTAIN", () => {
    expect(
      shouldAbstainOnStaleOnly({
        risk: "high",
        anyFreshSource: false,
        allSourcesAgedOrUnknown: true,
      }),
    ).toBe(true);
  });

  it("high-impact + at least one fresh source => do not abstain", () => {
    expect(
      shouldAbstainOnStaleOnly({
        risk: "high",
        anyFreshSource: true,
        allSourcesAgedOrUnknown: false,
      }),
    ).toBe(false);
  });

  it("medium-impact => never force-abstain even if all stale", () => {
    expect(
      shouldAbstainOnStaleOnly({
        risk: "medium",
        anyFreshSource: false,
        allSourcesAgedOrUnknown: true,
      }),
    ).toBe(false);
  });

  it("low-impact => never force-abstain", () => {
    expect(
      shouldAbstainOnStaleOnly({
        risk: "low",
        anyFreshSource: false,
        allSourcesAgedOrUnknown: true,
      }),
    ).toBe(false);
  });

  it("empty result set (no sources) does NOT trigger abstention (handled by prompt rule #2)", () => {
    expect(
      shouldAbstainOnStaleOnly({
        risk: "high",
        anyFreshSource: false,
        allSourcesAgedOrUnknown: false, // zero sources
      }),
    ).toBe(false);
  });
});

describe("freshnessPolicy — sweep batch size", () => {
  it("defines a bounded sweep batch size", () => {
    expect(SWEEP_BATCH_SIZE).toBe(100);
    expect(SWEEP_BATCH_SIZE).toBeGreaterThan(0);
    expect(SWEEP_BATCH_SIZE).toBeLessThanOrEqual(1000); // Convex-friendly
  });
});
