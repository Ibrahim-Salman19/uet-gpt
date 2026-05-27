import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() })),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/documents"),
}));

// Mock Radix UI select components
vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <select
      data-testid="select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock("lucide-react", () => ({
  FileText: () => <svg data-testid="icon-filetext" />,
  Search: () => <svg data-testid="icon-search" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  ExternalLink: () => <svg data-testid="icon-externallink" />,
  CheckCircle2: () => <svg data-testid="icon-check" />,
  AlertCircle: () => <svg data-testid="icon-alert" />,
  Clock: () => <svg data-testid="icon-clock" />,
  RefreshCw: () => <svg data-testid="icon-refresh" />,
  XCircle: () => <svg data-testid="icon-xcircle" />,
}));

import { useQuery, useMutation } from "convex/react";
import AdminDocumentsPage from "@/app/admin/documents/page";

function buildMockDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: `doc_${Math.random().toString(36).slice(2, 8)}`,
    _creationTime: Date.now() - 10000,
    url: "https://example.com/doc",
    title: "Test Document",
    source: "web",
    category: "academic",
    status: "indexed",
    chunkCount: 5,
    crawledAt: Date.now() - 5000,
    updatedAt: Date.now() - 5000,
    ...overrides,
  };
}

describe("AdminDocumentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock confirm
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows loading skeletons when documents are undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no documents exist", () => {
    vi.mocked(useQuery).mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    expect(screen.getByText("No documents yet")).toBeInTheDocument();
  });

  it("shows 'No documents match your filters' when filters are active", () => {
    vi.mocked(useQuery).mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    // Set a search query to trigger filtered-empty state
    const searchInput = screen.getByPlaceholderText("Search documents...");
    fireEvent.change(searchInput, { target: { value: "nonexistent" } });

    expect(screen.getByText("No documents match your filters")).toBeInTheDocument();
  });

  it("renders document list", () => {
    const docs = [
      buildMockDoc({ title: "Doc 1", url: "https://example.com/1" }),
      buildMockDoc({ title: "Doc 2", url: "https://example.com/2" }),
    ];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    expect(screen.getByText("Doc 1")).toBeInTheDocument();
    expect(screen.getByText("Doc 2")).toBeInTheDocument();
  });

  it("filters documents by search query", () => {
    const docs = [
      buildMockDoc({ title: "Admissions Guide", url: "https://example.com/admissions" }),
      buildMockDoc({ title: "Fee Structure", url: "https://example.com/fees" }),
    ];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    const searchInput = screen.getByPlaceholderText("Search documents...");
    fireEvent.change(searchInput, { target: { value: "Admissions" } });

    expect(screen.getByText("Admissions Guide")).toBeInTheDocument();
    expect(screen.queryByText("Fee Structure")).not.toBeInTheDocument();
  });

  it("shows document status badges", () => {
    const docs = [
      buildMockDoc({ status: "indexed" }),
      buildMockDoc({ status: "failed" }),
    ];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    expect(screen.getByText("indexed")).toBeInTheDocument();
    expect(screen.getByText("failed")).toBeInTheDocument();
  });

  it("shows category badges", () => {
    const docs = [buildMockDoc({ category: "admissions" })];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    expect(screen.getByText("admissions")).toBeInTheDocument();
  });

  it("shows error text for failed documents", () => {
    const docs = [
      buildMockDoc({ status: "failed", error: "404 Not Found" }),
    ];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    expect(screen.getByText("404 Not Found")).toBeInTheDocument();
  });

  it("shows chunk count when available", () => {
    const docs = [buildMockDoc({ chunkCount: 12 })];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    expect(screen.getByText("12 chunks")).toBeInTheDocument();
  });

  it("calls delete document mutation on delete button click", () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useQuery).mockReturnValue([buildMockDoc({ _id: "doc_to_delete" })]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockDelete, { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    const deleteButtons = screen.getAllByTestId("icon-trash");
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]!);
    expect(mockDelete).toHaveBeenCalled();
  });

  it("does not delete when confirm is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const mockDelete = vi.fn();
    vi.mocked(useQuery).mockReturnValue([buildMockDoc({ _id: "doc_1" })]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockDelete, { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    const deleteButtons = screen.getAllByTestId("icon-trash");
    fireEvent.click(deleteButtons[0]!);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("renders external link buttons", () => {
    const docs = [buildMockDoc({ url: "https://example.com/test" })];
    vi.mocked(useQuery).mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    expect(screen.getByTestId("icon-externallink")).toBeInTheDocument();
  });
});
