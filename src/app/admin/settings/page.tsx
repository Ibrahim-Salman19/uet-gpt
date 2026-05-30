"use client";

import { api } from "convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Bell, Database, Globe, Loader2, RotateCcw, Save, Shield } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
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
    description: "Configure crawling behavior and limits",
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
    description: "Control retrieval and generation settings",
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
    label: "Notifications",
    description: "Manage system notifications and alerts",
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
    label: "Security",
    description: "Access control and security settings",
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
  const upsertSetting = useMutation(api.admin.settings.upsertSetting);
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
      for (const section of settingsSections) {
        for (const field of section.fields) {
          const value = settings[field.key];
          if (value !== undefined) {
            await upsertSetting({ key: field.key, value, section: section.key });
          }
        }
      }
      toast.success("Settings saved", {
        description: "Your changes have been saved successfully.",
      });
    } catch (error) {
      toast.error("Failed to save settings", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [settings, upsertSetting]);

  const handleReset = useCallback(async () => {
    try {
      await resetSettings();
      setSettings(defaultSettings);
      toast.success("Settings reset", {
        description: "All settings have been reset to defaults.",
      });
    } catch (error) {
      toast.error("Failed to reset settings", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [resetSettings]);

  if (dbSettings === undefined) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">System Settings</h2>
          <p className="text-sm text-muted-foreground">
            Configure application behavior and preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button size="sm" onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-6">
        {settingsSections.map((section) => (
          <Card key={section.key}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {section.icon}
                </div>
                <div>
                  <CardTitle className="text-sm">{section.label}</CardTitle>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {section.fields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor={field.key} className="text-sm">
                        {field.label}
                      </Label>
                    </div>
                    <div className="w-[200px]">
                      {field.type === "boolean" ? (
                        <Switch
                          id={field.key}
                          checked={settings[field.key] as boolean}
                          onCheckedChange={(checked) => handleChange(field.key, checked)}
                        />
                      ) : field.type === "select" ? (
                        <Select
                          value={settings[field.key] as string}
                          onValueChange={(value) => handleChange(field.key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
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
                          onChange={(e) => handleChange(field.key, e.target.value)}
                          className="text-sm"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
