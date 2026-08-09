"use client";

import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";
import { VoiceModal } from "@/components/voice-modal";

/** Connects confirmed speech to whichever chat input currently owns the callback. */
export const VoiceModalWrapper = React.memo(function VoiceModalWrapper() {
  const { voiceTranscriptCallback } = usePreferences();
  return <VoiceModal onTranscript={voiceTranscriptCallback ?? undefined} />;
});
