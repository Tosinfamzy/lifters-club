import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useAuth } from "@clerk/clerk-expo";
import { offlineQueue, QueueItem } from "../lib/offline/queue";
import { offlineStorage } from "../lib/offline/storage";

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: Date | null;
  syncNow: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | null>(null);

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

export function OfflineProvider({ children }: { children: ReactNode }) {
  const { getToken } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    const count = await offlineQueue.size();
    setPendingCount(count);
  }, []);

  // Process a single queue item
  const processQueueItem = useCallback(
    async (item: QueueItem, token: string): Promise<boolean> => {
      const { operation } = item;

      try {
        let endpoint: string;
        let method: string;
        let body: unknown;

        switch (operation.type) {
          case "CREATE_WORKOUT_LOG":
            endpoint = "/api/workout-logs";
            method = "POST";
            body = {
              workoutId: operation.data.workoutId,
              startedAt: operation.data.startedAt,
            };
            break;

          case "UPDATE_WORKOUT_LOG":
            endpoint = `/api/workout-logs/${operation.data.id}`;
            method = "PATCH";
            body = {
              completedAt: operation.data.completedAt,
              overallRpe: operation.data.overallRpe,
              notes: operation.data.notes,
            };
            break;

          case "CREATE_LOGGED_SET":
            endpoint = `/api/workout-logs/${operation.data.workoutLogId}/sets`;
            method = "POST";
            body = {
              exerciseId: operation.data.exerciseId,
              setNumber: operation.data.setNumber,
              weight: operation.data.weight,
              reps: operation.data.reps,
              rpe: operation.data.rpe,
              notes: operation.data.notes,
            };
            break;

          case "UPDATE_LOGGED_SET":
            endpoint = `/api/logged-sets/${operation.data.id}`;
            method = "PATCH";
            body = operation.data;
            break;

          case "DELETE_LOGGED_SET":
            endpoint = `/api/logged-sets/${operation.data.id}`;
            method = "DELETE";
            body = undefined;
            break;

          default:
            console.warn("Unknown operation type");
            return false;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return true;
      } catch (error) {
        console.error("Failed to process queue item:", error);
        return false;
      }
    },
    []
  );

  // Sync all pending operations
  const syncNow = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    const queue = await offlineQueue.getQueue();
    if (queue.length === 0) return;

    setIsSyncing(true);

    try {
      const token = await getToken();
      if (!token) {
        console.error("No auth token available for sync");
        return;
      }

      // Process queue items in order
      for (const item of queue) {
        const success = await processQueueItem(item, token);
        if (success) {
          await offlineQueue.dequeue(item.id);
          await updatePendingCount();
        } else {
          // Mark as retried, skip if too many retries
          if (item.retryCount >= 3) {
            console.error("Max retries reached, removing item:", item.id);
            await offlineQueue.dequeue(item.id);
          } else {
            await offlineQueue.markRetried(item.id);
          }
        }
      }

      await offlineStorage.setLastSync();
      setLastSyncTime(new Date());
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
      updatePendingCount();
    }
  }, [isOnline, isSyncing, getToken, processQueueItem, updatePendingCount]);

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
        lastSyncTime,
        syncNow,
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
