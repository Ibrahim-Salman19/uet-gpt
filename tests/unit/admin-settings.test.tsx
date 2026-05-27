import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AdminSettingsPage from "@/app/admin/settings/page";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  Settings: () => <div data-testid="icon-settings">Settings</div>,
  Save: () => <div data-testid="icon-save">Save</div>,
  RotateCcw: () => <div data-testid="icon-rotate">RotateCcw</div>,
  Shield: () => <div data-testid="icon-shield">Shield</div>,
  Bell: () => <div data-testid="icon-bell">Bell</div>,
  Database: () => <div data-testid="icon-database">Database</div>,
  RefreshCw: () => <div data-testid="icon-refresh">RefreshCw</div>,
  Globe: () => <div data-testid="icon-globe">Globe</div>,
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
  Button: ({ children, onClick, variant, size }: any) => (
    <button
      data-testid="button"
      data-variant={variant}
      data-size={size}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ id, checked, onCheckedChange }: any) => (
    <input
      type="checkbox"
      data-testid="switch"
      id={id}
      checked={checked}
      onChange={(e) => onCheckedChange(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, htmlFor }: any) => (
    <label data-testid="label" htmlFor={htmlFor}>
      {children}
    </label>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: ({ id, type, value, onChange, className }: any) => (
    <input
      data-testid="input"
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      className={className}
      readOnly
    />
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@/components/ui/select", () => {
  const SelectContentMock = ({ children }: any) => <>{children}</>;
  SelectContentMock.displayName = "SelectContent";
  return {
    Select: ({ children, value, onValueChange }: any) => {
      // Flatten children to extract option-like nodes
      const flatten = (nodes: any): any[] => {
        if (!nodes) return [];
        if (!Array.isArray(nodes)) nodes = [nodes];
        const result: any[] = [];
        for (const n of nodes) {
          if (n?.props?.children && (n.type?.displayName === "SelectContent" || n.type === "div")) {
            result.push(...flatten(n.props.children));
          } else {
            result.push(n);
          }
        }
        return result;
      };
      const flat = flatten(children);
      const options = flat.filter(
        (n: any) => n?.props?.value && typeof n.props.value === "string",
      ) as Array<{ props: { value: string; children: string } }>;

      return (
        <select
          data-testid="native-select"
          value={value ?? ""}
          onChange={(e) => onValueChange?.(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt.props.value} value={opt.props.value}>
              {opt.props.children}
            </option>
          ))}
        </select>
      );
    },
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: SelectContentMock,
    SelectItem: ({ children, value }: any) => (
      <div data-value={value}>{children}</div>
    ),
  };
});

import { toast } from "sonner";

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Page Structure", () => {
    it("renders the header with title and description", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("System Settings")).toBeDefined();
      expect(
        screen.getByText("Configure application behavior and preferences"),
      ).toBeDefined();
    });

    it("renders Save Changes and Reset buttons", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Save Changes")).toBeDefined();
      expect(screen.getByText("Reset")).toBeDefined();
    });

    it("renders all four settings sections", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Crawling")).toBeDefined();
      expect(screen.getByText("RAG Pipeline")).toBeDefined();
      expect(screen.getByText("Notifications")).toBeDefined();
      expect(screen.getByText("Security")).toBeDefined();
    });

    it("renders section descriptions", () => {
      render(<AdminSettingsPage />);

      expect(
        screen.getByText("Configure crawling behavior and limits"),
      ).toBeDefined();
      expect(
        screen.getByText("Control retrieval and generation settings"),
      ).toBeDefined();
      expect(
        screen.getByText("Manage system notifications and alerts"),
      ).toBeDefined();
      expect(
        screen.getByText("Access control and security settings"),
      ).toBeDefined();
    });
  });

  describe("Crawling Section", () => {
    it("renders all crawling fields", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Max Pages Per Crawl")).toBeDefined();
      expect(screen.getByText("Max Crawl Depth")).toBeDefined();
      expect(screen.getByText("Crawl Interval (hours)")).toBeDefined();
      expect(screen.getByText("Auto-crawl enabled")).toBeDefined();
    });

    it("has correct default values for crawling fields", () => {
      render(<AdminSettingsPage />);

      const inputs = screen.getAllByTestId("input");
      const switches = screen.getAllByTestId("switch");

      // First 3 inputs are crawling (number), first switch is autoCrawlEnabled
      expect((inputs[0] as HTMLInputElement).value).toBe("500");
      expect((inputs[1] as HTMLInputElement).value).toBe("5");
      expect((inputs[2] as HTMLInputElement).value).toBe("24");
      expect((switches[0] as HTMLInputElement).checked).toBe(true);
    });
  });

  describe("RAG Pipeline Section", () => {
    it("renders all RAG fields", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Max Context Chunks")).toBeDefined();
      expect(screen.getByText("Similarity Threshold")).toBeDefined();
      expect(screen.getByText("Default Model")).toBeDefined();
      expect(screen.getByText("Semantic cache enabled")).toBeDefined();
      expect(screen.getByText("Cache TTL (hours)")).toBeDefined();
    });

    it("renders model options in select dropdown", () => {
      render(<AdminSettingsPage />);

      const selects = screen.getAllByTestId("native-select");
      expect(selects).toHaveLength(1);
      const select = selects[0] as HTMLSelectElement;
      const optionTexts = Array.from(select.options).map((o) => o.text);
      expect(optionTexts).toContain("Llama 3.3 70B");
      expect(optionTexts).toContain("Llama 3.1 8B");
      expect(optionTexts).toContain("Mixtral 8x7B");
    });

    it("sets correct defaults for RAG fields", () => {
      render(<AdminSettingsPage />);

      // Verify select default value
      const select = screen.getByTestId("native-select") as HTMLSelectElement;
      expect(select.value).toBe("llama-3.3-70b-versatile");
    });
  });

  describe("Notifications Section", () => {
    it("renders all notification toggles", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Crawl completed")).toBeDefined();
      expect(screen.getByText("Crawl failed")).toBeDefined();
      expect(screen.getByText("New feedback received")).toBeDefined();
      expect(screen.getByText("Error alerts")).toBeDefined();
    });

    it("has correct default toggle states", () => {
      render(<AdminSettingsPage />);

      const allSwitches = screen.getAllByTestId("switch");
      // All switches in order:
      //   0: autoCrawlEnabled (crawling)
      //   1: cacheEnabled (RAG)
      //   2: crawlCompleted
      //   3: crawlFailed
      //   4: newFeedback
      //   5: errorAlerts
      //   6: requireAuth (security)
      //   7: allowGuestAccess (security)
      const notifSwitches = allSwitches.slice(2, 6);

      expect((notifSwitches[0] as HTMLInputElement).checked).toBe(true); // crawlCompleted
      expect((notifSwitches[1] as HTMLInputElement).checked).toBe(true); // crawlFailed
      expect((notifSwitches[2] as HTMLInputElement).checked).toBe(false); // newFeedback
      expect((notifSwitches[3] as HTMLInputElement).checked).toBe(true); // errorAlerts
    });
  });

  describe("Security Section", () => {
    it("renders all security fields", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Require authentication")).toBeDefined();
      expect(screen.getByText("Allow guest access")).toBeDefined();
      expect(screen.getByText("Rate limit (requests/minute)")).toBeDefined();
    });

    it("has correct default values for security fields", () => {
      render(<AdminSettingsPage />);

      const switches = screen.getAllByTestId("switch");
      const inputs = screen.getAllByTestId("input");

      // Security switches are at indices 6 and 7
      const authSwitch = switches[6];
      const guestSwitch = switches[7];

      expect((authSwitch as HTMLInputElement).checked).toBe(true); // requireAuth
      expect((guestSwitch as HTMLInputElement).checked).toBe(false); // allowGuestAccess

      // Last input (index 6) is rate limit (7 total: 3 crawl + 3 RAG + 1 security)
      const rateInput = inputs[6];
      expect((rateInput as HTMLInputElement).value).toBe("60");
    });
  });

  describe("User Interactions", () => {
    it("toggles a switch and changes a value", () => {
      render(<AdminSettingsPage />);

      const switches = screen.getAllByTestId("switch");
      const autoCrawlSwitch = switches[0] as HTMLInputElement;

      expect(autoCrawlSwitch.checked).toBe(true);
      fireEvent.click(autoCrawlSwitch);
      expect(autoCrawlSwitch.checked).toBe(false);
    });

    it("changes select dropdown value", () => {
      render(<AdminSettingsPage />);

      const select = screen.getByTestId("native-select") as HTMLSelectElement;

      expect(select.value).toBe("llama-3.3-70b-versatile");
      fireEvent.change(select, {
        target: { value: "mixtral-8x7b-32768" },
      });
      expect(select.value).toBe("mixtral-8x7b-32768");
    });
  });

  describe("Save and Reset", () => {
    it("shows success toast when Save Changes is clicked", () => {
      render(<AdminSettingsPage />);

      fireEvent.click(screen.getByText("Save Changes"));

      expect(toast.success).toHaveBeenCalledWith("Settings saved", {
        description: expect.stringContaining("saved successfully"),
      });
    });

    it("shows success toast when Reset is clicked", () => {
      render(<AdminSettingsPage />);

      fireEvent.click(screen.getByText("Reset"));

      expect(toast.success).toHaveBeenCalledWith("Settings reset", {
        description: expect.stringContaining("reset to defaults"),
      });
    });

    it("resets all fields to defaults after changing values", () => {
      render(<AdminSettingsPage />);

      // Change some values
      const autoCrawlSwitch = screen.getAllByTestId("switch")[0] as HTMLInputElement;
      fireEvent.click(autoCrawlSwitch);
      expect(autoCrawlSwitch.checked).toBe(false);

      // Reset
      fireEvent.click(screen.getByText("Reset"));

      // Values should be back to defaults
      const switches = screen.getAllByTestId("switch");
      expect((switches[0] as HTMLInputElement).checked).toBe(true); // autoCrawl back to true
    });
  });

  describe("Total Field Count", () => {
    it("renders all 16 fields across 4 sections", () => {
      render(<AdminSettingsPage />);

      const fieldKeys = [
        "maxPagesPerCrawl",
        "maxCrawlDepth",
        "crawlIntervalHours",
        "autoCrawlEnabled",
        "maxContextChunks",
        "similarityThreshold",
        "defaultModel",
        "cacheEnabled",
        "cacheTTLHours",
        "crawlCompleted",
        "crawlFailed",
        "newFeedback",
        "errorAlerts",
        "requireAuth",
        "allowGuestAccess",
        "rateLimitPerMinute",
      ];

      const inputs = screen.getAllByTestId("input");
      const switches = screen.getAllByTestId("switch");
      const selects = screen.getAllByTestId("native-select");

      expect(inputs.length + switches.length + selects.length).toBe(
        fieldKeys.length,
      );

      // 7 inputs: 3 crawl + 3 RAG (maxContextChunks, similarityThreshold, cacheTTLHours) + 1 security (rateLimitPerMinute)
      expect(inputs).toHaveLength(7);
      // 8 switches: 1 crawl + 1 RAG + 4 notif + 2 security
      expect(switches).toHaveLength(8);
      // 1 select: defaultModel
      expect(selects).toHaveLength(1);
    });

    it("renders all section icons", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByTestId("icon-globe")).toBeDefined();
      expect(screen.getByTestId("icon-database")).toBeDefined();
      expect(screen.getByTestId("icon-bell")).toBeDefined();
      expect(screen.getByTestId("icon-shield")).toBeDefined();
    });
  });
});
