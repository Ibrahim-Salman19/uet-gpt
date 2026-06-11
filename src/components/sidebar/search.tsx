"use client";

import { Search } from "lucide-react";
import { usePreferences } from "@/components/preferences-provider";

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  const { setCommandPaletteOpen } = usePreferences();

  return (
    <div className="px-3 pb-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search conversations..."
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-sidebar)] py-1.5 pl-8 pr-12 text-base md:text-sm text-[var(--text-sidebar)] placeholder:text-[var(--text-muted)] outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] focus:border-[var(--accent-muted)]"
          aria-label="Search conversations"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="text-[9px] font-mono text-[var(--text-muted)] bg-zinc-800/80 border border-white/5 px-2 py-1 min-h-[24px] min-w-[24px] flex items-center justify-center rounded hover:text-white transition-colors duration-200 active:scale-95 shadow-sm"
            title="Open command palette"
          >
            ⌘K
          </button>
        </div>
      </div>
    </div>
  );
}
