// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConvexReadyGate } from "../../src/components/convex-ready-gate";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import React from "react";
import "@testing-library/jest-dom";

vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(),
}));

describe("ConvexReadyGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders children on happy path (clerk loaded, convex loaded)", () => {
    vi.mocked(useUser).mockReturnValue({ isLoaded: true } as any);
    vi.mocked(useConvexAuth).mockReturnValue({ isLoading: false } as any);

    render(
      <ConvexReadyGate>
        <div>Happy Path Content</div>
      </ConvexReadyGate>
    );

    expect(screen.getByText("Happy Path Content")).toBeInTheDocument();
  });

  test("renders connecting state when loading", () => {
    vi.mocked(useUser).mockReturnValue({ isLoaded: false } as any);
    vi.mocked(useConvexAuth).mockReturnValue({ isLoading: true } as any);

    render(
      <ConvexReadyGate>
        <div>Happy Path Content</div>
      </ConvexReadyGate>
    );

    expect(screen.getByText("CONNECTION LIVE")).toBeInTheDocument();
    expect(screen.queryByText("Happy Path Content")).not.toBeInTheDocument();
  });

  test("renders retry UI after timeout (10s)", () => {
    vi.mocked(useUser).mockReturnValue({ isLoaded: false } as any);
    vi.mocked(useConvexAuth).mockReturnValue({ isLoading: true } as any);

    render(
      <ConvexReadyGate>
        <div>Happy Path Content</div>
      </ConvexReadyGate>
    );

    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText("TIMEOUT // CONNECTION FAILURE")).toBeInTheDocument();
    expect(screen.getByText("RETRY CONNECTION")).toBeInTheDocument();
  });
});
