"use client";

import { ErrorView } from "@/components/shared/error-view";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorView
      label="MainLayout error"
      heading="Something went wrong"
      message="An unexpected error occurred. Please try again."
      error={error}
      reset={reset}
    />
  );
}
