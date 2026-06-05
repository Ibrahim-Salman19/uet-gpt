// @vitest-environment jsdom
import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { GlassPortal } from "../../src/components/chat/glass-portal";
import React from "react";
import "@testing-library/jest-dom";

describe("GlassPortal", () => {
  test("renders children correctly", () => {
    render(
      <GlassPortal>
        <div data-testid="child-element">Portal Child</div>
      </GlassPortal>
    );

    expect(screen.getByTestId("child-element")).toBeInTheDocument();
    expect(screen.getByText("Portal Child")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <GlassPortal className="custom-portal-class">
        <div>Content</div>
      </GlassPortal>
    );

    expect(container.firstChild).toHaveClass("custom-portal-class");
  });
});
