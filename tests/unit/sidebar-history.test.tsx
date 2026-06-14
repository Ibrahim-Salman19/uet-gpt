// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarHistory } from "../../src/components/sidebar/history";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn<() => string>(),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className} data-testid="mock-link">
      {children}
    </a>
  ),
}));

vi.mock("../../src/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/chat/123");

    render(<SidebarHistory chats={mockChats} onDelete={mockOnDelete} />);

    const links = screen.getAllByTestId("mock-link");
    const container0 = links[0]?.parentElement;
    const container1 = links[1]?.parentElement;

    expect(container0?.className).toContain("bg-[var(--accent)]/10");
    expect(container0?.className).not.toContain("text-[var(--text-sidebar)]");

    expect(container1?.className).toContain("text-[var(--text-sidebar)]");
    expect(container1?.className).not.toContain("bg-[var(--accent)]/10");
  });
});
