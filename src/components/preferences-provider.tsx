"use client";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import * as React from "react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";

export type AccentTheme = "indigo" | "violet" | "sky" | "amber" | "navy";
export type FontSize = "small" | "medium" | "large";
export type ModelPreference = "llama-3.1-8b" | "llama-4-scout";
export type ToggleSettingKey = "webgl" | "glow" | "anims" | "sounds" | "typingAnim" | "typingSound";

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
  fontSize: FontSize;
  modelPreference: ModelPreference;
  preferencesHydrated: boolean;
  updateModelPreference: (model: ModelPreference) => Promise<void>;

  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  diagnosticsOpen: boolean;
  setDiagnosticsOpen: (open: boolean) => void;
  voiceInputOpen: boolean;
  setVoiceInputOpen: (open: boolean) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  setAccentTheme: (theme: AccentTheme) => void;
  setFontSize: (size: FontSize) => void;
  toggleSetting: (key: ToggleSettingKey) => void;
  resetPreferences: () => void;
  addPin: (query: string, content: string) => void;
  removePin: (id: string) => void;
  isPinned: (content: string) => boolean;

  voiceTranscriptCallback: ((text: string) => void) | null;
  setVoiceTranscriptCallback: (fn: ((text: string) => void) | null) => void;

  playTypingSound: () => void;
  playTapSound: () => void;
  playSweepSound: () => void;
  playChimeSound: () => void;
}

const PreferencesContext = React.createContext<PreferencesContextType | null>(null);

const STORAGE = {
  accent: "pref-accent-theme",
  fontSize: "pref-font-size",
  webgl: "pref-webgl",
  glow: "pref-glow",
  anims: "pref-anims",
  sounds: "pref-sounds",
  typingAnim: "pref-typing-anim",
  typingSound: "pref-typing-sound",
  pins: "pref-pinned-highlights",
} as const;

const DEFAULTS = {
  accentTheme: "indigo" as AccentTheme,
  fontSize: "medium" as FontSize,
  modelPreference: "llama-3.1-8b" as ModelPreference,
  webglEnabled: true,
  glowEnabled: true,
  animsEnabled: true,
  soundsEnabled: false,
  typingAnimEnabled: true,
  typingSoundEnabled: false,
};

export const accentThemes: Record<AccentTheme, Record<string, string>> = {
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
    "--accent": "oklch(0.68 0.14 75)",
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

const MAX_PINNED_HIGHLIGHTS = 200;
const MAX_PIN_QUERY_LENGTH = 4_000;
const MAX_PIN_CONTENT_LENGTH = 24_000;

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Could not persist preference ${key}`, error);
    }
    return false;
  }
}

function readBoolean(key: string, fallback: boolean): boolean {
  const stored = safeGetItem(key);
  return stored === "true" ? true : stored === "false" ? false : fallback;
}

function isAccentTheme(value: unknown): value is AccentTheme {
  return typeof value === "string" && Object.hasOwn(accentThemes, value);
}

function isFontSize(value: unknown): value is FontSize {
  return value === "small" || value === "medium" || value === "large";
}

function isModelPreference(value: unknown): value is ModelPreference {
  return value === "llama-3.1-8b" || value === "llama-4-scout";
}

function isValidPin(value: unknown): value is PinnedHighlight {
  if (typeof value !== "object" || value === null) return false;
  const pin = value as Record<string, unknown>;
  return (
    typeof pin.id === "string" &&
    typeof pin.query === "string" &&
    typeof pin.content === "string" &&
    typeof pin.createdAt === "number" &&
    Number.isFinite(pin.createdAt)
  );
}

function loadPins(): PinnedHighlight[] {
  const stored = safeGetItem(STORAGE.pins);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isValidPin).slice(-MAX_PINNED_HIGHLIGHTS) : [];
  } catch {
    return [];
  }
}

function persistPins(pins: PinnedHighlight[]): boolean {
  return safeSetItem(STORAGE.pins, JSON.stringify(pins));
}

function normalizePinContent(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

let fallbackPinSequence = 0;

function generatePinId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
    if (typeof crypto.getRandomValues === "function") {
      const values = crypto.getRandomValues(new Uint32Array(2));
      return `pin_${values[0]!.toString(36)}_${values[1]!.toString(36)}`;
    }
  }
  fallbackPinSequence += 1;
  return `pin_${Date.now().toString(36)}_${fallbackPinSequence.toString(36)}`;
}

function usePreferencesState() {
  const [fontSize, setFontSize] = React.useState<FontSize>(DEFAULTS.fontSize);
  const [accentTheme, setAccentTheme] = React.useState<AccentTheme>(DEFAULTS.accentTheme);
  const [modelPreference, setModelPreference] = React.useState<ModelPreference>(
    DEFAULTS.modelPreference,
  );
  const [webglEnabled, setWebglEnabled] = React.useState(DEFAULTS.webglEnabled);
  const [glowEnabled, setGlowEnabled] = React.useState(DEFAULTS.glowEnabled);
  const [animsEnabled, setAnimsEnabled] = React.useState(DEFAULTS.animsEnabled);
  const [soundsEnabled, setSoundsEnabled] = React.useState(DEFAULTS.soundsEnabled);
  const [typingAnimEnabled, setTypingAnimEnabled] = React.useState(DEFAULTS.typingAnimEnabled);
  const [typingSoundEnabled, setTypingSoundEnabled] = React.useState(DEFAULTS.typingSoundEnabled);
  const [pinnedHighlights, setPinnedHighlights] = React.useState<PinnedHighlight[]>([]);
  const [hydrated, setHydrated] = React.useState(false);

  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = React.useState(false);
  const [voiceInputOpen, setVoiceInputOpen] = React.useState(false);
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // Read local storage only after hydration. This keeps the server and first
  // client render deterministic while still restoring device-local settings.
  React.useEffect(() => {
    const storedAccent = safeGetItem(STORAGE.accent);
    const storedFont = safeGetItem(STORAGE.fontSize);
    if (isAccentTheme(storedAccent)) setAccentTheme(storedAccent);
    if (isFontSize(storedFont)) setFontSize(storedFont);

    setWebglEnabled(readBoolean(STORAGE.webgl, DEFAULTS.webglEnabled));
    setGlowEnabled(readBoolean(STORAGE.glow, DEFAULTS.glowEnabled));
    setAnimsEnabled(readBoolean(STORAGE.anims, DEFAULTS.animsEnabled));
    setSoundsEnabled(readBoolean(STORAGE.sounds, DEFAULTS.soundsEnabled));
    setTypingAnimEnabled(readBoolean(STORAGE.typingAnim, DEFAULTS.typingAnimEnabled));
    setTypingSoundEnabled(readBoolean(STORAGE.typingSound, DEFAULTS.typingSoundEnabled));
    setPinnedHighlights(loadPins());
    setHydrated(true);
  }, []);

  return {
    fontSize,
    setFontSize,
    accentTheme,
    setAccentTheme,
    modelPreference,
    setModelPreference,
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
    hydrated,
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

type PreferenceState = ReturnType<typeof usePreferencesState>;

type UpdatePreferencesFn = (args: {
  theme?: string;
  fontSize?: string;
  model?: ModelPreference;
}) => Promise<unknown>;

function useServerPreferenceSync(
  userData: ReturnType<typeof useUserData>["convexUser"],
  serverModelPreference: unknown,
  state: PreferenceState,
): void {
  const fontSize = userData?.preferences?.fontSize;
  const theme = userData?.preferences?.theme;

  React.useEffect(() => {
    if (isFontSize(fontSize)) {
      state.setFontSize(fontSize);
      safeSetItem(STORAGE.fontSize, fontSize);
    }
    if (isAccentTheme(theme)) {
      state.setAccentTheme(theme);
      safeSetItem(STORAGE.accent, theme);
    }
  }, [fontSize, theme, state.setFontSize, state.setAccentTheme]);

  React.useEffect(() => {
    if (isModelPreference(serverModelPreference)) {
      state.setModelPreference(serverModelPreference);
    }
  }, [serverModelPreference, state.setModelPreference]);
}

function useDomPreferenceEffects(state: PreferenceState): void {
  React.useEffect(() => {
    if (!state.hydrated) return;
    const root = document.documentElement;
    const sizes: Record<FontSize, string> = {
      small: "0.875rem",
      medium: "1.025rem",
      large: "1.15rem",
    };
    root.style.setProperty("--chat-font-size", sizes[state.fontSize]);
    safeSetItem(STORAGE.fontSize, state.fontSize);
  }, [state.fontSize, state.hydrated]);

  React.useEffect(() => {
    if (!state.hydrated) return;
    const root = document.documentElement;
    for (const [property, value] of Object.entries(accentThemes[state.accentTheme])) {
      root.style.setProperty(property, value);
    }
    root.dataset.accentTheme = state.accentTheme;
    safeSetItem(STORAGE.accent, state.accentTheme);
  }, [state.accentTheme, state.hydrated]);

  React.useEffect(() => {
    if (!state.hydrated) return;
    safeSetItem(STORAGE.webgl, String(state.webglEnabled));
  }, [state.webglEnabled, state.hydrated]);
  React.useEffect(() => {
    if (!state.hydrated) return;
    safeSetItem(STORAGE.glow, String(state.glowEnabled));
  }, [state.glowEnabled, state.hydrated]);
  React.useEffect(() => {
    if (!state.hydrated) return;
    safeSetItem(STORAGE.sounds, String(state.soundsEnabled));
  }, [state.soundsEnabled, state.hydrated]);
  React.useEffect(() => {
    if (!state.hydrated) return;
    safeSetItem(STORAGE.typingAnim, String(state.typingAnimEnabled));
  }, [state.typingAnimEnabled, state.hydrated]);
  React.useEffect(() => {
    if (!state.hydrated) return;
    safeSetItem(STORAGE.typingSound, String(state.typingSoundEnabled));
  }, [state.typingSoundEnabled, state.hydrated]);

  React.useEffect(() => {
    if (!state.hydrated) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.body.classList.toggle(
        "reduce-micro-animations",
        !state.animsEnabled || reducedMotion.matches,
      );
    };

    apply();
    safeSetItem(STORAGE.anims, String(state.animsEnabled));
    reducedMotion.addEventListener("change", apply);
    return () => reducedMotion.removeEventListener("change", apply);
  }, [state.animsEnabled, state.hydrated]);
}

function useCrossTabPreferenceSync(state: PreferenceState): void {
  React.useEffect(() => {
    if (!state.hydrated) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key === null) return;

      switch (event.key) {
        case STORAGE.accent:
          state.setAccentTheme(
            isAccentTheme(event.newValue) ? event.newValue : DEFAULTS.accentTheme,
          );
          break;
        case STORAGE.fontSize:
          state.setFontSize(isFontSize(event.newValue) ? event.newValue : DEFAULTS.fontSize);
          break;
        case STORAGE.webgl:
          state.setWebglEnabled(
            event.newValue === null ? DEFAULTS.webglEnabled : event.newValue === "true",
          );
          break;
        case STORAGE.glow:
          state.setGlowEnabled(
            event.newValue === null ? DEFAULTS.glowEnabled : event.newValue === "true",
          );
          break;
        case STORAGE.anims:
          state.setAnimsEnabled(
            event.newValue === null ? DEFAULTS.animsEnabled : event.newValue === "true",
          );
          break;
        case STORAGE.sounds:
          state.setSoundsEnabled(
            event.newValue === null ? DEFAULTS.soundsEnabled : event.newValue === "true",
          );
          break;
        case STORAGE.typingAnim:
          state.setTypingAnimEnabled(
            event.newValue === null ? DEFAULTS.typingAnimEnabled : event.newValue === "true",
          );
          break;
        case STORAGE.typingSound:
          state.setTypingSoundEnabled(
            event.newValue === null ? DEFAULTS.typingSoundEnabled : event.newValue === "true",
          );
          break;
        case STORAGE.pins:
          state.setPinnedHighlights(loadPins());
          break;
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [
    state.setAccentTheme,
    state.setFontSize,
    state.setWebglEnabled,
    state.setGlowEnabled,
    state.setAnimsEnabled,
    state.setSoundsEnabled,
    state.setTypingAnimEnabled,
    state.setTypingSoundEnabled,
    state.setPinnedHighlights,
    state.hydrated,
  ]);
}

function useOverlayControls(state: PreferenceState) {
  const setCommandPaletteOpen = React.useCallback(
    (open: boolean) => {
      state.setCommandPaletteOpen(open);
      if (open) {
        state.setSettingsOpen(false);
        state.setVoiceInputOpen(false);
      }
    },
    [state.setCommandPaletteOpen, state.setSettingsOpen, state.setVoiceInputOpen],
  );

  const setSettingsOpen = React.useCallback(
    (open: boolean) => {
      state.setSettingsOpen(open);
      if (open) {
        state.setCommandPaletteOpen(false);
        state.setVoiceInputOpen(false);
      }
    },
    [state.setSettingsOpen, state.setCommandPaletteOpen, state.setVoiceInputOpen],
  );

  const setVoiceInputOpen = React.useCallback(
    (open: boolean) => {
      state.setVoiceInputOpen(open);
      if (open) {
        state.setCommandPaletteOpen(false);
        state.setSettingsOpen(false);
      }
    },
    [state.setVoiceInputOpen, state.setCommandPaletteOpen, state.setSettingsOpen],
  );

  const setDiagnosticsOpen = React.useCallback(
    (open: boolean) => state.setDiagnosticsOpen(open),
    [state.setDiagnosticsOpen],
  );

  return {
    setCommandPaletteOpen,
    setSettingsOpen,
    setVoiceInputOpen,
    setDiagnosticsOpen,
  };
}

function useVoiceTranscriptCallback() {
  const [callback, setCallback] = React.useState<((text: string) => void) | null>(null);
  const setVoiceTranscriptCallback = React.useCallback(
    (next: ((text: string) => void) | null) => setCallback(() => next),
    [],
  );
  return { voiceTranscriptCallback: callback, setVoiceTranscriptCallback };
}

function usePreferenceActions(updatePreferences: UpdatePreferencesFn, state: PreferenceState) {
  const setAccentTheme = React.useCallback(
    (theme: AccentTheme) => {
      if (theme === state.accentTheme) return;
      state.setAccentTheme(theme);
      void updatePreferences({ theme }).catch((error: unknown) => {
        console.error("Failed to persist accent theme", error);
        toast.error("Theme changed on this device but could not be synced");
      });
    },
    [state.accentTheme, state.setAccentTheme, updatePreferences],
  );

  const setFontSize = React.useCallback(
    (size: FontSize) => {
      if (size === state.fontSize) return;
      state.setFontSize(size);
      void updatePreferences({ fontSize: size }).catch((error: unknown) => {
        console.error("Failed to persist font size", error);
        toast.error("Text size changed on this device but could not be synced");
      });
    },
    [state.fontSize, state.setFontSize, updatePreferences],
  );

  const toggleSetting = React.useCallback(
    (key: ToggleSettingKey) => {
      const settings = {
        webgl: {
          value: state.webglEnabled,
          set: state.setWebglEnabled,
          label: "WebGL backdrop",
        },
        glow: { value: state.glowEnabled, set: state.setGlowEnabled, label: "Ambient glow" },
        anims: {
          value: state.animsEnabled,
          set: state.setAnimsEnabled,
          label: "Micro-animations",
        },
        sounds: {
          value: state.soundsEnabled,
          set: state.setSoundsEnabled,
          label: "Interface sounds",
        },
        typingAnim: {
          value: state.typingAnimEnabled,
          set: state.setTypingAnimEnabled,
          label: "Typing animation",
        },
        typingSound: {
          value: state.typingSoundEnabled,
          set: state.setTypingSoundEnabled,
          label: "Typing sounds",
        },
      } satisfies Record<
        ToggleSettingKey,
        { value: boolean; set: React.Dispatch<React.SetStateAction<boolean>>; label: string }
      >;

      const setting = settings[key];
      const next = !setting.value;
      setting.set(next);
      toast.success(`${setting.label} ${next ? "enabled" : "disabled"}`);
    },
    [
      state.webglEnabled,
      state.glowEnabled,
      state.animsEnabled,
      state.soundsEnabled,
      state.typingAnimEnabled,
      state.typingSoundEnabled,
      state.setWebglEnabled,
      state.setGlowEnabled,
      state.setAnimsEnabled,
      state.setSoundsEnabled,
      state.setTypingAnimEnabled,
      state.setTypingSoundEnabled,
    ],
  );

  const updateModelPreference = React.useCallback(
    async (model: ModelPreference) => {
      if (model === state.modelPreference) return;
      const previous = state.modelPreference;
      state.setModelPreference(model);
      try {
        await updatePreferences({ model });
        toast.success(`Model switched to ${model === "llama-4-scout" ? "UET-Pro" : "UET-Fast"}`);
      } catch (error) {
        state.setModelPreference((current) => (current === model ? previous : current));
        console.error("Failed to update model preference", error);
        toast.error("Model change could not be saved");
        throw error;
      }
    },
    [state.modelPreference, state.setModelPreference, updatePreferences],
  );

  const resetPreferences = React.useCallback(() => {
    state.setAccentTheme(DEFAULTS.accentTheme);
    state.setFontSize(DEFAULTS.fontSize);
    state.setModelPreference(DEFAULTS.modelPreference);
    state.setWebglEnabled(DEFAULTS.webglEnabled);
    state.setGlowEnabled(DEFAULTS.glowEnabled);
    state.setAnimsEnabled(DEFAULTS.animsEnabled);
    state.setSoundsEnabled(DEFAULTS.soundsEnabled);
    state.setTypingAnimEnabled(DEFAULTS.typingAnimEnabled);
    state.setTypingSoundEnabled(DEFAULTS.typingSoundEnabled);

    void updatePreferences({
      theme: DEFAULTS.accentTheme,
      fontSize: DEFAULTS.fontSize,
      model: DEFAULTS.modelPreference,
    }).catch((error: unknown) => {
      console.error("Failed to sync reset preferences", error);
      toast.error("Defaults were restored locally but could not be synced");
    });
    toast.success("Preferences reset to accessible defaults");
  }, [
    state.setAccentTheme,
    state.setFontSize,
    state.setModelPreference,
    state.setWebglEnabled,
    state.setGlowEnabled,
    state.setAnimsEnabled,
    state.setSoundsEnabled,
    state.setTypingAnimEnabled,
    state.setTypingSoundEnabled,
    updatePreferences,
  ]);

  const addPin = React.useCallback(
    (query: string, content: string) => {
      const cleanQuery = query.trim().slice(0, MAX_PIN_QUERY_LENGTH);
      const cleanContent = content.trim().slice(0, MAX_PIN_CONTENT_LENGTH);
      if (!cleanContent) return;

      state.setPinnedHighlights((current) => {
        const normalized = normalizePinContent(cleanContent);
        if (current.some((pin) => normalizePinContent(pin.content) === normalized)) {
          toast.info("Message is already pinned");
          return current;
        }

        const next = [
          ...current,
          {
            id: generatePinId(),
            query: cleanQuery,
            content: cleanContent,
            createdAt: Date.now(),
          },
        ].slice(-MAX_PINNED_HIGHLIGHTS);

        if (!persistPins(next)) {
          toast.error("Pin could not be saved on this device");
          return current;
        }
        toast.success("Added to pinned highlights");
        return next;
      });
    },
    [state.setPinnedHighlights],
  );

  const removePin = React.useCallback(
    (id: string) => {
      state.setPinnedHighlights((current) => {
        const next = current.filter((pin) => pin.id !== id);
        if (next.length === current.length) return current;
        if (!persistPins(next)) {
          toast.error("Pinned highlight could not be removed");
          return current;
        }
        toast.success("Removed from pinned highlights");
        return next;
      });
    },
    [state.setPinnedHighlights],
  );

  const normalizedPins = React.useMemo(
    () => new Set(state.pinnedHighlights.map((pin) => normalizePinContent(pin.content))),
    [state.pinnedHighlights],
  );
  const isPinned = React.useCallback(
    (content: string) => normalizedPins.has(normalizePinContent(content)),
    [normalizedPins],
  );

  return {
    setAccentTheme,
    setFontSize,
    toggleSetting,
    updateModelPreference,
    resetPreferences,
    addPin,
    removePin,
    isPinned,
  };
}

interface WebkitAudioWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function useAudioSynth(soundsEnabled: boolean, typingSoundEnabled: boolean) {
  const contextRef = React.useRef<AudioContext | null>(null);
  const enabledRef = React.useRef(soundsEnabled);
  const typingEnabledRef = React.useRef(typingSoundEnabled);
  const lastTypingSoundAtRef = React.useRef(0);
  const timeoutIdsRef = React.useRef(new Set<ReturnType<typeof setTimeout>>());

  React.useEffect(() => {
    enabledRef.current = soundsEnabled;
  }, [soundsEnabled]);
  React.useEffect(() => {
    typingEnabledRef.current = typingSoundEnabled;
  }, [typingSoundEnabled]);

  const getContext = React.useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    const AudioContextConstructor =
      window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;
    if (!AudioContextConstructor) return null;

    if (!contextRef.current || contextRef.current.state === "closed") {
      try {
        contextRef.current = new AudioContextConstructor({ latencyHint: "interactive" });
      } catch {
        try {
          contextRef.current = new AudioContextConstructor();
        } catch (error) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("Audio context could not be created", error);
          }
          return null;
        }
      }
    }
    if (contextRef.current.state === "suspended") {
      void contextRef.current.resume().catch(() => undefined);
    }
    return contextRef.current;
  }, []);

  const playTone = React.useCallback(
    (startFrequency: number, endFrequency: number, duration: number, volume: number) => {
      const context = getContext();
      if (!context) return;

      try {
        const now = context.currentTime;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(Math.max(1, startFrequency), now);
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(1, endFrequency),
          now + duration,
        );
        gain.gain.setValueAtTime(Math.max(0.0001, volume), now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.addEventListener(
          "ended",
          () => {
            oscillator.disconnect();
            gain.disconnect();
          },
          { once: true },
        );
        oscillator.start(now);
        oscillator.stop(now + duration + 0.02);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Audio feedback could not be played", error);
        }
      }
    },
    [getContext],
  );

  React.useEffect(() => {
    return () => {
      for (const timeoutId of timeoutIdsRef.current) clearTimeout(timeoutId);
      timeoutIdsRef.current.clear();
      const context = contextRef.current;
      contextRef.current = null;
      if (context && context.state !== "closed") void context.close().catch(() => undefined);
    };
  }, []);

  const playTypingSound = React.useCallback(() => {
    if (!enabledRef.current || !typingEnabledRef.current) return;
    const now = performance.now();
    if (now - lastTypingSoundAtRef.current < 32) return;
    lastTypingSoundAtRef.current = now;
    playTone(680, 260, 0.025, 0.018);
  }, [playTone]);

  const playTapSound = React.useCallback(() => {
    if (enabledRef.current) playTone(560, 240, 0.035, 0.025);
  }, [playTone]);

  const playSweepSound = React.useCallback(() => {
    if (enabledRef.current) playTone(300, 1_100, 0.32, 0.045);
  }, [playTone]);

  const playChimeSound = React.useCallback(() => {
    if (!enabledRef.current) return;
    playTone(523.25, 523.25, 0.24, 0.028);

    const timeoutId = setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      if (enabledRef.current) playTone(659.25, 659.25, 0.25, 0.026);
    }, 85);
    timeoutIdsRef.current.add(timeoutId);
  }, [playTone]);

  return { playTypingSound, playTapSound, playSweepSound, playChimeSound };
}

function useGlobalClickSound(enabled: boolean, playTapSound: () => void): void {
  React.useEffect(() => {
    if (!enabled) return;

    const handleClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(
        'button, a[href], [role="button"], [role="tab"], [role="switch"], input[type="submit"]',
      );
      if (
        !control ||
        control.dataset.sound === "off" ||
        control.dataset.customSound === "true" ||
        control.getAttribute("aria-disabled") === "true" ||
        (control instanceof HTMLButtonElement && control.disabled)
      ) {
        return;
      }
      playTapSound();
    };

    document.addEventListener("click", handleClick, { passive: true });
    return () => document.removeEventListener("click", handleClick);
  }, [enabled, playTapSound]);
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const userData = useUserData();
  const updatePreferences = useMutation(api.users.updatePreferences) as UpdatePreferencesFn;
  const state = usePreferencesState();

  useServerPreferenceSync(userData.convexUser, userData.modelPreference, state);
  useDomPreferenceEffects(state);
  useCrossTabPreferenceSync(state);

  const transcript = useVoiceTranscriptCallback();
  const overlays = useOverlayControls(state);
  const actions = usePreferenceActions(updatePreferences, state);
  const audio = useAudioSynth(state.soundsEnabled, state.typingSoundEnabled);
  useGlobalClickSound(state.soundsEnabled, audio.playTapSound);

  const contextValue = React.useMemo<PreferencesContextType>(
    () => ({
      accentTheme: state.accentTheme,
      webglEnabled: state.webglEnabled,
      glowEnabled: state.glowEnabled,
      animsEnabled: state.animsEnabled,
      soundsEnabled: state.soundsEnabled,
      typingAnimEnabled: state.typingAnimEnabled,
      typingSoundEnabled: state.typingSoundEnabled,
      pinnedHighlights: state.pinnedHighlights,
      fontSize: state.fontSize,
      modelPreference: state.modelPreference,
      preferencesHydrated: state.hydrated,
      updateModelPreference: actions.updateModelPreference,
      commandPaletteOpen: state.commandPaletteOpen,
      setCommandPaletteOpen: overlays.setCommandPaletteOpen,
      diagnosticsOpen: state.diagnosticsOpen,
      setDiagnosticsOpen: overlays.setDiagnosticsOpen,
      voiceInputOpen: state.voiceInputOpen,
      setVoiceInputOpen: overlays.setVoiceInputOpen,
      settingsOpen: state.settingsOpen,
      setSettingsOpen: overlays.setSettingsOpen,
      voiceTranscriptCallback: transcript.voiceTranscriptCallback,
      setVoiceTranscriptCallback: transcript.setVoiceTranscriptCallback,
      setAccentTheme: actions.setAccentTheme,
      setFontSize: actions.setFontSize,
      toggleSetting: actions.toggleSetting,
      resetPreferences: actions.resetPreferences,
      addPin: actions.addPin,
      removePin: actions.removePin,
      isPinned: actions.isPinned,
      ...audio,
    }),
    [
      state.accentTheme,
      state.webglEnabled,
      state.glowEnabled,
      state.animsEnabled,
      state.soundsEnabled,
      state.typingAnimEnabled,
      state.typingSoundEnabled,
      state.pinnedHighlights,
      state.fontSize,
      state.modelPreference,
      state.hydrated,
      state.commandPaletteOpen,
      state.diagnosticsOpen,
      state.voiceInputOpen,
      state.settingsOpen,
      overlays.setCommandPaletteOpen,
      overlays.setDiagnosticsOpen,
      overlays.setVoiceInputOpen,
      overlays.setSettingsOpen,
      transcript.voiceTranscriptCallback,
      transcript.setVoiceTranscriptCallback,
      actions.updateModelPreference,
      actions.setAccentTheme,
      actions.setFontSize,
      actions.toggleSetting,
      actions.resetPreferences,
      actions.addPin,
      actions.removePin,
      actions.isPinned,
      audio.playTypingSound,
      audio.playTapSound,
      audio.playSweepSound,
      audio.playChimeSound,
    ],
  );

  return <PreferencesContext.Provider value={contextValue}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextType {
  const context = React.useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used within a PreferencesProvider");
  return context;
}
