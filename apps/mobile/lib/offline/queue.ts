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
}

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
