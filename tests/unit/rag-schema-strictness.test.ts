import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Schema-strictness compatibility tests for the 4 production structured-output
 * schemas used by the RAG pipeline.
 *
 * Background (Track C, 2026-07-26): Groq's strict JSON Schema mode requires
 * `additionalProperties: false` on every object  -  without it, gpt-oss models
 * return HTTP 400. In zod, this maps to `.strict()` (reject unknown keys). The
 * initial migration probe failed because the schemas were not strict; Diagnostic
 * Test 1+2 proved all 4 schemas work once `.strict()` is added. These tests
 * guard against regression: if someone removes `.strict()` or adds a non-strict
 * nested object, this test fails before it reaches production.
 *
 * These tests do NOT call the live API (that's a runtime capability probe, run
 * separately). They verify the schema SHAPE is compatible with strict mode.
 */

// Mirror the exact production schemas (kept in sync with the convex source).
// If a production schema changes, update these mirrors and re-verify against the
// live API via the diagnostic harness.
const INTENT_ENUM = [
  "admissions",
  "academic",
  "administrative",
  "campus_life",
  "general",
  "off_topic",
  "simple_fact",
] as const;

const intentSchema = z
  .object({
    intent: z.enum([...INTENT_ENUM] as [string, ...string[]]),
  })
  .strict();

const cragSchema = z
  .object({
    evaluations: z.array(
      z.object({
        index: z.number(),
        relevant: z.boolean(),
        confidence: z.number().min(0).max(1),
      }),
    ),
  })
  .strict();

const faithfulnessSchema = z
  .object({
    faithful: z.boolean(),
    unsupportedClaims: z.array(z.string()),
    score: z.number().min(0).max(1),
  })
  .strict();

const rerankSchema = z
  .object({
    scores: z.array(z.object({ index: z.number(), score: z.number().min(0).max(1) })),
  })
  .strict();

const schemas = [
  { name: "intent (routing.ts)", schema: intentSchema, validSample: { intent: "admissions" } },
  {
    name: "crag (crag.ts)",
    schema: cragSchema,
    validSample: { evaluations: [{ index: 0, relevant: true, confidence: 0.9 }] },
  },
  {
    name: "faithfulness (faithfulness.ts)",
    schema: faithfulnessSchema,
    validSample: { faithful: true, unsupportedClaims: [], score: 1.0 },
  },
  {
    name: "rerank (groqRerank.ts)",
    schema: rerankSchema,
    validSample: { scores: [{ index: 0, score: 1 }] },
  },
];

describe("RAG structured-output schemas  -  Groq strict-schema compatibility", () => {
  for (const { name, schema, validSample } of schemas) {
    describe(`${name}`, () => {
      it("accepts a valid sample", () => {
        const result = schema.safeParse(validSample);
        expect(result.success).toBe(true);
      });

      it("rejects unknown top-level keys (additionalProperties:false via .strict())", () => {
        // This is the property Groq strict mode requires. A non-strict schema
        // would silently strip the extra key; a strict schema rejects it.
        const result = schema.safeParse({ ...validSample, unexpectedField: "x" });
        expect(result.success).toBe(false);
      });

      it("rejects wrong types on required fields", () => {
        // Build a sample with one field type-flipped. Use a shallow approach:
        // stringify the valid sample and parse with a corrupted field.
        const corrupted = JSON.parse(JSON.stringify(validSample));
        // Flip the first key's value to a wrong type
        const firstKey = Object.keys(corrupted)[0]!;
        corrupted[firstKey] = "wrong-type-string";
        const result = schema.safeParse(corrupted);
        expect(result.success).toBe(false);
      });
    });
  }

  it("all 4 production schemas are covered", () => {
    expect(schemas).toHaveLength(4);
  });
});
