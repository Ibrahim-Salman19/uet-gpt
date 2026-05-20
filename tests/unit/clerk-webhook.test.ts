import { describe, it, expect } from "vitest";
import { POST } from "../../src/app/api/webhooks/clerk/route";

describe("clerk webhook", () => {
  it("exports POST handler", () => {
    expect(typeof POST).toBe("function");
  });
});
