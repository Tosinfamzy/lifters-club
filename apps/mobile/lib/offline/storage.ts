import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ExercisePreference } from "../../types";
import type { ScoredSubstitute } from "../api";

// Storage keys
export const STORAGE_KEYS = {
  CACHED_WORKOUT: "lifters_club_cached_workout",
  CACHED_EXERCISES: "lifters_club_cached_exercises",
  OFFLINE_QUEUE: "lifters_club_offline_queue",
  LAST_SYNC: "lifters_club_last_sync",
  EXERCISE_PREFERENCES: "lifters_club_exercise_preferences",
  CACHED_SUBSTITUTES: "lifters_club_cached_substitutes",
} as const;

// Type-safe storage helpers (all async)
export const offlineStorage = {
  // Workout cache
  getCachedWorkout: async <T>(): Promise<T | null> => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_WORKOUT);
    return data ? JSON.parse(data) : null;
  },

  setCachedWorkout: async <T>(workout: T): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.CACHED_WORKOUT, JSON.stringify(workout));
  },

  clearCachedWorkout: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_WORKOUT);
  },

  // Exercise cache (for offline browsing)
  getCachedExercises: async <T>(): Promise<T | null> => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_EXERCISES);
    return data ? JSON.parse(data) : null;
  },

  setCachedExercises: async <T>(exercises: T): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.CACHED_EXERCISES, JSON.stringify(exercises));
  },

  // Last sync timestamp
  getLastSync: async (): Promise<Date | null> => {
    const timestamp = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestamp ? new Date(timestamp) : null;
  },

  setLastSync: async (date: Date = new Date()): Promise<void> => {
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, date.toISOString());
  },

  // Exercise preferences (for "Remember My Choice")
  getExercisePreferences: async (): Promise<Record<string, ExercisePreference>> => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.EXERCISE_PREFERENCES);
    return data ? JSON.parse(data) : {};
  },

  storeExercisePreference: async (pref: {
    originalId: string;
    substituteId: string;
    timestamp: string;
    reason?: string;
  }): Promise<void> => {
    const existing = await offlineStorage.getExercisePreferences();
    const updated = { ...existing, [pref.originalId]: pref };
    await AsyncStorage.setItem(STORAGE_KEYS.EXERCISE_PREFERENCES, JSON.stringify(updated));
  },

  // Cached substitutes (24h TTL)
  getCachedSubstitutes: async (exerciseId: string): Promise<ScoredSubstitute[] | null> => {
    const data = await AsyncStorage.getItem(`${STORAGE_KEYS.CACHED_SUBSTITUTES}_${exerciseId}`);
    if (!data) return null;

    const cache = JSON.parse(data);
    const age = Date.now() - new Date(cache.cachedAt).getTime();
    const TTL = 24 * 60 * 60 * 1000; // 24 hours

    return age < TTL ? cache.substitutes : null;
  },

  setCachedSubstitutes: async (exerciseId: string, substitutes: ScoredSubstitute[]): Promise<void> => {
    const cache = {
      substitutes,
      cachedAt: new Date().toISOString(),
      exerciseId,
    };
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.CACHED_SUBSTITUTES}_${exerciseId}`,
      JSON.stringify(cache)
    );
  },

  // Clear all offline data
  clearAll: async (): Promise<void> => {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.CACHED_WORKOUT,
      STORAGE_KEYS.CACHED_EXERCISES,
      STORAGE_KEYS.OFFLINE_QUEUE,
      STORAGE_KEYS.LAST_SYNC,
      STORAGE_KEYS.EXERCISE_PREFERENCES,
    ]);
  },
};
