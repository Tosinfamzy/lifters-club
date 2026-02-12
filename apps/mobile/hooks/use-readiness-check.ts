import { useState } from "react";
import { useApi } from "./use-api";
import type { ReadinessResult } from "../lib/api";

interface ReadinessInputs {
  sleepQuality: number;
  muscleSoreness: number;
  stressLevel: number;
  energyLevel: number;
}

export type { ReadinessResult, ReadinessInputs };

export function useReadinessCheck(
  userId: string | undefined,
  workoutId: string
) {
  const api = useApi();
  const [showReadinessCheck, setShowReadinessCheck] = useState(true);
  const [readinessResult, setReadinessResult] =
    useState<ReadinessResult | null>(null);
  const [readinessInputs, setReadinessInputs] = useState<ReadinessInputs>({
    sleepQuality: 7,
    muscleSoreness: 3,
    stressLevel: 4,
    energyLevel: 7,
  });
  const [isSubmittingReadiness, setIsSubmittingReadiness] = useState(false);

  const submitReadinessCheck = async () => {
    if (!userId) return;

    setIsSubmittingReadiness(true);

    try {
      const response = await api.submitReadiness({
        userId,
        workoutId,
        ...readinessInputs,
      });
      setReadinessResult(response.data);
    } catch (error) {
      console.error("Readiness check failed:", error);
      // Continue without readiness data when offline
      setShowReadinessCheck(false);
    } finally {
      setIsSubmittingReadiness(false);
    }
  };

  const skipReadiness = () => {
    setShowReadinessCheck(false);
  };

  return {
    showReadinessCheck,
    readinessResult,
    readinessInputs,
    isSubmittingReadiness,
    setReadinessInputs,
    submitReadinessCheck,
    skipReadiness,
  };
}
