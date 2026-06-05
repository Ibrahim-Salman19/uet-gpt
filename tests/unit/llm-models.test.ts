import { describe, expect, it } from "vitest";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";
import { getModelPriorities } from "../integration/helpers";

describe("LLM Fallback Chain", () => {
  it("exports a static array with all 4 models in priority order", () => {
    expect(LLM_FALLBACK_CHAIN).toHaveLength(4);
    expect(LLM_FALLBACK_CHAIN[0]!.id).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(LLM_FALLBACK_CHAIN[0]!.provider).toBe("groq");
    expect(LLM_FALLBACK_CHAIN[1]!.id).toBe("gpt-oss-120b");
    expect(LLM_FALLBACK_CHAIN[1]!.provider).toBe("cerebras");
    expect(LLM_FALLBACK_CHAIN[2]!.id).toBe("llama-3.1-8b-instant");
    expect(LLM_FALLBACK_CHAIN[2]!.provider).toBe("groq");
    expect(LLM_FALLBACK_CHAIN[3]!.id).toBe("gemini-2.5-flash");
    expect(LLM_FALLBACK_CHAIN[3]!.provider).toBe("google");
  });

  it("getModelPriorities includes models whose env vars are set", () => {
    const ORIGINAL = { ...process.env };
    process.env.GROQ_API_KEY = "test_groq";
    process.env.CEREBRAS_API_KEY = "test_cerebras";
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain = getModelPriorities();

    expect(chain.length).toBeGreaterThanOrEqual(3);
    expect(chain).toContain("meta-llama/llama-4-scout");
    expect(chain).toContain("cerebras-llama-3.3-70b");
    expect(chain).toContain("gemini-1.5-flash");

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
