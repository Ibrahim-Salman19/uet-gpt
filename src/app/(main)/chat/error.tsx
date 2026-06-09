"use client";

import { ErrorView } from "@/components/shared/error-view";

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      label="ChatLayout error"
      heading="Something went wrong in Chat"
      message="An unexpected error occurred in your chat session. Please try again."
      error={error}
      reset={reset}
    />
  );
}
