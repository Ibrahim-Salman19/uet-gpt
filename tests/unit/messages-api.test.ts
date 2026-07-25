import { describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../convex/_generated/api", () => ({
  components: {
    agent: {
      threads: { getThread: "getThread" },
      messages: {
        addMessages: "addMessages",
        listMessagesByThreadId: "listMessagesByThreadId",
      },
    },
  },
}));

// Neutralize rate limiting so these tests exercise auth/ownership logic only.
vi.mock("../../convex/rateLimit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(undefined),
}));

import { insert, list } from "../../convex/messages";

function makeChain(value: unknown) {
  const chain = {
    withIndex: vi.fn(),
    unique: vi.fn(),
    collect: vi.fn(),
    take: vi.fn(),
  };
  chain.withIndex.mockReturnValue(chain);
  chain.unique.mockResolvedValue(value);
  chain.collect.mockResolvedValue(value);
  chain.take.mockResolvedValue(value);
  return chain;
}

interface UserRow {
  _id: string;
  clerkId: string;
  isActive: boolean;
  role?: string;
}

function makeCtx(opts: {
  identity: { subject: string } | null;
  user: UserRow | null;
  thread?: unknown;
  messagesPage?: unknown[];
}) {
  const runQuery = vi.fn().mockImplementation(async () => {
    // First runQuery in insert/list is components.agent.threads.getThread.
    // The list handler then calls listMessagesByThreadId.
    if (opts.messagesPage && runQuery.mock.calls.length > 1) {
      return { page: opts.messagesPage };
    }
    return opts.thread;
  });
  const runMutation = vi.fn().mockResolvedValue({ messages: [{ _id: "msg_new" }] });

  return {
    ctx: {
      auth: { getUserIdentity: vi.fn().mockResolvedValue(opts.identity) },
      db: { query: vi.fn().mockReturnValue(makeChain(opts.user)) },
      runQuery,
      runMutation,
    },
    runMutation,
  };
}

const handler = <A>(fn: unknown) =>
  (fn as { handler: (ctx: unknown, args: A) => Promise<unknown> }).handler;

const baseInsertArgs = {
  threadId: "t1",
  role: "user" as const,
  content: "hello",
  sources: undefined,
  tokenCount: undefined,
};

describe("messages api - authorization & ownership", () => {
  it("insert rejects when there is no authenticated identity", async () => {
    const { ctx } = makeCtx({ identity: null, user: null });
    await expect(handler(insert)(ctx, baseInsertArgs)).rejects.toThrow(/auth/i);
  });

  it("insert rejects content over the 50000 character limit", async () => {
    const { ctx } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_1" },
    });
    await expect(
      handler(insert)(ctx, { ...baseInsertArgs, content: "x".repeat(50001) }),
    ).rejects.toThrow(/50000/);
  });

  it("insert rejects writing to a thread owned by another user (IDOR guard)", async () => {
    const { ctx, runMutation } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_OTHER" },
    });
    await expect(handler(insert)(ctx, baseInsertArgs)).rejects.toThrow(/not authorized/i);
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("insert persists a message for a thread owned by the caller", async () => {
    const { ctx, runMutation } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_1" },
    });
    const id = await handler(insert)(ctx, baseInsertArgs);
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      userId: "clerk_1",
      threadId: "t1",
    });
    expect(id).toBe("msg_new");
  });

  // list() returns null gracefully (instead of throwing) for unauthorized or
  // unauthenticated callers so a stale/redirected client cannot crash the React
  // tree. See convex/messages.ts:115-135 for the null-return guard rationale.
  it("list returns null when the caller does not own the thread", async () => {
    const { ctx } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_OTHER" },
    });
    await expect(handler(list)(ctx, { threadId: "t1" })).resolves.toBeNull();
  });

  it("list returns null for unauthenticated callers", async () => {
    const { ctx } = makeCtx({ identity: null, user: null });
    await expect(handler(list)(ctx, { threadId: "t1" })).resolves.toBeNull();
  });
});
