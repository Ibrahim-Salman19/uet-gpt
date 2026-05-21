import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { submit } from "../../convex/feedback/submit";

interface MockMutationCtx {
  db: {
    insert: ReturnType<typeof vi.fn>;
  };
}

describe("feedback:submit", () => {
  it("should not insert empty string for comment if comment is undefined", async () => {
    const mockInsert = vi.fn().mockResolvedValue("mocked_id" as Id<"feedback">);
    const mockCtx: MockMutationCtx = {
      db: {
        insert: mockInsert,
      },
    };

    const mockArgs = {
      messageId: "messages_id_123" as Id<"messages">,
      userId: "users_id_123" as Id<"users">,
      rating: "thumbsUp" as const,
    };

    await (
      submit as unknown as {
        handler: (ctx: MockMutationCtx, args: typeof mockArgs) => Promise<void>;
      }
    ).handler(mockCtx, mockArgs);

    expect(mockInsert).toHaveBeenCalled();
    const insertedData = mockInsert.mock.calls[0]?.[1];

    expect(insertedData.comment).toBeUndefined();
  });
});
