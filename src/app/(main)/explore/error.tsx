"use client";

import { ErrorView } from "@/components/shared/error-view";

export default function ExploreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      label="Explore error"
      heading="Something went wrong in Explore"
      message="Failed to load explore content. Please try again."
      error={error}
      reset={reset}
    />
  );
}
