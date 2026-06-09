// @vitest-environment happy-dom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LoadingState } from "@/components/loading-state";

describe("LoadingState", () => {
  it("renders message skeletons by default", () => {
    const { container } = render(<LoadingState />);
    const skeletons = container.querySelectorAll(".border-\\[var\\(--ks-rule\\)\\]");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders sidebar skeleton with type='sidebar'", () => {
    const { container } = render(<LoadingState type="sidebar" />);
    const skeletons = container.querySelectorAll(".border-\\[var\\(--ks-rule\\)\\]");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders page skeleton with type='page'", () => {
    const { container } = render(<LoadingState type="page" />);
    const skeletons = container.querySelectorAll(".border-\\[var\\(--ks-rule\\)\\]");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders message skeleton with type='messages'", () => {
    const { container } = render(<LoadingState type="messages" />);
    const userMessages = container.querySelectorAll(".flex-row-reverse");
    const assistantMessages = container.querySelectorAll(".flex-row:not(.flex-row-reverse)");
    expect(userMessages.length).toBeGreaterThan(0);
    expect(assistantMessages.length).toBeGreaterThan(0);
  });
});
