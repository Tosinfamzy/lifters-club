"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function HistoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("History error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="History Error"
      description="Failed to load your workout history. Please try again."
      error={error}
      reset={reset}
    />
  );
}
