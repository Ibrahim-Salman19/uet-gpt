// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom";

// ConvexReadyGate → useUserData → useStableQuery → useQuery/useConvexAuth from
// convex/react. Mock the full set of convex/react exports the gate tree needs.
vi.mock("convex/react", () => ({
  useConvexAuth: vi.fn(),
  useQuery: vi.fn(),
  useConvex: vi.fn(),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: vi.fn(),
}));

// useUserData imports the generated api; stub it so no real query ref is needed.
vi.mock("../../convex/_generated/api", () => ({
  api: { users: { getByClerkId: "getByClerkId" } },
}));

import { ConvexReadyGate } from "../../src/components/convex-ready-gate";
import { useUser } from "@clerk/nextjs";
import { useConvexAuth, useQuery } from "convex/react";

describe("ConvexReadyGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useUser).mockReturnValue({ isLoaded: true, user: null } as any);
    vi.mocked(useConvexAuth).mockReturnValue({ isLoading: false } as any);
    // useUserData treats `undefined` as "still loading" and anything else
    // (including null) as loaded. Return undefined so the happy-path branch
    // (no Clerk user) short-circuits before consulting the Convex user.
    vi.mocked(useQuery).mockReturnValue(undefined as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("renders children on happy path (clerk loaded, convex loaded)", () => {
    vi.mocked(useUser).mockReturnValue({ isLoaded: true, user: null } as any);
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

  test("renders retry UI after timeout (15s)", () => {
    vi.mocked(useUser).mockReturnValue({ isLoaded: false } as any);
    vi.mocked(useConvexAuth).mockReturnValue({ isLoading: true } as any);

    render(
      <ConvexReadyGate>
        <div>Happy Path Content</div>
      </ConvexReadyGate>
    );

    // TIMEOUT_MS is 15s (raised from 10s for high-latency PK networks).
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    // The redesigned timeout screen leads with "Can't Connect to Server".
    expect(screen.getByText(/Can't Connect to Server/)).toBeInTheDocument();
  });
});
