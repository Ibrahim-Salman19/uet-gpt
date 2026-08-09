"use client";

import * as React from "react";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "theme";
const ThemeContext = React.createContext<ThemeContextType | null>(null);
const THEME_BOOT_SCRIPT = `(function(){try{var s=localStorage.getItem("${STORAGE_KEY}");var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var r=document.documentElement;r.classList.remove("light","dark");r.classList.add(t);r.dataset.theme=t;r.style.colorScheme=t;}catch(e){}})();`;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // A stable server/client initial value avoids hydration mismatch. Applications
  // should also set the class in an inline pre-hydration script to eliminate FOUC.
  const [theme, setThemeState] = React.useState<Theme>("dark");
  const explicitPreferenceRef = React.useRef(false);

  React.useEffect(() => {
    const stored = readStoredTheme();
    explicitPreferenceRef.current = stored !== null;
    setThemeState(stored ?? systemTheme());

    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemChange = () => {
      if (!explicitPreferenceRef.current) setThemeState(systemTheme());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === "light" || event.newValue === "dark" ? event.newValue : null;
      explicitPreferenceRef.current = next !== null;
      setThemeState(next ?? systemTheme());
    };

    if (typeof colorScheme.addEventListener === "function") {
      colorScheme.addEventListener("change", handleSystemChange);
    } else {
      colorScheme.addListener(handleSystemChange);
    }
    window.addEventListener("storage", handleStorage);
    return () => {
      if (typeof colorScheme.removeEventListener === "function") {
        colorScheme.removeEventListener("change", handleSystemChange);
      } else {
        colorScheme.removeListener(handleSystemChange);
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useIsomorphicLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = React.useCallback((next: Theme) => {
    explicitPreferenceRef.current = true;
    setThemeState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Theme preference could not be persisted", error);
      }
    }
  }, []);

  const toggleTheme = React.useCallback(() => {
    setThemeState((current) => {
      const next = current === "light" ? "dark" : "light";
      explicitPreferenceRef.current = true;
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // The in-memory theme still changes when storage is unavailable.
      }
      return next;
    });
  }, []);

  const value = React.useMemo(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  );

  return (
    <>
      <script
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
      />
      <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    </>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
}
