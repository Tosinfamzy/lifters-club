"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function ExercisesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Exercises error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Exercise Library Error"
      description="Failed to load the exercise library. Please try again."
      error={error}
      reset={reset}
    />
  );
}
