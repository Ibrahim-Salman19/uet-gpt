"use client";

import { Bell, Database, Globe, RotateCcw, Save, Shield } from "lucide-react";
import { useState } from "react";
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

interface SettingsSection {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  fields: {
    key: string;
    label: string;
    type: "text" | "number" | "boolean" | "select";
    defaultValue: string | number | boolean;
    options?: { label: string; value: string }[];
  }[];
}

const settingsSections: SettingsSection[] = [
  {
    key: "crawl",
    label: "Crawling",
    description: "Configure crawling behavior and limits",
    icon: <Globe className="h-4 w-4" />,
    fields: [
      {
        key: "maxPagesPerCrawl",
        label: "Max Pages Per Crawl",
        type: "number",
        defaultValue: 500,
      },
      {
        key: "maxCrawlDepth",
        label: "Max Crawl Depth",
        type: "number",
        defaultValue: 5,
      },
      {
        key: "crawlIntervalHours",
        label: "Crawl Interval (hours)",
        type: "number",
        defaultValue: 24,
      },
      {
        key: "autoCrawlEnabled",
        label: "Auto-crawl enabled",
        type: "boolean",
        defaultValue: true,
      },
    ],
  },
  {
    key: "rag",
    label: "RAG Pipeline",
    description: "Control retrieval and generation settings",
    icon: <Database className="h-4 w-4" />,
    fields: [
      {
        key: "maxContextChunks",
        label: "Max Context Chunks",
        type: "number",
        defaultValue: 10,
      },
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
      {
        key: "cacheEnabled",
        label: "Semantic cache enabled",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "cacheTTLHours",
        label: "Cache TTL (hours)",
        type: "number",
        defaultValue: 24,
      },
    ],
  },
  {
    key: "notifications",
    label: "Notifications",
    description: "Manage system notifications and alerts",
    icon: <Bell className="h-4 w-4" />,
    fields: [
      {
        key: "crawlCompleted",
        label: "Crawl completed",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "crawlFailed",
        label: "Crawl failed",
        type: "boolean",
        defaultValue: true,
      },
      {
        key: "newFeedback",
        label: "New feedback received",
        type: "boolean",
        defaultValue: false,
      },
      {
        key: "errorAlerts",
        label: "Error alerts",
        type: "boolean",
        defaultValue: true,
      },
    ],
  },
  {
    key: "security",
    label: "Security",
    description: "Access control and security settings",
    icon: <Shield className="h-4 w-4" />,
    fields: [
      {
        key: "requireAuth",
        label: "Require authentication",
        type: "boolean",
        defaultValue: true,
      },
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
  const [settings, setSettings] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const section of settingsSections) {
      for (const field of section.fields) {
        initial[field.key] = field.defaultValue;
      }
    }
    return initial;
  });

  const handleChange = (key: string, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    toast.success("Settings saved", {
      description: "Your changes have been saved successfully.",
    });
  };

  const handleReset = () => {
    const initial: Record<string, any> = {};
    for (const section of settingsSections) {
      for (const field of section.fields) {
        initial[field.key] = field.defaultValue;
      }
    }
    setSettings(initial);
    toast.success("Settings reset", {
      description: "All settings have been reset to defaults.",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
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

      {/* Settings Sections */}
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
