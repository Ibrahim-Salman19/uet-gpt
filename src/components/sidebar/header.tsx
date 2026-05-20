"use client";

import { GraduationCap } from "lucide-react";

export function SidebarHeader() {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)] p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)]">
        <GraduationCap className="h-4 w-4 text-[var(--accent-fg)]" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold tracking-tight">UET GPT</span>
        <span className="text-[11px] text-[var(--text-muted)]">UET Taxila Assistant</span>
      </div>
    </div>
  );
}
