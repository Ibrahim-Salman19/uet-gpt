"use client";

import { X } from "lucide-react";
import * as React from "react";
import { type AccentTheme, usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

export function PreferencesModal() {
  const {
    accentTheme,
    webglEnabled,
    glowEnabled,
    animsEnabled,
    soundsEnabled,
    typingAnimEnabled,
    typingSoundEnabled,
    settingsOpen,
    setSettingsOpen,
    setAccentTheme,
    toggleSetting,
    resetPreferences,
  } = usePreferences();

  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !mounted) return;


    if (settingsOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [settingsOpen]);

  const handleClose = () => {
    setSettingsOpen(false);
  };

  const renderToggle = (
    id: string,
    checked: boolean,
    onClick: () => void,
    label: string,
    description: string,
  ) => {
    return (
      <div className="flex items-start justify-between gap-4 py-4 first:pt-0 border-b border-white/5 last:border-none">
        <label htmlFor={id} className="flex-1 cursor-pointer">
          <div className="text-[13px] font-medium text-zinc-200 font-sans">{label}</div>
          <div className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed pr-4 font-sans">
            {description}
          </div>
        </label>
        <button
          id={id}
          role="switch"
          aria-checked={checked}
          onClick={onClick}
          className={cn(
            "w-11 h-6 shrink-0 rounded-full relative transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none cursor-pointer",
            checked ? "bg-[var(--accent)]" : "bg-zinc-700",
          )}
        >
          <span
            className={cn(
              "absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm pointer-events-none",
              checked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>
    );
  };

  if (!mounted) return null;

  return (
    <dialog

      ref={dialogRef}
      id="settings-modal"
      onClose={handleClose}
      className="fixed inset-0 z-[100] m-auto bg-transparent p-0 w-full max-w-[400px] border-none outline-none"
    >
      <div className="bg-[var(--surface-3)] border border-[var(--surface-4)] rounded-[1.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col pointer-events-auto">
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center bg-zinc-950/50">
          <h2 className="text-sm font-semibold text-zinc-100 tracking-wide font-sans">
            Preferences
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-95 cursor-pointer"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-2 max-h-[380px] overflow-y-auto custom-scroll">
          {renderToggle(
            "toggle-webgl",
            webglEnabled,
            () => toggleSetting("webgl"),
            "High Performance Mode (WebGL)",
            "Enables the dynamic 3D WebGL particle background behind the chat container.",
          )}

          {renderToggle(
            "toggle-glow",
            glowEnabled,
            () => toggleSetting("glow"),
            "Ambient Tracking Glow",
            "Enables dynamic, mouse-tracking liquid gradients across the application shell.",
          )}

          {renderToggle(
            "toggle-anims",
            animsEnabled,
            () => toggleSetting("anims"),
            "Micro-Animations",
            "Enables hover transitions, toolbars, and scroll entry reveals. Turn off for maximum UI speed.",
          )}

          {renderToggle(
            "toggle-sounds",
            soundsEnabled,
            () => toggleSetting("sounds"),
            "UI Sound Effects",
            "Enables haptic-like synthesized electronic sound chimes on user interactions and chat receipts.",
          )}

          {renderToggle(
            "toggle-typing-anim",
            typingAnimEnabled,
            () => toggleSetting("typingAnim"),
            "Typing Animation",
            "Enables progressive character-scrambling text reveal effects on advisor responses.",
          )}

          {renderToggle(
            "toggle-typing-sound",
            typingSoundEnabled,
            () => toggleSetting("typingSound"),
            "Typing Sound Effect",
            "Plays synthesized keyboard clicks as text progressively renders.",
          )}

          {/* Accent Color Selection */}
          <div className="space-y-3 pt-6 border-t border-white/5">
            <label className="text-[13px] font-medium text-zinc-200 font-sans">Accent Theme</label>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {(["indigo", "violet", "sky", "amber", "navy"] as AccentTheme[]).map((theme) => {
                const colors: Record<AccentTheme, string> = {
                  indigo: "bg-[#4f46e5]",
                  violet: "bg-[#8b5cf6]",
                  sky: "bg-[#0ea5e9]",
                  amber: "bg-[#f59e0b]",
                  navy: "bg-[#c8963e]", // UET Gold
                };
                return (
                  <button
                    key={theme}
                    onClick={() => setAccentTheme(theme)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 rounded-xl border bg-zinc-950/40 text-center transition-all duration-200 active:scale-95 group focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none cursor-pointer",
                      accentTheme === theme
                        ? "border-white/30 bg-white/10"
                        : "border-white/5 hover:border-white/10",
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 h-4 rounded-full border border-white/10 shrink-0",
                        colors[theme],
                      )}
                    ></span>
                    <span className="text-[9px] font-mono text-zinc-400 capitalize">{theme}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/5 bg-zinc-950 flex justify-between items-center">
          <button
            onClick={resetPreferences}
            className="px-4 py-2 border border-white/5 hover:border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white rounded-lg text-xs font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none active:scale-95 cursor-pointer font-sans"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-zinc-100 text-zinc-900 rounded-lg text-xs font-semibold hover:bg-white transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none active:scale-95 cursor-pointer font-sans"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
