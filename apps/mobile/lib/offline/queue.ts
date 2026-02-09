import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "./storage";

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
  | { type: "UPDATE_LOGGED_SET"; data: Partial<QueuedLoggedSet> & { id: string } }
  | { type: "DELETE_LOGGED_SET"; data: { id: string } }
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

  // Add operation to queue
  enqueue: async (operation: QueuedOperation): Promise<QueueItem> => {
    const queue = await offlineQueue.getQueue();
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
