"use client";

import { api } from "convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Bell, Database, Globe, RotateCcw, Save, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LoadingState } from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface SettingsField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  defaultValue: string | number | boolean;
  options?: { label: string; value: string }[];
}

interface SettingsSection {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fields: SettingsField[];
}

const defaultSettings: Record<string, string | number | boolean> = {
  maxPagesPerCrawl: 500,
  maxCrawlDepth: 5,
  crawlIntervalHours: 24,
  autoCrawlEnabled: true,
  maxContextChunks: 10,
  similarityThreshold: 0.7,
  defaultModel: "llama-3.3-70b-versatile",
  cacheEnabled: true,
  cacheTTLHours: 24,
  crawlCompleted: true,
  crawlFailed: true,
  newFeedback: false,
  errorAlerts: true,
  requireAuth: true,
  allowGuestAccess: false,
  rateLimitPerMinute: 60,
};

const settingsSections: SettingsSection[] = [
  {
    key: "crawl",
    label: "Crawling",
    description: "Configure university web indexers and crawl depths",
    icon: <Globe className="h-4 w-4" />,
    fields: [
      { key: "maxPagesPerCrawl", label: "Max Pages Per Crawl", type: "number", defaultValue: 500 },
      { key: "maxCrawlDepth", label: "Max Crawl Depth", type: "number", defaultValue: 5 },
      {
        key: "crawlIntervalHours",
        label: "Crawl Interval (hours)",
        type: "number",
        defaultValue: 24,
      },
      { key: "autoCrawlEnabled", label: "Auto-crawl enabled", type: "boolean", defaultValue: true },
    ],
  },
  {
    key: "rag",
    label: "RAG Pipeline",
    description: "Adjust threshold matching, context count, and models",
    icon: <Database className="h-4 w-4" />,
    fields: [
      { key: "maxContextChunks", label: "Max Context Chunks", type: "number", defaultValue: 10 },
      {
        key: "similarityThreshold",
        label: "Similarity Threshold",
        type: "number",
        defaultValue: 0.7,
      },
      {
        key: "defaultModel",
        label: "Default Model",
        type: "select",
        defaultValue: "llama-3.3-70b-versatile",
        options: [
          { label: "Llama 3.3 70B", value: "llama-3.3-70b-versatile" },
          { label: "Llama 3.1 8B", value: "llama-3.1-8b-instant" },
          { label: "Mixtral 8x7B", value: "mixtral-8x7b-32768" },
        ],
      },
      { key: "cacheEnabled", label: "Semantic cache enabled", type: "boolean", defaultValue: true },
      { key: "cacheTTLHours", label: "Cache TTL (hours)", type: "number", defaultValue: 24 },
    ],
  },
  {
    key: "notifications",
    label: "System Alerts",
    description: "Toggle notifications for indexing and feedback status",
    icon: <Bell className="h-4 w-4" />,
    fields: [
      { key: "crawlCompleted", label: "Crawl completed", type: "boolean", defaultValue: true },
      { key: "crawlFailed", label: "Crawl failed", type: "boolean", defaultValue: true },
      { key: "newFeedback", label: "New feedback received", type: "boolean", defaultValue: false },
      { key: "errorAlerts", label: "Error alerts", type: "boolean", defaultValue: true },
    ],
  },
  {
    key: "security",
    label: "Security Gates",
    description: "Manage global endpoint rate limiting and authentication",
    icon: <Shield className="h-4 w-4" />,
    fields: [
      { key: "requireAuth", label: "Require authentication", type: "boolean", defaultValue: true },
      {
        key: "allowGuestAccess",
        label: "Allow guest access",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "rateLimitPerMinute",
        label: "Rate limit (requests/minute)",
        type: "number",
        defaultValue: 60,
      },
    ],
  },
];

export default function AdminSettingsPage() {
  const dbSettings = useQuery(api.admin.settings.getSettings, {});
  const upsertSettingsBatch = useMutation(api.admin.settings.upsertSettingsBatch);
  const resetSettings = useMutation(api.admin.settings.resetSettings);

  const [settings, setSettings] =
    useState<Record<string, string | number | boolean>>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (dbSettings && !loaded) {
      const merged = { ...defaultSettings };
      for (const s of dbSettings) {
        merged[s.key] = s.value as string | number | boolean;
      }
      setSettings(merged);
      setLoaded(true);
    }
  }, [dbSettings, loaded]);

  const handleChange = useCallback((key: string, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const settingsToSave: { key: string; value: string | number | boolean; section: string }[] =
        [];
      for (const section of settingsSections) {
        for (const field of section.fields) {
          const value = settings[field.key];
          if (value !== undefined) {
            settingsToSave.push({ key: field.key, value, section: section.key });
          }
        }
      }
      await upsertSettingsBatch({ settings: settingsToSave });
      toast.success("Settings saved successfully", {
        description: "Your system changes are now active.",
      });
    } catch (error) {
      toast.error("Failed to save settings", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [settings, upsertSettingsBatch]);

  const handleReset = useCallback(async () => {
    try {
      await resetSettings({ confirm: true });
      setSettings(defaultSettings);
      toast.success("Settings reset to default values", {
        description: "All configuration keys have been restored.",
      });
    } catch (error) {
      toast.error("Failed to reset settings", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [resetSettings]);

  if (dbSettings === undefined) {
    return <LoadingState type="admin-settings" />;
  }

  return (
    <div className="space-y-6 animate-[slide-up_0.3s_ease-[var(--ease-out-expo)]_both]">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
        <div>
          <h2 className="text-sm font-semibold text-zinc-400 font-mono tracking-tight uppercase">
            [ CONTROL_PANEL: SYSTEM SETTINGS ]
          </h2>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">
            Configure application runtime settings and neural pipeline gates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 border-white/5 bg-[#101012]/40 text-xs font-mono tracking-wider hover:bg-white/5 hover:text-white transition-all active:scale-[0.98]"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-2 text-zinc-400" />
            RESET
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            className="h-8 bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent-hover)] font-mono text-xs font-semibold tracking-wider transition-all active:scale-[0.98]"
          >
            <Save className="h-3.5 w-3.5 mr-2" />
            SAVE CHANGES
          </Button>
        </div>
      </div>

      {/* Split Pane Sections */}
      <div className="border border-white/5 rounded-xl bg-[#101012]/20 px-6 py-2 divide-y divide-white/[0.04]">
        {settingsSections.map((section) => (
          <div
            key={section.key}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8 py-6 first:pt-4 last:pb-4"
          >
            {/* Left Pane: Info and Meta */}
            <div className="space-y-1.5 pr-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-[var(--accent)]/10 flex items-center justify-center border border-[var(--accent)]/20 text-[var(--accent)]">
                  {section.icon}
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 font-mono">
                  {section.label}
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 font-sans leading-relaxed">
                {section.description}
              </p>
            </div>

            {/* Right Pane: Controls/Inputs (spans 2) */}
            <div className="lg:col-span-2 space-y-4">
              {section.fields.map((field) => (
                <div
                  key={field.key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-2 border-b border-white/[0.02] last:border-0"
                >
                  <div className="flex-1">
                    <Label htmlFor={field.key} className="text-xs font-sans text-zinc-300">
                      {field.label}
                    </Label>
                    <span className="block text-[9px] font-mono text-zinc-600 mt-0.5">
                      KEY: {field.key.toUpperCase()}
                    </span>
                  </div>
                  <div className="w-full sm:w-[220px] shrink-0">
                    {field.type === "boolean" ? (
                      <div className="flex items-center justify-end sm:justify-start h-9">
                        <Switch
                          id={field.key}
                          checked={settings[field.key] as boolean}
                          onCheckedChange={(checked) => handleChange(field.key, checked)}
                          className="data-[state=checked]:bg-[var(--accent)]"
                        />
                      </div>
                    ) : field.type === "select" ? (
                      <Select
                        value={settings[field.key] as string}
                        onValueChange={(value) => handleChange(field.key, value)}
                      >
                        <SelectTrigger className="h-9 bg-black/40 border-white/5 text-xs font-mono rounded text-zinc-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#101012] border-white/10 text-xs font-mono text-zinc-300">
                          {field.options?.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={field.key}
                        type={field.type}
                        value={settings[field.key] as string}
                        onChange={(e) =>
                          handleChange(
                            field.key,
                            field.type === "number" ? Number(e.target.value) : e.target.value,
                          )
                        }
                        className="h-9 bg-black/40 border-white/5 text-xs font-mono rounded text-zinc-300 focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
