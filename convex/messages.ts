import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./auth";
import { sourcesValidator, tokenCountValidator } from "./messages/validator";
import { enforceRateLimit } from "./rateLimit";

// Transform component source format to app format
function toAppSource(s: Record<string, unknown>) {
  const providerOpts =
    s.providerOptions && typeof s.providerOptions === "object"
      ? (s.providerOptions as Record<string, unknown>)
      : undefined;
  const opts =
    providerOpts?.meta && typeof providerOpts.meta === "object"
      ? (providerOpts.meta as Record<string, unknown>)
      : undefined;
  return {
    documentId: (opts?.documentId as string | undefined) ?? (s.id as string | undefined),
    chunkId: (opts?.chunkId as string) ?? "",
    url: (s.url as string) ?? (s.id as string) ?? "",
    title: (s.title as string) ?? "",
    relevanceScore: (opts?.relevanceScore as number) ?? 0,
    excerpt: (opts?.excerpt as string) ?? "",
    headingPath: opts?.headingPath as string,
  };
}

// Transform app source format to component format
function toComponentSource(source: Record<string, unknown>) {
  return {
    type: "source" as const,
    sourceType: "url" as const,
    id: source.url as string,
    url: source.url as string,
    title: source.title as string | undefined,
    providerOptions: {
      meta: {
        documentId: source.documentId,
        chunkId: source.chunkId,
        entryId: source.entryId,
        relevanceScore: source.relevanceScore,
        excerpt: source.excerpt,
        headingPath: source.headingPath,
      },
    } as unknown as Record<string, Record<string, unknown>>,
  };
}

export const insert = mutation({
  args: {
    threadId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    sources: sourcesValidator,
    tokenCount: tokenCountValidator,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    if (args.content.length > 50000) {
      throw new ConvexError("Message content must be under 50000 characters");
    }

    const user = await requireAuth(ctx);

    // TASK-S02: Enforce rate limits before any DB write.
    // Uses actual token count if the caller provides it, otherwise 1000 token estimate.
    const tokenEstimate = args.tokenCount?.total ?? 1_000;
    // Derive admin tier from the authoritative DB role (same source as auth.ts),
    // not the Clerk session-token claim which may be absent/unconfigured.
    const isAdmin = user.role === "admin" || user.role === "superadmin";
    // Count only user turns toward the per-user message limit so the limit is
    // deterministic regardless of whether assistant turns are persisted here.
    // The global token budget is enforced for every insert.
    const countMessage = args.role === "user";
    const [, thread] = await Promise.all([
      enforceRateLimit(ctx, user.clerkId, tokenEstimate, isAdmin, countMessage),
      ctx.runQuery(components.agent.threads.getThread, {
        threadId: args.threadId,
      }),
    ]);
    if (!thread || thread.userId !== user.clerkId) {
      throw new ConvexError("Not authorized to write to this thread");
    }

    const result = await ctx.runMutation(components.agent.messages.addMessages, {
      userId: user.clerkId,
      threadId: args.threadId,
      messages: [
        {
          message: { role: args.role, content: args.content },
          text: args.content,
          ...(args.sources && {
            sources: args.sources.map(toComponentSource),
          }),
          ...(args.tokenCount && {
            usage: {
              promptTokens: args.tokenCount.prompt,
              completionTokens: args.tokenCount.completion,
              totalTokens: args.tokenCount.total,
            },
          }),
        },
      ],
    });

    const inserted = result.messages[0];
    if (!inserted) {
      throw new ConvexError("Failed to insert message: no message returned from agent component");
    }
    return inserted._id;
  },
});

export const list = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new ConvexError("Thread not found");
    }

    if (thread.userId !== user.clerkId) {
      throw new ConvexError("Not authorized");
    }

    const result = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId: args.threadId,
      paginationOpts: { numItems: 200, cursor: null },
      order: "asc",
    });

    return result.page.map((msg) => ({
      _id: msg._id,
      _creationTime: msg._creationTime,
      threadId: msg.threadId ?? "",
      role: (msg.message as { role?: string })?.role ?? "assistant",
      content:
        typeof (msg.message as { content?: unknown })?.content === "string"
          ? (msg.message as { content: string }).content
          : (msg.text ?? ""),
      sources: msg.sources ? msg.sources.map(toAppSource) : undefined,
      tokenCount: msg.usage
        ? {
            prompt: msg.usage.promptTokens ?? 0,
            completion: msg.usage.completionTokens ?? 0,
            total: msg.usage.totalTokens ?? 0,
          }
        : undefined,
      createdAt: msg._creationTime,
    }));
  },
});
