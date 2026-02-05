"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function ProgramsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Programs error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Programs Error"
      description="Failed to load training programs. Please try again."
      error={error}
      reset={reset}
    />
  );
}
