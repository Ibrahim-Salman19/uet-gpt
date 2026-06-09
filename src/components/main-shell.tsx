"use client";

import * as React from "react";
import { toast } from "sonner";
import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import { usePreferences } from "@/components/preferences-provider";
import { Sidebar } from "@/components/sidebar";
import { cn } from "@/lib/utils";

interface MainShellProps {
  children: React.ReactNode;
}

// ── Model Dropdown Hook ──

function useModelDropdown() {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return { open, setOpen, ref };
}

// ── Model Selector ──

function ModelSelector({
  activeModelLabel,
  isOpen,
  onToggle,
  onSelect,
  ref,
}: {
  activeModelLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (modelKey: "llama-3.1-8b" | "llama-4-scout") => void;
  ref: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={onToggle}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-950/60 backdrop-blur-md rounded-lg border border-white/5 text-xs text-zinc-300 hover:text-white transition-all duration-300 ease-[var(--ease-spring)] group focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-[0.98] active:translate-y-[1px]"
        aria-label="Select AI Model"
      >
        <span className="font-medium">{activeModelLabel}</span>
        <svg
          className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 rounded-xl bg-[#101012] border border-[#2d2d34] shadow-[0_16px_32px_rgba(0,0,0,0.8)] py-1.5 z-50 pointer-events-auto animate-[dropdown-open_200ms_ease-out]">
          <button
            onClick={() => onSelect("llama-3.1-8b")}
            className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-zinc-200 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>UET-Fast</span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-white/5 px-1 rounded">
              DEFAULT
            </span>
          </button>
          <button
            onClick={() => onSelect("llama-4-scout")}
            className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-zinc-200 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>UET-Pro</span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-white/5 px-1 rounded">
              DEEP
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sidebar Panel ──

function SidebarPanel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "h-full bg-[#0a0a0c]/90 backdrop-blur-md flex flex-col shrink-0 z-[90] overflow-hidden",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "fixed top-0 left-0 lg:relative",
          open
            ? "translate-x-0 pointer-events-auto opacity-100"
            : "-translate-x-full lg:translate-x-0 pointer-events-none",
          open
            ? "w-72 border-r border-[#222226] lg:opacity-100 lg:pointer-events-auto"
            : "lg:w-0 lg:opacity-0 lg:border-r-transparent lg:pointer-events-none",
        )}
        style={{
          transitionProperty: "width, transform, opacity, border-color",
          willChange: open ? "width, opacity" : "auto",
        }}
        aria-label="Navigation sidebar"
      >
        {children}
      </aside>
    </>
  );
}

// ── Header ──

function Header({
  sidebarOpen,
  onToggleSidebar,
  modelSelector,
  onShareClick,
  onCommandPaletteOpen,
}: {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  modelSelector: React.ReactNode;
  onShareClick: () => void;
  onCommandPaletteOpen: (open: boolean) => void;
}) {
  return (
    <header className="w-full px-6 py-5 flex justify-between items-center pointer-events-auto shrink-0 border-b border-white/[0.04] bg-[#0a0a0c]/20 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className={cn(
            "text-zinc-400 hover:text-white transition-all duration-300 ease-[var(--ease-spring)] p-2 rounded-xl bg-zinc-950/60 border border-white/5 backdrop-blur-md hover:bg-white/5 active:scale-[0.98] active:translate-y-[1px] flex items-center justify-center shrink-0",
            sidebarOpen && "lg:hidden lg:opacity-0 lg:pointer-events-none",
          )}
        >
          <svg
            className="w-4.5 h-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {modelSelector}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onShareClick}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/60 border border-white/5 rounded-lg text-[10px] text-zinc-400 hover:text-white transition-all duration-300 ease-[var(--ease-spring)] group focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none select-none active:scale-[0.98] active:translate-y-[1px]"
        >
          <svg
            className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          <span>Share Chat</span>
        </button>
        <button
          onClick={() => onCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/60 border border-white/5 rounded-lg text-[10px] text-zinc-500 hover:text-zinc-300 hover:border-white/10 transition-all duration-300 ease-[var(--ease-spring)] select-none active:scale-[0.98] active:translate-y-[1px]"
        >
          <span>Search Commands</span>
          <kbd className="font-mono text-[9px] opacity-60 bg-zinc-900 border border-white/10 px-1.5 py-0.5 rounded">
            Ctrl+K
          </kbd>
        </button>
      </div>
    </header>
  );
}

// ── Sidebar Header ──

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-5 flex items-center justify-between border-b border-[#222226] shrink-0">
      <div className="flex items-center gap-3">
        <div
          className="relative w-7 h-7 flex items-center justify-center rounded bg-[var(--accent)]/10 border border-[var(--accent)]/20"
          aria-hidden="true"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        </div>
        <span className="text-[11px] uppercase tracking-[0.2em] font-semibold text-zinc-200 font-sans">
          UETGPT
        </span>
      </div>
      <button
        onClick={onClose}
        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded hover:bg-white/5"
        aria-label="Close sidebar"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
}

// ── Keyboard Shortcut Hook ──

function useSidebarKeyboardShortcuts(closeSidebar: () => void, toggleSidebar: () => void) {
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeSidebar();
      } else if (e.key === "/" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [closeSidebar, toggleSidebar]);
}

// ── Share Button Handler ──

function useShareHandler() {
  return React.useCallback(() => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Share link copied!");
    }
  }, []);
}

/**
 * Client-side shell that manages:
 * - Slide-in/out sidebar with mobile overlay
 * - Top header with hamburger, model selector, Ctrl+K pill
 * - Accessibility skip-link target
 */
export function MainShell({ children }: MainShellProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { setCommandPaletteOpen, modelPreference, updateModelPreference } = usePreferences();
  const { open: modelDropdownOpen, setOpen: setModelDropdownOpen, ref: dropdownRef } =
    useModelDropdown();

  React.useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  const toggleSidebar = React.useCallback(() => setSidebarOpen((p) => !p), []);
  const closeSidebar = React.useCallback(() => setSidebarOpen(false), []);

  const isPro = modelPreference === "llama-4-scout";
  const activeModelLabel = isPro ? "UET-Pro" : "UET-Fast";

  const handleSelectModel = async (modelKey: "llama-3.1-8b" | "llama-4-scout") => {
    setModelDropdownOpen(false);
    await updateModelPreference(modelKey);
  };

  const onShareClick = useShareHandler();

  useSidebarKeyboardShortcuts(closeSidebar, toggleSidebar);

  return (
    <div className="relative z-10 flex h-full w-full overflow-hidden">
      <SidebarPanel open={sidebarOpen} onClose={closeSidebar}>
        <SidebarHeader onClose={closeSidebar} />
        <Sidebar />
      </SidebarPanel>

      <div className="flex flex-1 flex-col min-w-0 pointer-events-auto bg-transparent relative h-full overflow-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          modelSelector={
            <ModelSelector
              activeModelLabel={activeModelLabel}
              isOpen={modelDropdownOpen}
              onToggle={() => setModelDropdownOpen((p) => !p)}
              onSelect={handleSelectModel}
              ref={dropdownRef}
            />
          }
          onShareClick={onShareClick}
          onCommandPaletteOpen={setCommandPaletteOpen}
        />

        <main id="main-content" className="flex-1 overflow-hidden relative">
          {children}
          <DiagnosticsPanel />
        </main>
      </div>
    </div>
  );
}
