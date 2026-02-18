import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useApi } from "./use-api";
import type { ReadinessResult } from "../lib/api";

interface ReadinessInputs {
  sleepQuality: number;
  muscleSoreness: number;
  stressLevel: number;
  energyLevel: number;
}

export type { ReadinessResult, ReadinessInputs };

function getReadinessCacheKey(workoutId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `readiness_${workoutId}_${today}`;
}

export function useReadinessCheck(
  userId: string | undefined,
  workoutId: string
) {
  const api = useApi();
  const [showReadinessCheck, setShowReadinessCheck] = useState(false);
  const [isLoadingCache, setIsLoadingCache] = useState(true);
  const [readinessResult, setReadinessResult] =
    useState<ReadinessResult | null>(null);
  const [readinessInputs, setReadinessInputs] = useState<ReadinessInputs>({
    sleepQuality: 7,
    muscleSoreness: 3,
    stressLevel: 4,
    energyLevel: 7,
  });
  const [isSubmittingReadiness, setIsSubmittingReadiness] = useState(false);

  // Check for cached readiness result on mount
  useEffect(() => {
    const loadCached = async () => {
      try {
        const cached = await AsyncStorage.getItem(getReadinessCacheKey(workoutId));
        if (cached) {
          setReadinessResult(JSON.parse(cached));
          setShowReadinessCheck(false);
        } else {
          setShowReadinessCheck(true);
        }
      } catch {
        setShowReadinessCheck(true);
      } finally {
        setIsLoadingCache(false);
      }
    };
    loadCached();
  }, [workoutId]);

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
      // Cache the result so it persists across remounts
      await AsyncStorage.setItem(
        getReadinessCacheKey(workoutId),
        JSON.stringify(response.data)
      );
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
    showReadinessCheck: showReadinessCheck && !isLoadingCache,
    readinessResult,
    readinessInputs,
    isSubmittingReadiness,
    setReadinessInputs,
    submitReadinessCheck,
    skipReadiness,
  };
}
