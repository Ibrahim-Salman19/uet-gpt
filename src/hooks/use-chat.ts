"use client";

import type { ConvexReactClient } from "convex/react";
import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Source } from "@/lib/types";
import { api } from "../../convex/_generated/api";
import { streamRegistry } from "./stream-registry";

const CHAT_TIMEOUT_MS = 45_000;

// Arguments accepted by api.messages.insert. Kept local because the Convex
// generated types are not always present (e.g. before codegen has run).
interface InsertMessageArgs {
  threadId: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}
type InsertMessageMutation = (args: InsertMessageArgs) => Promise<string>;

// Minimal shape of a message document returned by api.messages.list.
interface DbMessage {
  role: "user" | "assistant";
  content: string;
}

// Runtime guard for a single Source. The X-Sources header is base64-encoded
// JSON produced server-side, but we never trust its shape: only `url` and
// `title` are required by the Source type, so validate those before the data
// flows into rendering / persistence.
function isSource(value: unknown): value is Source {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.url === "string" && typeof v.title === "string";
}

function parseSourcesHeader(headers: Headers): Source[] {
  const sourcesHeader = headers.get("X-Sources");
  if (!sourcesHeader) return [];
  try {
    const binary = atob(sourcesHeader);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!Array.isArray(parsed)) {
      console.error("X-Sources header is not an array; ignoring.");
      return [];
    }
    // Drop any entries that do not match the Source shape rather than passing
    // unchecked data through to React rendering and Convex persistence.
    return parsed.filter(isSource);
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
  insertMutation: InsertMessageMutation,
  threadId: string,
  content: string,
): Promise<void> {
  await insertMutation({ threadId, role: "user", content: content.trim() });
}

async function fetchChatResponse(
  messages: { role: string; content: string }[],
  abortSignal: AbortSignal,
): Promise<{ response: Response; sources: Source[] }> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal: abortSignal,
  });

  if (!response.ok) {
    const errorData: unknown = await response.json().catch(() => ({}));
    const message =
      typeof errorData === "object" &&
      errorData !== null &&
      typeof (errorData as { error?: unknown }).error === "string"
        ? (errorData as { error: string }).error
        : "Failed to generate response";
    throw new Error(message);
  }

  const sources = parseSourcesHeader(response.headers);
  return { response, sources };
}

async function saveAssistantMessage(
  insertMutation: InsertMessageMutation,
  threadId: string,
  text: string,
  sources: Source[],
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

type RenameThreadMutation = (args: { id: string; title: string }) => Promise<null>;

async function executeStreamPhase(
  threadId: string,
  content: string,
  convex: ConvexReactClient,
  insertMutation: InsertMessageMutation,
  renameThreadMutation: RenameThreadMutation,
  abortController: AbortController,
  isRetryRequest: boolean,
): Promise<StreamResult> {
  const timeoutId = setTimeout(() => {
    if (abortController.signal.aborted) return;
    abortController.abort();
    toast.error("Response took too long. Please try again.");
  }, CHAT_TIMEOUT_MS);
  try {
    const dbMessagesRaw = await convex.query(api.messages.list, { threadId });
    const dbMessages: DbMessage[] = Array.isArray(dbMessagesRaw)
      ? (dbMessagesRaw as DbMessage[])
      : [];

    // Whether the user message for this turn is already persisted. Only treat
    // this as a retry when the caller explicitly requested a retry AND the last
    // stored message is the matching user turn. This avoids silently dropping a
    // legitimately repeated identical question (which the previous
    // content-equality-only heuristic would have done).
    const lastMessage = dbMessages[dbMessages.length - 1];
    const userMessageAlreadyPersisted =
      isRetryRequest &&
      lastMessage !== undefined &&
      lastMessage.role === "user" &&
      lastMessage.content === content.trim();

    if (!userMessageAlreadyPersisted) {
      await insertUserMessage(insertMutation, threadId, content);

      // Auto-title the thread from the first user message so the sidebar
      // shows something meaningful instead of "New Chat". Only the first
      // message (empty dbMessages) renames. Fire-and-forget; a failure here
      // must not break the stream.
      if (dbMessages.length === 0) {
        const cleanContent = content.trim().replace(/[?.,!]/g, "");
        const words = cleanContent.split(/\s+/).filter(Boolean);
        const MAX_TITLE_WORDS = 5;
        const MAX_TITLE_CHARS = 80;
        let newTitle =
          words.length > MAX_TITLE_WORDS
            ? `${words.slice(0, MAX_TITLE_WORDS).join(" ")}...`
            : cleanContent;
        if (newTitle.length > MAX_TITLE_CHARS) {
          newTitle = `${newTitle.slice(0, MAX_TITLE_CHARS)}...`;
        }
        if (newTitle.length > 0) {
          renameThreadMutation({ id: threadId, title: newTitle }).catch(console.error);
        }
      }
    }

    const formattedMessages = dbMessages.map((m) => ({ role: m.role, content: m.content }));
    if (!userMessageAlreadyPersisted) {
      formattedMessages.push({ role: "user", content: content.trim() });
    }

    const { response, sources } = await fetchChatResponse(
      formattedMessages,
      abortController.signal,
    );
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body reader available");
    streamRegistry.update(threadId, "", sources);
    const accumulatedText = await readStreamBody(reader, (text) => {
      streamRegistry.update(threadId, text, sources);
    });
    await saveAssistantMessage(insertMutation, threadId, accumulatedText, sources);
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
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
  // Explicitly tracks whether the next send is a user-initiated retry, rather
  // than inferring it from content equality with the last stored message.
  const isRetryRef = useRef(false);

  const insertMutation = useMutation(api.messages.insert) as unknown as InsertMessageMutation;
  const renameThread = useMutation(api.threads.rename) as unknown as RenameThreadMutation;

  // Abort any in-flight requests on thread change or unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [threadId]);

  function shouldSkipSend(content: string, threadId: string | undefined): boolean {
    return !content.trim() || !threadId || isLoadingRef.current;
  }

  function cleanupStreamState(threadId: string, generation: number): void {
    // Only the current (latest) generation may tear down shared lifecycle
    // state. A stale request settling after a newer send must NOT null out
    // abortControllerRef (it now points at the newer in-flight controller) or
    // flip isLoading off, otherwise a subsequent handleStop could not abort the
    // active request.
    if (streamGenerationRef.current !== generation) {
      return;
    }
    streamRegistry.update(threadId, "", []);
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

      // Consume the retry flag for this send only.
      const isRetryRequest = isRetryRef.current;
      isRetryRef.current = false;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const result = await executeStreamPhase(
          threadId,
          content,
          convex,
          insertMutation,
          renameThread,
          abortController,
          isRetryRequest,
        );

        if (!result.ok) {
          if (result.error === "aborted") {
            setError("Request timed out or was cancelled.");
          } else {
            setError(result.error);
            toast.error(result.error);
          }
        }
      } finally {
        cleanupStreamState(threadId, generation);
      }
    },
    [threadId, convex, insertMutation, renameThread],
  );

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Bump the generation so any in-flight request that settles after this stop
    // is recognized as stale and skips its lifecycle teardown.
    streamGenerationRef.current += 1;
    abortControllerRef.current = null;
    isLoadingRef.current = false;
    setIsLoading(false);
    // Clear any active streaming UI for the current thread.
    if (threadId) {
      streamRegistry.update(threadId, "", []);
    }
  }, [threadId]);

  const handleRetry = useCallback(() => {
    setError(null);
    if (lastMessageRef.current) {
      isRetryRef.current = true;
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
