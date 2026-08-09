"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
      className="relative text-[var(--text-muted)] hover:text-[var(--text-primary)]"
    >
      <Sun
        className="h-4 w-4 rotate-0 scale-100 transition-[transform,opacity] duration-[var(--duration-normal)] motion-reduce:transition-none dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute h-4 w-4 rotate-90 scale-0 transition-[transform,opacity] duration-[var(--duration-normal)] motion-reduce:transition-none dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
    </Button>
  );
}
