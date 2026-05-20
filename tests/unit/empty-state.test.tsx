import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "@/components/empty-state";

describe("EmptyState", () => {
  it("renders default heading", () => {
    render(<EmptyState onSuggestionSelect={() => {}} />);
    expect(
      screen.getByText("Ask me anything about UET Taxila")
    ).toBeInTheDocument();
  });

  it("renders custom title", () => {
    render(
      <EmptyState title="Welcome" onSuggestionSelect={() => {}} />
    );
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });

  it("renders suggestions when provided", () => {
    const suggestions = ["What is the fee structure?"];
    render(
      <EmptyState
        suggestions={suggestions}
        onSuggestionSelect={() => {}}
      />
    );
    expect(screen.getByText("What is the fee structure?")).toBeInTheDocument();
  });

  it("calls onSuggestionSelect when suggestion clicked", () => {
    const onSelect = vi.fn();
    render(
      <EmptyState
        suggestions={["Ask about admissions"]}
        onSuggestionSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText("Ask about admissions"));
    expect(onSelect).toHaveBeenCalledWith("Ask about admissions");
  });

  it("renders without suggestions section when suggestions is undefined", () => {
    render(<EmptyState onSuggestionSelect={() => {}} />);
    expect(screen.queryByText("Try asking:")).not.toBeInTheDocument();
  });
});
