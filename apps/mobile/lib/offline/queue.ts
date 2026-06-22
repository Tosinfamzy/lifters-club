import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storage";

// Storage key for ID mappings
const ID_MAPPING_KEY = "@lifters/offline_id_mappings";

// Types for queued operations
export interface QueuedLoggedSet {
  id: string;
  workoutLogId: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number;
  notes?: string;
  createdAt: string;
}

export interface QueuedWorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
}

export interface QueuedDecisionOutcome {
  decisionId: string;
  outcome: "followed" | "overridden";
  overrideReason?: string;
}

export type QueuedOperation =
  | { type: "CREATE_WORKOUT_LOG"; data: QueuedWorkoutLog }
  | { type: "UPDATE_WORKOUT_LOG"; data: Partial<QueuedWorkoutLog> & { id: string } }
  | { type: "CREATE_LOGGED_SET"; data: QueuedLoggedSet }
  | { type: "UPDATE_LOGGED_SET"; data: Partial<QueuedLoggedSet> & { id: string; workoutLogId: string } }
  | { type: "DELETE_LOGGED_SET"; data: { id: string; workoutLogId: string } }
  | { type: "RECORD_DECISION_OUTCOME"; data: QueuedDecisionOutcome };

export interface QueueItem {
  id: string;
  operation: QueuedOperation;
  timestamp: string;
  retryCount: number;
  /** ISO timestamp before which the item should be skipped (exponential backoff). */
  nextRetryAt?: string;
}

/** After this many transient failures an item is moved to the dead-letter store. */
export const MAX_RETRIES = 6;

const BACKOFF_BASE_MS = 2_000;
const BACKOFF_CAP_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Exponential backoff with jitter for a given (zero-based) retry count:
 * `min(cap, base · 2^n) + random(0..1000)ms`. The jitter avoids a thundering
 * herd of queued ops all retrying on the same tick after a reconnect.
 */
export const backoffDelayMs = (retryCount: number): number => {
  const exp = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** retryCount);
  return exp + Math.floor(Math.random() * 1000);
};

// Generate unique ID for queue items
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Offline queue management (all async)
export const offlineQueue = {
  // Get all queued operations
  getQueue: async (): Promise<QueueItem[]> => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
    return data ? JSON.parse(data) : [];
  },

  // Add operation to queue (with deduplication for CREATE operations)
  enqueue: async (operation: QueuedOperation): Promise<QueueItem> => {
    const queue = await offlineQueue.getQueue();

    // Deduplicate CREATE operations - don't queue if same resource already pending
    if (operation.type === "CREATE_WORKOUT_LOG") {
      const existing = queue.find(
        (item) =>
          item.operation.type === "CREATE_WORKOUT_LOG" &&
          item.operation.data.id === operation.data.id
      );
      if (existing) {
        console.log("Skipping duplicate CREATE_WORKOUT_LOG for:", operation.data.id);
        return existing;
      }
    }

    if (operation.type === "CREATE_LOGGED_SET") {
      const existing = queue.find(
        (item) =>
          item.operation.type === "CREATE_LOGGED_SET" &&
          item.operation.data.id === operation.data.id
      );
      if (existing) {
        console.log("Skipping duplicate CREATE_LOGGED_SET for:", operation.data.id);
        return existing;
      }
    }

    const item: QueueItem = {
      id: generateId(),
      operation,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };
    queue.push(item);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
    return item;
  },

  // Remove operation from queue (after successful sync)
  dequeue: async (id: string): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const filtered = queue.filter((item) => item.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(filtered));
  },

  // Mark operation as retried
  markRetried: async (id: string): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const updated = queue.map((item) =>
      item.id === id ? { ...item, retryCount: item.retryCount + 1 } : item
    );
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updated));
  },

  // Bump retryCount and defer the next attempt by `delayMs` (exponential backoff).
  scheduleRetry: async (id: string, delayMs: number): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    const updated = queue.map((item) =>
      item.id === id
        ? { ...item, retryCount: item.retryCount + 1, nextRetryAt }
        : item
    );
    await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(updated));
  },

  // ── Dead-letter store ──────────────────────────────────────────────────
  // Permanently-failing or retry-exhausted ops are moved here (not dropped) so
  // the data survives and can be surfaced/retried by the user.

  getDeadLetter: async (): Promise<QueueItem[]> => {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DEAD_LETTER);
    return data ? JSON.parse(data) : [];
  },

  deadLetterSize: async (): Promise<number> => {
    return (await offlineQueue.getDeadLetter()).length;
  },

  // Move one queued op to the dead-letter store.
  moveToDeadLetter: async (id: string): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    const item = queue.find((q) => q.id === id);
    if (!item) return;
    const dead = await offlineQueue.getDeadLetter();
    dead.push(item);
    await AsyncStorage.setItem(STORAGE_KEYS.DEAD_LETTER, JSON.stringify(dead));
    await offlineQueue.dequeue(id);
  },

  // Move every dead-letter op back to the live queue (reset attempts) for a
  // user-initiated "retry failed".
  retryDeadLetter: async (): Promise<void> => {
    const dead = await offlineQueue.getDeadLetter();
    if (dead.length === 0) return;
    const queue = await offlineQueue.getQueue();
    const revived = dead.map((item) => ({ ...item, retryCount: 0, nextRetryAt: undefined }));
    await AsyncStorage.setItem(
      STORAGE_KEYS.OFFLINE_QUEUE,
      JSON.stringify([...queue, ...revived])
    );
    await AsyncStorage.removeItem(STORAGE_KEYS.DEAD_LETTER);
  },

  // Get queue size
  size: async (): Promise<number> => {
    const queue = await offlineQueue.getQueue();
    return queue.length;
  },

  // Clear entire queue
  clear: async (): Promise<void> => {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
  },

  // Check if queue has items
  hasItems: async (): Promise<boolean> => {
    const size = await offlineQueue.size();
    return size > 0;
  },
};

// Helper to create a workout log operation
export const createWorkoutLogOperation = (data: QueuedWorkoutLog): QueuedOperation => ({
  type: "CREATE_WORKOUT_LOG",
  data,
});

// Helper to create a logged set operation
export const createLoggedSetOperation = (data: QueuedLoggedSet): QueuedOperation => ({
  type: "CREATE_LOGGED_SET",
  data,
});

// Helper to update a workout log operation
export const updateWorkoutLogOperation = (
  data: Partial<QueuedWorkoutLog> & { id: string }
): QueuedOperation => ({
  type: "UPDATE_WORKOUT_LOG",
  data,
});

// Helper to create a decision outcome operation
export const createDecisionOutcomeOperation = (
  data: QueuedDecisionOutcome
): QueuedOperation => ({
  type: "RECORD_DECISION_OUTCOME",
  data,
});

// ID Mapping: Maps offline IDs to server IDs after successful sync
export interface IdMapping {
  [offlineId: string]: string;
}

export const idMappingStore = {
  // Get all ID mappings
  getMappings: async (): Promise<IdMapping> => {
    const data = await AsyncStorage.getItem(ID_MAPPING_KEY);
    return data ? JSON.parse(data) : {};
  },

  // Add a mapping from offline ID to server ID
  addMapping: async (offlineId: string, serverId: string): Promise<void> => {
    const mappings = await idMappingStore.getMappings();
    mappings[offlineId] = serverId;
    await AsyncStorage.setItem(ID_MAPPING_KEY, JSON.stringify(mappings));
  },

  // Get server ID for an offline ID (returns offlineId if no mapping exists)
  getServerId: async (offlineId: string): Promise<string> => {
    const mappings = await idMappingStore.getMappings();
    return mappings[offlineId] || offlineId;
  },

  // Clear all mappings (after successful full sync)
  clear: async (): Promise<void> => {
    await AsyncStorage.removeItem(ID_MAPPING_KEY);
  },

  // Remap all pending operations that reference an offline ID
  remapPendingOperations: async (offlineId: string, serverId: string): Promise<void> => {
    const queue = await offlineQueue.getQueue();
    let updated = false;

    const remappedQueue = queue.map((item) => {
      const { operation } = item;

      // Remap CREATE_LOGGED_SET operations
      if (operation.type === "CREATE_LOGGED_SET" && operation.data.workoutLogId === offlineId) {
        updated = true;
        return {
          ...item,
          operation: {
            ...operation,
            data: { ...operation.data, workoutLogId: serverId },
          },
        };
      }

      // Remap UPDATE_LOGGED_SET operations
      if (operation.type === "UPDATE_LOGGED_SET" && operation.data.workoutLogId === offlineId) {
        updated = true;
        return {
          ...item,
          operation: {
            ...operation,
            data: { ...operation.data, workoutLogId: serverId },
          },
        };
      }

      // Remap DELETE_LOGGED_SET operations
      if (operation.type === "DELETE_LOGGED_SET" && operation.data.workoutLogId === offlineId) {
        updated = true;
        return {
          ...item,
          operation: {
            ...operation,
            data: { ...operation.data, workoutLogId: serverId },
          },
        };
      }

      // Remap UPDATE_WORKOUT_LOG operations
      if (operation.type === "UPDATE_WORKOUT_LOG" && operation.data.id === offlineId) {
        updated = true;
        return {
          ...item,
          operation: {
            ...operation,
            data: { ...operation.data, id: serverId },
          },
        };
      }

      return item;
    });

    if (updated) {
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(remappedQueue));
      console.log(`Remapped ${queue.length - remappedQueue.filter((i) => i === queue.find((q) => q.id === i.id)).length} operations from ${offlineId} to ${serverId}`);
    }
  },
};
