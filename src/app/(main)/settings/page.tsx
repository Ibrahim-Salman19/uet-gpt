"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { ChevronRight, Download, Info, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useStableQuery } from "@/hooks/use-stable-query";
import { cn } from "@/lib/utils";

const FONT_SIZES = [
  { value: "small", label: "Small", desc: "14px" },
  { value: "medium", label: "Medium", desc: "16px" },
  { value: "large", label: "Large", desc: "18px" },
] as const;

const MODELS = [
  { value: "llama-4-scout", label: "UET-Pro", desc: "Best quality (Deep)" },
  { value: "llama-3.1-8b", label: "UET-Fast", desc: "Fastest (Default)" },
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
        <h3 className="text-xs font-semibold text-zinc-200 tracking-wide uppercase font-sans">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed font-sans">
            {description}
          </p>
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
  onKeyDown,
}: {
  value: T;
  selected: T;
  label: string;
  description: string;
  onChange: (value: T) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  const isSelected = selected === value;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      // Roving tabindex: only the selected option is in the tab order; arrow
      // keys move between options within the group.
      tabIndex={isSelected ? 0 : -1}
      data-radio-value={value}
      onClick={() => onChange(value)}
      onKeyDown={onKeyDown}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-300 cursor-pointer active:scale-[0.99]",
        isSelected
          ? "border-[var(--accent)]/40 bg-[var(--accent)]/5 shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
          : "border-white/5 bg-[var(--surface-3)]/40 hover:border-white/10 hover:bg-[var(--surface-3)]/60",
      )}
    >
      <div
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
          isSelected
            ? "border-[var(--accent)] bg-[var(--accent)]/10"
            : "border-zinc-700 bg-transparent",
        )}
      >
        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-zinc-200 block font-sans">{label}</span>
        <p className="text-[10px] text-zinc-500 font-sans mt-0.5">{description}</p>
      </div>
    </button>
  );
}

function RadioGroup<T extends string>({
  label,
  selected,
  options,
  onChange,
}: {
  label: string;
  selected: T;
  options: readonly { value: T; label: string; desc: string }[];
  onChange: (value: T) => void;
}) {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: T) => {
    const currentIndex = options.findIndex((opt) => opt.value === value);
    if (currentIndex === -1) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % options.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + options.length) % options.length;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = options[nextIndex];
    onChange(next.value);
    // Move focus to the newly-selected option to keep the roving tabindex
    // in sync with the visual selection.
    const group = event.currentTarget.closest('[role="radiogroup"]');
    const target = group?.querySelector<HTMLButtonElement>(`[data-radio-value="${next.value}"]`);
    target?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      {options.map((opt) => (
        <RadioOption
          key={opt.value}
          value={opt.value}
          selected={selected}
          label={opt.label}
          description={opt.desc}
          onChange={onChange}
          onKeyDown={(event) => handleKeyDown(event, opt.value)}
        />
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const userData = useStableQuery(api.users.getByClerkId, user?.id ? { clerkId: user.id } : "skip");
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [fontSize, setFontSize] = useState<string>("medium");
  const [model, setModel] = useState<string>("llama-3.1-8b");

  useEffect(() => {
    if (userData?.preferences?.fontSize) {
      setFontSize(userData.preferences.fontSize);
    }
    if (userData?.preferences?.model) {
      setModel(userData.preferences.model);
    }
  }, [userData?.preferences?.fontSize, userData?.preferences?.model]);

  const handleFontSizeChange = async (value: string) => {
    setFontSize(value);
    try {
      await updatePreferences({ fontSize: value });
      toast.success("Font size saved successfully");
    } catch {
      toast.error("Failed to save font size preference");
    }
  };

  const handleModelChange = async (value: string) => {
    setModel(value);
    try {
      await updatePreferences({ model: value });
      toast.success("Model preference saved successfully");
    } catch {
      toast.error("Failed to save model preference");
    }
  };

  const handleExport = () => {
    toast.info("Export functionality is coming in a future update.");
  };

  const handleDeleteData = () => {
    toast.error("This action cannot be undone. Contact support.");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--surface-5)] bg-[var(--surface-1)]/60 backdrop-blur-md px-3 py-3 md:px-6 md:py-5 sticky top-0 z-10">
        <h1 className="text-base font-semibold text-zinc-100 font-sans tracking-tight">Settings</h1>
        <p className="text-xs text-zinc-500 mt-0.5 font-sans">
          Manage your application preferences
        </p>
      </div>

      <ScrollArea className="flex-1 bg-transparent">
        <div className="mx-auto max-w-2xl px-3 py-4 md:px-6 md:py-6 space-y-6 pb-20 md:pb-8">
          <SettingsSection title="Account" description="Manage your profile">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[var(--surface-3)]/40 backdrop-blur-sm px-4 py-3">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-10 w-10 rounded-[10px]",
                  },
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-200 font-sans truncate">
                  {user?.fullName ?? "User"}
                </p>
                <p className="text-[10px] text-zinc-500 font-sans truncate mt-0.5">
                  {user?.primaryEmailAddress?.emailAddress ?? ""}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-600" />
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          <SettingsSection title="Theme" description="Control how UET GPT looks">
            <div className="flex items-center gap-2">
              <ThemeToggle />
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          <SettingsSection title="Font Size" description="Adjust the text size in chat messages">
            <RadioGroup
              label="Font size"
              selected={fontSize}
              options={FONT_SIZES}
              onChange={handleFontSizeChange}
            />
          </SettingsSection>

          <Separator className="bg-white/5" />

          <SettingsSection title="AI Model" description="Choose the language model for responses">
            <RadioGroup
              label="AI model"
              selected={model}
              options={MODELS}
              onChange={handleModelChange}
            />
          </SettingsSection>

          <Separator className="bg-white/5" />

          <SettingsSection title="Data" description="Export or delete your data">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="flex w-full items-center gap-2.5 rounded-xl border border-white/5 bg-[var(--surface-3)]/40 px-4 py-3 text-xs font-semibold text-zinc-300 transition-all duration-300 hover:bg-[var(--surface-3)]/75 hover:border-white/10 active:scale-[0.98] cursor-pointer font-sans"
              >
                <Download className="h-4 w-4 text-zinc-400" />
                Export chat history
              </button>
              <button
                type="button"
                onClick={handleDeleteData}
                className="flex w-full items-center gap-2.5 rounded-xl border border-red-500/10 bg-red-950/5 px-4 py-3 text-xs font-semibold text-red-400 transition-all duration-300 hover:bg-red-950/15 hover:border-red-500/20 active:scale-[0.98] cursor-pointer font-sans"
              >
                <Trash2 className="h-4 w-4 text-red-400" />
                Delete all data
              </button>
            </div>
          </SettingsSection>

          <Separator className="bg-white/5" />

          <SettingsSection title="About" description="Version and legal information">
            <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-[var(--surface-3)]/40 backdrop-blur-sm px-4 py-3.5">
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                <Info className="h-4 w-4 text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-xs font-semibold text-zinc-200 font-sans">UET GPT v0.1.0</p>
                <p className="text-[10px] text-zinc-500 font-sans mt-0.5">
                  Your AI Guide to UET Taxila
                </p>
              </div>
            </div>
          </SettingsSection>
        </div>
      </ScrollArea>
    </div>
  );
}
