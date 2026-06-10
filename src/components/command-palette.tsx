"use client";

import { api } from "convex/_generated/api";
import { useMutation } from "convex/react";
import {
  Download,
  HelpCircle,
  Layers,
  PlusCircle,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { AccentTheme, usePreferences } from "@/components/preferences-provider";
import { cn } from "@/lib/utils";

interface CommandItemData {
  id: string;
  title: string;
  desc: string;
  icon: typeof Layers;
  shortcut: string;
  action: () => void;
}

function useCommandPalette() {
  const {
    setSettingsOpen,
    setDiagnosticsOpen,
    setAccentTheme,
    setCommandPaletteOpen,
  } = usePreferences();

  const router = useRouter();
  const createThread = useMutation(api.threads.create);

  const commands: CommandItemData[] = React.useMemo(() => {
    return [
      {
        id: "new",
        title: "New Conversation",
        desc: "Start a fresh chat thread with the advisor",
        icon: PlusCircle,
        shortcut: "/new",
        action: async () => {
          try {
            const threadId = await createThread({ title: "New Chat" });
            if (threadId) router.push(`/chat/${threadId}`);
          } catch (error) {
            console.error("Failed to create thread:", error);
          }
        },
      },
      {
        id: "settings",
        title: "Preferences Settings",
        desc: "Open theme, audio, and WebGL settings",
        icon: Settings,
        shortcut: "/settings",
        action: () => setSettingsOpen(true),
      },
      {
        id: "diagnostics",
        title: "Toggle Telemetry Panel",
        desc: "Show diagnostics of latency, FPS, and memory",
        icon: ShieldAlert,
        shortcut: "/telemetry",
        action: () => setDiagnosticsOpen(true),
      },
      {
        id: "theme-indigo",
        title: "Switch Accent: Indigo",
        desc: "Set accent theme to electric indigo",
        icon: Layers,
        shortcut: "/indigo",
        action: () => setAccentTheme("indigo"),
      },
      {
        id: "theme-violet",
        title: "Switch Accent: Violet",
        desc: "Set accent theme to neon purple",
        icon: Layers,
        shortcut: "/violet",
        action: () => setAccentTheme("violet"),
      },
      {
        id: "theme-sky",
        title: "Switch Accent: Sky Blue",
        desc: "Set accent theme to light sky cyan",
        icon: Layers,
        shortcut: "/sky",
        action: () => setAccentTheme("sky"),
      },
      {
        id: "theme-amber",
        title: "Switch Accent: Amber Gold",
        desc: "Set accent theme to bright amber gold",
        icon: Layers,
        shortcut: "/amber",
        action: () => setAccentTheme("amber"),
      },
      {
        id: "theme-navy",
        title: "Switch Accent: UET Gold",
        desc: "Set accent theme to UET Gold & Navy identity",
        icon: Layers,
        shortcut: "/uet",
        action: () => setAccentTheme("navy"),
      },
    ];
  }, [createThread, router, setSettingsOpen, setDiagnosticsOpen, setAccentTheme]);

  return { commands };
}

function useCommandQuery(commands: CommandItemData[], onSelectItem: (cmd: CommandItemData) => void) {
  const [query, setQuery] = React.useState("");
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.desc.toLowerCase().includes(query.toLowerCase()) ||
        c.shortcut.toLowerCase().includes(query.toLowerCase()),
    );
  }, [query, commands]);

  React.useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        onSelectItem(filteredCommands[selectedIndex]);
      }
    }
  };

  return { query, setQuery, selectedIndex, setSelectedIndex, filteredCommands, handleKeyDown };
}

function CommandItem({
  cmd,
  isSelected,
  onSelect,
}: {
  cmd: CommandItemData;
  isSelected: boolean;
  onSelect: (cmd: CommandItemData) => void;
}) {
  const Icon = cmd.icon;
  return (
    <button
      onClick={() => onSelect(cmd)}
      className={cn(
        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all duration-150 group active:scale-[0.99] border border-transparent cursor-pointer",
        isSelected
          ? "bg-white/10 text-white border-white/10"
          : "hover:bg-white/5 hover:text-white",
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white shrink-0 transition-colors" />
        <div>
          <div className="text-xs font-medium font-sans">{cmd.title}</div>
          <div className="text-[10px] text-zinc-500 font-sans mt-0.5">{cmd.desc}</div>
        </div>
      </div>
      <kbd className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider bg-zinc-900 px-1.5 py-0.5 border border-white/5 rounded select-none">
        {cmd.shortcut}
      </kbd>
    </button>
  );
}

function CommandPaletteContent({
  query, setQuery, filteredCommands, selectedIndex, handleSelect,
}: {
  query: string;
  setQuery: (q: string) => void;
  filteredCommands: CommandItemData[];
  selectedIndex: number;
  handleSelect: (cmd: CommandItemData) => void;
}) {
  return (
    <div className="bg-[#101012] border border-[#2d2d34] rounded-[1.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col pointer-events-auto">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5 bg-zinc-950/60">
        <Search className="w-4 h-4 text-zinc-500 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type a command or search..."
          className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 outline-none font-sans"
          spellCheck="false"
          autoComplete="off"
          autoFocus
        />
        <div className="flex items-center gap-1 shrink-0 select-none">
          <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-[9px] font-mono text-zinc-500 shadow-sm">ESC</kbd>
        </div>
      </div>
      <div id="cmd-list" className="max-h-[320px] overflow-y-auto custom-scroll p-2 space-y-0.5 text-zinc-300">
        <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider px-3 py-2 select-none">Quick Actions</div>
        {filteredCommands.length === 0 ? (
          <div className="text-xs text-zinc-500 py-6 text-center font-sans">No commands found matching &quot;{query}&quot;</div>
        ) : (
          filteredCommands.map((cmd, idx) => (
            <CommandItem key={cmd.id} cmd={cmd} isSelected={idx === selectedIndex} onSelect={handleSelect} />
          ))
        )}
      </div>
    </div>
  );
}

function useCommandPaletteHotkey(setOpen: (v: boolean) => void) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setOpen]);
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, playTapSound } = usePreferences();
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);

  const handleClose = React.useCallback(() => setCommandPaletteOpen(false), [setCommandPaletteOpen]);
  const handleSelect = React.useCallback(
    (cmd: CommandItemData) => { playTapSound(); cmd.action(); setCommandPaletteOpen(false); },
    [playTapSound, setCommandPaletteOpen],
  );

  const { commands } = useCommandPalette();
  const { query, setQuery, selectedIndex, setSelectedIndex, filteredCommands, handleKeyDown } = useCommandQuery(commands, handleSelect);

  useCommandPaletteHotkey(setCommandPaletteOpen);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (commandPaletteOpen) { dialog.showModal(); setQuery(""); setSelectedIndex(0); }
    else { dialog.close(); }
  }, [commandPaletteOpen, setQuery, setSelectedIndex]);

  return (
    <dialog ref={dialogRef} id="command-palette" onClose={handleClose} onKeyDown={handleKeyDown}
      className="fixed inset-0 z-[100] m-auto bg-transparent p-0 w-full max-w-[500px] border-none outline-none">
      <CommandPaletteContent query={query} setQuery={setQuery} filteredCommands={filteredCommands}
        selectedIndex={selectedIndex} handleSelect={handleSelect} />
    </dialog>
  );
}
