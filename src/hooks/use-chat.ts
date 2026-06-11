"use client";

import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Source } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { streamRegistry } from "./stream-registry";

const CHAT_TIMEOUT_MS = 45_000;

function parseSourcesHeader(headers: Headers): Source[] {
  const sourcesHeader = headers.get("X-Sources");
  if (!sourcesHeader) return [];
  try {
    const binary = atob(sourcesHeader);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) {
    console.error("Failed to parse X-Sources header:", e);
    return [];
  }
}

async function readStreamBody(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
): Promise<string> {
  const decoder = new TextDecoder();
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    accumulated += chunk;
    onChunk(accumulated);
  }
  return accumulated;
}

async function insertUserMessage(
  insertMutation: any,
  threadId: string,
  content: string,
): Promise<void> {
  await insertMutation({ threadId, role: "user", content: content.trim() });
}

async function fetchChatResponse(
  threadId: string,
  convex: any,
  abortSignal: AbortSignal,
): Promise<{ response: Response; sources: any[] }> {
  const dbMessages = await convex.query(api.messages.list, { threadId });
  const formattedMessages = dbMessages.map((msg: any) => ({
    role: msg.role,
    content: msg.content,
  }));

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: formattedMessages }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate response");
  }

  const sources = parseSourcesHeader(response.headers);
  return { response, sources };
}

async function saveAssistantMessage(
  insertMutation: any,
  threadId: string,
  text: string,
  sources: any[],
): Promise<void> {
  if (!text.trim()) return;
  await insertMutation({
    threadId,
    role: "assistant",
    content: text,
    sources: sources && sources.length > 0 ? sources : undefined,
  });
}

type StreamResult = { ok: true } | { ok: false; error: string | "aborted" };

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Failed to send message";
}

async function executeStreamPhase(
  threadId: string,
  content: string,
  insertMutation: any,
  convex: any,
  abortController: AbortController,
): Promise<StreamResult> {
  const timeoutId = setTimeout(() => {
    if (abortController.signal.aborted) return;
    abortController.abort();
    toast.error("Response took too long. Please try again.");
  }, CHAT_TIMEOUT_MS);
  try {
    await insertUserMessage(insertMutation, threadId, content);
    const { response, sources } = await fetchChatResponse(threadId, convex, abortController.signal);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body reader available");
    streamRegistry.update(threadId, "", sources);
    const accumulatedText = await readStreamBody(reader, (text) => {
      streamRegistry.update(threadId, text, sources);
    });
    await saveAssistantMessage(insertMutation, threadId, accumulatedText, sources);
    return { ok: true };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { ok: false, error: "aborted" };
    }
    return { ok: false, error: getErrorMessage(err) };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function useChat(threadId: string | undefined) {
  const convex = useConvex();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastMessageRef = useRef<string>("");
  const isLoadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamGenerationRef = useRef(0);

  const insertMutation = useMutation(api.messages.insert);

  // Abort any in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  function shouldSkipSend(content: string, threadId: string | undefined): boolean {
    return !content.trim() || !threadId || isLoadingRef.current;
  }

  function cleanupStreamState(threadId: string, generation: number): void {
    if (streamGenerationRef.current === generation) {
      streamRegistry.update(threadId, "", []);
    }
    abortControllerRef.current = null;
    isLoadingRef.current = false;
    setIsLoading(false);
  }

  const handleSend = useCallback(
    async (content: string) => {
      if (shouldSkipSend(content, threadId) || !threadId) return;

      isLoadingRef.current = true;
      setIsLoading(true);
      setError(null);
      lastMessageRef.current = content.trim();
      streamGenerationRef.current += 1;
      const generation = streamGenerationRef.current;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const result = await executeStreamPhase(
        threadId,
        content,
        insertMutation,
        convex,
        abortController,
      );

      if (!result.ok && result.error !== "aborted") {
        setError(result.error);
        toast.error(result.error);
      }

      cleanupStreamState(threadId, generation);
    },
    [threadId, insertMutation, convex],
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    isLoadingRef.current = false;
    setIsLoading(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    if (lastMessageRef.current) {
      handleSend(lastMessageRef.current);
    }
  }, [handleSend]);

  return {
    isLoading,
    error,
    sendMessage: handleSend,
    stopGeneration: handleStop,
    retry: handleRetry,
  };
}
