import { AmbientGlow } from "@/components/ambient-glow";
import { BackdropWrapper } from "@/components/backdrop-wrapper";
import { CommandPalette } from "@/components/command-palette";
import { ConnectionStatus } from "@/components/connection-status";
import { ConvexReadyGate } from "@/components/convex-ready-gate";
import { MainShell } from "@/components/main-shell";
import { PreferencesModal } from "@/components/preferences-modal";
import { VoiceModalWrapper } from "@/components/voice-modal-wrapper";

export const dynamic = "force-dynamic";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-[100dvh] w-full overflow-hidden bg-[#050506] text-zinc-100">
      {/* WebGL with graceful fallback if it crashes */}
      <BackdropWrapper />

      <AmbientGlow />

      <ConnectionStatus />

      {/* Branded loading/timeout gate */}
      <ConvexReadyGate>
        {/* Main shell handles sidebar open/close state */}
        <MainShell>{children}</MainShell>
      </ConvexReadyGate>

      {/* Modals & Palettes System */}
      <CommandPalette />
      <PreferencesModal />
      <VoiceModalWrapper />
    </div>
  );
}
