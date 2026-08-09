import { describe, expect, it } from "vitest";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";
import { getModelPriorities } from "../integration/helpers";

describe("LLM Fallback Chain", () => {
  it("exports a static array with fallback models in priority order", () => {
    expect(LLM_FALLBACK_CHAIN).toHaveLength(6);
    expect(LLM_FALLBACK_CHAIN[0]!.id).toBe("openai/gpt-oss-120b");
    expect(LLM_FALLBACK_CHAIN[0]!.provider).toBe("groq");
    expect(LLM_FALLBACK_CHAIN[1]!.id).toBe("openai/gpt-oss-20b");
    expect(LLM_FALLBACK_CHAIN[1]!.provider).toBe("groq");
  });

  it("getModelPriorities includes models whose env vars are set", () => {
    const ORIGINAL = { ...process.env };
    process.env.GROQ_API_KEY = "test_groq";
    process.env.CEREBRAS_API_KEY = "test_cerebras";
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain = getModelPriorities();

    expect(chain.length).toBeGreaterThanOrEqual(3);
    expect(chain).toContain("openai/gpt-oss-120b");
    expect(chain).toContain("openai/gpt-oss-20b");

    Object.assign(process.env, ORIGINAL);
  });

  it("getModelPriorities returns empty when no keys set", () => {
    const ORIGINAL = { ...process.env };
    delete process.env.GROQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const chain = getModelPriorities();
    expect(chain).toHaveLength(0);

    Object.assign(process.env, ORIGINAL);
  });
});
