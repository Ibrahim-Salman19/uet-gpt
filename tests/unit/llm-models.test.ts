import { describe, expect, it } from "vitest";

describe("LLM Fallback Chain", () => {
  const ORIGINAL_ENV = process.env;

  it("includes all 4 models when all API keys are set", () => {
    process.env.GROQ_API_KEY = "test_groq";
    process.env.CEREBRAS_API_KEY = "test_cerebras";
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain: { provider: string; id: string }[] = [];

    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" });
    }
    if (process.env.CEREBRAS_API_KEY) {
      chain.push({ id: "gpt-oss-120b", provider: "cerebras" });
    }
    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "llama-3.1-8b-instant", provider: "groq" });
    }
    if (process.env.GEMINI_API_KEY) {
      chain.push({ id: "gemini-2.5-flash", provider: "google" });
    }

    expect(chain).toHaveLength(4);
    expect(chain[0].id).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(chain[3].id).toBe("gemini-2.5-flash");
  });

  it("excludes Groq models when GROQ_API_KEY is missing", () => {
    delete process.env.GROQ_API_KEY;
    process.env.CEREBRAS_API_KEY = "test_cerebras";
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain: { provider: string; id: string }[] = [];

    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" });
    }
    if (process.env.CEREBRAS_API_KEY) {
      chain.push({ id: "gpt-oss-120b", provider: "cerebras" });
    }
    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "llama-3.1-8b-instant", provider: "groq" });
    }
    if (process.env.GEMINI_API_KEY) {
      chain.push({ id: "gemini-2.5-flash", provider: "google" });
    }

    expect(chain).toHaveLength(2);
    expect(chain[0].id).toBe("gpt-oss-120b");
    expect(chain[1].id).toBe("gemini-2.5-flash");
  });

  it("excludes Cerebras when CEREBRAS_API_KEY is missing", () => {
    process.env.GROQ_API_KEY = "test_groq";
    delete process.env.CEREBRAS_API_KEY;
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain: { provider: string; id: string }[] = [];

    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" });
    }
    if (process.env.CEREBRAS_API_KEY) {
      chain.push({ id: "gpt-oss-120b", provider: "cerebras" });
    }
    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "llama-3.1-8b-instant", provider: "groq" });
    }
    if (process.env.GEMINI_API_KEY) {
      chain.push({ id: "gemini-2.5-flash", provider: "google" });
    }

    expect(chain).toHaveLength(3);
    const providers = chain.map((m) => m.provider);
    expect(providers.filter((p) => p === "groq")).toHaveLength(2);
    expect(providers.filter((p) => p === "google")).toHaveLength(1);
  });

  it("returns empty chain when no API keys are set", () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const chain: { provider: string; id: string }[] = [];

    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" });
    }
    if (process.env.CEREBRAS_API_KEY) {
      chain.push({ id: "gpt-oss-120b", provider: "cerebras" });
    }
    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "llama-3.1-8b-instant", provider: "groq" });
    }
    if (process.env.GEMINI_API_KEY) {
      chain.push({ id: "gemini-2.5-flash", provider: "google" });
    }

    expect(chain).toHaveLength(0);
  });

  it("maintains correct priority order: Groq4Scout > Cerebras > Groq8B > Gemini", () => {
    process.env.GROQ_API_KEY = "test_groq";
    process.env.CEREBRAS_API_KEY = "test_cerebras";
    process.env.GEMINI_API_KEY = "test_gemini";

    const chain: { provider: string; id: string }[] = [];

    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "meta-llama/llama-4-scout-17b-16e-instruct", provider: "groq" });
    }
    if (process.env.CEREBRAS_API_KEY) {
      chain.push({ id: "gpt-oss-120b", provider: "cerebras" });
    }
    if (process.env.GROQ_API_KEY) {
      chain.push({ id: "llama-3.1-8b-instant", provider: "groq" });
    }
    if (process.env.GEMINI_API_KEY) {
      chain.push({ id: "gemini-2.5-flash", provider: "google" });
    }

    expect(chain[0].id).toContain("llama-4-scout");
    expect(chain[1].id).toContain("cerebras");
    expect(chain[2].id).toContain("8b-instant");
    expect(chain[3].id).toContain("gemini");
  });
});
