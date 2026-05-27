import { describe, expect, it } from "vitest";

describe("types", () => {
  it("Id type is a branded string", () => {
    const docId = "abc123" as string & { __tableName: "documents" };
    expect(typeof docId).toBe("string");
  });
});


