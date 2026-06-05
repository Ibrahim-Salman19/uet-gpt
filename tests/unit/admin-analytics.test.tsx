// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminAnalyticsPage from "@/app/admin/analytics/page";

// Mock convex/react
vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useConvex: vi.fn(),
  useAction: vi.fn(),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  TrendingUp: () => <div data-testid="icon-trending-up">TrendingUp</div>,
  TrendingDown: () => <div data-testid="icon-trending-down">TrendingDown</div>,
  Users: () => <div data-testid="icon-users">Users</div>,
  ThumbsUp: () => <div data-testid="icon-thumbs-up">ThumbsUp</div>,
  ThumbsDown: () => <div data-testid="icon-thumbs-down">ThumbsDown</div>,
  Database: () => <div data-testid="icon-database">Database</div>,
  HardDrive: () => <div data-testid="icon-hard-drive">HardDrive</div>,
  Activity: () => <div data-testid="icon-activity">Activity</div>,
}));

// Mock UI components
vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <div data-testid="card-title">{children}</div>,
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

import { useQuery } from "convex/react";

const mockStats = {
  totalDocuments: 1500,
  totalFeedback: 85,
  totalUsers: 320,
  totalCrawlJobs: 12,
  totalCacheEntries: 450,
  indexedDocuments: 1350,
  pendingDocuments: 120,
  failedDocuments: 30,
  activeUsersLast24h: 45,
  storageUsed: {
    documents: 102400,
    cache: 51200,
    total: 153600,
  },
  recentFeedback: [
    { _id: "f1", rating: "thumbsUp", createdAt: Date.now() },
    { _id: "f2", rating: "thumbsUp", createdAt: Date.now() },
    { _id: "f3", rating: "thumbsDown", createdAt: Date.now() },
    { _id: "f4", rating: "thumbsUp", createdAt: Date.now() },
    { _id: "f5", rating: "thumbsUp", createdAt: Date.now() },
    { _id: "f6", rating: "thumbsDown", createdAt: Date.now() },
    { _id: "f7", rating: "thumbsUp", createdAt: Date.now() },
    { _id: "f8", rating: "thumbsUp", createdAt: Date.now() },
    { _id: "f9", rating: "thumbsDown", createdAt: Date.now() },
    { _id: "f10", rating: "thumbsUp", createdAt: Date.now() },
  ],
  recentCrawls: [
    { _id: "c1", status: "completed", startedAt: Date.now() },
  ],
};

describe("AdminAnalyticsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Loading State", () => {
    it("shows skeleton cards when data is loading", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      render(<AdminAnalyticsPage />);
      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons.length).toBeGreaterThanOrEqual(12);
    });

    it("renders exactly 6 skeleton cards in loading state", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      render(<AdminAnalyticsPage />);
      const cards = screen.getAllByTestId("card");
      expect(cards).toHaveLength(6);
    });
  });

  describe("Usage Metrics Section", () => {
    it("renders Active Users Today card with correct values", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("45")).toBeDefined();
      expect(screen.getByText("320 total users")).toBeDefined();
    });

    it("renders Satisfaction Rate card with computed percentage", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      // 7 thumbsUp out of 10 total = 70%
      expect(screen.getByText("70%")).toBeDefined();
      expect(screen.getByText("7")).toBeDefined(); // positive count
      expect(screen.getByText("3")).toBeDefined(); // negative count
    });

    it("shows 0% satisfaction when there is no recent feedback", () => {
      const noFeedbackStats = {
        ...mockStats,
        recentFeedback: [],
      };
      vi.mocked(useQuery).mockReturnValue(noFeedbackStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("0%")).toBeDefined();
    });

    it("shows 0% satisfaction when all recent feedback is negative", () => {
      const allNegativeStats = {
        ...mockStats,
        recentFeedback: [
          ...Array.from({ length: 5 }, (_, i) => ({
            _id: `n${i}`,
            rating: "thumbsDown" as const,
            createdAt: Date.now(),
          })),
        ],
      };
      vi.mocked(useQuery).mockReturnValue(allNegativeStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("0%")).toBeDefined();
    });

    it("shows 100% satisfaction when all recent feedback is positive", () => {
      const allPositiveStats = {
        ...mockStats,
        recentFeedback: [
          ...Array.from({ length: 5 }, (_, i) => ({
            _id: `p${i}`,
            rating: "thumbsUp" as const,
            createdAt: Date.now(),
          })),
        ],
      };
      vi.mocked(useQuery).mockReturnValue(allPositiveStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("100%")).toBeDefined();
    });
  });

  describe("System Metrics Section", () => {
    it("renders Document Storage card correctly", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("100.0 KB")).toBeDefined();
      expect(screen.getByText("1,500 documents")).toBeDefined();
    });

    it("renders Cache Storage card correctly", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("50.0 KB")).toBeDefined();
      expect(screen.getByText("450 cache entries")).toBeDefined();
    });

    it("renders Total Storage card with combined value", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("150.0 KB")).toBeDefined();
      expect(screen.getByText("Combined document + cache storage")).toBeDefined();
    });
  });

  describe("Document Health Section", () => {
    it("shows indexed document count with percentage", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("1350")).toBeDefined();
      expect(screen.getByText("90% of total")).toBeDefined();
    });

    it("shows 'No documents' when totalDocuments is 0", () => {
      const emptyDocStats = {
        ...mockStats,
        totalDocuments: 0,
        indexedDocuments: 0,
      };
      vi.mocked(useQuery).mockReturnValue(emptyDocStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("No documents")).toBeDefined();
    });

    it("shows pending documents count", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("120")).toBeDefined();
      expect(screen.getByText("Awaiting processing")).toBeDefined();
    });

    it("shows failed documents with investigation notice when > 0", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("30")).toBeDefined();
      expect(screen.getByText("Needs investigation")).toBeDefined();
    });

    it("shows failed documents with 'No issues' when 0", () => {
      const noFailStats = {
        ...mockStats,
        failedDocuments: 0,
      };
      vi.mocked(useQuery).mockReturnValue(noFailStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("0")).toBeDefined();
      expect(screen.getByText("No issues detected")).toBeDefined();
    });

    it("applies red border when failedDocuments > 0", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      const cards = screen.getAllByTestId("card");
      const failedCard = cards.find((c) => c.className?.includes("border-red-500/20"));
      expect(failedCard).toBeDefined();
    });
  });

  describe("Section Structure", () => {
    it("renders all three main sections", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      expect(screen.getByText("Usage Metrics")).toBeDefined();
      expect(screen.getByText("System Metrics")).toBeDefined();
      expect(screen.getByText("Document Health")).toBeDefined();
    });

    it("renders two separators between sections", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      const separators = screen.getAllByTestId("separator");
      expect(separators).toHaveLength(2);
    });

    it("renders correct number of metric cards in each section", () => {
      vi.mocked(useQuery).mockReturnValue(mockStats);
      render(<AdminAnalyticsPage />);

      const cards = screen.getAllByTestId("card");
      // 2 usage + 3 system + 3 health = 8 total cards
      expect(cards).toHaveLength(8);
    });
  });
});
