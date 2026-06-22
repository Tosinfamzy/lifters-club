import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  offlineQueue,
  backoffDelayMs,
  MAX_RETRIES,
  createLoggedSetOperation,
  type QueuedLoggedSet,
} from "../queue";
import { STORAGE_KEYS } from "../storage";

function aSet(id: string): QueuedLoggedSet {
  return {
    id,
    workoutLogId: "wlog-1",
    exerciseId: "barbell-bench-press",
    setNumber: 1,
    weight: 100,
    reps: 8,
    createdAt: new Date().toISOString(),
  };
}

describe("offline queue — retry + dead-letter", () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    await AsyncStorage.removeItem(STORAGE_KEYS.DEAD_LETTER);
  });

  describe("backoffDelayMs", () => {
    it("grows exponentially from a 2s base, plus <1s jitter", () => {
      expect(backoffDelayMs(0)).toBeGreaterThanOrEqual(2000);
      expect(backoffDelayMs(0)).toBeLessThan(3000);
      expect(backoffDelayMs(1)).toBeGreaterThanOrEqual(4000);
      expect(backoffDelayMs(1)).toBeLessThan(5000);
      expect(backoffDelayMs(2)).toBeGreaterThanOrEqual(8000);
      expect(backoffDelayMs(2)).toBeLessThan(9000);
    });

    it("caps the exponential term at 5 minutes", () => {
      const d = backoffDelayMs(20); // 2s * 2^20 would be huge
      expect(d).toBeGreaterThanOrEqual(5 * 60 * 1000);
      expect(d).toBeLessThan(5 * 60 * 1000 + 1000);
    });
  });

  describe("scheduleRetry", () => {
    it("increments retryCount and sets a future nextRetryAt", async () => {
      const item = await offlineQueue.enqueue(createLoggedSetOperation(aSet("set-1")));
      await offlineQueue.scheduleRetry(item.id, 5000);

      const [updated] = await offlineQueue.getQueue();
      expect(updated.retryCount).toBe(1);
      expect(updated.nextRetryAt).toBeDefined();
      expect(new Date(updated.nextRetryAt!).getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe("dead-letter store", () => {
    it("moves an item out of the queue into the dead-letter store", async () => {
      const item = await offlineQueue.enqueue(createLoggedSetOperation(aSet("set-2")));
      await offlineQueue.moveToDeadLetter(item.id);

      expect(await offlineQueue.size()).toBe(0);
      expect(await offlineQueue.deadLetterSize()).toBe(1);
      const [dead] = await offlineQueue.getDeadLetter();
      expect(dead.operation.type).toBe("CREATE_LOGGED_SET");
    });

    it("retryDeadLetter revives ops back to the queue with reset attempts", async () => {
      const item = await offlineQueue.enqueue(createLoggedSetOperation(aSet("set-3")));
      await offlineQueue.scheduleRetry(item.id, 5000);
      await offlineQueue.moveToDeadLetter(item.id);
      expect(await offlineQueue.deadLetterSize()).toBe(1);

      await offlineQueue.retryDeadLetter();

      expect(await offlineQueue.deadLetterSize()).toBe(0);
      const [revived] = await offlineQueue.getQueue();
      expect(revived.retryCount).toBe(0);
      expect(revived.nextRetryAt).toBeUndefined();
    });
  });

  it("exposes a sane MAX_RETRIES", () => {
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(3);
  });
});
