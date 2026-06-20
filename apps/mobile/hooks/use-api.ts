import { useAuth } from "@clerk/clerk-expo";
import { useCallback, useMemo } from "react";
import { api as baseApi } from "../lib/api";

/**
 * Hook to get an authenticated API client for mobile.
 * Creates a scoped client per-request to avoid token race conditions.
 */
export function useApi() {
  const { getToken } = useAuth();

  const authenticatedRequest = useCallback(
    async <T>(requestFn: (client: typeof baseApi) => Promise<T>): Promise<T> => {
      const token = await getToken();
      const client = baseApi.withToken(token);
      return requestFn(client);
    },
    [getToken]
  );

  const api = useMemo(
    () => ({
      // Public endpoints (no auth needed)
      getExercises: baseApi.getExercises.bind(baseApi),
      getExercise: baseApi.getExercise.bind(baseApi),
      getExerciseSubstitutes: baseApi.getExerciseSubstitutes.bind(baseApi),
      getPrograms: baseApi.getPrograms.bind(baseApi),
      getProgram: baseApi.getProgram.bind(baseApi),

      // Workouts (protected)
      getTodaysWorkout: () =>
        authenticatedRequest((c) => c.getTodaysWorkout()),
      getWorkout: (workoutId: string) =>
        authenticatedRequest((c) => c.getWorkout(workoutId)),

      // Workout logs (protected)
      getWorkoutLogs: (params?: Parameters<typeof baseApi.getWorkoutLogs>[0]) =>
        authenticatedRequest((c) => c.getWorkoutLogs(params)),
      getWorkoutLog: (logId: string) =>
        authenticatedRequest((c) => c.getWorkoutLog(logId)),
      createWorkoutLog: (data: Parameters<typeof baseApi.createWorkoutLog>[0]) =>
        authenticatedRequest((c) => c.createWorkoutLog(data)),
      completeWorkoutLog: (
        logId: string,
        data: Parameters<typeof baseApi.completeWorkoutLog>[1]
      ) => authenticatedRequest((c) => c.completeWorkoutLog(logId, data)),

      // Sets (protected)
      createLoggedSet: (
        logId: string,
        data: Parameters<typeof baseApi.createLoggedSet>[1]
      ) => authenticatedRequest((c) => c.createLoggedSet(logId, data)),
      updateLoggedSet: (
        logId: string,
        setId: string,
        data: Parameters<typeof baseApi.updateLoggedSet>[2]
      ) => authenticatedRequest((c) => c.updateLoggedSet(logId, setId, data)),
      deleteLoggedSet: (logId: string, setId: string) =>
        authenticatedRequest((c) => c.deleteLoggedSet(logId, setId)),

      // Users (protected)
      getCurrentUser: () =>
        authenticatedRequest((c) => c.getCurrentUser()),
      createUser: (data: Parameters<typeof baseApi.createUser>[0]) =>
        authenticatedRequest((c) => c.createUser(data)),
      updateUser: (
        userId: string,
        data: Parameters<typeof baseApi.updateUser>[1]
      ) => authenticatedRequest((c) => c.updateUser(userId, data)),

      // Onboarding / Calibration (protected)
      getCalibrationPlan: (userId: string, equipment: string[], goal?: string) =>
        authenticatedRequest((c) => c.getCalibrationPlan(userId, equipment, goal)),
      saveUserBaselines: (
        userId: string,
        baselines: Parameters<typeof baseApi.saveUserBaselines>[1]
      ) => authenticatedRequest((c) => c.saveUserBaselines(userId, baselines)),
      submitCalibrationResults: (
        userId: string,
        sets: Parameters<typeof baseApi.submitCalibrationResults>[1],
        targetReps?: number
      ) => authenticatedRequest((c) => c.submitCalibrationResults(userId, sets, targetReps)),
      updateOnboardingStatus: (
        userId: string,
        data: Parameters<typeof baseApi.updateOnboardingStatus>[1]
      ) => authenticatedRequest((c) => c.updateOnboardingStatus(userId, data)),

      // Readiness (protected)
      submitReadiness: (data: Parameters<typeof baseApi.submitReadiness>[0]) =>
        authenticatedRequest((c) => c.submitReadiness(data)),

      // Decisions (protected)
      getDecisionHistory: (
        params: Parameters<typeof baseApi.getDecisionHistory>[0]
      ) => authenticatedRequest((c) => c.getDecisionHistory(params)),
      recordDecisionOutcome: (
        decisionId: string,
        data: Parameters<typeof baseApi.recordDecisionOutcome>[1]
      ) =>
        authenticatedRequest((c) =>
          c.recordDecisionOutcome(decisionId, data)
        ),
      getLoadProgression: (
        data: Parameters<typeof baseApi.getLoadProgression>[0]
      ) => authenticatedRequest((c) => c.getLoadProgression(data)),
      getWithinSessionAdjustment: (
        data: Parameters<typeof baseApi.getWithinSessionAdjustment>[0]
      ) => authenticatedRequest((c) => c.getWithinSessionAdjustment(data)),

      // Workouts (protected)
      getWorkouts: (params: Parameters<typeof baseApi.getWorkouts>[0]) =>
        authenticatedRequest((c) => c.getWorkouts(params)),
      updateWorkout: (id: string, data: Parameters<typeof baseApi.updateWorkout>[1]) =>
        authenticatedRequest((c) => c.updateWorkout(id, data)),
      generateWeek: (
        trainingBlockId: string,
        options?: Parameters<typeof baseApi.generateWeek>[1]
      ) => authenticatedRequest((c) => c.generateWeek(trainingBlockId, options)),

      // Training blocks (protected)
      pauseTrainingBlock: (blockId: string) =>
        authenticatedRequest((c) => c.pauseTrainingBlock(blockId)),
      createTrainingBlock: (
        data: Parameters<typeof baseApi.createTrainingBlock>[0]
      ) => authenticatedRequest((c) => c.createTrainingBlock(data)),

      // Standalone workouts (protected)
      generateStandaloneWorkout: (
        data: Parameters<typeof baseApi.generateStandaloneWorkout>[0]
      ) => authenticatedRequest((c) => c.generateStandaloneWorkout(data)),
      getStandaloneWorkout: (id: string) =>
        authenticatedRequest((c) => c.getStandaloneWorkout(id)),
      startStandaloneWorkout: (id: string) =>
        authenticatedRequest((c) => c.startStandaloneWorkout(id)),
      completeStandaloneWorkout: (id: string) =>
        authenticatedRequest((c) => c.completeStandaloneWorkout(id)),

      // Analytics (protected)
      getAnalyticsSummary: () =>
        authenticatedRequest((c) => c.getAnalyticsSummary()),
      getVolumeAnalytics: (weeks?: number) =>
        authenticatedRequest((c) => c.getVolumeAnalytics(weeks)),
      getExerciseProgress: (
        exerciseId: string,
        userId: string,
        limit?: number
      ) =>
        authenticatedRequest((c) =>
          c.getExerciseProgress(exerciseId, userId, limit)
        ),
    }),
    [authenticatedRequest]
  );

  return api;
}
