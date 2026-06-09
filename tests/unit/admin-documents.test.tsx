// @vitest-environment happy-dom
import { fireEvent, render, screen, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const buildAdminMocks = (globalThis as any).buildAdminMocks;
  (globalThis as any).currentAdminMocks = buildAdminMocks({
    pathname: "/admin/documents",
    useMockConvexCtx: true,
    lucideIcons: {
      FileText: "icon-filetext",
      Search: "icon-search",
      Trash2: "icon-trash",
      ExternalLink: "icon-externallink",
      CheckCircle2: "icon-check",
      AlertCircle: "icon-alert",
      Clock: "icon-clock",
      RefreshCw: "icon-refresh",
      XCircle: "icon-xcircle",
    },
  });
});

vi.mock("convex/react", () => (globalThis as any).currentAdminMocks.convexReactMock);
vi.mock("next/navigation", () => (globalThis as any).currentAdminMocks.navigationMock);
vi.mock("@/components/ui/skeleton", () => (globalThis as any).currentAdminMocks.skeletonMock);
vi.mock("lucide-react", () => (globalThis as any).currentAdminMocks.lucideMock);

const mockConvex = (globalThis as any).currentAdminMocks.mockConvex;

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

import { useMutation } from "convex/react";
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
    const { container } = render(<AdminDocumentsPage />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no documents exist", async () => {
    mockConvex.query.mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByText("NO SYSTEM DOCUMENTS INGESTED")).toBeInTheDocument();
    });
  });

  it("shows 'No documents match your filters' when filters are active", async () => {
    mockConvex.query.mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    // Wait for the empty state
    await waitFor(() => {
      expect(screen.getByText("NO SYSTEM DOCUMENTS INGESTED")).toBeInTheDocument();
    });

    // Set a search query to trigger filtered-empty state
    const searchInput = screen.getByPlaceholderText("Search documents...");
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: "nonexistent" } });
    });

    await waitFor(() => {
      expect(screen.getByText("NO MATCHING DOCUMENTS FOUND")).toBeInTheDocument();
    });
  });

  it("renders document list", async () => {
    const docs = [
      buildMockDoc({ title: "Doc 1", url: "https://example.com/1" }),
      buildMockDoc({ title: "Doc 2", url: "https://example.com/2" }),
    ];
    mockConvex.query.mockReturnValue(docs);
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
    mockConvex.query.mockReturnValue(docs);
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
    mockConvex.query.mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("indexed")).toBeInTheDocument();
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("shows category badges", async () => {
    const docs = [buildMockDoc({ category: "admissions" })];
    mockConvex.query.mockReturnValue(docs);
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
    mockConvex.query.mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByText("404 Not Found")).toBeInTheDocument();
    });
  });

  it("shows chunk count when available", async () => {
    const docs = [buildMockDoc({ chunkCount: 12 })];
    mockConvex.query.mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByText("12 CHUNKS")).toBeInTheDocument();
    });
  });

  it("calls delete document mutation on delete button click", async () => {
    const mockDelete = vi.fn().mockResolvedValue(undefined);
    mockConvex.query.mockReturnValue([buildMockDoc({ _id: "doc_to_delete" })]);
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
    mockConvex.query.mockReturnValue([buildMockDoc({ _id: "doc_1" })]);
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
    mockConvex.query.mockReturnValue(docs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminDocumentsPage />);
    await waitFor(() => {
      expect(screen.getByTestId("icon-externallink")).toBeInTheDocument();
    });
  });
});
