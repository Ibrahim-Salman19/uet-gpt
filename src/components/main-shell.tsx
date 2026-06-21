"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 px-3 py-2 md:px-4 bg-zinc-950/60 backdrop-blur-md rounded-lg border border-white/5 text-xs text-zinc-300 hover:text-white transition-all duration-300 ease-[var(--ease-spring)] group focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:outline-none active:scale-[0.98] active:translate-y-[1px] min-h-[36px]"
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
          <title>Dropdown arrow</title>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-2 w-48 rounded-xl bg-[var(--surface-3)] border border-[var(--surface-4)] shadow-[0_16px_32px_rgba(0,0,0,0.8)] py-1.5 z-50 pointer-events-auto animate-[dropdown-open_200ms_ease-out]">
          <button
            type="button"
            onClick={() => onSelect("llama-3.1-8b")}
            className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-zinc-200 hover:text-white transition-colors flex items-center justify-between"
          >
            <span>UET-Fast</span>
            <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-white/5 px-1 rounded">
              DEFAULT
            </span>
          </button>
          <button
            type="button"
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
          "h-full bg-[var(--surface-1)]/90 backdrop-blur-md flex flex-col shrink-0 z-[90] overflow-hidden",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "fixed top-0 left-0 lg:relative",
          open
            ? "translate-x-0 pointer-events-auto opacity-100"
            : "-translate-x-full lg:translate-x-0 pointer-events-none",
          open
            ? "w-72 xl:w-80 border-r border-[var(--surface-5)] lg:opacity-100 lg:pointer-events-auto"
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
    <header className="w-full px-3 py-2.5 md:px-5 md:py-4 lg:px-6 lg:py-5 flex justify-between items-center pointer-events-auto shrink-0 border-b border-white/[0.04] bg-[var(--surface-1)]/60 backdrop-blur-xl relative z-[60] shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          className="text-zinc-400 hover:text-white transition-all duration-300 ease-[var(--ease-spring)] p-2 rounded-xl bg-zinc-950/60 border border-white/5 backdrop-blur-md hover:bg-white/5 active:scale-[0.98] active:translate-y-[1px] flex items-center justify-center shrink-0 min-h-[40px] min-w-[40px]"
        >
          <svg
            className="w-4.5 h-4.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <title>Toggle Sidebar</title>
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        {modelSelector}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShareClick}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/60 border border-white/5 rounded-lg text-[10px] text-zinc-400 hover:text-white transition-all duration-300 ease-[var(--ease-spring)] group focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none select-none active:scale-[0.98] active:translate-y-[1px]"
        >
          <svg
            className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <title>Share icon</title>
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
          </svg>
          <span>Share</span>
        </button>
        <button
          type="button"
          onClick={() => onCommandPaletteOpen(true)}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-950/60 border border-white/5 rounded-lg text-[10px] text-zinc-400 hover:text-white hover:border-white/10 transition-all duration-300 ease-[var(--ease-spring)] select-none active:scale-[0.98] active:translate-y-[1px]"
        >
          <span>Search</span>
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
    <div className="p-5 flex items-center justify-between border-b border-[var(--surface-5)] shrink-0">
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
        type="button"
        onClick={onClose}
        className="text-zinc-500 hover:text-zinc-300 transition-colors p-2 rounded-lg hover:bg-white/5 min-h-[36px] min-w-[36px] flex items-center justify-center lg:hidden"
        aria-label="Close sidebar"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <title>Close sidebar</title>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
    </div>
  );
}

// ── Mobile Bottom Navigation ──

const MOBILE_NAV_ITEMS = [
  {
    href: "/chat",
    label: "Chat",
    icon: (active: boolean) => (
      <svg
        className={cn(
          "w-5 h-5 transition-all duration-200",
          active ? "stroke-[var(--accent)]" : "stroke-zinc-500",
        )}
        viewBox="0 0 24 24"
        fill={active ? "rgba(var(--accent-rgb,212,168,74),0.08)" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>Chat</title>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/explore",
    label: "Explore",
    icon: (active: boolean) => (
      <svg
        className={cn(
          "w-5 h-5 transition-all duration-200",
          active ? "stroke-[var(--accent)]" : "stroke-zinc-500",
        )}
        viewBox="0 0 24 24"
        fill={active ? "rgba(var(--accent-rgb,212,168,74),0.08)" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>Explore</title>
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (active: boolean) => (
      <svg
        className={cn(
          "w-5 h-5 transition-all duration-200",
          active ? "stroke-[var(--accent)]" : "stroke-zinc-500",
        )}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <title>Settings</title>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

function MobileBottomNav({ visible }: { visible: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[70] lg:hidden glass-nav mobile-bottom-nav h-16 box-content",
        "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none",
      )}
      aria-label="Mobile navigation"
    >
      <div className="flex items-center justify-around px-2 h-16">
        {MOBILE_NAV_ITEMS.map((item, idx) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "mobile-nav-item flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-h-[52px] min-w-[64px] relative overflow-hidden",
                isActive
                  ? "text-[var(--accent)]"
                  : "text-zinc-500 hover:text-zinc-300 active:scale-95",
              )}
              style={{ animationDelay: `${idx * 40}ms` }}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
            >
              {isActive && <div className="absolute inset-0 bg-[var(--accent)]/5 rounded-xl" />}
              <span className="relative z-10">{item.icon(isActive)}</span>
              <span
                className={cn(
                  "relative z-10 text-[10px] font-medium tracking-wide transition-all duration-200",
                  isActive ? "text-[var(--accent)]" : "text-zinc-600",
                )}
              >
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
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
 * - Mobile bottom navigation bar (hidden on lg+)
 * - Accessibility skip-link target
 */
export function MainShell({ children }: MainShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const { setCommandPaletteOpen, modelPreference, updateModelPreference } = usePreferences();
  const {
    open: modelDropdownOpen,
    setOpen: setModelDropdownOpen,
    ref: dropdownRef,
  } = useModelDropdown();

  // Global focus tracker to check if keyboard is likely open / user is typing
  const [inputFocused, setInputFocused] = React.useState(false);

  React.useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        setInputFocused(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        // Delay setting state in case focus is moving to another input/textarea
        setTimeout(() => {
          const activeEl = document.activeElement;
          if (!activeEl || (activeEl.tagName !== "INPUT" && activeEl.tagName !== "TEXTAREA")) {
            setInputFocused(false);
          }
        }, 50);
      }
    };

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);

    return () => {
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    // Run once on mount
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = React.useCallback(() => setSidebarOpen((p) => !p), []);
  const closeSidebar = React.useCallback(() => setSidebarOpen(false), []);

  const isPro = modelPreference === "llama-4-scout";
  const activeModelLabel = isPro ? "UET-Pro" : "UET-Fast";

  const handleSelectModel = React.useCallback(
    async (modelKey: "llama-3.1-8b" | "llama-4-scout") => {
      setModelDropdownOpen(false);
      await updateModelPreference(modelKey);
    },
    [setModelDropdownOpen, updateModelPreference],
  );

  const onShareClick = useShareHandler();

  useSidebarKeyboardShortcuts(closeSidebar, toggleSidebar);

  const isChatThread = pathname.startsWith("/chat/") && pathname !== "/chat";
  const showMobilePadding = !inputFocused && !isChatThread;

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

        {/* Main content with bottom padding on mobile for nav bar */}
        <main
          id="main-content"
          className={cn(
            "flex-1 overflow-hidden relative lg:pb-0 transition-[padding-bottom] duration-150 ease-out",
            showMobilePadding ? "pb-16" : "pb-0",
          )}
        >
          {children}
          <DiagnosticsPanel inputFocused={inputFocused} />
        </main>
      </div>

      {/* Mobile bottom navigation — hidden on lg+ screens */}
      <MobileBottomNav visible={!inputFocused && !isChatThread} />
    </div>
  );
}
