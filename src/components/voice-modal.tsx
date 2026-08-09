"use client";

import { CheckCircle, Mic, MicOff, RotateCcw } from "lucide-react";
import * as React from "react";
import { usePreferences } from "@/components/preferences-provider";

interface VoiceModalProps {
  onTranscript?: (text: string) => void;
}

const MAX_LISTENING_MS = 60_000;

interface SpeechRecognitionAlternativeLike {
  readonly transcript: string;
}

interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  readonly error: string;
  readonly message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as SpeechRecognitionWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function speechErrorMessage(error: string): string {
  switch (error) {
    case "no-speech":
      return "No speech was detected. Check your microphone and try again.";
    case "audio-capture":
      return "No working microphone was found.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone or speech-recognition permission was denied.";
    case "network":
      return "Speech recognition could not reach its recognition service.";
    case "language-not-supported":
      return "Your current browser language is not supported for speech recognition.";
    case "aborted":
      return "Listening was cancelled.";
    default:
      return "Speech recognition stopped unexpectedly. Please try again.";
  }
}

function useSpeechRecognition() {
  const [transcript, setTranscript] = React.useState("");
  const [isListening, setIsListening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSupported, setIsSupported] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = React.useRef("");
  const manuallyStoppingRef = React.useRef(false);
  const autoStopTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoStopTimer = React.useCallback(() => {
    if (autoStopTimerRef.current !== null) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const abortListening = React.useCallback(() => {
    clearAutoStopTimer();
    manuallyStoppingRef.current = true;
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already stopped.
      }
    }
    setIsListening(false);
  }, [clearAutoStopTimer]);

  const startListening = React.useCallback(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      setIsSupported(false);
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    abortListening();
    manuallyStoppingRef.current = false;
    finalTranscriptRef.current = "";
    setTranscript("");
    setError(null);

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => {
      if (recognitionRef.current !== recognition) return;
      setIsListening(true);
      clearAutoStopTimer();
      autoStopTimerRef.current = setTimeout(() => {
        if (recognitionRef.current !== recognition) return;
        manuallyStoppingRef.current = true;
        try {
          recognition.stop();
        } catch {
          abortListening();
        }
      }, MAX_LISTENING_MS);
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const alternative = result?.[0];
        if (!alternative) continue;

        if (result.isFinal) {
          finalTranscriptRef.current =
            `${finalTranscriptRef.current} ${alternative.transcript}`.trim();
        } else {
          interim += alternative.transcript;
        }
      }

      setTranscript(`${finalTranscriptRef.current} ${interim}`.trim());
    };

    recognition.onerror = (event) => {
      clearAutoStopTimer();
      if (event.error !== "aborted" || !manuallyStoppingRef.current) {
        setError(speechErrorMessage(event.error));
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      clearAutoStopTimer();
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (startError) {
      recognitionRef.current = null;
      setIsListening(false);
      setError(
        startError instanceof DOMException && startError.name === "InvalidStateError"
          ? "The microphone is already starting. Please wait a moment."
          : "Speech recognition could not be started.",
      );
    }
  }, [abortListening, clearAutoStopTimer]);

  const stopListening = React.useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setIsListening(false);
      return;
    }
    manuallyStoppingRef.current = true;
    try {
      recognition.stop();
    } catch {
      abortListening();
    }
  }, [abortListening]);

  const reset = React.useCallback(() => {
    abortListening();
    finalTranscriptRef.current = "";
    setTranscript("");
    setError(null);
  }, [abortListening]);

  React.useEffect(() => abortListening, [abortListening]);

  return {
    transcript,
    isListening,
    error,
    isSupported,
    startListening,
    stopListening,
    abortListening,
    reset,
  };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(true);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

const WAVEFORM_HEIGHTS = [30, 70, 50, 90, 40, 60, 80, 35, 65] as const;

function WaveformBars({
  listening,
  hasTranscript,
}: {
  listening: boolean;
  hasTranscript: boolean;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="flex h-12 items-end justify-center gap-1.5" aria-hidden="true">
      {WAVEFORM_HEIGHTS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className="w-1 rounded-full transition-[height,background-color] duration-300 motion-reduce:transition-none"
          style={{
            height: listening ? `${height}%` : "20%",
            backgroundColor: listening
              ? "var(--accent)"
              : hasTranscript
                ? "var(--semantic-success, #34d399)"
                : "rgb(63 63 70)",
            animation:
              listening && !reducedMotion
                ? `pulse ${0.65 + index * 0.06}s ease-in-out ${index * 0.04}s infinite alternate`
                : "none",
          }}
        />
      ))}
    </div>
  );
}

export function VoiceModal({ onTranscript }: VoiceModalProps) {
  const { voiceInputOpen, setVoiceInputOpen } = usePreferences();
  const dialogRef = React.useRef<HTMLDialogElement | null>(null);
  const titleId = React.useId();
  const statusId = React.useId();
  const speech = useSpeechRecognition();

  const close = React.useCallback(() => {
    speech.reset();
    setVoiceInputOpen(false);
  }, [speech.reset, setVoiceInputOpen]);

  const confirm = React.useCallback(() => {
    const value = speech.transcript.trim();
    if (!value || !onTranscript) return;
    try {
      onTranscript(value);
      close();
    } catch (error) {
      console.error("Voice transcript callback failed", error);
    }
  }, [speech.transcript, onTranscript, close]);

  React.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (voiceInputOpen && !dialog.open) {
      speech.reset();
      try {
        dialog.showModal();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Voice dialog could not be opened", error);
        }
        setVoiceInputOpen(false);
      }
    } else if (!voiceInputOpen && dialog.open) {
      speech.abortListening();
      dialog.close();
    }
  }, [voiceInputOpen, speech.reset, speech.abortListening, setVoiceInputOpen]);

  const status = speech.isListening
    ? "Listening. Speak clearly, then choose Stop."
    : speech.transcript
      ? "Review the transcript, then confirm or retry."
      : speech.isSupported
        ? "Choose Start when you are ready."
        : "Speech recognition is unavailable in this browser.";

  return (
    <dialog
      ref={dialogRef}
      id="voice-modal"
      aria-labelledby={titleId}
      aria-describedby={statusId}
      onCancel={close}
      onClose={() => setVoiceInputOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      className="fixed inset-0 z-[100] m-auto w-[calc(100%_-_2rem)] max-w-[380px] border-none bg-transparent p-0 outline-none backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 rounded-[1.5rem] border border-[var(--surface-4)] bg-[var(--surface-3)] p-6 text-center shadow-[0_32px_64px_-12px_rgba(0,0,0,0.9)]">
        <div>
          <h2 id={titleId} className="text-sm font-semibold tracking-wide text-zinc-100">
            Voice input
          </h2>
          <p id={statusId} role="status" aria-live="polite" className="mt-1 text-xs text-zinc-500">
            {status}
          </p>
        </div>

        <WaveformBars listening={speech.isListening} hasTranscript={Boolean(speech.transcript)} />

        <div className="w-full rounded-lg border border-white/5 bg-zinc-950/45 p-3 text-left">
          <p className="min-h-12 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-[var(--accent)]">
            {speech.transcript || "Your transcript will appear here."}
          </p>
        </div>

        {speech.error ? (
          <p role="alert" className="text-xs leading-relaxed text-red-400">
            {speech.error}
          </p>
        ) : null}

        <p className="text-[10px] leading-relaxed text-zinc-600">
          Depending on the browser, speech may be processed by the browser vendor’s online
          recognition service. Listening stops automatically after one minute.
        </p>

        <div className="grid w-full grid-cols-2 gap-3">
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-white/5 py-2.5 text-xs font-semibold text-zinc-400 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
          >
            Cancel
          </button>

          {speech.isListening ? (
            <button
              type="button"
              onClick={speech.stopListening}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/20 py-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
              Stop
            </button>
          ) : speech.transcript ? (
            <button
              type="button"
              onClick={confirm}
              disabled={!onTranscript}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/20 py-2.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={speech.startListening}
              disabled={!speech.isSupported}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/20 py-2.5 text-xs font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              Start
            </button>
          )}
        </div>

        {!speech.isListening && (speech.transcript || speech.error) ? (
          <button
            type="button"
            onClick={speech.startListening}
            className="flex items-center gap-1.5 text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Clear and try again
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
