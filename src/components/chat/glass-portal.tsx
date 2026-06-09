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
        "flex h-full flex-col items-center justify-end px-4 pb-4 md:px-8 md:pb-8",
        className,
      )}
    >
      <div className="w-full max-w-4xl h-full max-h-[90dvh] bg-[#101012]/80 backdrop-blur-md border border-[#222226] rounded-2xl md:rounded-3xl p-2.5 shadow-2xl relative overflow-hidden flex flex-col pointer-events-auto">
        <div className="w-full h-full flex flex-col rounded-[calc(1.5rem-3px)] border border-[#2d2d34] shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)] relative overflow-hidden bg-zinc-950/70">
          <GridOverlay />
          {children}
        </div>
      </div>
    </div>
  );
}
