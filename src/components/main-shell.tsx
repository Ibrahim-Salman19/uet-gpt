"use client";

import { ChevronDown, Menu, MessageSquare, Search, Settings, Share2, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { DiagnosticsPanel } from "@/components/diagnostics-panel";
import { type ModelPreference, usePreferences } from "@/components/preferences-provider";
import { Sidebar } from "@/components/sidebar";
import { cn, copyToClipboard } from "@/lib/utils";

interface MainShellProps {
  children: React.ReactNode;
}

const MODEL_OPTIONS: ReadonlyArray<{
  key: ModelPreference;
  label: string;
  badge: string;
  description: string;
}> = [
  {
    key: "gpt-oss-20b",
    label: "UET-Fast",
    badge: "DEFAULT",
    description: "Lower latency for everyday questions",
  },
  {
    key: "gpt-oss-120b",
    label: "UET-Pro",
    badge: "DEEP",
    description: "More deliberate responses for complex work",
  },
];

function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query);
      if (typeof mediaQuery.addEventListener === "function") {
        mediaQuery.addEventListener("change", onChange);
        return () => mediaQuery.removeEventListener("change", onChange);
      }
      mediaQuery.addListener(onChange);
      return () => mediaQuery.removeListener(onChange);
    },
    [query],
  );
  const getSnapshot = React.useCallback(() => window.matchMedia(query).matches, [query]);
  const getServerSnapshot = React.useCallback(() => false, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function useModelDropdown() {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current || event.composedPath().includes(rootRef.current)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, rootRef, triggerRef };
}

function ModelSelector({
  activeModel,
  open,
  setOpen,
  rootRef,
  triggerRef,
  onSelect,
}: {
  activeModel: ModelPreference;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rootRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onSelect: (model: ModelPreference) => Promise<void>;
}) {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const menuId = React.useId();
  const [pendingModel, setPendingModel] = React.useState<ModelPreference | null>(null);
  const pendingRef = React.useRef(false);
  const activeOption =
    MODEL_OPTIONS.find((option) => option.key === activeModel) ?? MODEL_OPTIONS[0]!;

  React.useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>(`[data-model-key="${activeModel}"]`)
        ?.focus();
    });
  }, [open, activeModel]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]:not(:disabled)',
      ) ?? [],
    );
    if (!items.length) return;
    const index = Math.max(0, items.indexOf(document.activeElement as HTMLButtonElement));

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items.at(-1)?.focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  const selectModel = async (model: ModelPreference) => {
    if (pendingRef.current || pendingModel || model === activeModel) {
      setOpen(false);
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      return;
    }

    pendingRef.current = true;
    setPendingModel(model);
    try {
      await onSelect(model);
      setOpen(false);
      requestAnimationFrame(() => {
        if (triggerRef.current?.isConnected) triggerRef.current.focus();
      });
    } catch {
      // The preference provider reports the persistence error and rolls back.
    } finally {
      pendingRef.current = false;
      setPendingModel(null);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="group flex min-h-10 items-center gap-2 rounded-lg border border-white/5 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300 backdrop-blur-md transition-colors hover:border-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 md:px-4"
        aria-label="Select AI model"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
      >
        <span className="font-medium">{activeOption.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-zinc-500 transition-transform group-hover:text-zinc-300 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label="AI model"
          onKeyDown={handleMenuKeyDown}
          className="pointer-events-auto absolute left-0 z-50 mt-2 w-64 animate-[dropdown-open_160ms_ease-out] rounded-xl border border-[var(--surface-4)] bg-[var(--surface-3)] p-1.5 shadow-[0_16px_32px_rgba(0,0,0,0.8)] motion-reduce:animate-none"
        >
          {MODEL_OPTIONS.map((option) => {
            const selected = option.key === activeModel;
            const pending = option.key === pendingModel;
            return (
              <button
                key={option.key}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                data-model-key={option.key}
                disabled={Boolean(pendingModel)}
                onClick={() => void selectModel(option.key)}
                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs text-zinc-200 transition-colors hover:bg-white/5 hover:text-white focus-visible:bg-white/5 focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
                    {pending ? "Saving preference…" : option.description}
                  </span>
                </span>
                <span className="shrink-0 rounded border border-white/5 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
                  {option.badge}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function useInert(ref: React.RefObject<HTMLElement | null>, inert: boolean): void {
  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof (element as unknown as { inert?: boolean }).inert === "boolean") {
      (element as unknown as { inert: boolean }).inert = inert;
    } else if (inert) {
      element.setAttribute("inert", "");
    } else {
      element.removeAttribute("inert");
    }

    return () => {
      if (typeof (element as unknown as { inert?: boolean }).inert === "boolean") {
        (element as unknown as { inert: boolean }).inert = false;
      } else {
        element.removeAttribute("inert");
      }
    };
  }, [ref, inert]);
}

function useMobileSidebarFocus(
  open: boolean,
  desktop: boolean,
  panelRef: React.RefObject<HTMLElement | null>,
  triggerRef: React.RefObject<HTMLButtonElement | null>,
  onClose: () => void,
) {
  React.useEffect(() => {
    if (!open || desktop) return;
    const panel = panelRef.current;
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      panel.querySelector<HTMLElement>("[data-sidebar-autofocus]")?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(
        (element) =>
          !element.hasAttribute("hidden") &&
          element.getAttribute("aria-hidden") !== "true" &&
          element.getClientRects().length > 0,
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
    };
  }, [open, desktop, panelRef, triggerRef, onClose]);
}

function SidebarPanel({
  open,
  desktop,
  onClose,
  triggerRef,
  children,
}: {
  open: boolean;
  desktop: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLElement | null>(null);
  useInert(panelRef, !open);
  useMobileSidebarFocus(open, desktop, panelRef, triggerRef, onClose);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden motion-reduce:transition-none",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        id="primary-sidebar"
        aria-label="Navigation sidebar"
        aria-hidden={!open}
        className={cn(
          "fixed left-0 top-0 z-[90] flex h-full shrink-0 flex-col overflow-hidden bg-[var(--surface-1)]/95 backdrop-blur-md transition-[width,transform,opacity,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] lg:relative motion-reduce:transition-none",
          open
            ? "w-72 translate-x-0 border-r border-[var(--surface-5)] opacity-100 xl:w-80"
            : "w-72 -translate-x-full border-r border-transparent opacity-0 lg:w-0 lg:translate-x-0",
        )}
      >
        {children}
      </aside>
    </>
  );
}

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--surface-5)] p-5">
      <div className="flex items-center gap-3">
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded border border-[var(--accent)]/20 bg-[var(--accent)]/10"
          aria-hidden="true"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-200">
          UETGPT
        </span>
      </div>
      <button
        type="button"
        data-sidebar-autofocus
        onClick={onClose}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] lg:hidden"
        aria-label="Close navigation"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function Header({
  sidebarOpen,
  sidebarTriggerRef,
  onToggleSidebar,
  modelSelector,
  onShare,
  onOpenCommandPalette,
}: {
  sidebarOpen: boolean;
  sidebarTriggerRef: React.RefObject<HTMLButtonElement | null>;
  onToggleSidebar: () => void;
  modelSelector: React.ReactNode;
  onShare: () => void;
  onOpenCommandPalette: () => void;
}) {
  return (
    <header className="pointer-events-auto relative z-[60] flex w-full shrink-0 items-center justify-between border-b border-white/[0.04] bg-[var(--surface-1)]/60 px-3 py-2.5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-xl md:px-5 md:py-4 lg:px-6 lg:py-5">
      <div className="flex min-w-0 items-center gap-3">
        <button
          ref={sidebarTriggerRef}
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={sidebarOpen}
          aria-controls="primary-sidebar"
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-zinc-950/60 p-2 text-zinc-400 backdrop-blur-md transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        {modelSelector}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onShare}
          className="flex min-h-9 items-center gap-1.5 rounded-lg border border-white/5 bg-zinc-950/60 px-2.5 py-1.5 text-[10px] text-zinc-400 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:px-3"
          aria-label="Share this page"
        >
          <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Share</span>
        </button>
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="hidden min-h-9 items-center gap-1.5 rounded-lg border border-white/5 bg-zinc-950/60 px-3 py-1.5 text-[10px] text-zinc-400 transition-colors hover:border-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:flex"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Search</span>
          <kbd className="rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] opacity-70">
            Ctrl/⌘ K
          </kbd>
        </button>
      </div>
    </header>
  );
}

const MOBILE_NAV_ITEMS = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/explore", label: "Explore", icon: Search },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

function MobileBottomNav({ visible }: { visible: boolean }) {
  const pathname = usePathname();
  const navRef = React.useRef<HTMLElement | null>(null);
  useInert(navRef, !visible);

  return (
    <nav
      ref={navRef}
      className={cn(
        "glass-nav mobile-bottom-nav fixed inset-x-0 bottom-0 z-[70] box-content h-16 pb-[env(safe-area-inset-bottom)] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:hidden motion-reduce:transition-none",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0",
      )}
      aria-label="Mobile navigation"
      aria-hidden={!visible}
    >
      <div className="flex h-16 items-center justify-around px-2">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[52px] min-w-16 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl px-4 py-2 transition-colors",
                active ? "text-[var(--accent)]" : "text-zinc-500 hover:text-zinc-300",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <span
                  className="absolute inset-0 rounded-xl bg-[var(--accent)]/5"
                  aria-hidden="true"
                />
              ) : null}
              <Icon className="relative z-10 h-5 w-5" aria-hidden="true" />
              <span
                className={cn(
                  "relative z-10 text-[11px] font-medium tracking-wide",
                  active ? "text-[var(--accent)]" : "text-zinc-400",
                )}
              >
                {item.label}
              </span>
              {active ? (
                <span
                  className="absolute bottom-0 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-[var(--accent)]"
                  aria-hidden="true"
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isTextEntry(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && !NON_TEXT_INPUT_TYPES.has(element.type);
}

function useInputFocus(): boolean {
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    const update = () => setFocused(isTextEntry(document.activeElement));
    const handleFocusOut = () => queueMicrotask(update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", handleFocusOut);
    update();
    return () => {
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  return focused;
}

function useSidebarKeyboardShortcut(
  desktop: boolean,
  sidebarOpen: boolean,
  toggleSidebar: () => void,
  closeSidebar: () => void,
): void {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        if (!event.repeat) toggleSidebar();
        return;
      }

      // Escape belongs to the topmost transient surface first. Menus and native
      // dialogs handle it themselves; the desktop sidebar closes only when no
      // higher-priority overlay remains open.
      if (
        desktop &&
        sidebarOpen &&
        event.key === "Escape" &&
        !document.querySelector("dialog[open]") &&
        document.activeElement?.closest('[role="menu"]') === null
      ) {
        event.preventDefault();
        closeSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [desktop, sidebarOpen, toggleSidebar, closeSidebar]);
}

function useShareHandler() {
  return React.useCallback(async () => {
    const data = { title: document.title, url: window.location.href };
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(data);
        return;
      }
      if (await copyToClipboard(data.url)) {
        toast.success("Share link copied");
      } else {
        toast.error("The share link could not be copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Share failed", error);
      toast.error("This page could not be shared");
    }
  }, []);
}

export function MainShell({ children }: MainShellProps) {
  const pathname = usePathname();
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = React.useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);
  const sidebarOpen = desktop ? desktopSidebarOpen : mobileSidebarOpen;
  const sidebarTriggerRef = React.useRef<HTMLButtonElement | null>(null);
  const inputFocused = useInputFocus();
  const preferences = usePreferences();
  const dropdown = useModelDropdown();
  const share = useShareHandler();

  React.useEffect(() => {
    setMobileSidebarOpen(false);
    dropdown.setOpen(false);
  }, [pathname, dropdown.setOpen]);

  const toggleSidebar = React.useCallback(() => {
    if (desktop) setDesktopSidebarOpen((open) => !open);
    else setMobileSidebarOpen((open) => !open);
  }, [desktop]);
  const closeSidebar = React.useCallback(() => {
    if (desktop) setDesktopSidebarOpen(false);
    else setMobileSidebarOpen(false);
  }, [desktop]);

  useSidebarKeyboardShortcut(desktop, sidebarOpen, toggleSidebar, closeSidebar);

  const isChatThread = pathname.startsWith("/chat/") && pathname !== "/chat";
  const showMobileNav = !inputFocused && !isChatThread && !mobileSidebarOpen;

  return (
    <div className="relative z-10 flex h-full w-full overflow-hidden">
      <SidebarPanel
        open={sidebarOpen}
        desktop={desktop}
        onClose={closeSidebar}
        triggerRef={sidebarTriggerRef}
      >
        <SidebarHeader onClose={closeSidebar} />
        <Sidebar />
      </SidebarPanel>

      <div className="pointer-events-auto relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
        <Header
          sidebarOpen={sidebarOpen}
          sidebarTriggerRef={sidebarTriggerRef}
          onToggleSidebar={toggleSidebar}
          modelSelector={
            <ModelSelector
              activeModel={preferences.modelPreference}
              open={dropdown.open}
              setOpen={dropdown.setOpen}
              rootRef={dropdown.rootRef}
              triggerRef={dropdown.triggerRef}
              onSelect={preferences.updateModelPreference}
            />
          }
          onShare={() => void share()}
          onOpenCommandPalette={() => preferences.setCommandPaletteOpen(true)}
        />

        <main
          id="main-content"
          tabIndex={-1}
          className={cn(
            "relative flex-1 overflow-hidden transition-[padding-bottom] duration-150 ease-out lg:pb-0 motion-reduce:transition-none",
            showMobileNav ? "pb-[calc(4rem_+_env(safe-area-inset-bottom))]" : "pb-0",
          )}
        >
          {children}
          <DiagnosticsPanel inputFocused={inputFocused} />
        </main>
      </div>

      <MobileBottomNav visible={showMobileNav} />
    </div>
  );
}
