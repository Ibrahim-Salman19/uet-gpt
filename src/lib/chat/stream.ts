import { type LanguageModel, type ModelMessage, streamText } from "ai";
import { LLM_FALLBACK_CHAIN } from "@/lib/llm-models";

type StreamConfig = {
  system: string;
  messages: ModelMessage[];
  temperature: number;
  maxOutputTokens: number;
  onFinish?: (text: string, model: string) => void;
};

function flushTextFn(
  text: string,
  controller: ReadableStreamDefaultController,
  accumulated: { current: string },
) {
  if (!text) return;
  controller.enqueue(text);
  accumulated.current += text;
}

function getModelName(model: LanguageModel): string {
  const m = model as { modelId?: string; provider?: string };
  return m.modelId || m.provider || "unknown";
}

// A leftover buffer is only a real in-progress think-tag if it is a strict
// prefix of "<think>"/"</think>". Arbitrary trailing text that merely starts
// with "<" (e.g. an inequality `x < `, a generic `<T>`, or truncated markup) is
// legitimate answer content and must NOT be dropped.
function isPartialThinkTag(buffer: string): boolean {
  return "<think>".startsWith(buffer) || "</think>".startsWith(buffer);
}

function finalizeStream(
  buffer: string,
  accumulatedText: string,
  onFinish: ((text: string, model: string) => void) | undefined,
  controller: ReadableStreamDefaultController,
  model: LanguageModel,
) {
  if (buffer && !isPartialThinkTag(buffer)) {
    controller.enqueue(buffer);
    accumulatedText += buffer;
  }
  controller.close();
  if (onFinish) {
    onFinish(accumulatedText, getModelName(model));
  }
}

function processChunk(
  value: string,
  buffer: { current: string },
  accumulated: { current: string },
  state: { isThinking: boolean },
  controller: ReadableStreamDefaultController,
) {
  let remaining = buffer.current + value;
  buffer.current = "";

  while (remaining.length > 0) {
    if (state.isThinking) {
      const partialCloseMatch = remaining.match(/<\/t?h?i?n?k?>?$/);
      if (partialCloseMatch) {
        buffer.current = remaining.substring(partialCloseMatch.index!);
        remaining = remaining.substring(0, partialCloseMatch.index!);
        if (remaining.length === 0) break;
      }

      const closeIdx = remaining.indexOf("</think>");
      if (closeIdx === -1) {
        remaining = "";
      } else {
        state.isThinking = false;
        remaining = remaining.substring(closeIdx + 8);
      }
    } else {
      const partialOpenMatch = remaining.match(/<t?h?i?n?k?>?$/);
      if (partialOpenMatch) {
        buffer.current = remaining.substring(partialOpenMatch.index!);
        remaining = remaining.substring(0, partialOpenMatch.index!);
        if (remaining.length === 0) break;
      }

      const openIdx = remaining.indexOf("<think>");
      if (openIdx === -1) {
        flushTextFn(remaining, controller, accumulated);
        remaining = "";
      } else {
        const before = remaining.substring(0, openIdx);
        flushTextFn(before, controller, accumulated);
        state.isThinking = true;
        remaining = remaining.substring(openIdx + 7);
      }
    }
  }
}

function streamWithStrippedThinking(
  reader: ReadableStreamDefaultReader<string>,
  model: LanguageModel,
  state: { isThinking: boolean },
  onFinish?: (text: string, model: string) => void,
): ReadableStream<string> {
  return new ReadableStream({
    async start(controller) {
      const accumulated = { current: "" };
      const buf = { current: "" };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            finalizeStream(buf.current, accumulated.current, onFinish, controller, model);
            break;
          }
          processChunk(value, buf, accumulated, state, controller);
        }
      } catch (e) {
        // NOTE: fallback to the next model is only possible before/at the first
        // token (see tryStreamWithFallback). Once streaming has started the model
        // is committed, so a mid-stream provider failure surfaces an inline error
        // rather than retrying. We deliberately do NOT call onFinish here, so a
        // truncated/error answer is never written to the semantic cache.
        console.error(`Stream interrupted (model: ${getModelName(model)}):`, e);
        controller.enqueue("\n\n[Error: Connection to AI provider lost mid-stream]");
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}

// Reasoning models require temperature 1.0 (they reject/ignore lower values).
const REASONING_TEMPERATURE = 1.0;

function isReasoningModel(modelId: string): boolean {
  return LLM_FALLBACK_CHAIN.some((c) => c.id === modelId && c.isReasoning);
}

function resolveTemperature(model: LanguageModel, defaultTemp: number): number {
  const m = model as { modelId?: string; model?: string };
  const id = m.modelId ?? m.model;
  return id && isReasoningModel(id) ? REASONING_TEMPERATURE : defaultTemp;
}

async function tryModelWithFallback(model: LanguageModel, config: StreamConfig) {
  const resolvedTemp = resolveTemperature(model, config.temperature);

  const result = streamText({
    model,
    system: config.system,
    messages: config.messages,
    temperature: resolvedTemp,
    maxOutputTokens: config.maxOutputTokens,
  });

  const reader = result.textStream.getReader();

  const { done, value } = await reader.read();

  const textStream = new ReadableStream<string>({
    async start(controller) {
      if (!done && value) {
        controller.enqueue(value);
      }
      try {
        while (true) {
          const { done: d, value: val } = await reader.read();
          if (d) break;
          controller.enqueue(val);
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        reader.releaseLock();
      }
    },
  });

  const state = { isThinking: false };
  const strippedStream = streamWithStrippedThinking(
    textStream.getReader(),
    model,
    state,
    config.onFinish,
  );

  return new Proxy(result, {
    get(target, prop, receiver) {
      if (prop === "textStream") {
        return strippedStream;
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return value.bind(receiver);
      }
      return value;
    },
  });
}

export async function tryStreamWithFallback(models: LanguageModel[], config: StreamConfig) {
  let lastError: unknown;
  for (const model of models) {
    try {
      return await tryModelWithFallback(model, config);
    } catch (error) {
      console.warn("Model failed, trying fallback:", error);
      lastError = error;
    }
  }
  throw lastError || new Error("All LLM providers failed");
}
