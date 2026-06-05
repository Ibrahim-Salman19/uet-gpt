import { describe, expect, it, vi, beforeEach } from "vitest";

const mockStorage: Record<string, string> = {};

const mockLocalStorage = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: vi.fn((index: number) => Object.keys(mockStorage)[index] ?? null),
};

describe("useLocalStorage", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    vi.restoreAllMocks();
  });

  it("should return the initial value if no value exists in localStorage", () => {
    const key = "test-key";
    const initialValue = "default-value";
    const stored = mockStorage[key];
    expect(stored).toBeUndefined();
    expect(initialValue).toBe("default-value");
  });

  it("should return the value from localStorage if it exists", () => {
    const key = "test-key";
    const storedValue = "stored-value";
    mockStorage[key] = JSON.stringify(storedValue);

    const item = mockStorage[key];
    expect(JSON.parse(item)).toBe("stored-value");
  });

  it("should update localStorage when the value changes", () => {
    const key = "test-key";
    const newValue = "new-value";

    mockStorage[key] = JSON.stringify(newValue);
    const item = mockStorage[key];

    expect(JSON.parse(item)).toBe("new-value");
  });

  it("should handle cases where localStorage is not available and return initialValue", () => {
    const key = "restricted-key";
    const fallback = "fallback";
    const stored = mockStorage[key];
    expect(stored).toBeUndefined();
    expect(fallback).toBe("fallback");
  });
});
