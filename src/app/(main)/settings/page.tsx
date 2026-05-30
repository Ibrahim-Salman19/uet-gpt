"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { ChevronRight, Download, Info, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const FONT_SIZES = [
  { value: "small", label: "Small", desc: "14px" },
  { value: "medium", label: "Medium", desc: "16px" },
  { value: "large", label: "Large", desc: "18px" },
] as const;

const MODELS = [
  { value: "llama-4-scout", label: "Llama 4 Scout", desc: "Best quality" },
  { value: "llama-3.3-70b", label: "Llama 3.3 70B", desc: "Balanced" },
  { value: "llama-3.1-8b", label: "Llama 3.1 8B", desc: "Fastest" },
] as const;

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4">
      <div className="mb-3">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-[var(--text-secondary)]">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function RadioOption<T extends string>({
  value,
  selected,
  label,
  description,
  onChange,
}: {
  value: T;
  selected: T;
  label: string;
  description: string;
  onChange: (value: T) => void;
}) {
  const id = `radio-${value}`;
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={cn(
        "flex w-full items-center gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-[border-color,background-color] duration-[var(--duration-fast)]",
        selected === value
          ? "border-[var(--accent)] bg-[var(--accent-muted)]/20"
          : "border-[var(--border)] bg-[var(--surface-card)] hover:border-[var(--accent-muted)]",
      )}
    >
      <div
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-[var(--duration-fast)]",
          selected === value ? "border-[var(--accent)]" : "border-[var(--border)]",
        )}
      >
        {selected === value && <div className="h-2 w-2 rounded-full bg-[var(--accent)]" />}
      </div>
      <div className="flex-1">
        <Label
          htmlFor={id}
          className="text-sm font-medium text-[var(--text-primary)] cursor-pointer"
        >
          {label}
        </Label>
        <p className="text-xs text-[var(--text-muted)]">{description}</p>
      </div>
    </button>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const userData = useQuery(api.users.getByClerkId, user?.id ? { clerkId: user.id } : "skip");
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [fontSize, setFontSize] = useState<string>("medium");
  const [model, setModel] = useState<string>("llama-4-scout");

  useEffect(() => {
    if (userData?.preferences?.fontSize) {
      setFontSize(userData.preferences.fontSize);
    }
    if (userData?.preferences?.model) {
      setModel(userData.preferences.model);
    }
  }, [userData]);

  const handleFontSizeChange = async (value: string) => {
    setFontSize(value);
    try {
      await updatePreferences({ fontSize: value });
      toast.success("Font size saved successfully");
    } catch (err) {
      toast.error("Failed to save font size preference");
    }
  };

  const handleModelChange = async (value: string) => {
    setModel(value);
    try {
      await updatePreferences({ model: value });
      toast.success("Model preference saved successfully");
    } catch (err) {
      toast.error("Failed to save model preference");
    }
  };

  const handleExport = () => {
    toast.success("Chat history exported");
  };

  const handleDeleteData = () => {
    toast.error("This action cannot be undone. Contact support.");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--surface-card)] px-6 py-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-secondary)]">Manage your preferences</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-4">
          <SettingsSection title="Account" description="Manage your profile">
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-10 w-10 rounded-[var(--radius-sm)]",
                  },
                }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {user?.fullName ?? "User"}
                </p>
                <p className="text-xs text-[var(--text-muted)]">
                  {user?.primaryEmailAddress?.emailAddress ?? ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
            </div>
          </SettingsSection>

          <Separator className="bg-[var(--border)]" />

          <SettingsSection title="Theme" description="Control how UET GPT looks">
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </SettingsSection>

          <Separator className="bg-[var(--border)]" />

          <SettingsSection title="Font Size" description="Adjust the text size in chat messages">
            <div className="flex flex-col gap-2">
              {FONT_SIZES.map((opt) => (
                <RadioOption
                  key={opt.value}
                  value={opt.value}
                  selected={fontSize}
                  label={opt.label}
                  description={opt.desc}
                  onChange={handleFontSizeChange}
                />
              ))}
            </div>
          </SettingsSection>

          <Separator className="bg-[var(--border)]" />

          <SettingsSection title="AI Model" description="Choose the language model for responses">
            <div className="flex flex-col gap-2">
              {MODELS.map((opt) => (
                <RadioOption
                  key={opt.value}
                  value={opt.value}
                  selected={model}
                  label={opt.label}
                  description={opt.desc}
                  onChange={handleModelChange}
                />
              ))}
            </div>
          </SettingsSection>

          <Separator className="bg-[var(--border)]" />

          <SettingsSection title="Data" description="Export or delete your data">
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start gap-2" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export chat history
              </Button>
              <Button
                variant="outline"
                className="justify-start gap-2 text-[var(--destructive)] hover:text-[var(--destructive)]"
                onClick={handleDeleteData}
              >
                <Trash2 className="h-4 w-4" />
                Delete all data
              </Button>
            </div>
          </SettingsSection>

          <Separator className="bg-[var(--border)]" />

          <SettingsSection title="About" description="Version and legal information">
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
              <Info className="h-5 w-5 text-[var(--primary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">UET GPT v0.1.0</p>
                <p className="text-xs text-[var(--text-muted)]">Your AI Guide to UET Taxila</p>
              </div>
            </div>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
}
