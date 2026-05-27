import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { submit } from "../../convex/feedback/submit";

interface MockMutationCtx {
  auth: {
    getUserIdentity: ReturnType<typeof vi.fn>;
  };
  db: {
    insert: ReturnType<typeof vi.fn>;
    query: ReturnType<typeof vi.fn>;
  };
}

function makeChain(value: unknown) {
  const chain = {
    withIndex: vi.fn(),
    unique: vi.fn(),
    collect: vi.fn(),
  };
  chain.withIndex.mockReturnValue(chain);
  chain.unique.mockResolvedValue(value);
  chain.collect.mockResolvedValue(value);
  return chain;
}

describe("feedback:submit", () => {
  it("should not insert empty string for comment if comment is undefined", async () => {
    const mockInsert = vi.fn().mockResolvedValue("mocked_id" as Id<"feedback">);
    const mockQuery = vi
      .fn()
      .mockReturnValueOnce(makeChain({ _id: "users_id_123" as Id<"users">, clerkId: "clerk_test_123" }))
      .mockReturnValueOnce(makeChain([]));

    const mockCtx: MockMutationCtx = {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: "clerk_test_123" }),
      },
      db: {
        insert: mockInsert,
        query: mockQuery,
      },
    };

    const mockArgs = {
      messageId: "messages_id_123" as string,
      userId: "users_id_123" as string,
      rating: "thumbsUp" as const,
    };
    await (
      submit as unknown as {
        _handler: (ctx: MockMutationCtx, args: typeof mockArgs) => Promise<void>;
      }
    )._handler(mockCtx, mockArgs);

    expect(mockInsert).toHaveBeenCalled();
    const insertedData = mockInsert.mock.calls[0]?.[1];

    expect(insertedData.comment).toBeUndefined();
  });
});
