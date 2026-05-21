import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarHistory } from "../../src/components/sidebar/history";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

// Mock next/link to render simple anchors for testing
vi.mock("next/link", () => ({
  default: ({ children, href, className }: any) => (
    <a href={href} className={className} data-testid="mock-link">
      {children}
    </a>
  ),
}));

// Mock the ScrollArea to render its children normally
vi.mock("../../src/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div>{children}</div>,
}));

describe("SidebarHistory", () => {
  const mockChats = [
    { id: "123", title: "Test Chat 1" },
    { id: "456", title: "Test Chat 2" },
  ];
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should highlight the active chat based on the clean pathname, without route groups", () => {
    // Next.js omits route groups like (main) from the pathname
    (usePathname as any).mockReturnValue("/chat/123");

    render(<SidebarHistory chats={mockChats} onDelete={mockOnDelete} />);

    const links = screen.getAllByTestId("mock-link");

    // First link should be active
    expect(links[0]!.className).toContain("bg-[var(--accent)]/10");
    expect(links[0]!.className).not.toContain("text-[var(--text-sidebar)]");

    // Second link should be inactive
    expect(links[1]!.className).toContain("text-[var(--text-sidebar)]");
    expect(links[1]!.className).not.toContain("bg-[var(--accent)]/10");
  });
});
