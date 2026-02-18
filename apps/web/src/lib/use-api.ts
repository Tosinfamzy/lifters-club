"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useMemo } from "react";
import { api as baseApi } from "./api";

/**
 * Hook to get an authenticated API client.
 * Creates a scoped client per-request to avoid token race conditions.
 */
export function useApi() {
  const { getToken } = useAuth();

  // Create a scoped API client with a fresh token — no shared mutable state
  const authenticatedRequest = useCallback(
    async <T>(requestFn: (client: typeof baseApi) => Promise<T>): Promise<T> => {
      const token = await getToken();
      const client = baseApi.withToken(token);
      return requestFn(client);
    },
    [getToken]
  );

  // Wrap all API methods that need auth
  const api = useMemo(
    () => ({
      // Pass through public endpoints
      getExercises: baseApi.getExercises.bind(baseApi),
      getExercise: baseApi.getExercise.bind(baseApi),
      searchExercises: baseApi.searchExercises.bind(baseApi),
      getExerciseSubstitutes: baseApi.getExerciseSubstitutes.bind(baseApi),
      getPrograms: baseApi.getPrograms.bind(baseApi),
      getProgram: baseApi.getProgram.bind(baseApi),

      // Wrap protected endpoints with auth
      getDecisionHistory: (params: Parameters<typeof baseApi.getDecisionHistory>[0]) =>
        authenticatedRequest((client) => client.getDecisionHistory(params)),

      getDecision: (id: string) =>
        authenticatedRequest((client) => client.getDecision(id)),

      recordDecisionOutcome: (
        decisionId: string,
        data: Parameters<typeof baseApi.recordDecisionOutcome>[1]
      ) => authenticatedRequest((client) => client.recordDecisionOutcome(decisionId, data)),

      getTrainingBlocks: (userId: string, status?: string) =>
        authenticatedRequest((client) => client.getTrainingBlocks(userId, status)),

      getTrainingBlock: (id: string) =>
        authenticatedRequest((client) => client.getTrainingBlock(id)),

      getTodaysWorkout: (userId: string) =>
        authenticatedRequest((client) => client.getTodaysWorkout(userId)),

      getRecentWorkouts: (userId: string, limit?: number) =>
        authenticatedRequest((client) => client.getRecentWorkouts(userId, limit)),

      getWorkouts: (params: Parameters<typeof baseApi.getWorkouts>[0]) =>
        authenticatedRequest((client) => client.getWorkouts(params)),

      updateWorkout: (id: string, data: Parameters<typeof baseApi.updateWorkout>[1]) =>
        authenticatedRequest((client) => client.updateWorkout(id, data)),

      getWorkoutLogs: (params: Parameters<typeof baseApi.getWorkoutLogs>[0]) =>
        authenticatedRequest((client) => client.getWorkoutLogs(params)),

      getCurrentUser: (clerkId: string) =>
        authenticatedRequest((client) => client.getCurrentUser(clerkId)),

      createUser: (data: Parameters<typeof baseApi.createUser>[0]) =>
        authenticatedRequest((client) => client.createUser(data)),

      // Program management (protected)
      createProgram: (data: Parameters<typeof baseApi.createProgram>[0]) =>
        authenticatedRequest((client) => client.createProgram(data)),

      deleteProgram: (id: string) =>
        authenticatedRequest((client) => client.deleteProgram(id)),

      updateProgram: (id: string, data: Parameters<typeof baseApi.updateProgram>[1]) =>
        authenticatedRequest((client) => client.updateProgram(id, data)),

      // Training blocks (protected)
      createTrainingBlock: (data: Parameters<typeof baseApi.createTrainingBlock>[0]) =>
        authenticatedRequest((client) => client.createTrainingBlock(data)),

      generateWeek: (
        trainingBlockId: string,
        options?: Parameters<typeof baseApi.generateWeek>[1]
      ) => authenticatedRequest((client) => client.generateWeek(trainingBlockId, options)),

      // User baselines (protected)
      getUserBaselines: (userId: string) =>
        authenticatedRequest((client) => client.getUserBaselines(userId)),

      saveUserBaselines: (
        userId: string,
        baselines: Parameters<typeof baseApi.saveUserBaselines>[1]
      ) => authenticatedRequest((client) => client.saveUserBaselines(userId, baselines)),

      getCalibrationPlan: (userId: string, equipment: string[]) =>
        authenticatedRequest((client) => client.getCalibrationPlan(userId, equipment)),

      updateOnboardingStatus: (
        userId: string,
        data: Parameters<typeof baseApi.updateOnboardingStatus>[1]
      ) => authenticatedRequest((client) => client.updateOnboardingStatus(userId, data)),

      // User management (protected)
      updateUser: (userId: string, data: Parameters<typeof baseApi.updateUser>[1]) =>
        authenticatedRequest((client) => client.updateUser(userId, data)),

      // Workout logs (protected)
      getWorkoutLog: (logId: string) =>
        authenticatedRequest((client) => client.getWorkoutLog(logId)),

      logRetrospectiveWorkout: (data: Parameters<typeof baseApi.logRetrospectiveWorkout>[0]) =>
        authenticatedRequest((client) => client.logRetrospectiveWorkout(data)),

      // Set management (protected)
      updateSet: (logId: string, setId: string, data: Parameters<typeof baseApi.updateSet>[2]) =>
        authenticatedRequest((client) => client.updateSet(logId, setId, data)),

      deleteSet: (logId: string, setId: string) =>
        authenticatedRequest((client) => client.deleteSet(logId, setId)),

      // Analytics (protected)
      getAnalyticsSummary: (userId: string) =>
        authenticatedRequest((client) => client.getAnalyticsSummary(userId)),

      getVolumeAnalytics: (userId: string, weeks?: number) =>
        authenticatedRequest((client) => client.getVolumeAnalytics(userId, weeks)),

      getPersonalRecords: (userId: string) =>
        authenticatedRequest((client) => client.getPersonalRecords(userId)),

      getExerciseProgress: (exerciseId: string, userId: string, limit?: number) =>
        authenticatedRequest((client) => client.getExerciseProgress(exerciseId, userId, limit)),

      getWeeklySummary: (userId: string, weekOffset?: number) =>
        authenticatedRequest((client) => client.getWeeklySummary(userId, weekOffset)),
    }),
    [authenticatedRequest]
  );

  return api;
}
