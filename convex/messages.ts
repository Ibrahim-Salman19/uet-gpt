import { ConvexError, v } from "convex/values";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { sourcesValidator, tokenCountValidator } from "./messages/validator";
import { enforceRateLimit } from "./rateLimit";

function toAppSource(s: any): any {
  return {
    documentId: s.providerOptions?.documentId ?? s.id,
    chunkId: s.providerOptions?.chunkId ?? "",
    url: s.url ?? s.id,
    title: s.title ?? "",
    relevanceScore: s.providerOptions?.relevanceScore ?? 0,
    excerpt: s.providerOptions?.excerpt ?? "",
  };
}

function toComponentSource(source: any): any {
  return {
    type: "url",
    id: source.url,
    url: source.url,
    title: source.title,
    providerOptions: {
      documentId: source.documentId,
      chunkId: source.chunkId,
      relevanceScore: source.relevanceScore,
      excerpt: source.excerpt,
    },
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    // TASK-S02: Enforce rate limits before any DB write.
    // Uses actual token count if the caller provides it, otherwise 1000 token estimate.
    const tokenEstimate = args.tokenCount?.total ?? 1_000;
    await enforceRateLimit(ctx, identity.subject, tokenEstimate);

    const result = await ctx.runMutation(components.agent.messages.addMessages, {
      userId: identity.subject,
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

    return result.messages[0]?._id as string;
  },
});

export const list = query({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const thread = await ctx.runQuery(components.agent.threads.getThread, {
      threadId: args.threadId,
    });
    if (!thread) {
      throw new ConvexError("Thread not found");
    }

    if (thread.userId !== identity.subject) {
      throw new ConvexError("Not authorized");
    }

    const result = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId: args.threadId,
      paginationOpts: { numItems: 200, cursor: null },
      order: "asc",
    });

    return result.page.map((msg: any) => ({
      _id: msg._id as string,
      _creationTime: msg._creationTime,
      threadId: msg.threadId as string,
      role: msg.message?.role ?? "assistant",
      content: msg.message?.content ?? msg.text ?? "",
      sources: msg.sources ? msg.sources.map(toAppSource) : undefined,
      tokenCount: msg.usage
        ? {
            prompt: msg.usage.promptTokens,
            completion: msg.usage.completionTokens,
            total: msg.usage.totalTokens,
          }
        : undefined,
      createdAt: msg._creationTime,
    }));
  },
});
