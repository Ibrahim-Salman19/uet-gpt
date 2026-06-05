"use client";

import { usePreferences } from "@/components/preferences-provider";
import { VoiceModal } from "@/components/voice-modal";

/**
 * Thin wrapper that connects VoiceModal to the preferences context.
 * The voiceTranscriptCallback is set by ChatInput when it mounts, so
 * confirmed voice input flows directly into the active chat field.
 */
export function VoiceModalWrapper() {
  const { voiceTranscriptCallback } = usePreferences();
  return <VoiceModal onTranscript={voiceTranscriptCallback ?? undefined} />;
}
