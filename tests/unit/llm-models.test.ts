import { describe, expect, it } from "vitest";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";
import { getModelPriorities } from "../integration/helpers";

describe("LLM Fallback Chain", () => {
  it("exports a static array with all 6 models in priority order", () => {
    expect(LLM_FALLBACK_CHAIN).toHaveLength(6);
    // Groq primary (2): 70b workhorse + 8b fast
    expect(LLM_FALLBACK_CHAIN[0]!.id).toBe("llama-3.3-70b-versatile");
    expect(LLM_FALLBACK_CHAIN[0]!.provider).toBe("groq");
    expect(LLM_FALLBACK_CHAIN[1]!.id).toBe("llama-3.1-8b-instant");
    expect(LLM_FALLBACK_CHAIN[1]!.provider).toBe("groq");
    // Cerebras secondary (2): gemma + gpt-oss
    expect(LLM_FALLBACK_CHAIN[2]!.id).toBe("gemma-4-31b");
    expect(LLM_FALLBACK_CHAIN[2]!.provider).toBe("cerebras");
    expect(LLM_FALLBACK_CHAIN[3]!.id).toBe("gpt-oss-120b");
    expect(LLM_FALLBACK_CHAIN[3]!.provider).toBe("cerebras");
    // Google tertiary (2): newest free-tier flash-lite + backup
    expect(LLM_FALLBACK_CHAIN[4]!.id).toBe("gemini-3.5-flash-lite");
    expect(LLM_FALLBACK_CHAIN[4]!.provider).toBe("google");
    expect(LLM_FALLBACK_CHAIN[5]!.id).toBe("gemini-3.1-flash-lite");
    expect(LLM_FALLBACK_CHAIN[5]!.provider).toBe("google");
  });

  it("getModelPriorities includes models whose env vars are set", () => {
    const ORIGINAL = { ...process.env };
    process.env.GROQ_API_KEY = "test_groq";
    process.env.CEREBRAS_API_KEY = "test_cerebras";
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain = getModelPriorities();

    expect(chain.length).toBeGreaterThanOrEqual(3);
    expect(chain).toContain("llama-3.3-70b-versatile");
    expect(chain).toContain("gpt-oss-120b");
    expect(chain).toContain("gemini-3.5-flash-lite");

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
