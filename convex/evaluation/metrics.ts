export interface MetricResult {
  recallAtK: number;
  mrr: number;
  citationCorrectness: number;
  unsupportedClaimRate: number;
  groundednessScore: number;
}

export function calculateRecallAtK(retrievedDocIds: string[], groundTruthDocIds: string[]): number {
  if (groundTruthDocIds.length === 0) return 1.0;
  const matches = groundTruthDocIds.filter((id) => retrievedDocIds.includes(id));
  return matches.length / groundTruthDocIds.length;
}

export function calculateMRR(retrievedDocIds: string[], groundTruthDocIds: string[]): number {
  if (groundTruthDocIds.length === 0) return 1.0;
  for (let i = 0; i < retrievedDocIds.length; i++) {
    const id = retrievedDocIds[i];
    if (id && groundTruthDocIds.includes(id)) {
      return 1.0 / (i + 1);
    }
  }
  return 0.0;
}

export function calculateCitationCorrectness(
  citedUrls: string[],
  approvedHosts: string[] = ["uet.edu.pk", "uettaxila.edu.pk"],
): number {
  if (citedUrls.length === 0) return 1.0;
  let valid = 0;
  for (const urlStr of citedUrls) {
    try {
      const parsed = new URL(urlStr);
      const host = parsed.hostname.toLowerCase();
      if (approvedHosts.some((approved) => host === approved || host.endsWith(`.${approved}`))) {
        valid += 1;
      }
    } catch {
      // Invalid URL syntax
    }
  }
  return valid / citedUrls.length;
}

export function calculateUnsupportedClaimRate(
  claims: Array<{ text: string; supportedByEvidence: boolean }>,
): number {
  if (claims.length === 0) return 0.0;
  const unsupported = claims.filter((c) => !c.supportedByEvidence).length;
  return unsupported / claims.length;
}

export function computeEvaluationMetrics(params: {
  retrievedDocIds: string[];
  groundTruthDocIds: string[];
  citedUrls: string[];
  claims: Array<{ text: string; supportedByEvidence: boolean }>;
}): MetricResult {
  const recallAtK = calculateRecallAtK(params.retrievedDocIds, params.groundTruthDocIds);
  const mrr = calculateMRR(params.retrievedDocIds, params.groundTruthDocIds);
  const citationCorrectness = calculateCitationCorrectness(params.citedUrls);
  const unsupportedClaimRate = calculateUnsupportedClaimRate(params.claims);
  const groundednessScore = Math.max(0, 1.0 - unsupportedClaimRate);

  return {
    recallAtK,
    mrr,
    citationCorrectness,
    unsupportedClaimRate,
    groundednessScore,
  };
}
