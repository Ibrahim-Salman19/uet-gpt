import { createCerebras } from "@ai-sdk/cerebras";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { type LanguageModel, streamText } from "ai";
import { ConvexError } from "convex/values";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY || "" });
const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY || "" });
const cerebras = createCerebras({ apiKey: process.env.CEREBRAS_API_KEY || "" });

function modelName(model: LanguageModel | string): string {
  if (typeof model === "string") return model;
  if (model?.modelId) return model.modelId;
  return String(model);
}

export async function robustStreamText(
  models: LanguageModel[],
  options: Omit<Parameters<typeof streamText>[0], "model">,
) {
  const errors: Error[] = [];
  for (const model of models) {
    try {
      console.log(`Attempting RAG stream with model: ${modelName(model)}`);
      const result = streamText({ ...options, model } as Parameters<typeof streamText>[0]);

      const reader = result.textStream.getReader();
      const first = await reader.read();

      const textStream = new ReadableStream({
        async start(controller) {
          if (!first.done && first.value !== undefined) {
            controller.enqueue(first.value);
          }
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              controller.enqueue(value);
            }
          } catch (e) {
            controller.error(e);
          } finally {
            reader.releaseLock();
          }
        },
        cancel() {
          reader.cancel();
          reader.releaseLock();
        },
      });

      Object.defineProperty(result, "textStream", {
        value: textStream,
        writable: true,
        configurable: true,
      });

      return { result, model };
    } catch (error) {
      console.warn(`Model ${modelName(model)} handshake failed:`, error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }
  }
  throw new ConvexError({
    code: "LLM_UNAVAILABLE",
    message: `All LLM providers failed. Errors: ${errors.map((e) => e.message).join("; ")}`,
  });
}

export function getFallbackModels() {
  const models: LanguageModel[] = [];

  if (process.env.GROQ_API_KEY) {
    models.push(groq("meta-llama/llama-4-scout-17b-16e-instruct"));
  }

  if (process.env.CEREBRAS_API_KEY) {
    models.push(cerebras("llama-3.3-70b"));
  }

  if (process.env.GROQ_API_KEY) {
    models.push(groq("llama-3.1-8b-instant"));
  }

  if (process.env.GEMINI_API_KEY) {
    models.push(google("gemini-1.5-flash"));
  }

  return models;
}
