"use client";

import { Search } from "lucide-react";

interface SidebarSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function SidebarSearch({ value, onChange }: SidebarSearchProps) {
  return (
    <div className="px-3 pb-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search conversations..."
          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface-sidebar)] py-1.5 pl-8 pr-3 text-sm text-[var(--text-sidebar)] placeholder:text-[var(--text-muted)] outline-none transition-all duration-[var(--duration-fast)] focus:border-[var(--accent-muted)]"
          aria-label="Search conversations"
        />
      </div>
    </div>
  );
}
