"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console in development
    console.error("Root error boundary caught:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <ErrorCard
        title="Something went wrong"
        description="An unexpected error occurred. Our team has been notified."
        error={error}
        reset={reset}
      />
    </div>
  );
}
