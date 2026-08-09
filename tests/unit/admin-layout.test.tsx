// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// Mock @clerk/nextjs
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    isLoaded: true,
    sessionClaims: {
      metadata: {
        role: "admin",
      },
    },
  }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: "clerk_123",
      fullName: "Admin User",
    },
  }),
  ClerkProvider: ({ children }: any) => <>{children}</>,
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Shield: () => <svg data-testid="icon-shield" />,
  LayoutDashboard: () => <svg data-testid="icon-dashboard" />,
  Globe: () => <svg data-testid="icon-globe" />,
  FileText: () => <svg data-testid="icon-filetext" />,
  BarChart3: () => <svg data-testid="icon-barchart" />,
  MessageSquare: () => <svg data-testid="icon-messagesquare" />,
  Settings: () => <svg data-testid="icon-settings" />,
  Users: () => <svg data-testid="icon-users" />,
}));

import { usePathname } from "next/navigation";
import AdminLayout from "@/app/admin/(admin-shell)/layout";

describe("AdminLayout", () => {
  it("renders the admin panel title", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(<AdminLayout><div>Content</div></AdminLayout>);
    expect(screen.getByText("Admin Panel")).toBeTruthy();
  });

  it("renders all navigation items", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(<AdminLayout><div>Content</div></AdminLayout>);
    // Nav items appear in both sidebar and header; use getAllByText
    expect(screen.getAllByText("Overview").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Crawls").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Documents").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Analytics").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Feedback").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
  });

  it("highlights the active nav item based on pathname", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/crawls");
    const { container } = render(<AdminLayout><div>Content</div></AdminLayout>);

    // The active link should have bg-[var(--accent)]/10 class
    const links = container.querySelectorAll("a");
    const crawlsLink = Array.from(links).find((l) => l.textContent?.includes("Crawls"));
    expect(crawlsLink?.className).toContain("bg-[var(--accent)]/10");
    const overviewLink = Array.from(links).find((l) => l.textContent?.includes("Overview"));
    expect(overviewLink?.className).toContain("text-zinc-400");
  });

  it("renders back to app link", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(<AdminLayout><div>Content</div></AdminLayout>);
    expect(screen.getByText("← Back to app")).toBeTruthy();
  });

  it("displays the current page name in the header", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/analytics");
    render(<AdminLayout><div>Content</div></AdminLayout>);
    // Header and sidebar both show "Analytics" - check it appears at least once
    expect(screen.getAllByText("Analytics").length).toBe(2);
  });

  it("renders children content", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(<AdminLayout><div>Child Content</div></AdminLayout>);
    expect(screen.getByText("Child Content")).toBeTruthy();
  });

  it("defaults header to root nav item 'Overview' when pathname does not match another nav item", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/unknown");
    render(<AdminLayout><div>Content</div></AdminLayout>);
    // /admin/unknown starts with /admin/, matching the Overview nav item
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeTruthy();
  });

  it("renders all nav link icons", () => {
    vi.mocked(usePathname).mockReturnValue("/admin");
    render(<AdminLayout><div>Content</div></AdminLayout>);
    expect(screen.getByTestId("icon-shield")).toBeTruthy();
    expect(screen.getByTestId("icon-dashboard")).toBeTruthy();
    expect(screen.getByTestId("icon-globe")).toBeTruthy();
    expect(screen.getByTestId("icon-filetext")).toBeTruthy();
  });
});
