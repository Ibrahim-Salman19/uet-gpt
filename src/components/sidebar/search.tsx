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
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search history…"
        className="w-full rounded-[10px] border border-white/10 bg-black/20 py-2.5 pl-9 pr-12 text-base md:text-[13px] text-zinc-200 placeholder:text-zinc-500 outline-none transition-all duration-300 hover:border-white/20 focus:border-[var(--accent)]/50 focus:bg-white/5 focus:ring-4 focus:ring-[var(--accent)]/10"
        aria-label="Search conversations"
      />
      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 pointer-events-auto">
        <button
          type="button"
          onClick={() => setCommandPaletteOpen(true)}
          className="text-[9px] font-mono text-zinc-500 bg-white/5 border border-white/5 px-2 py-1 min-h-[24px] min-w-[24px] flex items-center justify-center rounded-[6px] hover:text-white hover:bg-white/10 transition-all duration-200 active:scale-95 shadow-sm"
          title="Open command palette"
        >
          ⌘K
        </button>
      </div>
    </div>
  );
}
