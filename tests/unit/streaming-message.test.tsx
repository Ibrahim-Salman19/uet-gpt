import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { StreamingMessage } from "@/components/chat/streaming-message";

describe("StreamingMessage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders full content when not streaming", () => {
    render(<StreamingMessage content="Hello world" isStreaming={false} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("renders without content initially while streaming", () => {
    const { container } = render(<StreamingMessage content="Hello world" isStreaming={true} />);
    const spans = container.querySelectorAll("span");
    const hasEmptyContent = Array.from(spans).some(
      (s) => s.className.includes("whitespace-pre-wrap") && s.textContent === ""
    );
    expect(hasEmptyContent).toBe(true);
  });

  it("shows cursor during streaming", () => {
    const { container } = render(
      <StreamingMessage content="Hello" isStreaming={true} />
    );
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });

  it("hides cursor when not streaming", () => {
    const { container } = render(
      <StreamingMessage content="Hello" isStreaming={false} />
    );
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).not.toBeInTheDocument();
  });

  it("progressively reveals content via rAF", () => {
    render(<StreamingMessage content="Hello World" isStreaming={true} />);

    act(() => {
      vi.advanceTimersByTime(16);
    });

    const el = screen.getByText(/^Hel/);
    expect(el).toBeInTheDocument();
  });

  it("shows full content when streaming completes", () => {
    const { rerender } = render(
      <StreamingMessage content="Hello" isStreaming={true} />
    );

    rerender(<StreamingMessage content="Hello" isStreaming={false} />);

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
