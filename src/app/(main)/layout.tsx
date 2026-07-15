import type { Metadata } from "next";
import { ErrorBoundary } from "react-error-boundary";
import { AmbientGlow } from "@/components/ambient-glow";
import { BackdropWrapper } from "@/components/backdrop-wrapper";
import { CommandPalette } from "@/components/command-palette";
import { ConnectionStatus } from "@/components/connection-status";
import { ConvexReadyGate } from "@/components/convex-ready-gate";
import { MainShell } from "@/components/main-shell";
import { PreferencesModal } from "@/components/preferences-modal";
import { VoiceModalWrapper } from "@/components/voice-modal-wrapper";

export const dynamic = "force-dynamic";

// App routes are auth-gated, client-rendered shells with no crawlable content.
// Keep them out of the index (child layouts inherit this unless overridden).
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[var(--surface-base)] text-[var(--text-primary)]">
      {/* WebGL with graceful fallback if it crashes */}
      <BackdropWrapper />

      <ErrorBoundary fallback={null}>
        <AmbientGlow />
      </ErrorBoundary>

      <ErrorBoundary fallback={null}>
        <ConnectionStatus />
      </ErrorBoundary>

      {/* Branded loading/timeout gate */}
      <ConvexReadyGate>
        {/* Main shell handles sidebar open/close state */}
        <MainShell>{children}</MainShell>
      </ConvexReadyGate>

      {/* Modals & Palettes System */}
      <ErrorBoundary fallback={null}>
        <CommandPalette />
      </ErrorBoundary>

      <ErrorBoundary fallback={null}>
        <PreferencesModal />
      </ErrorBoundary>

      <ErrorBoundary fallback={null}>
        <VoiceModalWrapper />
      </ErrorBoundary>
    </div>
  );
}
