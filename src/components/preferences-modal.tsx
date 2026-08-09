"use client";

import { Check, X } from "lucide-react";
import * as React from "react";
import { type AccentTheme, type FontSize, usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

const ACCENT_OPTIONS: ReadonlyArray<{
  value: AccentTheme;
  label: string;
  swatch: string;
}> = [
  { value: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { value: "violet", label: "Violet", swatch: "#8b5cf6" },
  { value: "sky", label: "Sky", swatch: "#0ea5e9" },
  { value: "amber", label: "Amber", swatch: "#f59e0b" },
  { value: "navy", label: "UET Gold", swatch: "#c8963e" },
];
const FONT_SIZE_OPTIONS: ReadonlyArray<{
  value: FontSize;
  label: string;
  description: string;
}> = [
  { value: "small", label: "Compact", description: "More content on screen" },
  { value: "medium", label: "Comfortable", description: "Balanced default size" },
  { value: "large", label: "Large", description: "Improved reading comfort" },
];

function PreferenceSwitch({
  id,
  checked,
  onToggle,
  label,
  description,
  disabled = false,
}: {
  id: string;
  checked: boolean;
  onToggle: () => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  const descriptionId = `${id}-description`;

  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 py-4 first:pt-0 last:border-none">
      <div className={cn("min-w-0 flex-1", disabled && "opacity-55")}>
        <label
          htmlFor={id}
          className={cn("text-[13px] font-medium text-zinc-200", !disabled && "cursor-pointer")}
        >
          {label}
        </label>
        <p id={descriptionId} className="mt-1.5 pr-4 text-[11px] leading-relaxed text-zinc-500">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none",
          checked ? "bg-[var(--accent)]" : "bg-zinc-700",
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

export function PreferencesModal() {
  const preferences = usePreferences();
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();

  const handleClose = React.useCallback(() => {
    preferences.setSettingsOpen(false);
  }, [preferences.setSettingsOpen]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (preferences.settingsOpen && !dialog.open) {
      try {
        dialog.showModal();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Preferences dialog could not be opened", error);
        }
        preferences.setSettingsOpen(false);
      }
    } else if (!preferences.settingsOpen && dialog.open) {
      dialog.close();
    }
  }, [preferences.settingsOpen, preferences.setSettingsOpen]);

  const handleDialogClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) handleClose();
  };

  const handleAccentKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % ACCENT_OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + ACCENT_OPTIONS.length) % ACCENT_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = ACCENT_OPTIONS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const next = ACCENT_OPTIONS[nextIndex];
    if (!next) return;
    preferences.setAccentTheme(next.value);
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-accent-theme="${next.value}"]`)?.focus();
    });
  };

  const handleFontSizeKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % FONT_SIZE_OPTIONS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + FONT_SIZE_OPTIONS.length) % FONT_SIZE_OPTIONS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = FONT_SIZE_OPTIONS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const next = FONT_SIZE_OPTIONS[nextIndex];
    if (!next) return;
    preferences.setFontSize(next.value);
    requestAnimationFrame(() => {
      document.querySelector<HTMLButtonElement>(`[data-font-size="${next.value}"]`)?.focus();
    });
  };

  return (
    <dialog
      ref={dialogRef}
      id="settings-modal"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={!preferences.preferencesHydrated}
      onCancel={handleClose}
      onClose={handleClose}
      onClick={handleDialogClick}
      className="fixed inset-0 z-[100] m-auto w-[calc(100%_-_2rem)] max-w-[430px] border-none bg-transparent p-0 outline-none backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="pointer-events-auto flex max-h-[min(44rem,calc(100dvh_-_2rem))] flex-col overflow-hidden rounded-[1.5rem] border border-[var(--surface-4)] bg-[var(--surface-3)] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)]">
        <header className="flex shrink-0 items-center justify-between border-b border-white/5 bg-zinc-950/50 px-6 py-5">
          <div>
            <h2 id={titleId} className="text-sm font-semibold tracking-wide text-zinc-100">
              Preferences
            </h2>
            <p id={descriptionId} className="mt-1 text-[11px] text-zinc-500">
              Visual, reading, motion, and audio settings.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            aria-label="Close preferences"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="custom-scroll min-h-0 flex-1 overflow-y-auto p-6">
          <div>
            <PreferenceSwitch
              id="toggle-webgl"
              disabled={!preferences.preferencesHydrated}
              checked={preferences.webglEnabled}
              onToggle={() => preferences.toggleSetting("webgl")}
              label="Animated WebGL backdrop"
              description="Shows a lightweight particle field when hardware acceleration is available. Unsupported or constrained devices automatically use a static fallback."
            />
            <PreferenceSwitch
              id="toggle-glow"
              disabled={!preferences.preferencesHydrated}
              checked={preferences.glowEnabled}
              onToggle={() => preferences.toggleSetting("glow")}
              label="Pointer-tracking ambient glow"
              description="Adds a subtle compositor-animated glow on fine-pointer devices. It is suppressed by reduced-motion and browser-exposed data-saver settings."
            />
            <PreferenceSwitch
              id="toggle-anims"
              disabled={!preferences.preferencesHydrated}
              checked={preferences.animsEnabled}
              onToggle={() => preferences.toggleSetting("anims")}
              label="Interface animations"
              description="Controls non-essential transitions and entry effects. Your operating system’s reduced-motion preference still takes priority."
            />
            <PreferenceSwitch
              id="toggle-sounds"
              disabled={!preferences.preferencesHydrated}
              checked={preferences.soundsEnabled}
              onToggle={() => preferences.toggleSetting("sounds")}
              label="Interface sounds"
              description="Plays short synthesized feedback tones after direct interactions. Sounds are off by default and never autoplay."
            />
            <PreferenceSwitch
              id="toggle-typing-anim"
              disabled={!preferences.preferencesHydrated}
              checked={preferences.typingAnimEnabled}
              onToggle={() => preferences.toggleSetting("typingAnim")}
              label="Progressive response reveal"
              description="Reveals generated responses progressively instead of displaying each received segment immediately."
            />
            <PreferenceSwitch
              id="toggle-typing-sound"
              checked={preferences.typingSoundEnabled}
              onToggle={() => preferences.toggleSetting("typingSound")}
              label="Typing feedback sound"
              description={
                preferences.soundsEnabled
                  ? "Adds a quiet, rate-limited tone during progressive response rendering."
                  : "Enable interface sounds first to use typing feedback."
              }
              disabled={!preferences.preferencesHydrated || !preferences.soundsEnabled}
            />
          </div>

          <fieldset className="mt-6 border-t border-white/5 pt-6">
            <legend className="text-[13px] font-medium text-zinc-200">Accent theme</legend>
            <div
              className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"
              role="radiogroup"
              aria-label="Accent theme"
            >
              {ACCENT_OPTIONS.map((option, index) => {
                const selected = preferences.accentTheme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected && preferences.preferencesHydrated ? 0 : -1}
                    disabled={!preferences.preferencesHydrated}
                    data-accent-theme={option.value}
                    onKeyDown={(event) => handleAccentKeyDown(event, index)}
                    onClick={() => preferences.setAccentTheme(option.value)}
                    className={cn(
                      "relative flex min-h-16 flex-col items-center justify-center gap-2 rounded-xl border bg-zinc-950/40 p-2 text-center transition-[background-color,border-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 motion-reduce:transition-none",
                      selected
                        ? "border-white/30 bg-white/10 text-zinc-100"
                        : "border-white/5 text-zinc-400 hover:border-white/15 hover:text-zinc-200",
                    )}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-white/15 shadow-sm"
                      style={{ backgroundColor: option.swatch }}
                      aria-hidden="true"
                    />
                    <span className="text-[9px] font-medium">{option.label}</span>
                    {selected ? (
                      <Check className="absolute right-1.5 top-1.5 h-3 w-3" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-white/5 pt-6">
            <legend className="text-[13px] font-medium text-zinc-200">Response text size</legend>
            <div
              className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
              role="radiogroup"
              aria-label="Response text size"
            >
              {FONT_SIZE_OPTIONS.map((option, index) => {
                const selected = preferences.fontSize === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected && preferences.preferencesHydrated ? 0 : -1}
                    disabled={!preferences.preferencesHydrated}
                    data-font-size={option.value}
                    onKeyDown={(event) => handleFontSizeKeyDown(event, index)}
                    onClick={() => preferences.setFontSize(option.value)}
                    className={cn(
                      "rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-50",
                      selected
                        ? "border-white/30 bg-white/10 text-zinc-100"
                        : "border-white/5 bg-zinc-950/40 text-zinc-400 hover:border-white/15 hover:text-zinc-200",
                    )}
                  >
                    <span className="block text-xs font-medium">{option.label}</span>
                    <span className="mt-1 block text-[10px] leading-relaxed text-zinc-500">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <footer className="flex shrink-0 items-center justify-between border-t border-white/5 bg-zinc-950 px-6 py-4">
          <button
            type="button"
            onClick={preferences.resetPreferences}
            disabled={!preferences.preferencesHydrated}
            className="rounded-lg border border-white/5 px-4 py-2 text-xs font-medium text-zinc-400 transition-colors hover:border-white/10 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-wait disabled:opacity-50"
          >
            Reset defaults
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-zinc-100 px-5 py-2 text-xs font-semibold text-zinc-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            Done
          </button>
        </footer>
      </div>
    </dialog>
  );
}
