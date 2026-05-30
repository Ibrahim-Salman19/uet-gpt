import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

// Mock next/navigation (not directly used but needed by layout)
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin/crawls"),
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock("lucide-react", () => ({
  Globe: () => <svg data-testid="icon-globe" />,
  Play: () => <svg data-testid="icon-play" />,
  RotateCw: () => <svg data-testid="icon-rotate" />,
  CheckCircle2: () => <svg data-testid="icon-check" />,
  XCircle: () => <svg data-testid="icon-xcircle" />,
  Clock: () => <svg data-testid="icon-clock" />,
  AlertTriangle: () => <svg data-testid="icon-alert" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

import { useQuery, useMutation } from "convex/react";
import AdminCrawlsPage from "@/app/admin/crawls/page";

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
    render(<AdminCrawlsPage />);
    const skeletons = screen.getAllByTestId("skeleton");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("shows empty state when no crawl jobs exist", async () => {
    mockConvex.query.mockResolvedValue([]);
    const mockTrigger = vi.fn();
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("No crawl jobs yet")).toBeInTheDocument();
      expect(screen.getByText("Start your first crawl")).toBeInTheDocument();
    });
  });

  it("renders crawl jobs list", async () => {
    mockConvex.query.mockResolvedValue([buildMockCrawl()]);
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
    mockConvex.query.mockResolvedValue(jobs);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);

    await waitFor(() => {
      expect(screen.getByText("completed")).toBeInTheDocument();
      expect(screen.getByText("running")).toBeInTheDocument();
      expect(screen.getByText("failed")).toBeInTheDocument();
    });
  });

  it("shows error text when crawl has an error", async () => {
    mockConvex.query.mockResolvedValue([
      buildMockCrawl({ error: "Connection timeout" }),
    ]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("Connection timeout")).toBeInTheDocument();
    });
  });

  it("renders header with title and description", async () => {
    mockConvex.query.mockResolvedValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("Crawl Jobs")).toBeInTheDocument();
      expect(screen.getByText("Manage and monitor website crawling jobs")).toBeInTheDocument();
    });
  });

  it("renders Refresh button", async () => {
    mockConvex.query.mockResolvedValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("Refresh")).toBeInTheDocument();
    });
  });

  it("renders New Crawl button", async () => {
    mockConvex.query.mockResolvedValue([]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    await waitFor(() => {
      expect(screen.getByText("New Crawl")).toBeInTheDocument();
    });
  });

  it("calls trigger mutation when New Crawl is clicked", async () => {
    mockConvex.query.mockResolvedValue([
      buildMockCrawl({ _id: "existing", status: "completed" }),
    ]);
    const mockTrigger = vi.fn().mockResolvedValue("new_job_id");
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    
    await screen.findByText("New Crawl");
    const button = screen.getByText("New Crawl");
    await act(async () => {
      fireEvent.click(button);
    });
    expect(mockTrigger).toHaveBeenCalledWith({
      url: "https://web.uettaxila.edu.pk/",
      maxPages: 500,
      maxDepth: 5,
    });
  });

  it("shows spinner while triggering crawl", async () => {
    mockConvex.query.mockResolvedValue([buildMockCrawl()]);
    const mockTrigger = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000)),
    );
    vi.mocked(useMutation).mockReturnValue(Object.assign(mockTrigger, { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    
    await screen.findByText("New Crawl");
    const button = screen.getByText("New Crawl");
    await act(async () => {
      fireEvent.click(button);
    });
    // Button should be disabled during triggering
    expect(button.closest("button")).toBeDisabled();
  });

  it("displays token count in human-readable format", async () => {
    mockConvex.query.mockResolvedValue([buildMockCrawl()]);
    vi.mocked(useMutation).mockReturnValue(Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() }));
    render(<AdminCrawlsPage />);
    // 15000 tokens → "15.0k"
    await waitFor(() => {
      expect(screen.getByText("15.0k")).toBeInTheDocument();
    });
  });
});
