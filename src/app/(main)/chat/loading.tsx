export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 pointer-events-none select-none">
      <div className="relative flex items-center justify-center w-16 h-16">
        <div className="absolute inset-0 rounded-xl border border-[var(--accent)]/20 animate-[pulse-dot_2s_ease-in-out_infinite]" />
        <div
          className="absolute inset-2 rounded-lg border border-[var(--accent)]/40 animate-spin"
          style={{ animationDuration: "4s" }}
        />
        <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-[var(--accent)] opacity-80">
          INITIALIZING...
        </span>
        <div className="h-px w-24 bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent animate-pulse" />
      </div>
    </div>
  );
}
