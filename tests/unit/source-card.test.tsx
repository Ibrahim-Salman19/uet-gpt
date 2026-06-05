// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SourceCard } from "@/components/chat/source-card";
import type { Source } from "@/lib/types";

const mockSource: Source = {
  documentId: "doc1" as unknown as Source["documentId"],
  chunkId: "chunk1" as unknown as Source["chunkId"],
  url: "https://web.uettaxila.edu.pk/admissions",
  title: "Admission Guidelines",
  relevanceScore: 0.95,
  excerpt: "Application process for undergraduate programs...",
};

describe("SourceCard", () => {
  it("renders the title and excerpt", () => {
    render(<SourceCard source={mockSource} index={0} />);
    expect(screen.getByText("Admission Guidelines")).toBeInTheDocument();
    expect(screen.getByText(/Application process for undergraduate programs/)).toBeInTheDocument();
  });

  it("renders the relevance score", () => {
    render(<SourceCard source={mockSource} index={0} />);
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("renders the hostname from URL", () => {
    render(<SourceCard source={mockSource} index={0} />);
    expect(screen.getByText("web.uettaxila.edu.pk")).toBeInTheDocument();
  });

  it("renders the index number", () => {
    render(<SourceCard source={mockSource} index={2} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("has correct link attributes", () => {
    const { container } = render(<SourceCard source={mockSource} index={0} />);
    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", mockSource.url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("handles long excerpt gracefully", () => {
    const longExcerpt = "A".repeat(500);
    const sourceLong = { ...mockSource, excerpt: longExcerpt };
    render(<SourceCard source={sourceLong} index={0} />);
    expect(screen.getByText("Admission Guidelines")).toBeInTheDocument();
  });
});
