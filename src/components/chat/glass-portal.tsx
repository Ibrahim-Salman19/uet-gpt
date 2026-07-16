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
          "linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }}
    />
  );
}

/**
 * GlassPortal - the premium frosted glass container that holds the chat UI.
 *
 * Responsive strategy:
 * - Mobile: Full width/height, no border/padding - feels native
 * - Tablet (md): Centered with horizontal padding, partial max-height
 * - Desktop (lg+): Floating glass card, 90dvh, max-w-4xl
 * - Large screens (2xl+): Wider max-w-5xl to use screen real estate
 */
export function GlassPortal({ children, className }: GlassPortalProps) {
  return (
    <div
      className={cn("flex h-full flex-col items-center justify-end p-0 md:p-6 lg:p-8", className)}
    >
      <div
        className={cn(
          // Mobile: full bleed, no border radius
          "w-full h-full",
          // MD+: card-like with border and rounding
          "md:max-h-full md:rounded-3xl md:border md:border-[var(--border)]/50",
          // XL+: wider
          "xl:max-w-4xl 2xl:max-w-5xl",
          // Shared styles
          "bg-[var(--surface-card)]/60 backdrop-blur-md shadow-2xl relative overflow-hidden flex flex-col pointer-events-auto",
          // Inner padding on md+ for spacing from window edge
          "p-0 md:p-2.5",
        )}
      >
        <div
          className={cn(
            "w-full h-full flex flex-col overflow-hidden relative",
            "bg-[var(--surface-base)]/50",
            "rounded-none md:rounded-[calc(1.5rem-3px)]",
            "border-0 md:border md:border-[var(--border)]/30",
            "shadow-none md:shadow-[inset_0_1px_1px_rgba(255,255,255,0.04)]",
          )}
        >
          <GridOverlay />
          {children}
        </div>
      </div>
    </div>
  );
}
