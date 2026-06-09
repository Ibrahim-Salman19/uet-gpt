"use client";

import { ErrorView } from "@/components/shared/error-view";

export default function ThreadError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      label="Thread error"
      heading="Something went wrong in this Thread"
      message="Failed to load thread messages. Please try again."
      error={error}
      reset={reset}
    />
  );
}
