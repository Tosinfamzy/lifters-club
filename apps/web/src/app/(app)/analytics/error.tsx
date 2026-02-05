"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Analytics error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Analytics Error"
      description="Failed to load your training analytics. Please try again."
      error={error}
      reset={reset}
    />
  );
}
