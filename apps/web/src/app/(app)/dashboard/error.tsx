"use client";

import { useEffect } from "react";
import { ErrorCard } from "@/components/error-card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <ErrorCard
      title="Dashboard Error"
      description="Failed to load your dashboard. Please try refreshing the page."
      error={error}
      reset={reset}
    />
  );
}
