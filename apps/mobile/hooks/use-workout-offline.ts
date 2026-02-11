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

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

// Types
export interface Exercise {
  id: string;
  name: string;
  equipment: string[];
  primaryMuscles: string[];
}

export interface PlannedExercise {
  exerciseId: string;
  exercise?: Exercise;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
}

export interface Workout {
  id: string;
  trainingBlockId: string;
  scheduledDate: string;
  weekNumber: number;
  dayNumber: number;
  plannedExercises: PlannedExercise[];
  status: "scheduled" | "in_progress" | "completed" | "skipped";
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
}

export interface LoggedSet {
  id: string;
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
}

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

      const response = await fetch(`${API_URL}/api/workouts/${workoutId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch workout");

      const json = await response.json();
      // API returns { data: workout } - the workout is directly in data
      const workoutData = json.data;

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
          const response = await fetch(`${API_URL}/api/logs`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              id: newLog.id,
              workoutId,
              userId,
              startedAt: newLog.startedAt,
            }),
          });

          if (response.ok) {
            const json = await response.json();
            const serverLog = json.data;
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
          }
        } catch {
          // Fall through to queue
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
      const optimisticSet: LoggedSet = { ...newSet };
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
          const response = await fetch(
            `${API_URL}/api/logs/${workoutLog.id}/sets`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                exerciseId,
                setNumber,
                weight,
                reps,
                rpe,
                notes,
              }),
            }
          );

          if (response.ok) {
            const json = await response.json();
            const serverSet = json.data;

            // Replace optimistic set with server response
            setLoggedSets((prev) =>
              prev.map((s) => (s.id === optimisticSet.id ? serverSet : s))
            );

            return serverSet;
          }
        } catch {
          // Fall through to queue
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
          await fetch(`${API_URL}/api/logs/${workoutLog.id}/complete`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ completedAt, overallRpe, notes }),
          });
          return;
        } catch {
          // Fall through to queue
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
