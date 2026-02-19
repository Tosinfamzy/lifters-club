"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "./use-api";

/** Centralized query key factory for cache consistency. */
export const queryKeys = {
  dashboard: {
    trainingBlocks: (userId: string) => ["trainingBlocks", userId, "active"] as const,
    decisions: (userId: string) => ["decisions", userId, "recent"] as const,
    todaysWorkout: (userId: string) => ["todaysWorkout", userId] as const,
    recentWorkouts: (userId: string) => ["recentWorkouts", userId] as const,
    summary: (userId: string) => ["analyticsSummary", userId] as const,
  },
  analytics: {
    volume: (userId: string, weeks: number) => ["volumeAnalytics", userId, weeks] as const,
    summary: (userId: string) => ["analyticsSummary", userId] as const,
    logs: (userId: string) => ["workoutLogs", userId, "analytics"] as const,
    personalRecords: (userId: string) => ["personalRecords", userId] as const,
    exercises: () => ["exercises", "all"] as const,
  },
  history: {
    logs: (userId: string) => ["workoutLogs", userId, "history"] as const,
  },
  weeklySummary: (userId: string, weekOffset: number) =>
    ["weeklySummary", userId, weekOffset] as const,
};

// --- Dashboard hooks ---

export function useTrainingBlocks() {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.trainingBlocks(userId ?? ""),
    queryFn: async () => {
      const blocksResult = await api.getTrainingBlocks(userId!, "active");
      const blocks = blocksResult.data || [];
      if (blocks.length === 0) return { block: null, program: null, workouts: [] };

      const block = blocks[0] ?? null;
      if (!block) return { block: null, program: null, workouts: [] };

      const [blockDetails, workoutsResult] = await Promise.all([
        api.getTrainingBlock(block.id),
        api.getWorkouts({ trainingBlockId: block.id }),
      ]);

      return {
        block,
        program: blockDetails.data.program ?? null,
        workouts: workoutsResult.data || [],
      };
    },
    enabled: !!userId,
  });
}

export function useRecentDecisions(limit = 3) {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.decisions(userId ?? ""),
    queryFn: async () => {
      const result = await api.getDecisionHistory({ userId: userId!, limit });
      return result.data || [];
    },
    enabled: !!userId,
  });
}

export function useTodaysWorkout() {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.todaysWorkout(userId ?? ""),
    queryFn: async () => {
      const result = await api.getTodaysWorkout(userId!);
      return result.data || null;
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 min — more fresh for "today"
  });
}

export function useRecentWorkouts(limit = 5) {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.recentWorkouts(userId ?? ""),
    queryFn: async () => {
      const result = await api.getRecentWorkouts(userId!, limit);
      return result.data || [];
    },
    enabled: !!userId,
  });
}

export function useAnalyticsSummary() {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.dashboard.summary(userId ?? ""),
    queryFn: async () => {
      const result = await api.getAnalyticsSummary(userId!);
      return result.data || null;
    },
    enabled: !!userId,
  });
}

// --- Weekly Summary hook ---

export function useWeeklySummary(weekOffset: number) {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.weeklySummary(userId ?? "", weekOffset),
    queryFn: async () => {
      const result = await api.getWeeklySummary(userId!, weekOffset);
      return result.data;
    },
    enabled: !!userId,
  });
}

// --- Analytics hooks ---

export function useVolumeAnalytics(weeks = 12) {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.analytics.volume(userId ?? "", weeks),
    queryFn: async () => {
      const result = await api.getVolumeAnalytics(userId!, weeks);
      return result.data?.weeks || [];
    },
    enabled: !!userId,
  });
}

export function usePersonalRecords() {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.analytics.personalRecords(userId ?? ""),
    queryFn: async () => {
      const result = await api.getPersonalRecords(userId!);
      return result.data?.records || [];
    },
    enabled: !!userId,
  });
}

export function useWorkoutLogsForAnalytics(limit = 50) {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  return useQuery({
    queryKey: queryKeys.analytics.logs(userId ?? ""),
    queryFn: async () => {
      const result = await api.getWorkoutLogs({ userId: userId!, limit });
      return result.data || [];
    },
    enabled: !!userId,
  });
}

export function useExercisesList(limit = 50) {
  const api = useApi();

  return useQuery({
    queryKey: queryKeys.analytics.exercises(),
    queryFn: async () => {
      const result = await api.getExercises({ limit });
      return result.data || [];
    },
    staleTime: 30 * 60 * 1000, // 30 min — exercises rarely change
  });
}
