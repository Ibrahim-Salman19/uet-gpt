import { describe, expect, it, vi } from "vitest";
import type { Id } from "../../convex/_generated/dataModel";
import { submit } from "../../convex/feedback/submit";

describe("feedback:submit", () => {
  it("should not insert empty string for comment if comment is undefined", async () => {
    // Mock the db.insert function
    const mockInsert = vi.fn().mockResolvedValue("mocked_id" as Id<"feedback">);
    const mockCtx = {
      db: {
        insert: mockInsert,
      },
    } as any;

    const mockArgs = {
      messageId: "messages_id_123" as Id<"messages">,
      userId: "users_id_123" as Id<"users">,
      rating: "thumbsUp" as const,
      // comment is undefined
    };

    await (submit as any).handler(mockCtx, mockArgs);

    expect(mockInsert).toHaveBeenCalled();
    const insertedData = mockInsert.mock.calls[0]![1];

    // We expect comment to be undefined, but currently it will fail because it inserts ""
    expect(insertedData.comment).toBeUndefined();
  });
});
