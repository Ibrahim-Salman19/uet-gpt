import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalStorage } from "../../src/hooks/use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should return the initial value if no value exists in localStorage", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default-value"));
    expect(result.current[0]).toBe("default-value");
  });

  it("should return the value from localStorage if it exists", () => {
    window.localStorage.setItem("test-key", JSON.stringify("stored-value"));
    const { result } = renderHook(() => useLocalStorage("test-key", "default-value"));
    expect(result.current[0]).toBe("stored-value");
  });

  it("should update localStorage when the value changes", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default-value"));

    act(() => {
      const setValue = result.current[1];
      setValue("new-value");
    });

    expect(result.current[0]).toBe("new-value");
    expect(JSON.parse(window.localStorage.getItem("test-key")!)).toBe("new-value");
  });

  it("should handle cases where localStorage is not available (like SSR/privacy mode) and return initialValue", () => {
    // Mock localStorage.getItem to throw an error, simulating a restricted/SSR environment
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("localStorage is not available");
    });

    const { result } = renderHook(() => useLocalStorage("restricted-key", "fallback"));

    expect(result.current[0]).toBe("fallback");
    getItemSpy.mockRestore();
  });
});
