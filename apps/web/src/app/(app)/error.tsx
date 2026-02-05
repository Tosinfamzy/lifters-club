"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Page Error"
      description="There was a problem loading this page. Please try again."
      error={error}
      reset={reset}
    />
  );
}
