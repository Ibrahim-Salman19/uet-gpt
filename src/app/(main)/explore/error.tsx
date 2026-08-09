"use client";

import { ErrorView } from "@/components/shared/error-view";

interface ExploreErrorProps {
  error: Error & {
    digest?: string;
  };
  reset: () => void;
}

export default function ExploreError({ error, reset }: Readonly<ExploreErrorProps>) {
  return (
    <ErrorView
      label="Explore unavailable"
      heading="We couldn’t load the document library"
      message="A temporary problem prevented Explore from loading. Try again to reload the documents."
      error={error}
      reset={reset}
    />
  );
}
