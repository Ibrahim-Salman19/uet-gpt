export default function ChatLoading() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 animate-pulse">
      <div className="w-14 h-14 rounded-2xl bg-zinc-800/50 border border-zinc-700/30" />
      <div className="h-4 w-48 rounded bg-zinc-800/50" />
      <div className="h-3 w-64 rounded bg-zinc-800/30" />
    </div>
  );
}
