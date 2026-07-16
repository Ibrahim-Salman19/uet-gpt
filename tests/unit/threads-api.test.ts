import { describe, expect, it, vi } from "vitest";

vi.mock("../../convex/_generated/server", () => ({
  mutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  query: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalMutation: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalQuery: (opts: { handler: Function }) => ({ handler: opts.handler }),
  internalAction: (opts: { handler: Function }) => ({ handler: opts.handler }),
}));

vi.mock("../../convex/_generated/api", () => ({
  components: {
    agent: {
      threads: {
        getThread: "getThread",
        createThread: "createThread",
        updateThread: "updateThread",
        listThreadsByUserId: "listThreadsByUserId",
        deleteAllForThreadIdAsync: "deleteAllForThreadIdAsync",
      },
      messages: { listMessagesByThreadId: "listMessagesByThreadId" },
    },
  },
  internal: {
    threads: {
      safeDeleteThread: "safeDeleteThread",
      getOldArchivedUsersBatch: "getOldArchivedUsersBatch",
      purgeOldArchived: "purgeOldArchived",
    },
  },
}));

import { create, remove, rename } from "../../convex/threads";

/** Build a chainable ctx.db.query(...).withIndex(...).unique() stub. */
function makeChain(value: unknown) {
  const chain = {
    withIndex: vi.fn(),
    unique: vi.fn(),
    collect: vi.fn(),
    take: vi.fn(),
    paginate: vi.fn(),
  };
  chain.withIndex.mockReturnValue(chain);
  chain.unique.mockResolvedValue(value);
  chain.collect.mockResolvedValue(value);
  chain.take.mockResolvedValue(value);
  return chain;
}

interface Identity {
  subject: string;
}

interface UserRow {
  _id: string;
  clerkId: string;
  isActive: boolean;
  role?: string;
}

function makeCtx(opts: { identity: Identity | null; user: UserRow | null; thread?: unknown }) {
  const runQuery = vi.fn().mockImplementation(async (ref: unknown) => {
    // The handlers call components.agent.threads.getThread after requireAuth.
    void ref;
    return opts.thread;
  });
  const runMutation = vi.fn().mockResolvedValue("thread_new_id");

  return {
    ctx: {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(opts.identity),
      },
      db: {
        query: vi.fn().mockReturnValue(makeChain(opts.user)),
      },
      runQuery,
      runMutation,
    },
    runMutation,
  };
}

const handler = <A>(fn: unknown) =>
  (fn as { handler: (ctx: unknown, args: A) => Promise<unknown> }).handler;

describe("threads api - authorization & ownership", () => {
  it("create rejects when there is no authenticated identity", async () => {
    const { ctx } = makeCtx({ identity: null, user: null });
    await expect(handler(create)(ctx, { title: "Test" })).rejects.toThrow(/auth/i);
  });

  it("create rejects a deactivated user (cannot resurrect their row)", async () => {
    const { ctx } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: false },
    });
    await expect(handler(create)(ctx, { title: "Test" })).rejects.toThrow(/deactivated/i);
  });

  it("create writes a thread for the authenticated user's clerkId", async () => {
    const { ctx, runMutation } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
    });
    await handler(create)(ctx, { title: "My thread" });
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      userId: "clerk_1",
      title: "My thread",
    });
  });

  it("rename rejects when the thread belongs to another user (IDOR guard)", async () => {
    const { ctx, runMutation } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_OTHER" },
    });
    await expect(handler(rename)(ctx, { id: "t1", title: "Hacked" })).rejects.toThrow(
      /not authorized/i,
    );
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("rename throws when the thread does not exist", async () => {
    const { ctx } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: null,
    });
    await expect(handler(rename)(ctx, { id: "t1", title: "x" })).rejects.toThrow(/not found/i);
  });

  it("remove rejects when the thread belongs to another user (IDOR guard)", async () => {
    const { ctx, runMutation } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_OTHER", status: "active" },
    });
    await expect(handler(remove)(ctx, { id: "t1" })).rejects.toThrow(/not authorized/i);
    expect(runMutation).not.toHaveBeenCalled();
  });

  it("remove soft-deletes (archives) a thread owned by the caller", async () => {
    const { ctx, runMutation } = makeCtx({
      identity: { subject: "clerk_1" },
      user: { _id: "u1", clerkId: "clerk_1", isActive: true },
      thread: { _id: "t1", userId: "clerk_1", status: "active" },
    });
    await handler(remove)(ctx, { id: "t1" });
    expect(runMutation).toHaveBeenCalledTimes(1);
    expect(runMutation.mock.calls[0]?.[1]).toMatchObject({
      threadId: "t1",
      patch: { status: "archived" },
    });
  });
});
