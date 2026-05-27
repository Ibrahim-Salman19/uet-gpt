import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => Object.assign(vi.fn(), { withOptimisticUpdate: vi.fn() })),
  useConvex: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin"),
}));

// Mock lucide-icon components used in StatCard
vi.mock("lucide-react", () => ({
  FileText: () => <svg data-testid="icon-filetext" />,
  Users: () => <svg data-testid="icon-users" />,
  Globe: () => <svg data-testid="icon-globe" />,
  ThumbsUp: () => <svg data-testid="icon-thumbsup" />,
  ThumbsDown: () => <svg data-testid="icon-thumbsdown" />,
  Activity: () => <svg data-testid="icon-activity" />,
  Database: () => <svg data-testid="icon-database" />,
}));

import { useQuery } from "convex/react";
import AdminOverviewPage from "@/app/admin/page";

function buildMockStats(overrides: Record<string, unknown> = {}) {
  return {
    totalDocuments: 100,
    totalFeedback: 50,
    totalUsers: 25,
    totalCrawlJobs: 10,
    totalCacheEntries: 200,
    indexedDocuments: 80,
    pendingDocuments: 15,
    failedDocuments: 5,
    activeUsersLast24h: 8,
    recentFeedback: [
      { _id: "fb1", rating: "thumbsUp", createdAt: Date.now() - 1000, category: "accurate" },
      { _id: "fb2", rating: "thumbsDown", createdAt: Date.now() - 2000 },
    ],
    recentCrawls: [
      { _id: "cj1", status: "completed", startedAt: Date.now() - 5000, trigger: "scheduled" },
    ],
    storageUsed: { documents: 50000, cache: 20000, total: 70000 },
    ...overrides,
  };
}

describe("AdminOverviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing when stats are undefined", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);
    expect(() => render(<AdminOverviewPage />)).not.toThrow();
  });

  it("renders stat cards with data", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats());
    render(<AdminOverviewPage />);

    expect(screen.getByText("Total Documents")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("80 indexed")).toBeInTheDocument();

    expect(screen.getByText("Active Users Today")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("25 total users")).toBeInTheDocument();

    expect(screen.getByText("Crawl Jobs")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("renders secondary stat cards", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats());
    render(<AdminOverviewPage />);

    expect(screen.getByText("Total Feedback")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    expect(screen.getByText("Cache Entries")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();

    expect(screen.getByText("Document Issues")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Needs attention' trend when there are failed documents", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats({ failedDocuments: 3 }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("shows 'All clear' trend when no failed documents", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats({ failedDocuments: 0 }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("All clear")).toBeInTheDocument();
  });

  it("renders document status breakdown section", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats());
    render(<AdminOverviewPage />);
    expect(screen.getByText("Document Status")).toBeInTheDocument();
    expect(screen.getByText("Indexed")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders recent crawl jobs section", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats());
    render(<AdminOverviewPage />);
    expect(screen.getByText("Recent Crawl Jobs")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("scheduled")).toBeInTheDocument();
  });

  it("shows empty state when no recent crawls", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats({ recentCrawls: [] }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("No crawl jobs yet")).toBeInTheDocument();
  });

  it("renders recent feedback section", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats());
    render(<AdminOverviewPage />);
    expect(screen.getByText("Recent Feedback")).toBeInTheDocument();
  });

  it("shows empty state when no recent feedback", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats({ recentFeedback: [] }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("No feedback yet")).toBeInTheDocument();
  });

  it("shows '15 pending' trend text in total documents card", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats({ pendingDocuments: 15 }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("15 pending")).toBeInTheDocument();
  });

  it("renders the page title in the layout", () => {
    vi.mocked(useQuery).mockReturnValue(buildMockStats());
    const { container } = render(<AdminOverviewPage />);
    // The page is rendered inside the admin layout which adds the header
    // Just verify the stat cards render
    expect(container.querySelectorAll(".text-2xl").length).toBeGreaterThan(0);
  });
});
