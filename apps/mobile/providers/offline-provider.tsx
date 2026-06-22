import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@clerk/clerk-expo";
import { offlineQueue, QueueItem, idMappingStore, MAX_RETRIES, backoffDelayMs } from "../lib/offline/queue";
import { offlineStorage } from "../lib/offline/storage";
import { fetchWithTimeout, FetchTimeoutError } from "../lib/fetch-with-timeout";
import { API_URL } from "../lib/constants";

const SYNC_LOCK_KEY = "@lifters/sync_lock";
const SYNC_LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minute stale lock detection

/**
 * Outcome of attempting one queued op, so the sync loop can react correctly:
 * - `success`   → done, remove from queue.
 * - `deferred`  → a dependency (e.g. the workout log) isn't ready yet; leave it
 *                 and retry next pass WITHOUT consuming retry budget.
 * - `transient` → network/timeout/5xx; back off and retry (dead-letter after MAX_RETRIES).
 * - `permanent` → 4xx or orphaned; dead-letter immediately (retrying won't help).
 */
type ProcessResult = "success" | "deferred" | "transient" | "permanent";

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  /** Ops that exhausted retries or hit a permanent error (surfaced, never dropped). */
  deadLetterCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
  /** Move dead-letter ops back to the live queue and flush (user "retry failed"). */
  retryDeadLetter: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [deadLetterCount, setDeadLetterCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Update pending + dead-letter counts
  const updatePendingCount = useCallback(async () => {
    setPendingCount(await offlineQueue.size());
    setDeadLetterCount(await offlineQueue.deadLetterSize());
  }, []);

  // Process a single queue item
  const processQueueItem = useCallback(
    async (item: QueueItem, token: string): Promise<ProcessResult> => {
      const { operation } = item;

      try {
        let endpoint: string;
        let method: string;
        let body: unknown;
        let offlineIdToMap: string | null = null;

        switch (operation.type) {
          case "CREATE_WORKOUT_LOG":
            endpoint = "/api/logs";
            method = "POST";
            body = {
              id: operation.data.id,
              workoutId: operation.data.workoutId,
              userId: operation.data.userId,
              startedAt: operation.data.startedAt,
            };
            // Track if this is an offline ID that needs mapping
            if (operation.data.id.startsWith("offline-")) {
              offlineIdToMap = operation.data.id;
            }
            break;

          case "UPDATE_WORKOUT_LOG": {
            // Resolve offline ID to server ID
            let resolvedLogId = await idMappingStore.getServerId(operation.data.id);

            // If still an offline ID, the workout log may not exist on server
            if (resolvedLogId.startsWith("offline-")) {
              console.log(`Unresolved offline logId for UPDATE: ${resolvedLogId}`);
              // Check if there's a pending CREATE_WORKOUT_LOG for this ID
              const queue = await offlineQueue.getQueue();
              const pendingLog = queue.find(
                (q) => q.operation.type === "CREATE_WORKOUT_LOG" && q.operation.data.id === resolvedLogId
              );

              if (pendingLog) {
                // The workout log hasn't been created yet — defer (no retry penalty).
                console.log("Workout log not yet created, deferring completion");
                return "deferred";
              }

              // Orphaned update — preserve it in the dead-letter store, don't drop.
              console.log("Orphaned workout log update, dead-lettering");
              return "permanent";
            }

            endpoint = `/api/logs/${resolvedLogId}/complete`;
            method = "PATCH";
            body = {
              completedAt: operation.data.completedAt,
              overallRpe: operation.data.overallRpe,
              notes: operation.data.notes,
            };
            break;
          }

          case "CREATE_LOGGED_SET": {
            // Resolve offline workoutLogId to server ID
            let resolvedWorkoutLogId = await idMappingStore.getServerId(operation.data.workoutLogId);

            // If still an offline ID, try to find the workout log on server
            if (resolvedWorkoutLogId.startsWith("offline-")) {
              console.log(`Unresolved offline workoutLogId: ${resolvedWorkoutLogId}, attempting to find on server`);
              // Check if there's a pending CREATE_WORKOUT_LOG for this ID
              const queue = await offlineQueue.getQueue();
              const pendingLog = queue.find(
                (q) => q.operation.type === "CREATE_WORKOUT_LOG" && q.operation.data.id === resolvedWorkoutLogId
              );

              if (pendingLog) {
                // The workout log hasn't been created yet — defer (no retry penalty).
                console.log("Workout log not yet created, deferring set creation");
                return "deferred";
              }

              // Orphaned set (its workout log is gone, not just pending). Preserve
              // it in the dead-letter store instead of silently dropping the data.
              console.log("Orphaned logged set, dead-lettering");
              return "permanent";
            }

            endpoint = `/api/logs/${resolvedWorkoutLogId}/sets`;
            method = "POST";
            body = {
              // The server requires the set id (createSetSchema) and uses it as
              // the PK — sending the stable client id makes replays idempotent.
              id: operation.data.id,
              exerciseId: operation.data.exerciseId,
              setNumber: operation.data.setNumber,
              weight: operation.data.weight,
              reps: operation.data.reps,
              rpe: operation.data.rpe,
              notes: operation.data.notes,
            };
            break;
          }

          case "UPDATE_LOGGED_SET": {
            // Resolve offline workoutLogId to server ID
            const resolvedWorkoutLogId = await idMappingStore.getServerId(operation.data.workoutLogId);

            // Dependency not resolved yet — defer (no retry penalty).
            if (resolvedWorkoutLogId.startsWith("offline-")) {
              console.log(`Unresolved offline workoutLogId for UPDATE_SET: ${resolvedWorkoutLogId}, deferring`);
              return "deferred";
            }

            endpoint = `/api/logs/${resolvedWorkoutLogId}/sets/${operation.data.id}`;
            method = "PATCH";
            body = {
              weight: operation.data.weight,
              reps: operation.data.reps,
              rpe: operation.data.rpe,
              notes: operation.data.notes,
            };
            break;
          }

          case "DELETE_LOGGED_SET": {
            // Resolve offline workoutLogId to server ID
            const resolvedWorkoutLogId = await idMappingStore.getServerId(operation.data.workoutLogId);

            // Dependency not resolved yet — defer (no retry penalty).
            if (resolvedWorkoutLogId.startsWith("offline-")) {
              console.log(`Unresolved offline workoutLogId for DELETE_SET: ${resolvedWorkoutLogId}, deferring`);
              return "deferred";
            }

            endpoint = `/api/logs/${resolvedWorkoutLogId}/sets/${operation.data.id}`;
            method = "DELETE";
            body = undefined;
            break;
          }

          case "RECORD_DECISION_OUTCOME":
            endpoint = `/api/decisions/${operation.data.decisionId}/outcome`;
            method = "POST";
            body = {
              outcome: operation.data.outcome,
              overrideReason: operation.data.overrideReason,
            };
            break;

          default:
            console.warn("Unknown operation type");
            return "permanent";
        }

        const response = await fetchWithTimeout(
          `${API_URL}${endpoint}`,
          {
            method,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: body ? JSON.stringify(body) : undefined,
          },
          30000 // 30 second timeout
        );

        if (!response.ok) {
          // 409 Conflict on CREATE_WORKOUT_LOG means the resource already exists
          // We need to fetch the existing log to get the server ID for mapping
          if (response.status === 409 && operation.type === "CREATE_WORKOUT_LOG") {
            console.log("Workout log already exists (409), fetching existing to get server ID");
            // Fetch the existing workout log by workoutId to get server ID
            const existingResponse = await fetchWithTimeout(
              `${API_URL}/api/logs?workoutId=${operation.data.workoutId}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              },
              30000
            );
            if (existingResponse.ok) {
              const json = await existingResponse.json();
              const existingLog = json.data?.[0] || json.data;
              if (existingLog?.id && offlineIdToMap) {
                await idMappingStore.addMapping(offlineIdToMap, existingLog.id);
                await idMappingStore.remapPendingOperations(offlineIdToMap, existingLog.id);
                console.log(`Mapped existing offline ID ${offlineIdToMap} to server ID ${existingLog.id}`);
              }
            }
            return "success";
          }
          // 409 Conflict on CREATE_LOGGED_SET - the set already exists
          if (response.status === 409 && operation.type === "CREATE_LOGGED_SET") {
            console.log("Logged set already exists (409), treating as success");
            return "success";
          }
          // Classify the failure: a 4xx is permanent (retrying won't fix a
          // validation/ownership error) → dead-letter; 5xx/other is transient → back off.
          console.error(`Sync op failed: HTTP ${response.status} for ${operation.type}`);
          return response.status >= 400 && response.status < 500 ? "permanent" : "transient";
        }

        // If CREATE_WORKOUT_LOG succeeded, capture the server ID and remap pending operations
        if (operation.type === "CREATE_WORKOUT_LOG" && offlineIdToMap) {
          const json = await response.json();
          const serverLog = json.data;
          if (serverLog?.id) {
            await idMappingStore.addMapping(offlineIdToMap, serverLog.id);
            await idMappingStore.remapPendingOperations(offlineIdToMap, serverLog.id);
            console.log(`Mapped offline ID ${offlineIdToMap} to server ID ${serverLog.id}`);
          }
        }

        return "success";
      } catch (error) {
        // Network failure or timeout — transient, back off and retry.
        if (error instanceof FetchTimeoutError) {
          console.error("Sync request timed out:", error.message);
        } else {
          console.error("Failed to process queue item:", error);
        }
        return "transient";
      }
    },
    []
  );

  // Sync lock helpers for Phase 6 - preventing race conditions
  const acquireSyncLock = async (): Promise<boolean> => {
    const existing = await AsyncStorage.getItem(SYNC_LOCK_KEY);
    if (existing) {
      const lockTime = parseInt(existing, 10);
      // Stale lock detection - release if older than 5 minutes
      if (Date.now() - lockTime < SYNC_LOCK_TIMEOUT_MS) {
        return false; // Lock is held by another sync
      }
    }
    await AsyncStorage.setItem(SYNC_LOCK_KEY, Date.now().toString());
    return true;
  };

  const releaseSyncLock = async () => {
    await AsyncStorage.removeItem(SYNC_LOCK_KEY);
  };

  // Sync all pending operations with lock to prevent race conditions
  const syncNow = useCallback(async () => {
    if (!isOnline) return;

    // Try to acquire sync lock to prevent duplicate syncs
    const acquired = await acquireSyncLock();
    if (!acquired) {
      console.log("Sync already in progress (lock held)");
      return;
    }

    const queue = await offlineQueue.getQueue();
    if (queue.length === 0) {
      await releaseSyncLock();
      return;
    }

    setIsSyncing(true);

    try {
      const token = await getToken();
      if (!token) {
        console.error("No auth token available for sync");
        return;
      }

      // Process queue items in order (FIFO preserves log → set dependencies).
      const now = Date.now();
      for (const item of queue) {
        // Respect backoff: skip items not yet due for a retry.
        if (item.nextRetryAt && new Date(item.nextRetryAt).getTime() > now) {
          continue;
        }

        const result = await processQueueItem(item, token);

        if (result === "success") {
          await offlineQueue.dequeue(item.id);
        } else if (result === "deferred") {
          // Dependency not ready — leave in place, no retry penalty, try next pass.
          continue;
        } else if (result === "permanent") {
          console.error("Permanent failure, dead-lettering item:", item.id);
          await offlineQueue.moveToDeadLetter(item.id);
        } else {
          // transient: back off, or dead-letter once retries are exhausted.
          if (item.retryCount + 1 >= MAX_RETRIES) {
            console.error("Max retries reached, dead-lettering item:", item.id);
            await offlineQueue.moveToDeadLetter(item.id);
          } else {
            await offlineQueue.scheduleRetry(item.id, backoffDelayMs(item.retryCount));
          }
        }
        await updatePendingCount();
      }

      await offlineStorage.setLastSync();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      await releaseSyncLock();
      setIsSyncing(false);
      updatePendingCount();
    }
  }, [isOnline, getToken, processQueueItem, updatePendingCount]);

  // User-initiated "retry failed": revive dead-letter ops and flush.
  const retryDeadLetter = useCallback(async () => {
    await offlineQueue.retryDeadLetter();
    await updatePendingCount();
    await syncNow();
  }, [updatePendingCount, syncNow]);

  // Monitor network state
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);

      // Auto-sync when coming back online
      if (online) {
        offlineQueue.hasItems().then((hasItems) => {
          if (hasItems) {
            syncNow();
          }
        });
      }
    });

    return () => unsubscribe();
  }, [syncNow]);

  // Initialize state
  useEffect(() => {
    const init = async () => {
      await updatePendingCount();
      const lastSync = await offlineStorage.getLastSync();
      setLastSyncTime(lastSync);
    };
    init();
  }, [updatePendingCount]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSyncing,
        pendingCount,
        deadLetterCount,
        lastSyncTime,
        syncNow,
        retryDeadLetter,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline(): OfflineContextType {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error("useOffline must be used within an OfflineProvider");
  }
  return context;
}
