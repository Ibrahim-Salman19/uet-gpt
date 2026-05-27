import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminFeedbackPage from "@/app/admin/feedback/page";

// Mock convex/react
const mockDeleteFeedback = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => mockDeleteFeedback),
  useConvex: vi.fn(),
  useAction: vi.fn(),
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ThumbsUp: (props: any) => <div data-testid="icon-thumbs-up" {...props}>ThumbsUp</div>,
  ThumbsDown: (props: any) => <div data-testid="icon-thumbs-down" {...props}>ThumbsDown</div>,
  Trash2: (props: any) => <div data-testid="icon-trash" {...props}>Trash2</div>,
  MessageSquare: (props: any) => <div data-testid="icon-message-square" {...props}>MessageSquare</div>,
  Filter: (props: any) => <div data-testid="icon-filter" {...props}>Filter</div>,
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

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, variant, size, className }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      className={className}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className, variant }: any) => (
    <span data-testid="badge" data-variant={variant} className={className}>
      {children}
    </span>
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: any) => <div data-testid="skeleton" {...props} />,
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>,
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, value, onValueChange }: any) => (
    <select
      data-testid="native-select"
      value={value}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => (
    <option value={value}>{children}</option>
  ),
}));

import { useQuery } from "convex/react";

const generateMockFeedback = (count: number, startId = 0) =>
  Array.from({ length: count }, (_, i) => ({
    _id: `fb${startId + i}`,
    rating: (i % 3 === 0 ? "thumbsDown" : "thumbsUp") as "thumbsUp" | "thumbsDown",
    category: i % 2 === 0 ? "general" : "technical",
    comment: `Feedback comment ${i}`,
    createdAt: Date.now() - i * 100000,
    userId: `user${i}`,
  }));

describe("AdminFeedbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteFeedback.mockReset();
    // Default: confirm returns true
    global.confirm = vi.fn(() => true);
  });

  describe("Loading State", () => {
    it("shows skeleton cards when feedback data is loading", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      render(<AdminFeedbackPage />);

      const skeletons = screen.getAllByTestId("skeleton");
      // Summary cards have skeletons + list cards
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it("shows 5 skeleton list items during loading", () => {
      vi.mocked(useQuery).mockReturnValue(undefined);
      render(<AdminFeedbackPage />);

      const cards = screen.getAllByTestId("card");
      // 3 summary cards + 5 skeleton list items = 8
      expect(cards.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe("Summary Cards", () => {
    it("renders total, positive, and negative feedback counts", () => {
      const feedback = generateMockFeedback(10);
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      expect(screen.getByText("10")).toBeDefined(); // Total
      expect(screen.getAllByText("6")[0]).toBeDefined(); // Positive (non-multiples of 3)
      expect(screen.getByText("4")).toBeDefined(); // Negative (multiples of 3)
    });

    it("shows 0 totals when feedback list is empty", () => {
      vi.mocked(useQuery).mockReturnValue([]);
      render(<AdminFeedbackPage />);

      // Multiple "0" values exist (total, positive, negative) — getAllByText
      const zeros = screen.getAllByText("0");
      expect(zeros.length).toBeGreaterThanOrEqual(1);
    });

    it("shows total count when all feedback is positive", () => {
      const allPositive = Array.from({ length: 5 }, (_, i) => ({
        _id: `p${i}`,
        rating: "thumbsUp" as const,
        category: "general",
        comment: `Positive ${i}`,
        createdAt: Date.now(),
        userId: `u${i}`,
      }));
      vi.mocked(useQuery).mockReturnValue(allPositive);
      render(<AdminFeedbackPage />);

      // Both total and positive count show "5" — use getAllByText
      const fives = screen.getAllByText("5");
      expect(fives.length).toBe(2); // total card + positive card
    });
  });

  describe("Rating Filter", () => {
    it("shows all feedback by default (all filter)", () => {
      const feedback = generateMockFeedback(15);
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      // All 15 should be visible
      for (let i = 0; i < 15; i++) {
        expect(screen.getByText(`Feedback comment ${i}`)).toBeDefined();
      }
    });

    it("filters to show only positive feedback", () => {
      const feedback = generateMockFeedback(15);
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const select = screen.getByTestId("native-select") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "thumbsUp" } });

      // Should only show positive ones (not multiples of 3)
      expect(screen.getByText("Feedback comment 1")).toBeDefined();
      expect(screen.getByText("Feedback comment 2")).toBeDefined();
      expect(screen.queryByText("Feedback comment 3")).toBeNull(); // negative (index % 3 === 0)

      // All negative comments should be hidden (indices 0, 3, 6, 9, 12)
      for (let i = 0; i < 15; i++) {
        if (i % 3 === 0) {
          expect(screen.queryByText(`Feedback comment ${i}`)).toBeNull();
        } else {
          expect(screen.getByText(`Feedback comment ${i}`)).toBeDefined();
        }
      }
    });

    it("filters to show only negative feedback", () => {
      const feedback = generateMockFeedback(15);
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const select = screen.getByTestId("native-select") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "thumbsDown" } });

      // Should only show negative ones (multiples of 3)
      for (let i = 0; i < 15; i++) {
        if (i % 3 === 0) {
          expect(screen.getByText(`Feedback comment ${i}`)).toBeDefined();
        } else {
          expect(screen.queryByText(`Feedback comment ${i}`)).toBeNull();
        }
      }
    });

    it("shows empty message when filter yields no results", () => {
      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsUp" as const,
          category: "general",
          comment: "Only positive",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const select = screen.getByTestId("native-select") as HTMLSelectElement;
      fireEvent.change(select, { target: { value: "thumbsDown" } });

      expect(screen.getByText("No feedback matches your filter")).toBeDefined();
    });

    it("shows 'No feedback yet' when list is empty and no filter is active", () => {
      vi.mocked(useQuery).mockReturnValue([]);
      render(<AdminFeedbackPage />);

      expect(screen.getByText("No feedback yet")).toBeDefined();
    });
  });

  describe("Feedback Items", () => {
    it("displays feedback rating badge", () => {
      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsUp" as const,
          category: "general",
          comment: "Great!",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      expect(screen.getAllByText("Positive").length).toBeGreaterThanOrEqual(1);
    });

    it("displays negative rating badge", () => {
      const feedback = [
        {
          _id: "fb2",
          rating: "thumbsDown" as const,
          category: "general",
          comment: "Bad",
          createdAt: Date.now(),
          userId: "u2",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      expect(screen.getAllByText("Negative").length).toBeGreaterThanOrEqual(1);
    });

    it("displays category badge when present", () => {
      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsUp" as const,
          category: "technical",
          comment: "API issue",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      expect(screen.getByText("technical")).toBeDefined();
    });

    it("displays feedback comment text", () => {
      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsUp" as const,
          category: "general",
          comment: "This is a great product!",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      expect(screen.getByText("This is a great product!")).toBeDefined();
    });

    it("displays formatted date", () => {
      const createdAt = Date.now();
      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsUp" as const,
          category: "general",
          comment: "Great!",
          createdAt,
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const dateStr = new Date(createdAt).toLocaleString();
      expect(
        screen.getByText((content) => content.includes(dateStr)),
      ).toBeDefined();
    });
  });

  describe("Delete Functionality", () => {
    it("calls deleteFeedback mutation on delete button click", async () => {
      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsDown" as const,
          category: "general",
          comment: "Bad",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const deleteButtons = screen.getAllByTestId("button");
      const deleteBtn = deleteButtons.find(
        (b) => b.className?.includes("text-red-500"),
      );
      expect(deleteBtn).toBeDefined();
      fireEvent.click(deleteBtn!);

      expect(mockDeleteFeedback).toHaveBeenCalledWith({ feedbackId: "fb1" });
    });

    it("does not call deleteFeedback when confirm is cancelled", () => {
      vi.mocked(global.confirm).mockReturnValue(false);

      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsDown" as const,
          category: "general",
          comment: "Bad",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const deleteButtons = screen.getAllByTestId("button");
      const deleteBtn = deleteButtons.find(
        (b) => b.className?.includes("text-red-500"),
      );
      fireEvent.click(deleteBtn!);

      expect(mockDeleteFeedback).not.toHaveBeenCalled();
    });

    it("survives delete when deleteFeedback throws an error", async () => {
      mockDeleteFeedback.mockRejectedValueOnce(new Error("Network error"));

      const feedback = [
        {
          _id: "fb1",
          rating: "thumbsDown" as const,
          category: "general",
          comment: "Bad",
          createdAt: Date.now(),
          userId: "u1",
        },
      ];
      vi.mocked(useQuery).mockReturnValue(feedback);
      render(<AdminFeedbackPage />);

      const deleteButtons = screen.getAllByTestId("button");
      const deleteBtn = deleteButtons.find(
        (b) => b.className?.includes("text-red-500"),
      );
      fireEvent.click(deleteBtn!);

      // Should not throw - the error is caught in the component
      expect(mockDeleteFeedback).toHaveBeenCalled();
    });
  });
});
