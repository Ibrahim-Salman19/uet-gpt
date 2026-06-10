import { cn } from "@/lib/utils";

interface GlassPortalProps {
  children: React.ReactNode;
  className?: string;
}

function GridOverlay() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
      style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)",
        backgroundSize: "32px 32px",
      }}
    />
  );
}

export function GlassPortal({ children, className }: GlassPortalProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col relative overflow-hidden",
        className,
      )}
    >
      <GridOverlay />
      {/* ── Nested Inner Card (Terminal Brutalism) ── */}
      <div className="relative z-10 flex-1 w-full max-w-4xl mx-auto flex flex-col bg-zinc-950/80 backdrop-blur-md border border-white/5 rounded-2xl md:rounded-3xl p-2.5 shadow-2xl">
        <div className="w-full h-full flex flex-col rounded-[calc(1.5rem-3px)] border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] relative overflow-hidden bg-zinc-950/70">
          <GridOverlay />
          {children}
        </div>
      </div>
    </div>
  );
}
