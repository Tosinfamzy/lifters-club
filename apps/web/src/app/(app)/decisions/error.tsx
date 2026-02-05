"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function DecisionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Decisions error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Decisions Error"
      description="Failed to load training decisions. Please try again."
      error={error}
      reset={reset}
    />
  );
}
