// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStableQuery } from "../../src/hooks/use-stable-query";
import { useQuery } from "convex/react";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

describe("useStableQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns query value when defined", () => {
    vi.mocked(useQuery).mockReturnValue("resolved");
    const { result } = renderHook(() => useStableQuery("api.foo" as any, {}));
    expect(result.current).toBe("resolved");
  });

  test("holds last non-undefined value during loading", () => {
    // Start resolved
    vi.mocked(useQuery).mockReturnValue("first");
    const { result, rerender } = renderHook(() => useStableQuery("api.foo" as any, {}));
    expect(result.current).toBe("first");

    // Transition to loading (returns undefined)
    vi.mocked(useQuery).mockReturnValue(undefined);
    rerender();
    expect(result.current).toBe("first"); // holds last value

    // Transition to new resolved value
    vi.mocked(useQuery).mockReturnValue("second");
    rerender();
    expect(result.current).toBe("second");
  });
});
