"use client";

import { ErrorView } from "@/components/shared/error-view";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      label="Settings error"
      heading="Something went wrong in Settings"
      message="Failed to load settings. Please try again."
      error={error}
      reset={reset}
    />
  );
}
