"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useMemo } from "react";
import { api as baseApi } from "./api";

/**
 * Hook to get an authenticated API client
 * Sets the Clerk token on the API client before each request
 */
export function useApi() {
  const { getToken } = useAuth();

  // Create authenticated request wrapper
  const authenticatedRequest = useCallback(
    async <T>(requestFn: () => Promise<T>): Promise<T> => {
      const token = await getToken();
      baseApi.setToken(token);
      try {
        return await requestFn();
      } finally {
        // Clear token after request for security
        baseApi.setToken(null);
      }
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
      getPrograms: baseApi.getPrograms.bind(baseApi),
      getProgram: baseApi.getProgram.bind(baseApi),

      // Wrap protected endpoints with auth
      getDecisionHistory: (params: Parameters<typeof baseApi.getDecisionHistory>[0]) =>
        authenticatedRequest(() => baseApi.getDecisionHistory(params)),

      getDecision: (id: string) =>
        authenticatedRequest(() => baseApi.getDecision(id)),

      getTrainingBlocks: (userId: string, status?: string) =>
        authenticatedRequest(() => baseApi.getTrainingBlocks(userId, status)),

      getTrainingBlock: (id: string) =>
        authenticatedRequest(() => baseApi.getTrainingBlock(id)),

      getTodaysWorkout: (userId: string) =>
        authenticatedRequest(() => baseApi.getTodaysWorkout(userId)),

      getRecentWorkouts: (userId: string, limit?: number) =>
        authenticatedRequest(() => baseApi.getRecentWorkouts(userId, limit)),

      getWorkouts: (params: Parameters<typeof baseApi.getWorkouts>[0]) =>
        authenticatedRequest(() => baseApi.getWorkouts(params)),

      getWorkoutLogs: (params: Parameters<typeof baseApi.getWorkoutLogs>[0]) =>
        authenticatedRequest(() => baseApi.getWorkoutLogs(params)),

      getCurrentUser: (clerkId: string) =>
        authenticatedRequest(() => baseApi.getCurrentUser(clerkId)),

      createUser: (data: Parameters<typeof baseApi.createUser>[0]) =>
        baseApi.createUser(data), // Create user might need special handling

      // Program management (protected)
      createProgram: (data: Parameters<typeof baseApi.createProgram>[0]) =>
        authenticatedRequest(() => baseApi.createProgram(data)),

      deleteProgram: (id: string) =>
        authenticatedRequest(() => baseApi.deleteProgram(id)),

      updateProgram: (id: string, data: Parameters<typeof baseApi.updateProgram>[1]) =>
        authenticatedRequest(() => baseApi.updateProgram(id, data)),

      // Training blocks (protected)
      createTrainingBlock: (data: Parameters<typeof baseApi.createTrainingBlock>[0]) =>
        authenticatedRequest(() => baseApi.createTrainingBlock(data)),
    }),
    [authenticatedRequest]
  );

  return api;
}
