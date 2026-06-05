"use client";

import * as React from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { useUserData } from "@/hooks/use-user-data";

export type AccentTheme = "indigo" | "violet" | "sky" | "amber" | "navy";

export interface PinnedHighlight {
  id: string;
  query: string;
  content: string;
  createdAt: number;
}

interface PreferencesContextType {
  accentTheme: AccentTheme;
  webglEnabled: boolean;
  glowEnabled: boolean;
  animsEnabled: boolean;
  soundsEnabled: boolean;
  typingAnimEnabled: boolean;
  typingSoundEnabled: boolean;
  pinnedHighlights: PinnedHighlight[];
  fontSize: "small" | "medium" | "large";
  modelPreference: "llama-3.1-8b" | "llama-4-scout";
  updateModelPreference: (model: "llama-3.1-8b" | "llama-4-scout") => Promise<void>;

  // Modals
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  diagnosticsOpen: boolean;
  setDiagnosticsOpen: (open: boolean) => void;
  voiceInputOpen: boolean;
  setVoiceInputOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Actions
  setAccentTheme: (theme: AccentTheme) => void;
  toggleSetting: (
    key: "webgl" | "glow" | "anims" | "sounds" | "typingAnim" | "typingSound",
  ) => void;
  resetPreferences: () => void;
  addPin: (query: string, content: string) => void;
  removePin: (id: string) => void;
  isPinned: (query: string) => boolean;

  // Voice transcript callback — set by active ChatInput to receive voice text
  voiceTranscriptCallback: ((text: string) => void) | null;
  setVoiceTranscriptCallback: (fn: ((text: string) => void) | null) => void;

  // Audio Synth
  playTypingSound: () => void;
  playTapSound: () => void;
  playSweepSound: () => void;
  playChimeSound: () => void;
}

const PreferencesContext = React.createContext<PreferencesContextType | null>(null);

const accentThemes: Record<AccentTheme, Record<string, string>> = {
  indigo: {
    "--accent": "oklch(0.63 0.18 265)",
    "--accent-hover": "oklch(0.56 0.21 265)",
    "--accent-active": "oklch(0.48 0.24 265)",
    "--accent-fg": "oklch(0.99 0.005 30)",
    "--accent-muted": "oklch(0.85 0.04 265)",
    "--accent-200": "#a5b4fc",
    "--accent-300": "#818cf8",
    "--accent-400": "#6366f1",
    "--accent-500": "#4f46e5",
    "--accent-600": "#4338ca",
    "--accent-950": "#17171e",
  },
  violet: {
    "--accent": "oklch(0.60 0.20 290)",
    "--accent-hover": "oklch(0.53 0.23 290)",
    "--accent-active": "oklch(0.45 0.26 290)",
    "--accent-fg": "oklch(0.99 0.005 30)",
    "--accent-muted": "oklch(0.85 0.04 290)",
    "--accent-200": "#ddd6fe",
    "--accent-300": "#c084fc",
    "--accent-400": "#a855f7",
    "--accent-500": "#8b5cf6",
    "--accent-600": "#7c3aed",
    "--accent-950": "#1e1b4b",
  },
  sky: {
    "--accent": "oklch(0.65 0.15 220)",
    "--accent-hover": "oklch(0.58 0.18 220)",
    "--accent-active": "oklch(0.50 0.20 220)",
    "--accent-fg": "oklch(0.15 0.01 265)",
    "--accent-muted": "oklch(0.85 0.04 220)",
    "--accent-200": "#bae6fd",
    "--accent-300": "#7dd3fc",
    "--accent-400": "#38bdf8",
    "--accent-500": "#0ea5e9",
    "--accent-600": "#0284c7",
    "--accent-950": "#082f49",
  },
  amber: {
    "--accent": "oklch(0.76 0.17 75)",
    "--accent-hover": "oklch(0.70 0.19 75)",
    "--accent-active": "oklch(0.62 0.21 75)",
    "--accent-fg": "oklch(0.15 0.01 265)",
    "--accent-muted": "oklch(0.88 0.05 75)",
    "--accent-200": "#fde68a",
    "--accent-300": "#fcd34d",
    "--accent-400": "#fbbf24",
    "--accent-500": "#f59e0b",
    "--accent-600": "#d97706",
    "--accent-950": "#451a03",
  },
  navy: {
    "--accent": "oklch(0.68 0.14 75)", // Golden accent theme for UET Identity
    "--accent-hover": "oklch(0.72 0.14 75)",
    "--accent-active": "oklch(0.64 0.13 75)",
    "--accent-fg": "oklch(0.2 0.02 265)",
    "--accent-muted": "oklch(0.85 0.04 75)",
    "--accent-200": "#fde68a",
    "--accent-300": "#fcd34d",
    "--accent-400": "#fbbf24",
    "--accent-500": "#f59e0b",
    "--accent-600": "#d97706",
    "--accent-950": "#451a03",
  },
};

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { convexUser: userData, modelPreference } = useUserData();
  const updatePreferences = useMutation(api.users.updatePreferences);
  const [fontSize, setFontSizeState] = React.useState<"small" | "medium" | "large">("medium");

  const [accentTheme, setAccentThemeState] = React.useState<AccentTheme>("indigo");
  const [webglEnabled, setWebglEnabled] = React.useState(true);
  const [glowEnabled, setGlowEnabled] = React.useState(true);
  const [animsEnabled, setAnimsEnabled] = React.useState(true);
  const [soundsEnabled, setSoundsEnabled] = React.useState(true);
  const [typingAnimEnabled, setTypingAnimEnabled] = React.useState(true);
  const [typingSoundEnabled, setTypingSoundEnabled] = React.useState(true);
  const [pinnedHighlights, setPinnedHighlights] = React.useState<PinnedHighlight[]>([]);

  // Modals state
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [voiceInputOpen, setVoiceInputOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Voice transcript callback reference
  const voiceTranscriptCallbackRef = React.useRef<((text: string) => void) | null>(null);
  const [voiceTranscriptCallback, setVoiceTranscriptCallbackState] = React.useState<((text: string) => void) | null>(null);

  const setVoiceTranscriptCallback = React.useCallback((fn: ((text: string) => void) | null) => {
    voiceTranscriptCallbackRef.current = fn;
    setVoiceTranscriptCallbackState(() => fn);
  }, []);

  // Audio Context Ref
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  // Load from localStorage on mount
  React.useEffect(() => {
    try {
      const storedTheme = localStorage.getItem("pref-accent-theme") as AccentTheme;
      if (storedTheme && accentThemes[storedTheme]) {
        setAccentThemeState(storedTheme);
      }

      const storedWebgl = localStorage.getItem("pref-webgl");
      if (storedWebgl !== null) setWebglEnabled(storedWebgl === "true");

      const storedGlow = localStorage.getItem("pref-glow");
      if (storedGlow !== null) setGlowEnabled(storedGlow === "true");

      const storedAnims = localStorage.getItem("pref-anims");
      if (storedAnims !== null) setAnimsEnabled(storedAnims === "true");

      const storedSounds = localStorage.getItem("pref-sounds");
      if (storedSounds !== null) setSoundsEnabled(storedSounds === "true");

      const storedTypingAnim = localStorage.getItem("pref-typing-anim");
      if (storedTypingAnim !== null) setTypingAnimEnabled(storedTypingAnim === "true");

      const storedTypingSound = localStorage.getItem("pref-typing-sound");
      if (storedTypingSound !== null) setTypingSoundEnabled(storedTypingSound === "true");

      const storedPins = localStorage.getItem("pref-pinned-highlights");
      if (storedPins) {
        setPinnedHighlights(JSON.parse(storedPins));
      }

      const storedFontSize = localStorage.getItem("pref-font-size") as "small" | "medium" | "large";
      if (storedFontSize === "small" || storedFontSize === "medium" || storedFontSize === "large") {
        setFontSizeState(storedFontSize);
      }
    } catch (e) {
      console.error("Failed to load preferences from local storage", e);
    }
  }, []);

  // Sync font size from Convex
  React.useEffect(() => {
    if (userData?.preferences?.fontSize) {
      const size = userData.preferences.fontSize as "small" | "medium" | "large";
      setFontSizeState(size);
      try {
        localStorage.setItem("pref-font-size", size);
      } catch {}
    }
  }, [userData]);

  // Set root custom property for font size
  React.useEffect(() => {
    const root = document.documentElement;
    const sizeMap = {
      small: "0.875rem",  // 14px
      medium: "1.025rem", // 16.4px (optical baseline adjustment)
      large: "1.15rem",   // 18.4px
    };
    root.style.setProperty("--chat-font-size", sizeMap[fontSize]);
  }, [fontSize]);

  // Update theme custom variables on document
  React.useEffect(() => {
    const root = document.documentElement;
    const themeVars = accentThemes[accentTheme];
    if (themeVars) {
      Object.entries(themeVars).forEach(([key, val]) => {
        root.style.setProperty(key, val);
      });
    }
    localStorage.setItem("pref-accent-theme", accentTheme);
  }, [accentTheme]);

  // Apply micro-animations disable class on body
  React.useEffect(() => {
    const body = document.body;
    if (animsEnabled) {
      body.classList.remove("reduce-micro-animations");
    } else {
      body.classList.add("reduce-micro-animations");
    }
    localStorage.setItem("pref-anims", String(animsEnabled));
  }, [animsEnabled]);

  // Save properties to local storage
  React.useEffect(() => {
    localStorage.setItem("pref-webgl", String(webglEnabled));
  }, [webglEnabled]);

  React.useEffect(() => {
    localStorage.setItem("pref-glow", String(glowEnabled));
  }, [glowEnabled]);

  React.useEffect(() => {
    localStorage.setItem("pref-sounds", String(soundsEnabled));
  }, [soundsEnabled]);

  React.useEffect(() => {
    localStorage.setItem("pref-typing-anim", String(typingAnimEnabled));
  }, [typingAnimEnabled]);

  React.useEffect(() => {
    localStorage.setItem("pref-typing-sound", String(typingSoundEnabled));
  }, [typingSoundEnabled]);

  const setAccentTheme = React.useCallback((theme: AccentTheme) => {
    setAccentThemeState(theme);
    toast.success(`Theme switched to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
  }, []);

  const toggleSetting = React.useCallback(
    (key: "webgl" | "glow" | "anims" | "sounds" | "typingAnim" | "typingSound") => {
      if (key === "webgl") setWebglEnabled((p) => !p);
      else if (key === "glow") setGlowEnabled((p) => !p);
      else if (key === "anims") setAnimsEnabled((p) => !p);
      else if (key === "sounds") setSoundsEnabled((p) => !p);
      else if (key === "typingAnim") setTypingAnimEnabled((p) => !p);
      else if (key === "typingSound") setTypingSoundEnabled((p) => !p);
      toast.success("Preferences updated");
    },
    [],
  );

  const updateModelPreference = React.useCallback(async (model: "llama-3.1-8b" | "llama-4-scout") => {
    try {
      await updatePreferences({ model });
      toast.success(`Model switched to ${model === "llama-4-scout" ? "UET-Pro" : "UET-Fast"}`);
    } catch (err) {
      toast.error("Failed to update model preference");
    }
  }, [updatePreferences]);

  const resetPreferences = React.useCallback(() => {
    setAccentThemeState("indigo");
    setWebglEnabled(true);
    setGlowEnabled(true);
    setAnimsEnabled(true);
    setSoundsEnabled(true);
    setTypingAnimEnabled(true);
    setTypingSoundEnabled(true);
    toast.success("Preferences reset to default values");
  }, []);

  const addPin = React.useCallback((query: string, content: string) => {
    setPinnedHighlights((prev) => {
      // Check if already pinned
      if (prev.some((p) => p.query.toLowerCase().trim() === query.toLowerCase().trim())) {
        toast.info("Message is already pinned");
        return prev;
      }
      const updated = [
        ...prev,
        {
          id: `pin_${Math.random().toString(36).slice(2, 9)}`,
          query,
          content,
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("pref-pinned-highlights", JSON.stringify(updated));
      toast.success("Added to pinned highlights");
      return updated;
    });
  }, []);

  const removePin = React.useCallback((id: string) => {
    setPinnedHighlights((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      localStorage.setItem("pref-pinned-highlights", JSON.stringify(updated));
      toast.success("Removed from pinned highlights");
      return updated;
    });
  }, []);

  const isPinned = React.useCallback(
    (query: string) => {
      return pinnedHighlights.some(
        (p) => p.query.toLowerCase().trim() === query.toLowerCase().trim(),
      );
    },
    [pinnedHighlights],
  );

  // Audio Synthesis
  const getAudioContext = React.useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playTypingSound = React.useCallback(() => {
    if (!soundsEnabled || !typingSoundEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (err) {}
  }, [soundsEnabled, typingSoundEnabled, getAudioContext]);

  const playTapSound = React.useCallback(() => {
    if (!soundsEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.03);
      gain.gain.setValueAtTime(0.03, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    } catch (err) {}
  }, [soundsEnabled, getAudioContext]);

  const playSweepSound = React.useCallback(() => {
    if (!soundsEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {}
  }, [soundsEnabled, getAudioContext]);

  const playChimeSound = React.useCallback(() => {
    if (!soundsEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain1.gain.setValueAtTime(0.03, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      setTimeout(() => {
        if (!soundsEnabled) return;
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
          gain2.gain.setValueAtTime(0.03, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.35);
        } catch (e) {}
      }, 80);
    } catch (err) {}
  }, [soundsEnabled, getAudioContext]);

  // Hook up click listener for global tap sound on buttons
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!soundsEnabled) return;
      const target = (e.target as HTMLElement).closest(
        'button, [role="tab"], [role="switch"], a, input[type="submit"]',
      );
      if (target) {
        playTapSound();
      }
    };

    document.addEventListener("click", handleGlobalClick);
    return () => {
      document.removeEventListener("click", handleGlobalClick);
    };
  }, [soundsEnabled, playTapSound]);

  return (
    <PreferencesContext.Provider
      value={{
        accentTheme,
        webglEnabled,
        glowEnabled,
        animsEnabled,
        soundsEnabled,
        typingAnimEnabled,
        typingSoundEnabled,
        pinnedHighlights,
        fontSize,
        modelPreference,
        updateModelPreference,
        commandPaletteOpen,
        setCommandPaletteOpen,
        diagnosticsOpen,
        setDiagnosticsOpen,
        voiceInputOpen,
        setVoiceInputOpen,
        settingsOpen,
        setSettingsOpen,
        voiceTranscriptCallback,
        setVoiceTranscriptCallback,
        setAccentTheme,
        toggleSetting,
        resetPreferences,
        addPin,
        removePin,
        isPinned,
        playTypingSound,
        playTapSound,
        playSweepSound,
        playChimeSound,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = React.useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
