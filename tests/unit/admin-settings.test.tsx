// @vitest-environment happy-dom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const buildAdminMocks = (globalThis as any).buildAdminMocks;
  if (!buildAdminMocks) {
    // Fail loudly instead of silently no-op'ing - a missing global here means
    // the shared admin test setup did not load, which would otherwise surface
    // as confusing "cannot read property of undefined" errors below.
    throw new Error(
      "buildAdminMocks global is not defined - admin test setup did not run (check tests/setup).",
    );
  }
  (globalThis as any).currentAdminMocks = buildAdminMocks({
    pathname: "/admin/settings",
    mockSonner: true,
    lucideIcons: [
      "Settings",
      "Save",
      "RotateCcw",
      "Shield",
      "Bell",
      "Database",
      "RefreshCw",
      "Globe",
    ],
  });
});

vi.mock("convex/react", () => (globalThis as any).currentAdminMocks?.convexReactMock);
vi.mock("lucide-react", () => (globalThis as any).currentAdminMocks.lucideMock);
vi.mock("@/components/ui/card", () => (globalThis as any).currentAdminMocks.cardMock);
vi.mock("@/components/ui/button", () => (globalThis as any).currentAdminMocks.buttonMock);
vi.mock("sonner", () => (globalThis as any).currentAdminMocks.sonnerMock as any);

import AdminSettingsPage from "@/app/admin/(admin-shell)/settings/page";

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
    SelectItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  };
});

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

// Distinct spies per mutation so tests can assert the exact persistence call.
// The page calls useMutation twice per render (upsertSettingsBatch, then
// resetSettings), in that order, on EVERY render — including the re-render
// triggered by the dbSettings-merge useEffect. So we dispatch by call index
// modulo 2: odd calls (1st of each render) → upsert, even calls (2nd) → reset.
// This stays stable across re-renders, unlike a naive callCount===1 check.
let upsertSpy: ReturnType<typeof vi.fn>;
let resetSpy: ReturnType<typeof vi.fn>;

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useQuery).mockReturnValue([]);
    upsertSpy = vi.fn().mockResolvedValue(undefined);
    resetSpy = vi.fn().mockResolvedValue(undefined);
    let callCount = 0;
    vi.mocked(useMutation).mockImplementation(() => {
      callCount += 1;
      // 1st of each render → upsert, 2nd → reset (repeats every render).
      return (callCount % 2 === 1 ? upsertSpy : resetSpy) as any;
    });
  });

  describe("Page Structure", () => {
    it("renders the header with title and description", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("[ CONTROL_PANEL: SYSTEM SETTINGS ]")).toBeDefined();
      expect(
        screen.getByText("Configure application runtime settings and neural pipeline gates"),
      ).toBeDefined();
    });

    it("renders Save Changes and Reset buttons", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("SAVE CHANGES")).toBeDefined();
      expect(screen.getByText("RESET")).toBeDefined();
    });

    it("renders all four settings sections", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Crawling")).toBeDefined();
      expect(screen.getByText("RAG Pipeline")).toBeDefined();
      expect(screen.getByText("System Alerts")).toBeDefined();
      expect(screen.getByText("Security Gates")).toBeDefined();
    });

    it("renders section descriptions", () => {
      render(<AdminSettingsPage />);

      expect(screen.getByText("Configure university web indexers and crawl depths")).toBeDefined();
      expect(
        screen.getByText("Adjust threshold matching, context count, and models"),
      ).toBeDefined();
      expect(
        screen.getByText("Toggle notifications for indexing and feedback status"),
      ).toBeDefined();
      expect(
        screen.getByText("Manage global endpoint rate limiting and authentication"),
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
      expect(optionTexts).toContain("GPT-OSS 120B");
      expect(optionTexts).toContain("GPT-OSS 20B");
      expect(optionTexts).toContain("Mixtral 8x7B");
      expect(optionTexts).toContain("Gemini 3.5 Flash-Lite");
    });

    it("sets correct defaults for RAG fields", () => {
      render(<AdminSettingsPage />);

      // Verify select default value
      const select = screen.getByTestId("native-select") as HTMLSelectElement;
      expect(select.value).toBe("openai/gpt-oss-120b");
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

      expect(select.value).toBe("openai/gpt-oss-120b");
      fireEvent.change(select, {
        target: { value: "mixtral-8x7b-32768" },
      });
      expect(select.value).toBe("mixtral-8x7b-32768");
    });
  });

  describe("Save and Reset", () => {
    it("persists settings via the Convex mutation when Save Changes is clicked", async () => {
      render(<AdminSettingsPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("SAVE CHANGES"));
      });

      // The persistence contract: handleSave must call upsertSettingsBatch with
      // the collected form values, not merely show a toast. Assert the real
      // backend write happened with a non-empty settings array of {key,value,section}.
      await waitFor(() => {
        expect(upsertSpy).toHaveBeenCalledTimes(1);
      });
      const payload = upsertSpy.mock.calls[0]?.[0];
      expect(Array.isArray(payload.settings)).toBe(true);
      expect(payload.settings.length).toBeGreaterThan(0);
      for (const entry of payload.settings) {
        expect(entry).toHaveProperty("key");
        expect(entry).toHaveProperty("value");
        expect(entry).toHaveProperty("section");
      }

      // And only then a success toast (title is the stable, asserted part).
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Settings saved successfully",
          expect.objectContaining({ description: expect.any(String) }),
        );
      });
    });

    it("persists a reset via the Convex mutation when Reset is clicked", async () => {
      render(<AdminSettingsPage />);

      await act(async () => {
        fireEvent.click(screen.getByText("RESET"));
      });

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledWith({ confirm: true });
      });
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          "Settings reset to default values",
          expect.objectContaining({ description: expect.any(String) }),
        );
      });
    });

    it("resets all fields to defaults after changing values", async () => {
      render(<AdminSettingsPage />);

      // Change some values
      const autoCrawlSwitch = screen.getAllByTestId("switch")[0] as HTMLInputElement;
      fireEvent.click(autoCrawlSwitch);
      expect(autoCrawlSwitch.checked).toBe(false);

      // Reset
      await act(async () => {
        fireEvent.click(screen.getByText("RESET"));
      });

      // Values should be back to defaults
      await waitFor(() => {
        const switches = screen.getAllByTestId("switch");
        expect((switches[0] as HTMLInputElement).checked).toBe(true); // autoCrawl back to true
      });
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

      expect(inputs.length + switches.length + selects.length).toBe(fieldKeys.length);

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
