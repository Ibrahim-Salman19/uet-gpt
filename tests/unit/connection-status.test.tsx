// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ConnectionStatus } from "../../src/components/connection-status";
import React from "react";
import "@testing-library/jest-dom";

describe("ConnectionStatus", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renders null when online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);

    const { container } = render(<ConnectionStatus />);
    expect(container.firstChild).toBeNull();
  });

  test("renders offline banner when offline", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    render(<ConnectionStatus />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(
      screen.getByText(/You are offline - messages will be sent when you reconnect/i)
    ).toBeInTheDocument();
  });

  test("renders reconnected banner when returning online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);

    render(<ConnectionStatus />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByText(/Reconnected/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(/Reconnected/i)).not.toBeInTheDocument();
  });
});
