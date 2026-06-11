"use client";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import * as React from "react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";

export type AccentTheme = "indigo" | "violet" | "sky" | "amber" | "navy";

interface PinnedHighlight {
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

function loadBooleanInitial(key: string, defaultVal: boolean): boolean {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? val === "true" : defaultVal;
  } catch {
    return defaultVal;
  }
}

function loadStringInitial(key: string, defaultVal: string): string {
  try {
    return localStorage.getItem(key) ?? defaultVal;
  } catch {
    return defaultVal;
  }
}

function loadAccentThemeInitial(): AccentTheme {
  const stored = loadStringInitial("pref-accent-theme", "indigo") as AccentTheme;
  return stored && accentThemes[stored] ? stored : "indigo";
}

function loadPinsInitial(): PinnedHighlight[] {
  try {
    const stored = localStorage.getItem("pref-pinned-highlights");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function isValidFontSize(v: string | null): v is "small" | "medium" | "large" {
  return v === "small" || v === "medium" || v === "large";
}

function loadFontSizeInitial(): "small" | "medium" | "large" {
  try {
    const stored = localStorage.getItem("pref-font-size");
    if (isValidFontSize(stored)) return stored;
    return "medium";
  } catch {
    return "medium";
  }
}

function usePreferencesState() {
  const [fontSize, setFontSizeState] = React.useState<"small" | "medium" | "large">(
    loadFontSizeInitial,
  );
  const [accentTheme, setAccentThemeState] = React.useState<AccentTheme>(loadAccentThemeInitial);
  const [webglEnabled, setWebglEnabled] = React.useState(() =>
    loadBooleanInitial("pref-webgl", true),
  );
  const [glowEnabled, setGlowEnabled] = React.useState(() => loadBooleanInitial("pref-glow", true));
  const [animsEnabled, setAnimsEnabled] = React.useState(() =>
    loadBooleanInitial("pref-anims", true),
  );
  const [soundsEnabled, setSoundsEnabled] = React.useState(() =>
    loadBooleanInitial("pref-sounds", true),
  );
  const [typingAnimEnabled, setTypingAnimEnabled] = React.useState(() =>
    loadBooleanInitial("pref-typing-anim", true),
  );
  const [typingSoundEnabled, setTypingSoundEnabled] = React.useState(() =>
    loadBooleanInitial("pref-typing-sound", true),
  );
  const [pinnedHighlights, setPinnedHighlights] =
    React.useState<PinnedHighlight[]>(loadPinsInitial);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [voiceInputOpen, setVoiceInputOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return {
    fontSize,
    setFontSizeState,
    accentTheme,
    setAccentThemeState,
    webglEnabled,
    setWebglEnabled,
    glowEnabled,
    setGlowEnabled,
    animsEnabled,
    setAnimsEnabled,
    soundsEnabled,
    setSoundsEnabled,
    typingAnimEnabled,
    setTypingAnimEnabled,
    typingSoundEnabled,
    setTypingSoundEnabled,
    pinnedHighlights,
    setPinnedHighlights,
    commandPaletteOpen,
    setCommandPaletteOpen,
    diagnosticsOpen,
    setDiagnosticsOpen,
    voiceInputOpen,
    setVoiceInputOpen,
    settingsOpen,
    setSettingsOpen,
  };
}

function syncPrefFromConvex<T>(
  val: T | undefined,
  setter: (v: T) => void,
  storageKey: string,
): void {
  if (val == null) return;
  setter(val);
  try {
    localStorage.setItem(storageKey, String(val));
  } catch {}
}

function useConvexPreferenceSync(
  userData: any,
  setFontSizeState: (v: "small" | "medium" | "large") => void,
  setAccentThemeState: (v: AccentTheme) => void,
) {
  React.useEffect(() => {
    const prefs = userData?.preferences;
    if (!prefs) return;
    syncPrefFromConvex(
      prefs.fontSize as "small" | "medium" | "large" | undefined,
      setFontSizeState,
      "pref-font-size",
    );
    syncPrefFromConvex(
      prefs.theme as AccentTheme | undefined,
      setAccentThemeState,
      "pref-accent-theme",
    );
  }, [userData]);
}

function useFontSizeEffect(fontSize: "small" | "medium" | "large") {
  React.useEffect(() => {
    const root = document.documentElement;
    const sizeMap = { small: "0.875rem", medium: "1.025rem", large: "1.15rem" };
    root.style.setProperty("--chat-font-size", sizeMap[fontSize]);
  }, [fontSize]);
}

function useThemeEffect(accentTheme: AccentTheme) {
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
}

function usePreferencePersistence({
  webglEnabled,
  glowEnabled,
  animsEnabled,
  soundsEnabled,
  typingAnimEnabled,
  typingSoundEnabled,
}: {
  webglEnabled: boolean;
  glowEnabled: boolean;
  animsEnabled: boolean;
  soundsEnabled: boolean;
  typingAnimEnabled: boolean;
  typingSoundEnabled: boolean;
}) {
  React.useEffect(() => {
    const body = document.body;
    if (animsEnabled) {
      body.classList.remove("reduce-micro-animations");
    } else {
      body.classList.add("reduce-micro-animations");
    }
    localStorage.setItem("pref-webgl", String(webglEnabled));
    localStorage.setItem("pref-glow", String(glowEnabled));
    localStorage.setItem("pref-sounds", String(soundsEnabled));
    localStorage.setItem("pref-typing-anim", String(typingAnimEnabled));
    localStorage.setItem("pref-typing-sound", String(typingSoundEnabled));
    localStorage.setItem("pref-anims", String(animsEnabled));
  }, [
    webglEnabled,
    glowEnabled,
    soundsEnabled,
    typingAnimEnabled,
    typingSoundEnabled,
    animsEnabled,
  ]);
}

function useGlobalClickSound(soundsEnabled: boolean, playTapSound: () => void) {
  React.useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (!soundsEnabled) return;
      const target = (e.target as HTMLElement).closest(
        'button:not([data-custom-sound="true"]), [role="tab"], [role="switch"], a, input[type="submit"]',
      );
      if (target) {
        playTapSound();
      }
    };
    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, [soundsEnabled, playTapSound]);
}

function useVoiceTranscriptCallback() {
  const ref = React.useRef<((text: string) => void) | null>(null);
  const [callback, setCallback] = React.useState<((text: string) => void) | null>(null);
  const setFn = React.useCallback((fn: ((text: string) => void) | null) => {
    ref.current = fn;
    setCallback(() => fn);
  }, []);
  return { voiceTranscriptCallback: callback, setVoiceTranscriptCallback: setFn };
}

function usePreferenceActions(
  updatePreferences: any,
  setters: {
    setAccentThemeState: (v: AccentTheme) => void;
    setWebglEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
    setGlowEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
    setAnimsEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
    setSoundsEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
    setTypingAnimEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
    setTypingSoundEnabled: (v: boolean | ((p: boolean) => boolean)) => void;
    setPinnedHighlights: (
      v: PinnedHighlight[] | ((p: PinnedHighlight[]) => PinnedHighlight[]),
    ) => void;
  },
  pinnedHighlights: PinnedHighlight[],
) {
  const setAccentTheme = React.useCallback(
    (theme: AccentTheme) => {
      setters.setAccentThemeState(theme);
      updatePreferences({ theme }).catch(console.error);
      toast.success(`Theme switched to ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
    },
    [updatePreferences],
  );

  const toggleSetting = React.useCallback(
    (key: "webgl" | "glow" | "anims" | "sounds" | "typingAnim" | "typingSound") => {
      const toggleFns: Record<string, () => void> = {
        webgl: () => setters.setWebglEnabled((p) => !p),
        glow: () => setters.setGlowEnabled((p) => !p),
        anims: () => setters.setAnimsEnabled((p) => !p),
        sounds: () => setters.setSoundsEnabled((p) => !p),
        typingAnim: () => setters.setTypingAnimEnabled((p) => !p),
        typingSound: () => setters.setTypingSoundEnabled((p) => !p),
      };
      toggleFns[key]?.();
      toast.success("Preferences updated");
    },
    [],
  );

  const updateModelPreference = React.useCallback(
    async (model: "llama-3.1-8b" | "llama-4-scout") => {
      try {
        await updatePreferences({ model });
        toast.success(`Model switched to ${model === "llama-4-scout" ? "UET-Pro" : "UET-Fast"}`);
      } catch (err) {
        toast.error("Failed to update model preference");
      }
    },
    [updatePreferences],
  );

  const resetPreferences = React.useCallback(() => {
    setters.setAccentThemeState("indigo");
    setters.setWebglEnabled(true);
    setters.setGlowEnabled(true);
    setters.setAnimsEnabled(true);
    setters.setSoundsEnabled(true);
    setters.setTypingAnimEnabled(true);
    setters.setTypingSoundEnabled(true);
    toast.success("Preferences reset to default values");
  }, []);

  const addPin = React.useCallback((query: string, content: string) => {
    setters.setPinnedHighlights((prev) => {
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
    setters.setPinnedHighlights((prev) => {
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

  return {
    setAccentTheme,
    toggleSetting,
    updateModelPreference,
    resetPreferences,
    addPin,
    removePin,
    isPinned,
  };
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { convexUser: userData, modelPreference } = useUserData();
  const updatePreferences = useMutation(api.users.updatePreferences);
  const {
    fontSize,
    setFontSizeState,
    accentTheme,
    setAccentThemeState,
    webglEnabled,
    setWebglEnabled,
    glowEnabled,
    setGlowEnabled,
    animsEnabled,
    setAnimsEnabled,
    soundsEnabled,
    setSoundsEnabled,
    typingAnimEnabled,
    setTypingAnimEnabled,
    typingSoundEnabled,
    setTypingSoundEnabled,
    pinnedHighlights,
    setPinnedHighlights,
    commandPaletteOpen,
    setCommandPaletteOpen,
    diagnosticsOpen,
    setDiagnosticsOpen,
    voiceInputOpen,
    setVoiceInputOpen,
    settingsOpen,
    setSettingsOpen,
  } = usePreferencesState();
  const { voiceTranscriptCallback, setVoiceTranscriptCallback } = useVoiceTranscriptCallback();
  useConvexPreferenceSync(userData, setFontSizeState, setAccentThemeState);
  useFontSizeEffect(fontSize);
  useThemeEffect(accentTheme);
  usePreferencePersistence({
    webglEnabled,
    glowEnabled,
    animsEnabled,
    soundsEnabled,
    typingAnimEnabled,
    typingSoundEnabled,
  });

  const {
    setAccentTheme,
    toggleSetting,
    updateModelPreference,
    resetPreferences,
    addPin,
    removePin,
    isPinned,
  } = usePreferenceActions(
    updatePreferences,
    {
      setAccentThemeState,
      setWebglEnabled,
      setGlowEnabled,
      setAnimsEnabled,
      setSoundsEnabled,
      setTypingAnimEnabled,
      setTypingSoundEnabled,
      setPinnedHighlights,
    },
    pinnedHighlights,
  );

  const { playTypingSound, playTapSound, playSweepSound, playChimeSound } = useAudioSynth(
    soundsEnabled,
    typingSoundEnabled,
  );

  useGlobalClickSound(soundsEnabled, playTapSound);

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

function useAudioSynth(soundsEnabled: boolean, typingSoundEnabled: boolean) {
  const audioCtxRef = React.useRef<AudioContext | null>(null);

  const getAudioContext = React.useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  function playTone(
    frequency: number,
    endFrequency: number,
    duration: number,
    gainValue: number,
  ): void {
    try {
      const ctx = getAudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + duration);
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration + 0.02);
    } catch {}
  }

  const chimeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (chimeTimeoutRef.current) clearTimeout(chimeTimeoutRef.current);
    };
  }, []);

  const playTypingSound = React.useCallback(() => {
    if (!soundsEnabled || !typingSoundEnabled) return;
    playTone(800, 200, 0.03, 0.03);
  }, [soundsEnabled, typingSoundEnabled]);

  const playTapSound = React.useCallback(() => {
    if (!soundsEnabled) return;
    playTone(800, 200, 0.03, 0.03);
  }, [soundsEnabled]);

  const playSweepSound = React.useCallback(() => {
    if (!soundsEnabled) return;
    playTone(300, 1200, 0.4, 0.06);
  }, [soundsEnabled]);

  const playChimeSound = React.useCallback(() => {
    if (!soundsEnabled) return;
    try {
      const ctx = getAudioContext();
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain1.gain.setValueAtTime(0.03, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      chimeTimeoutRef.current = setTimeout(() => {
        if (!soundsEnabled) return;
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
          gain2.gain.setValueAtTime(0.03, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.35);
        } catch (e) {}
      }, 80);
    } catch (err) {}
  }, [soundsEnabled, getAudioContext]);

  return { playTypingSound, playTapSound, playSweepSound, playChimeSound };
}
