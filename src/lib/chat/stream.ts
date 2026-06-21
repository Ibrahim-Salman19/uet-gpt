import { type LanguageModel, streamText } from "ai";

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

function finalizeStream(
  buffer: string,
  accumulatedText: string,
  onFinish: ((text: string, model: string) => void) | undefined,
  reader: ReadableStreamDefaultReader<string>,
  controller: ReadableStreamDefaultController,
  model: LanguageModel,
) {
  if (buffer && !buffer.startsWith("<")) {
    controller.enqueue(buffer);
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
            finalizeStream(buf.current, accumulated.current, onFinish, reader, controller, model);
            break;
          }
          processChunk(value, buf, accumulated, state, controller);
        }
      } catch (e) {
        console.error("Stream interrupted:", e);
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

function resolveTemperature(model: LanguageModel, defaultTemp: number): number {
  const isReasoningModel = (model as { modelId?: string }).modelId === "gpt-oss-120b";
  return isReasoningModel ? 1.0 : defaultTemp;
}

async function tryModelWithFallback(
  model: LanguageModel,
  config: {
    system: string;
    messages: unknown[];
    temperature: number;
    maxOutputTokens: number;
    onFinish?: (text: string, model: string) => void;
  },
) {
  const resolvedTemp = resolveTemperature(model, config.temperature);

  const result = streamText({
    model,
    system: config.system,
    messages: config.messages,
    temperature: resolvedTemp,
    maxOutputTokens: config.maxOutputTokens,
  } as Parameters<typeof streamText>[0]);

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

export async function tryStreamWithFallback(
  models: LanguageModel[],
  config: {
    system: string;
    messages: unknown[];
    temperature: number;
    maxOutputTokens: number;
    onFinish?: (text: string, model: string) => void;
  },
) {
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
