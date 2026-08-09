"use client";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import { Layers, PlusCircle, Search, Settings, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

interface CommandItemData {
  id: string;
  title: string;
  description: string;
  icon: typeof Layers;
  aliases: string[];
  badge: string;
  action: () => void | Promise<void>;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function useCommands(): CommandItemData[] {
  const { setSettingsOpen, setDiagnosticsOpen, setAccentTheme } = usePreferences();
  const router = useRouter();
  const createThread = useMutation(api.threads.create);

  return React.useMemo(
    () => [
      {
        id: "new",
        title: "New conversation",
        description: "Create and open a fresh advisor thread",
        icon: PlusCircle,
        aliases: ["chat", "thread", "new"],
        badge: "/new",
        action: async () => {
          const threadId = await createThread({ title: "New Chat" });
          if (!threadId) throw new Error("Thread creation returned no identifier");
          router.push(`/chat/${threadId}`);
        },
      },
      {
        id: "settings",
        title: "Open preferences",
        description: "Configure visuals, motion, sound, and accessibility",
        icon: Settings,
        aliases: ["settings", "preferences", "audio", "webgl"],
        badge: "/settings",
        action: () => setSettingsOpen(true),
      },
      {
        id: "diagnostics",
        title: "Open diagnostics",
        description: "Inspect observable connection and rendering metrics",
        icon: ShieldAlert,
        aliases: ["telemetry", "fps", "network", "connection"],
        badge: "/diagnostics",
        action: () => setDiagnosticsOpen(true),
      },
      ...(
        [
          ["indigo", "Indigo", "cool indigo"],
          ["violet", "Violet", "violet purple"],
          ["sky", "Sky", "sky cyan blue"],
          ["amber", "Amber", "amber gold"],
          ["navy", "UET Gold", "uet navy gold"],
        ] as const
      ).map(([theme, label, aliases]) => ({
        id: `theme-${theme}`,
        title: `Accent: ${label}`,
        description: `Apply the ${label} accent palette`,
        icon: Layers,
        aliases: ["theme", "accent", ...aliases.split(" ")],
        badge: `/${theme === "navy" ? "uet" : theme}`,
        action: () => setAccentTheme(theme),
      })),
    ],
    [createThread, router, setSettingsOpen, setDiagnosticsOpen, setAccentTheme],
  );
}

function useFilteredCommands(
  commands: CommandItemData[],
  onRun: (command: CommandItemData) => void,
) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const deferredQuery = React.useDeferredValue(query);

  const filteredCommands = React.useMemo(() => {
    const normalized = normalizeSearch(deferredQuery);
    if (!normalized) return commands;

    return commands
      .map((command) => {
        const title = normalizeSearch(command.title);
        const haystack = normalizeSearch(
          `${command.title} ${command.description} ${command.badge} ${command.aliases.join(" ")}`,
        );
        const score = title.startsWith(normalized)
          ? 0
          : title.includes(normalized)
            ? 1
            : haystack.includes(normalized)
              ? 2
              : Number.POSITIVE_INFINITY;
        return { command, score };
      })
      .filter((entry) => Number.isFinite(entry.score))
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.command);
  }, [commands, deferredQuery]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [deferredQuery]);

  React.useEffect(() => {
    if (selectedIndex >= filteredCommands.length) setSelectedIndex(0);
  }, [filteredCommands.length, selectedIndex]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (filteredCommands.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((index) => (index + 1) % filteredCommands.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((index) => (index - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = filteredCommands[selectedIndex];
      if (command) onRun(command);
    }
  };

  return {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    filteredCommands,
    handleKeyDown,
  };
}

function CommandItem({
  command,
  selected,
  busy,
  optionId,
  onHover,
  onRun,
}: {
  command: CommandItemData;
  selected: boolean;
  busy: boolean;
  optionId: string;
  onHover: () => void;
  onRun: () => void;
}) {
  const Icon = command.icon;
  const ref = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <button
      ref={ref}
      id={optionId}
      type="button"
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      disabled={busy}
      onPointerEnter={onHover}
      onClick={onRun}
      className={cn(
        "group flex w-full items-center justify-between gap-4 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors focus-visible:outline-none disabled:cursor-wait disabled:opacity-60",
        selected
          ? "border-white/10 bg-white/10 text-white"
          : "text-zinc-300 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <Icon
          className="h-4 w-4 shrink-0 text-zinc-500 transition-colors group-hover:text-zinc-200"
          aria-hidden="true"
        />
        <span className="min-w-0">
          <span className="block truncate text-xs font-medium">{command.title}</span>
          <span className="mt-0.5 block truncate text-[10px] text-zinc-500">
            {command.description}
          </span>
        </span>
      </span>
      <kbd className="shrink-0 rounded border border-white/5 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
        {command.badge}
      </kbd>
    </button>
  );
}

function useCommandPaletteHotkey(setOpen: (open: boolean) => void) {
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!event.repeat) setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOpen]);
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = usePreferences();
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listId = React.useId();
  const optionPrefix = React.useId();
  const [runningId, setRunningId] = React.useState<string | null>(null);
  const runningRef = React.useRef(false);
  const commands = useCommands();

  const close = React.useCallback(() => {
    setCommandPaletteOpen(false);
  }, [setCommandPaletteOpen]);

  const runCommand = React.useCallback(
    async (command: CommandItemData) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setRunningId(command.id);
      try {
        await command.action();
        close();
      } catch (error) {
        console.error(`Command ${command.id} failed`, error);
        toast.error("That command could not be completed");
      } finally {
        runningRef.current = false;
        setRunningId(null);
      }
    },
    [close],
  );

  const search = useFilteredCommands(commands, (command) => void runCommand(command));
  useCommandPaletteHotkey(setCommandPaletteOpen);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (commandPaletteOpen && !dialog.open) {
      search.setQuery("");
      search.setSelectedIndex(0);
      try {
        dialog.showModal();
        requestAnimationFrame(() => inputRef.current?.focus());
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Command palette could not be opened", error);
        }
        setCommandPaletteOpen(false);
      }
    } else if (!commandPaletteOpen && dialog.open) {
      dialog.close();
    }
  }, [commandPaletteOpen, search.setQuery, search.setSelectedIndex, setCommandPaletteOpen]);

  const activeCommand = search.filteredCommands[search.selectedIndex];
  const activeId = activeCommand ? `${optionPrefix}-${activeCommand.id}` : undefined;

  return (
    <dialog
      ref={dialogRef}
      id="command-palette"
      aria-label="Command palette"
      onCancel={close}
      onClose={close}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={search.handleKeyDown}
      className="fixed inset-0 z-[100] m-auto w-[calc(100%_-_2rem)] max-w-[520px] border-none bg-transparent p-0 outline-none backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-[1.5rem] border border-[#2d2d34] bg-[#101012] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)]">
        <div className="flex items-center gap-3 border-b border-white/5 bg-zinc-950/60 px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={search.query}
            onChange={(event) => search.setQuery(event.target.value)}
            placeholder="Search commands…"
            className="w-full bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-500"
            spellCheck={false}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeId}
            aria-label="Search commands"
          />
          <kbd className="shrink-0 rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-mono text-[9px] text-zinc-500">
            ESC
          </kbd>
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label="Available commands"
          aria-busy={Boolean(runningId)}
          className="custom-scroll max-h-[min(22rem,60dvh)] space-y-0.5 overflow-y-auto p-2 text-zinc-300"
        >
          <div
            className="px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-zinc-500"
            role="presentation"
          >
            Quick actions
          </div>
          {search.filteredCommands.length === 0 ? (
            <p className="py-8 text-center text-xs text-zinc-500" role="status">
              No command matches “{search.query}”.
            </p>
          ) : (
            search.filteredCommands.map((command, index) => (
              <CommandItem
                key={command.id}
                command={command}
                selected={index === search.selectedIndex}
                busy={Boolean(runningId)}
                optionId={`${optionPrefix}-${command.id}`}
                onHover={() => search.setSelectedIndex(index)}
                onRun={() => void runCommand(command)}
              />
            ))
          )}
        </div>
      </div>
    </dialog>
  );
}
