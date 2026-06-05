// @vitest-environment happy-dom
import { fireEvent, render, screen, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockConvex = {
  query: vi.fn(),
};

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() })),
  useConvex: () => mockConvex,
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
    window.confirm = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows loading skeletons when documents are undefined", () => {
    mockConvex.query.mockImplementation(() => new Promise(() => {})); // keeps loading
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no documents exist", async () => {
    mockConvex.query.mockResolvedValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByText("No documents yet")).toBeInTheDocument();
    });
  });

  it("shows 'No documents match your filters' when filters are active", async () => {
    mockConvex.query.mockResolvedValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    // Wait for the empty state
    await waitFor(() => {
      expect(screen.getByText("No documents yet")).toBeInTheDocument();
    });

    // Set a search query to trigger filtered-empty state
    const searchInput = screen.getByPlaceholderText("Search documents...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    });

    await waitFor(() => {
      expect(screen.getByText("No documents match your filters")).toBeInTheDocument();
    });
  });

  it("renders document list", async () => {
    const docs = [
      buildMockDoc({ title: "Doc 1", url: "https://example.com/1" }),
      buildMockDoc({ title: "Doc 2", url: "https://example.com/2" }),
    ];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Doc 1")).toBeInTheDocument();
      expect(screen.getByText("Doc 2")).toBeInTheDocument();
    });
  });

  it("filters documents by search query", async () => {
    const docs = [
      buildMockDoc({ title: "Admissions Guide", url: "https://example.com/admissions" }),
      buildMockDoc({ title: "Fee Structure", url: "https://example.com/fees" }),
    ];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Admissions Guide")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search documents...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "Admissions" } });
    });

    await waitFor(() => {
      expect(screen.getByText("Admissions Guide")).toBeInTheDocument();
      expect(screen.queryByText("Fee Structure")).not.toBeInTheDocument();
    });
  });

  it("shows document status badges", async () => {
    const docs = [
      buildMockDoc({ status: "indexed" }),
      buildMockDoc({ status: "failed" }),
    ];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("indexed")).toBeInTheDocument();
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("shows category badges", async () => {
    const docs = [buildMockDoc({ category: "admissions" })];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("admissions")).toBeInTheDocument();
    });
  });

  it("shows error text for failed documents", async () => {
    const docs = [
      buildMockDoc({ status: "failed", error: "404 Not Found" }),
    ];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByText("404 Not Found")).toBeInTheDocument();
    });
  });

  it("shows chunk count when available", async () => {
    const docs = [buildMockDoc({ chunkCount: 12 })];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByText("12 chunks")).toBeInTheDocument();
    });
  });

  it("calls delete document mutation on delete button click", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    mockConvex.query.mockResolvedValue([buildMockDoc({ _id: "doc_to_delete" })]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockDelete, { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId("icon-trash").length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByTestId("icon-trash");
    await act(async () => {
      fireEvent.click(deleteButtons[0]!);
    });
    expect(mockDelete).toHaveBeenCalled();
  });

  it("does not delete when confirm is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const mockDelete = vi.fn();
    mockConvex.query.mockResolvedValue([buildMockDoc({ _id: "doc_1" })]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockDelete, { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId("icon-trash").length).toBeGreaterThan(0);
    });

    const deleteButtons = screen.getAllByTestId("icon-trash");
    await act(async () => {
      fireEvent.click(deleteButtons[0]!);
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("renders external link buttons", async () => {
    const docs = [buildMockDoc({ url: "https://example.com/test" })];
    mockConvex.query.mockResolvedValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("icon-externallink")).toBeInTheDocument();
    });
  });
});
