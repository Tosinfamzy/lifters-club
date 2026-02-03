import AsyncStorage from "@react-native-async-storage/async-storage";
import { offlineStorage, STORAGE_KEYS } from "../storage";

describe("offlineStorage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Exercise Preferences", () => {
    it("stores exercise preference correctly", async () => {
      const preference = {
        originalId: "bench-press",
        substituteId: "incline-bench",
        timestamp: new Date().toISOString(),
        reason: "Same movement pattern",
      };

      await offlineStorage.storeExercisePreference(preference);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.EXERCISE_PREFERENCES,
        expect.stringContaining(preference.originalId)
      );
    });

    it("retrieves exercise preferences correctly", async () => {
      const mockPreferences = {
        "bench-press": {
          originalId: "bench-press",
          substituteId: "incline-bench",
          timestamp: "2024-01-01T00:00:00.000Z",
          reason: "Same movement pattern",
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockPreferences)
      );

      const result = await offlineStorage.getExercisePreferences();

      expect(result).toEqual(mockPreferences);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(
        STORAGE_KEYS.EXERCISE_PREFERENCES
      );
    });

    it("returns empty object when no preferences exist", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await offlineStorage.getExercisePreferences();

      expect(result).toEqual({});
    });

    it("updates existing preference for same exercise", async () => {
      const existingPreferences = {
        "bench-press": {
          originalId: "bench-press",
          substituteId: "old-substitute",
          timestamp: "2024-01-01T00:00:00.000Z",
        },
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(existingPreferences)
      );

      const newPreference = {
        originalId: "bench-press",
        substituteId: "new-substitute",
        timestamp: "2024-01-02T00:00:00.000Z",
        reason: "Better match",
      };

      await offlineStorage.storeExercisePreference(newPreference);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(setItemCall[1]);

      expect(storedData["bench-press"].substituteId).toBe("new-substitute");
      expect(storedData["bench-press"].reason).toBe("Better match");
    });
  });

  describe("Cached Substitutes", () => {
    it("caches substitutes with TTL", async () => {
      const substitutes = [
        {
          exercise: {
            id: "incline-bench",
            name: "Incline Bench Press",
            equipment: ["barbell"],
            difficulty: "intermediate" as const,
          },
          score: 94,
          matchReasons: ["Same pattern"],
        },
      ];

      await offlineStorage.setCachedSubstitutes("bench-press", substitutes);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        `${STORAGE_KEYS.CACHED_SUBSTITUTES}_bench-press`,
        expect.stringContaining("bench-press")
      );
    });

    it("retrieves cached substitutes within TTL", async () => {
      const cachedData = {
        substitutes: [{
          exercise: { id: "test", name: "Test Exercise", equipment: ["dumbbell"], difficulty: "beginner" as const },
          score: 85,
          matchReasons: ["Similar pattern"],
        }],
        cachedAt: new Date().toISOString(),
        exerciseId: "bench-press",
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(cachedData)
      );

      const result = await offlineStorage.getCachedSubstitutes("bench-press");

      expect(result).toEqual(cachedData.substitutes);
    });

    it("returns null for expired cache (> 24h)", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 2); // 2 days ago

      const expiredCache = {
        substitutes: [{
          exercise: { id: "test", name: "Test Exercise", equipment: ["dumbbell"], difficulty: "beginner" as const },
          score: 85,
          matchReasons: ["Similar pattern"],
        }],
        cachedAt: yesterday.toISOString(),
        exerciseId: "bench-press",
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(expiredCache)
      );

      const result = await offlineStorage.getCachedSubstitutes("bench-press");

      expect(result).toBeNull();
    });

    it("returns null when no cache exists", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await offlineStorage.getCachedSubstitutes("bench-press");

      expect(result).toBeNull();
    });

    it("includes timestamp and exerciseId in cached data", async () => {
      const substitutes = [{
        exercise: { id: "test", name: "Test Exercise", equipment: ["dumbbell"], difficulty: "beginner" as const },
        score: 85,
        matchReasons: ["Similar pattern"],
      }];

      await offlineStorage.setCachedSubstitutes("bench-press", substitutes);

      const setItemCall = (AsyncStorage.setItem as jest.Mock).mock.calls[0];
      const storedData = JSON.parse(setItemCall[1]);

      expect(storedData).toHaveProperty("cachedAt");
      expect(storedData).toHaveProperty("exerciseId", "bench-press");
      expect(storedData).toHaveProperty("substitutes", substitutes);
    });
  });

  describe("Cached Workout", () => {
    it("stores cached workout correctly", async () => {
      const workout = {
        id: "workout-1",
        name: "Push Day",
        exercises: [],
      };

      await offlineStorage.setCachedWorkout(workout);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CACHED_WORKOUT,
        JSON.stringify(workout)
      );
    });

    it("retrieves cached workout correctly", async () => {
      const mockWorkout = {
        id: "workout-1",
        name: "Push Day",
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockWorkout)
      );

      const result = await offlineStorage.getCachedWorkout();

      expect(result).toEqual(mockWorkout);
    });

    it("clears cached workout", async () => {
      await offlineStorage.clearCachedWorkout();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        STORAGE_KEYS.CACHED_WORKOUT
      );
    });
  });

  describe("Last Sync", () => {
    it("stores last sync timestamp", async () => {
      const testDate = new Date("2024-01-01T12:00:00.000Z");

      await offlineStorage.setLastSync(testDate);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEYS.LAST_SYNC,
        testDate.toISOString()
      );
    });

    it("retrieves last sync timestamp as Date", async () => {
      const testDate = "2024-01-01T12:00:00.000Z";

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(testDate);

      const result = await offlineStorage.getLastSync();

      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe(testDate);
    });

    it("returns null when no last sync exists", async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const result = await offlineStorage.getLastSync();

      expect(result).toBeNull();
    });
  });

  describe("Clear All", () => {
    it("removes all storage keys", async () => {
      await offlineStorage.clearAll();

      expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
        STORAGE_KEYS.CACHED_WORKOUT,
        STORAGE_KEYS.CACHED_EXERCISES,
        STORAGE_KEYS.OFFLINE_QUEUE,
        STORAGE_KEYS.LAST_SYNC,
        STORAGE_KEYS.EXERCISE_PREFERENCES,
      ]);
    });
  });
});
