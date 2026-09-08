// @vitest-environment happy-dom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const buildAdminMocks = (globalThis as any).buildAdminMocks;
  (globalThis as any).currentAdminMocks = buildAdminMocks({
    pathname: "/admin/crawls",
    includeRouter: true,
    useMockConvexCtx: true,
    lucideIcons: {
      Globe: "icon-globe",
      Play: "icon-play",
      RotateCw: "icon-rotate",
      CheckCircle2: "icon-check",
      XCircle: "icon-xcircle",
      Clock: "icon-clock",
      AlertTriangle: "icon-alert",
      Loader2: "icon-loader",
    },
  });
});

vi.mock("convex/react", () => (globalThis as any).currentAdminMocks.convexReactMock);
vi.mock("next/navigation", () => (globalThis as any).currentAdminMocks.navigationMock);
vi.mock("@/components/ui/skeleton", () => (globalThis as any).currentAdminMocks.skeletonMock);
vi.mock("lucide-react", () => (globalThis as any).currentAdminMocks.lucideMock);

const mockConvex = (globalThis as any).currentAdminMocks.mockConvex;

import { useMutation } from "convex/react";
import AdminCrawlsPage from "@/app/admin/(admin-shell)/crawls/page";

function buildMockCrawl(overrides: Record<string, unknown> = {}) {
  return {
    _id: "job1",
    _creationTime: Date.now() - 5000,
    trigger: "scheduled",
    status: "completed",
    config: {
      maxPages: 500,
      maxDepth: 5,
      includePaths: ["/**"],
      excludePaths: [],
      allowExternalLinks: false,
    },
    stats: {
      totalPages: 6,
      successfulPages: 50,
      failedPages: 2,
      skippedPages: 1,
      totalChunks: 120,
      totalTokens: 15000,
      bytesProcessed: 100000,
    },
    startedAt: Date.now() - 5000,
    completedAt: Date.now(),
    ...overrides,
  };
}

describe("AdminCrawlsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeletons when crawls are undefined", () => {
    mockConvex.query.mockImplementation(() => new Promise(() => {})); // never resolves, keeps loading
    const mockTrigger = vi.fn();
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    const { container } = render(<AdminCrawlsPage />);
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no crawl jobs exist", async () => {
    mockConvex.query.mockReturnValue([]);
    const mockTrigger = vi.fn();
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("NO ACTIVE CRAWL RECORDS FOUND")).toBeInTheDocument();
      expect(screen.getByText("START FIRST CRAWL ENGINE")).toBeInTheDocument();
    });
  });

  it("renders crawl jobs list", async () => {
    mockConvex.query.mockReturnValue([buildMockCrawl()]);
    const mockTrigger = vi.fn();
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);

    await waitFor(() => {
      expect(screen.getByText("completed")).toBeInTheDocument();
      expect(screen.getByText("scheduled")).toBeInTheDocument();
      expect(screen.getByText("50")).toBeInTheDocument(); // successful pages
      expect(screen.getByText("2")).toBeInTheDocument();  // failed pages
      expect(screen.getByText("120")).toBeInTheDocument(); // chunks
    });
  });

  it("renders multiple crawl jobs", async () => {
    const jobs = [
      buildMockCrawl({ _id: "job1", status: "completed" }),
      buildMockCrawl({ _id: "job2", status: "running" }),
      buildMockCrawl({ _id: "job3", status: "failed" }),
    ];
    mockConvex.query.mockReturnValue(jobs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);

    await waitFor(() => {
      expect(screen.getByText("completed")).toBeInTheDocument();
      expect(screen.getByText("running")).toBeInTheDocument();
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("shows error text when crawl has an error", async () => {
    mockConvex.query.mockReturnValue([
      buildMockCrawl({ error: "Connection timeout" }),
    ]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });
  });

  it("renders header with title and description", async () => {
    mockConvex.query.mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("[ CRITICAL_SYSTEM: CRAWL JOBS ]")).toBeInTheDocument();
      expect(screen.getByText("Manage and monitor website crawling engines")).toBeInTheDocument();
    });
  });

  it("renders LIVE auto-update indicator", async () => {
    // Manual refresh was replaced by Convex's reactive queries  -  the page
    // shows a disabled "LIVE" badge instead of a Refresh button.
    mockConvex.query.mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });
  });

  it("renders New Crawl button", async () => {
    mockConvex.query.mockReturnValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("NEW CRAWL")).toBeInTheDocument();
    });
  });

  it("calls trigger mutation when New Crawl is clicked", async () => {
    mockConvex.query.mockReturnValue([
      buildMockCrawl({ _id: "existing", status: "completed" }),
    ]);
    const mockTrigger = vi.fn().mockResolvedValue("new_job_id");
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    
    await screen.findByText("NEW CRAWL");
    const button = screen.getByText("NEW CRAWL");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockTrigger).toHaveBeenCalledWith({
      url: "https://web.uettaxila.edu.pk/",
      maxPages: 500,
      maxDepth: 4,
    });
  });

  it("shows spinner while triggering crawl", async () => {
    mockConvex.query.mockReturnValue([buildMockCrawl()]);
    const mockTrigger = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    
    await screen.findByText("NEW CRAWL");
    const button = screen.getByText("NEW CRAWL");
    await act(async () => {
      fireEvent.click(button);
    });
    // Button should be disabled during triggering
    expect(button.closest("button")).toBeDisabled();
  });

  it("displays token count in human-readable format", async () => {
    mockConvex.query.mockReturnValue([buildMockCrawl()]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    // 15000 tokens → "15.0k"
    await waitFor(() => {
      expect(screen.getByText("15.0k")).toBeInTheDocument();
    });
  });
});
