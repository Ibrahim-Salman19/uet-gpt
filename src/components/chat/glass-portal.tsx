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
        "flex h-full w-full flex-col bg-zinc-950/20 relative overflow-hidden",
        className,
      )}
    >
      <GridOverlay />
      {children}
    </div>
  );
}
