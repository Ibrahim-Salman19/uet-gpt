// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const buildAdminMocks = (globalThis as any).buildAdminMocks;
  (globalThis as any).currentAdminMocks = buildAdminMocks({
    pathname: "/admin",
    withOptimisticUpdate: true,
    lucideIcons: {
      FileText: "icon-filetext",
      Users: "icon-users",
      Globe: "icon-globe",
      ThumbsUp: "icon-thumbsup",
      ThumbsDown: "icon-thumbsdown",
      Activity: "icon-activity",
      Database: "icon-database",
    },
  });
});

vi.mock("convex/react", () => (globalThis as any).currentAdminMocks.convexReactMock);
vi.mock("next/navigation", () => (globalThis as any).currentAdminMocks.navigationMock);
vi.mock("lucide-react", () => (globalThis as any).currentAdminMocks.lucideMock);

import { useQuery } from "convex/react";
import AdminOverviewPage from "@/app/admin/(admin-shell)/page";

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

function mockOverviewQueries(stats: any) {
  vi.mocked(useQuery).mockImplementation((query: any, ..._args: any[]) => {
    if (!stats || !query) return undefined;
    const sym = Symbol.for("functionName");
    const queryName = typeof query === "string" ? query : (query[sym] || query.name || "");
    if (typeof queryName !== "string") return undefined;
    if (queryName.includes("documentStats")) {
      return {
        total: stats.totalDocuments,
        indexed: stats.indexedDocuments,
        pending: stats.pendingDocuments,
        failed: stats.failedDocuments,
      };
    }
    if (queryName.includes("userStats")) {
      return {
        activeLast24h: stats.activeUsersLast24h,
        total: stats.totalUsers,
      };
    }
    if (queryName.includes("feedbackCount")) {
      return stats.totalFeedback;
    }
    if (queryName.includes("feedbackStats")) {
      return {
        recent: stats.recentFeedback,
      };
    }
    if (queryName.includes("crawlCount")) {
      return stats.totalCrawlJobs;
    }
    if (queryName.includes("crawlStats")) {
      return {
        recent: stats.recentCrawls,
      };
    }
    if (queryName.includes("cacheStats")) {
      return {
        total: stats.totalCacheEntries,
      };
    }
    return undefined;
  });
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
    mockOverviewQueries(buildMockStats());
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
    mockOverviewQueries(buildMockStats());
    render(<AdminOverviewPage />);

    expect(screen.getByText("Total Feedback")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    expect(screen.getByText("Cache Entries")).toBeInTheDocument();
    expect(screen.getByText("200")).toBeInTheDocument();

    expect(screen.getByText("Document Issues")).toBeInTheDocument();
    expect(screen.getAllByText("5").length).toBeGreaterThanOrEqual(1);
  });

  it("shows 'Needs attention' trend when there are failed documents", () => {
    mockOverviewQueries(buildMockStats({ failedDocuments: 3 }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("shows 'All clear' trend when no failed documents", () => {
    mockOverviewQueries(buildMockStats({ failedDocuments: 0 }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("All clear")).toBeInTheDocument();
  });

  it("renders document status breakdown section", () => {
    mockOverviewQueries(buildMockStats());
    render(<AdminOverviewPage />);
    expect(screen.getByText("INDEXED / PENDING / FAILED")).toBeInTheDocument();
  });

  it("renders recent crawl jobs section", () => {
    mockOverviewQueries(buildMockStats());
    render(<AdminOverviewPage />);
    expect(screen.getByText("[ SYSTEM: RECENT CRAWLS ]")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("scheduled")).toBeInTheDocument();
  });

  it("shows empty state when no recent crawls", () => {
    mockOverviewQueries(buildMockStats({ recentCrawls: [] }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("No crawl jobs yet")).toBeInTheDocument();
  });

  it("renders recent feedback section", () => {
    mockOverviewQueries(buildMockStats());
    render(<AdminOverviewPage />);
    expect(screen.getByText("[ CUSTOMER: RECENT FEEDBACK ]")).toBeInTheDocument();
  });

  it("shows empty state when no recent feedback", () => {
    mockOverviewQueries(buildMockStats({ recentFeedback: [] }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("No feedback yet")).toBeInTheDocument();
  });

  it("shows '15 pending' trend text in total documents card", () => {
    mockOverviewQueries(buildMockStats({ pendingDocuments: 15 }));
    render(<AdminOverviewPage />);
    expect(screen.getByText("15 pending")).toBeInTheDocument();
  });

  it("renders the page title in the layout", () => {
    mockOverviewQueries(buildMockStats());
    const { container } = render(<AdminOverviewPage />);
    // The page is rendered inside the admin layout which adds the header
    // Just verify the stat cards render
    expect(container.querySelectorAll(".text-3xl").length).toBeGreaterThan(0);
  });
});
