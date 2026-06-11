"use client";

import { CheckCircle, Mic, MicOff } from "lucide-react";
import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";

interface VoiceModalProps {
  onTranscript?: (text: string) => void;
}

// ── Speech Recognition Hook ──

function useSpeechRecognition() {
  const [transcript, setTranscript] = React.useState("");
  const [isListening, setIsListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSupported, setIsSupported] = React.useState(true);
  const recognitionRef = React.useRef<any>(null);

  // Check browser support
  React.useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
  }, []);

  // Setup speech recognition
  const startListening = React.useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }
      setTranscript(finalTranscript || interimTranscript);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setError("No speech detected. Try again.");
      } else if (event.error === "not-allowed") {
        setError("Microphone access was denied. Allow microphone in browser settings.");
      } else {
        setError(`Error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, []);

  const stopListening = React.useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  return {
    transcript,
    isListening,
    error,
    isSupported,
    setTranscript,
    setError,
    startListening,
    stopListening,
  };
}

// ── Waveform Bars ──

function WaveformBars({
  isListening,
  hasTranscript,
}: {
  isListening: boolean;
  hasTranscript: boolean;
}) {
  return (
    <div className="flex items-end justify-center gap-1.5 h-12">
      {[0.3, 0.7, 0.5, 0.9, 0.4, 0.6, 0.8, 0.35, 0.65].map((h, i) => (
        <div
          key={i}
          className="w-1 rounded-full transition-all duration-300"
          style={{
            height: isListening ? `${h * 100}%` : "20%",
            background: isListening
              ? "var(--accent)"
              : hasTranscript
                ? "oklch(0.55 0.18 145)"
                : "rgb(63, 63, 70)",
            animationName: isListening ? "pulse" : "none",
            animationDuration: `${0.6 + i * 0.07}s`,
            animationTimingFunction: "ease-in-out",
            animationIterationCount: "infinite",
            animationDirection: "alternate",
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

// ── Voice Action Buttons ──

function VoiceActionButtons({
  isListening,
  transcript,
  isSupported,
  onCancel,
  onStop,
  onConfirm,
  onStart,
}: {
  isListening: boolean;
  transcript: string;
  isSupported: boolean;
  onCancel: () => void;
  onStop: () => void;
  onConfirm: () => void;
  onStart: () => void;
}) {
  return (
    <div className="w-full flex gap-3">
      <button
        onClick={onCancel}
        className="flex-1 py-2.5 border border-white/5 hover:bg-white/5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white transition-all duration-200 active:scale-95 cursor-pointer font-sans"
      >
        Cancel
      </button>

      {isListening ? (
        <button
          onClick={onStop}
          className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 rounded-lg text-xs font-semibold text-red-400 hover:text-red-300 transition-all duration-200 active:scale-95 cursor-pointer font-sans flex items-center justify-center gap-1.5"
        >
          <MicOff className="h-3.5 w-3.5" />
          Stop
        </button>
      ) : transcript ? (
        <button
          onClick={onConfirm}
          className="flex-1 py-2.5 bg-[var(--accent)]/20 border border-[var(--accent)]/30 hover:bg-[var(--accent)]/30 rounded-lg text-xs font-semibold text-[var(--accent)] transition-all duration-200 active:scale-95 cursor-pointer font-sans flex items-center justify-center gap-1.5"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          Confirm
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={!isSupported}
          className="flex-1 py-2.5 bg-[var(--accent)]/20 border border-[var(--accent)]/30 hover:bg-[var(--accent)]/30 rounded-lg text-xs font-semibold text-[var(--accent)] transition-all duration-200 active:scale-95 cursor-pointer font-sans flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Mic className="h-3.5 w-3.5" />
          Start
        </button>
      )}
    </div>
  );
}

function VoiceDialogContent({
  isListening,
  transcript,
  error,
  isSupported,
  onCancel,
  onConfirm,
  onStop,
  onStart,
}: {
  isListening: boolean;
  transcript: string;
  error: string | null;
  isSupported: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onStop: () => void;
  onStart: () => void;
}) {
  return (
    <div className="bg-[#101012] border border-[#2d2d34] rounded-[1.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)] p-6 flex flex-col items-center text-center gap-4">
      <div>
        <h3 className="text-sm font-semibold text-zinc-100 tracking-wide font-sans">Voice Input</h3>
        <p className="text-xs text-zinc-500 mt-1 font-sans">
          {isListening
            ? "Listening… speak your question"
            : transcript
              ? "Tap confirm to send, or retry"
              : isSupported
                ? "Tap the mic to start"
                : "Not supported in this browser"}
        </p>
      </div>

      <WaveformBars isListening={isListening} hasTranscript={!!transcript} />

      <p
        id="voice-transcript"
        className="text-xs font-mono text-[var(--accent)] italic min-h-[2.5rem] px-2 select-text leading-relaxed w-full text-left"
      >
        {transcript || (error ? "" : "\u00a0")}
      </p>

      {error && <p className="text-xs text-red-400 font-sans -mt-2 px-2">{error}</p>}

      <VoiceActionButtons
        isListening={isListening}
        transcript={transcript}
        isSupported={isSupported}
        onCancel={onCancel}
        onStop={onStop}
        onConfirm={onConfirm}
        onStart={onStart}
      />
    </div>
  );
}

export function VoiceModal({ onTranscript }: VoiceModalProps) {
  const { voiceInputOpen, setVoiceInputOpen } = usePreferences();
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const {
    transcript,
    isListening,
    error,
    isSupported,
    setTranscript,
    setError,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  const handleConfirm = React.useCallback(() => {
    if (transcript.trim() && onTranscript) onTranscript(transcript.trim());
    setVoiceInputOpen(false);
    setTranscript("");
  }, [transcript, onTranscript, setVoiceInputOpen]);

  const handleClose = React.useCallback(() => {
    stopListening();
    setVoiceInputOpen(false);
    setTranscript("");
    setError(null);
  }, [stopListening, setVoiceInputOpen]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (voiceInputOpen) {
      dialog.showModal();
      setTranscript("");
      setError(null);
      setTimeout(startListening, 200);
    } else {
      stopListening();
      dialog.close();
    }
  }, [voiceInputOpen, startListening, stopListening]);

  return (
    <dialog
      ref={dialogRef}
      id="voice-modal"
      onClose={handleClose}
      className="fixed inset-0 z-[100] m-auto bg-transparent p-0 w-full max-w-[360px] border-none outline-none"
    >
      <VoiceDialogContent
        isListening={isListening}
        transcript={transcript}
        error={error}
        isSupported={isSupported}
        onCancel={handleClose}
        onConfirm={handleConfirm}
        onStop={stopListening}
        onStart={startListening}
      />
    </dialog>
  );
}
