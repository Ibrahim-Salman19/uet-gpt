// Deterministic Conflict Detector for UETGPT RAG Pipeline

export type ConflictClass =
  | "EXACT_CONFLICT"
  | "SESSION_DIFFERENCE"
  | "TEMPORAL_VERSION_DIFFERENCE"
  | "UNIT_DIFFERENCE"
  | "AUTHORITY_DIFFERENCE"
  | "PARTIAL_CONFLICT"
  | "RESOLVED_CONFLICT"
  | "UNRESOLVED_CRITICAL_CONFLICT";

export interface FactPayload {
  id: string;
  sourceVersionId: string;
  type: string;
  subject: string;
  rawText: string;
  session?: string;
  authority?: "official_primary" | "official_secondary" | "official_archive" | string;
}

export interface DetectedConflict {
  conflictClass: ConflictClass;
  subject: string;
  factA: FactPayload;
  factB: FactPayload;
  normalizedA: string;
  normalizedB: string;
  isCritical: boolean;
}

/**
 * Normalizes currency strings like 'PKR 5,000' or 'Rs. 5000' to numeric value string.
 */
export function normalizeCurrency(text: string): string | null {
  const match = text.match(/(?:PKR|Rs\.?|Rupees)\s*([\d,]+)/i);
  if (match && match[1]) {
    return match[1].replace(/,/g, "");
  }
  return null;
}

/**
 * Normalizes date strings like '31 July 2026' or '2026-07-31' to YYYY-MM-DD.
 */
export function normalizeDate(text: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
    return text.trim();
  }
  const match = text.match(
    /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
  );
  if (match) {
    const day = match[1]!.padStart(2, "0");
    const months: Record<string, string> = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    const month = months[match[2]!.toLowerCase()];
    const year = match[3]!;
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Normalizes percentage strings like '80%' or '0.80' to standard fraction format.
 */
export function normalizePercentage(text: string): string | null {
  const pctMatch = text.match(/([\d.]+)\s*%/);
  if (pctMatch && pctMatch[1]) {
    return (parseFloat(pctMatch[1]) / 100).toFixed(2);
  }
  const fracMatch = text.match(/0\.\d+/);
  if (fracMatch) {
    return parseFloat(fracMatch[0]).toFixed(2);
  }
  return null;
}

/**
 * Detects conflicts between two fact payloads.
 */
export function detectFactConflict(a: FactPayload, b: FactPayload): DetectedConflict | null {
  if (a.subject.toLowerCase() !== b.subject.toLowerCase() || a.type !== b.type) {
    return null;
  }

  // Session check first
  if (a.session && b.session && a.session !== b.session) {
    return {
      conflictClass: "SESSION_DIFFERENCE",
      subject: a.subject,
      factA: a,
      factB: b,
      normalizedA: a.rawText,
      normalizedB: b.rawText,
      isCritical: false, // Different sessions are not contradictions
    };
  }

  // Attempt value normalization based on type
  let normA: string | null = null;
  let normB: string | null = null;

  if (a.type === "fee_amount") {
    normA = normalizeCurrency(a.rawText);
    normB = normalizeCurrency(b.rawText);
  } else if (a.type === "deadline" || a.type === "entry_test_date" || a.type === "exam_date") {
    normA = normalizeDate(a.rawText);
    normB = normalizeDate(b.rawText);
  } else if (a.type === "percentage" || a.type === "merit_value") {
    normA = normalizePercentage(a.rawText);
    normB = normalizePercentage(b.rawText);
  }

  const valA = normA ?? a.rawText.trim();
  const valB = normB ?? b.rawText.trim();

  if (valA === valB) {
    return null; // No conflict
  }

  // Values differ on the same subject & same session -> UNRESOLVED_CRITICAL_CONFLICT
  return {
    conflictClass: "UNRESOLVED_CRITICAL_CONFLICT",
    subject: a.subject,
    factA: a,
    factB: b,
    normalizedA: valA,
    normalizedB: valB,
    isCritical: true,
  };
}
