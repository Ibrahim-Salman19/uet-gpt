import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatSuggestions } from "@/components/chat/chat-suggestions";

const suggestions = ["What is the fee structure?", "When do admissions open?"];

describe("ChatSuggestions", () => {
  it("renders suggestion buttons", () => {
    render(<ChatSuggestions suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getByText("What is the fee structure?")).toBeInTheDocument();
    expect(screen.getByText("When do admissions open?")).toBeInTheDocument();
  });

  it("renders default suggestions when none provided", () => {
    render(<ChatSuggestions onSelect={() => {}} />);
    expect(screen.getByText("What is the fee structure for BS programs?")).toBeInTheDocument();
  });

  it("returns null for empty suggestions", () => {
    const { container } = render(<ChatSuggestions suggestions={[]} onSelect={() => {}} />);
    expect(container.innerHTML).toBe("");
  });

  it("calls onSelect when a suggestion is clicked", () => {
    const onSelect = vi.fn();
    render(<ChatSuggestions suggestions={suggestions} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("What is the fee structure?"));
    expect(onSelect).toHaveBeenCalledWith("What is the fee structure?");
  });

  it("shows the Try asking header", () => {
    render(<ChatSuggestions suggestions={suggestions} onSelect={() => {}} />);
    expect(screen.getByText("Try asking:")).toBeInTheDocument();
  });
});
