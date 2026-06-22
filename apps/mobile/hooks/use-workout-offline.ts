import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/clerk-expo";
import { offlineStorage } from "../lib/offline/storage";
import {
  offlineQueue,
  createWorkoutLogOperation,
  createLoggedSetOperation,
  updateWorkoutLogOperation,
  QueuedLoggedSet,
  QueuedWorkoutLog,
} from "../lib/offline/queue";
import { useOffline } from "../providers/offline-provider";
import { api } from "../lib/api";
import type { Workout, WorkoutLog, LoggedSet } from "../lib/api";

interface CachedWorkoutData {
  workout: Workout;
  workoutLog?: WorkoutLog;
  loggedSets: LoggedSet[];
  cachedAt: string;
}

// Generate unique ID
const generateId = (): string => {
  return `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Hook for managing workout data with offline support.
 * Caches workout data locally and queues mutations when offline.
 */
export function useWorkoutOffline(workoutId: string) {
  const { getToken } = useAuth();
  const { isOnline } = useOffline();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutLog, setWorkoutLog] = useState<WorkoutLog | null>(null);
  const [loggedSets, setLoggedSets] = useState<LoggedSet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use refs to avoid recreating callbacks on every render
  const getTokenRef = useRef(getToken);
  const isOnlineRef = useRef(isOnline);
  const hasLoadedRef = useRef(false);
  getTokenRef.current = getToken;
  isOnlineRef.current = isOnline;

  // Fetch workout data from API and cache it
  const fetchAndCache = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      if (!token) return;

      const response = await api.withToken(token).getWorkout(workoutId);
      const workoutData = response.data;

      const cachedData: CachedWorkoutData = {
        workout: workoutData,
        workoutLog: undefined, // Workout log is created when starting the workout
        loggedSets: [],
        cachedAt: new Date().toISOString(),
      };

      await offlineStorage.setCachedWorkout(cachedData);

      setWorkout(workoutData);
      setWorkoutLog(null);
      setLoggedSets([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch workout");
    }
  }, [workoutId]); // Uses refs for getToken

  // Load from cache or fetch
  const loadWorkout = useCallback(async () => {
    if (hasLoadedRef.current) return; // Prevent re-loading
    hasLoadedRef.current = true;

    setIsLoading(true);

    // Try cache first
    const cached = await offlineStorage.getCachedWorkout<CachedWorkoutData>();
    if (cached?.workout?.id === workoutId) {
      setWorkout(cached.workout);
      setWorkoutLog(cached.workoutLog || null);
      setLoggedSets(cached.loggedSets || []);
    }

    // If online, fetch fresh data
    if (isOnlineRef.current) {
      await fetchAndCache();
    } else if (!cached?.workout?.id || cached.workout.id !== workoutId) {
      setError("No cached data available offline");
    }

    setIsLoading(false);
  }, [workoutId, fetchAndCache]); // Uses refs for isOnline

  // Start workout (create workout log)
  const startWorkout = useCallback(
    async (userId: string): Promise<WorkoutLog | null> => {
      // Guard: don't create a new log if one already exists for this workout
      if (workoutLog) {
        console.log("Workout log already exists, returning existing:", workoutLog.id);
        return workoutLog;
      }

      const newLog: QueuedWorkoutLog = {
        id: generateId(),
        workoutId,
        userId,
        startedAt: new Date().toISOString(),
      };

      // Optimistic update
      const optimisticLog: WorkoutLog = {
        ...newLog,
        createdAt: newLog.startedAt,
        updatedAt: newLog.startedAt,
      };
      setWorkoutLog(optimisticLog);

      // Update cache
      const cached = await offlineStorage.getCachedWorkout<CachedWorkoutData>();
      if (cached) {
        await offlineStorage.setCachedWorkout({
          ...cached,
          workoutLog: optimisticLog,
        });
      }

      if (isOnlineRef.current) {
        try {
          const token = await getTokenRef.current();
          const response = await api.withToken(token).createWorkoutLog({
            id: newLog.id,
            workoutId,
            userId,
            startedAt: newLog.startedAt,
          });

          const serverLog = response.data;
          setWorkoutLog(serverLog);

          // Update cache with server ID
          const latestCached = await offlineStorage.getCachedWorkout<CachedWorkoutData>();
          if (latestCached) {
            await offlineStorage.setCachedWorkout({
              ...latestCached,
              workoutLog: serverLog,
            });
          }

          return serverLog;
        } catch {
          // Falls through to offline queue
        }
      }

      // Queue for later sync
      await offlineQueue.enqueue(createWorkoutLogOperation(newLog));
      return optimisticLog;
    },
    [workoutId, workoutLog] // Uses refs for isOnline/getToken
  );

  // Log a set
  const logSet = useCallback(
    async (
      exerciseId: string,
      setNumber: number,
      weight: number,
      reps: number,
      rpe?: number,
      notes?: string
    ): Promise<LoggedSet | null> => {
      if (!workoutLog) {
        setError("Start workout first");
        return null;
      }

      const newSet: QueuedLoggedSet = {
        id: generateId(),
        workoutLogId: workoutLog.id,
        exerciseId,
        setNumber,
        weight,
        reps,
        rpe,
        notes,
        createdAt: new Date().toISOString(),
      };

      // Optimistic update
      const optimisticSet: LoggedSet = {
        ...newSet,
        rpe: newSet.rpe ?? null,
        notes: newSet.notes ?? null,
      };
      setLoggedSets((prev) => [...prev, optimisticSet]);

      // Update cache
      const cached = await offlineStorage.getCachedWorkout<CachedWorkoutData>();
      if (cached) {
        await offlineStorage.setCachedWorkout({
          ...cached,
          loggedSets: [...cached.loggedSets, optimisticSet],
        });
      }

      if (isOnlineRef.current && !workoutLog.id.startsWith("offline-")) {
        try {
          const token = await getTokenRef.current();
          const response = await api.withToken(token).createLoggedSet(
            workoutLog.id,
            { id: newSet.id, exerciseId, setNumber, weight, reps, rpe, notes }
          );

          const serverSet = response.data;

          // Replace optimistic set with server response
          setLoggedSets((prev) =>
            prev.map((s) => (s.id === optimisticSet.id ? serverSet : s))
          );

          return serverSet;
        } catch {
          // Falls through to offline queue
        }
      }

      // Queue for later sync
      await offlineQueue.enqueue(createLoggedSetOperation(newSet));
      return optimisticSet;
    },
    [workoutLog] // Uses refs for isOnline/getToken
  );

  // Complete workout
  const completeWorkout = useCallback(
    async (overallRpe?: number, notes?: string): Promise<void> => {
      if (!workoutLog) return;

      const completedAt = new Date().toISOString();

      // Optimistic update
      setWorkoutLog((prev) =>
        prev ? { ...prev, completedAt, overallRpe, notes } : null
      );

      // Update cache
      const cached = await offlineStorage.getCachedWorkout<CachedWorkoutData>();
      if (cached && cached.workoutLog) {
        await offlineStorage.setCachedWorkout({
          ...cached,
          workoutLog: { ...cached.workoutLog, completedAt, overallRpe, notes },
        });
      }

      if (isOnlineRef.current && !workoutLog.id.startsWith("offline-")) {
        try {
          const token = await getTokenRef.current();
          await api.withToken(token).completeWorkoutLog(workoutLog.id, {
            completedAt,
            overallRpe,
            notes,
          });
          return;
        } catch {
          // Falls through to offline queue
        }
      }

      // Queue for later sync
      await offlineQueue.enqueue(
        updateWorkoutLogOperation({
          id: workoutLog.id,
          completedAt,
          overallRpe,
          notes,
        })
      );
    },
    [workoutLog] // Uses refs for isOnline/getToken
  );

  // Get logged sets for a specific exercise
  const getSetsForExercise = useCallback(
    (exerciseId: string): LoggedSet[] => {
      return loggedSets.filter((set) => set.exerciseId === exerciseId);
    },
    [loggedSets]
  );

  // Load on mount only
  useEffect(() => {
    loadWorkout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]); // Only reload when workoutId changes, not on callback recreation

  return {
    workout,
    workoutLog,
    loggedSets,
    isLoading,
    error,
    isOnline,
    startWorkout,
    logSet,
    completeWorkout,
    getSetsForExercise,
    refresh: loadWorkout,
  };
}
