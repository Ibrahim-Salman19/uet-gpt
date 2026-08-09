import { v } from "convex/values";
import { action } from "../_generated/server";

export type QueryLanguage = "english" | "urdu" | "roman_urdu" | "mixed";

export type QueryIntent =
  | "admissions"
  | "fees"
  | "merit"
  | "eligibility"
  | "entry_test"
  | "examinations"
  | "programs"
  | "departments"
  | "faculty"
  | "campus_life"
  | "historical"
  | "general"
  | "off_topic";

export type TemporalIntent = "current" | "historical" | "session_specific" | "timeless" | "unknown";

export type QueryRisk =
  | "high_current"
  | "medium_current"
  | "low_current"
  | "historical"
  | "general";

export type CriticalFactType =
  | "fee_amount"
  | "deadline"
  | "merit_value"
  | "eligibility_requirement"
  | "entry_test_date"
  | "exam_date"
  | "schedule_time"
  | "required_document";

export interface QueryUnderstanding {
  language: QueryLanguage;
  intent: QueryIntent;
  temporalIntent: TemporalIntent;
  risk: QueryRisk;
  requestedSession?: string;
  requestedYear?: number;
  criticalFactTypes: CriticalFactType[];
  rewrittenQuery: string;
  preserveTerms: string[];
}

export function classifyQueryRuleBased(queryText: string): QueryUnderstanding {
  const lower = queryText.toLowerCase();

  // Extract explicit historical year (e.g., 2020)
  const yearMatch = lower.match(/\b(19\d\d|20[0-1]\d|202[0-4])\b/);
  const isHistorical =
    yearMatch !== null ||
    lower.includes("historical") ||
    lower.includes("previous year") ||
    lower.includes("past");
  const requestedYear = yearMatch && yearMatch[1] ? parseInt(yearMatch[1], 10) : undefined;

  const isHighRiskTerm =
    !isHistorical &&
    (lower.includes("fee") ||
      lower.includes("deadline") ||
      lower.includes("closing date") ||
      lower.includes("merit") ||
      lower.includes("entry test") ||
      lower.includes("admission schedule") ||
      lower.includes("eligibility") ||
      lower.includes("date sheet"));

  let risk: QueryRisk = "general";
  if (isHistorical) {
    risk = "historical";
  } else if (isHighRiskTerm) {
    risk = "high_current";
  }

  let intent: QueryIntent = "general";
  if (isHistorical) intent = "historical";
  else if (lower.includes("fee")) intent = "fees";
  else if (lower.includes("merit")) intent = "merit";
  else if (lower.includes("entry test") || lower.includes("ecat")) intent = "entry_test";
  else if (lower.includes("admission")) intent = "admissions";
  else if (lower.includes("exam") || lower.includes("date sheet")) intent = "examinations";

  const criticalFactTypes: CriticalFactType[] = [];
  if (lower.includes("fee")) criticalFactTypes.push("fee_amount");
  if (lower.includes("deadline") || lower.includes("last date")) criticalFactTypes.push("deadline");
  if (lower.includes("merit")) criticalFactTypes.push("merit_value");
  if (lower.includes("entry test") || lower.includes("exam"))
    criticalFactTypes.push("entry_test_date", "exam_date");

  let language: QueryLanguage = "english";
  if (/[\u0600-\u06FF]/.test(queryText)) {
    language = "urdu";
  } else if (
    lower.includes("kya") ||
    lower.includes("kab") ||
    lower.includes("kaise") ||
    lower.includes("hai")
  ) {
    language = "roman_urdu";
  }

  let temporalIntent: TemporalIntent = "timeless";
  if (isHistorical) {
    temporalIntent = "historical";
  } else if (isHighRiskTerm) {
    temporalIntent = "current";
  }

  return {
    language,
    intent,
    temporalIntent,
    risk,
    requestedYear,
    criticalFactTypes,
    rewrittenQuery: queryText.trim(),
    preserveTerms: [],
  };
}

export const understandQueryAction = action({
  args: {
    queryText: v.string(),
  },
  handler: async (_ctx, args) => {
    return classifyQueryRuleBased(args.queryText);
  },
});
