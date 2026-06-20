import { describe, it, expect } from "vitest";
import {
  calculateWithinSessionAdjustment,
  defaultWithinSessionConfig,
  type WithinSessionInput,
} from "../within-session";

function createInput(overrides: Partial<WithinSessionInput> = {}): WithinSessionInput {
  return {
    completedSet: { weight: 100, reps: 8, rpe: 8 },
    targetRepRange: [8, 10],
    plannedWeight: 100,
    remainingSets: 2,
    ...overrides,
  };
}

describe("calculateWithinSessionAdjustment", () => {
  describe("increase scenarios", () => {
    it("increases when RPE is 2+ below target and reps hit the top of the range", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 10, rpe: 6 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("increase");
      expect(result.nextSetWeight).toBe(105); // 100 >= threshold → +5
    });

    it("uses the small increment below the large-increment threshold", () => {
      const input = createInput({
        completedSet: { weight: 40, reps: 10, rpe: 6 },
        plannedWeight: 40,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("increase");
      expect(result.nextSetWeight).toBe(42.5); // 40 < 50 → +2.5
    });

    it("does NOT increase on low RPE when reps fell short of the top of the range", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 8, rpe: 6 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("maintain");
      expect(result.nextSetWeight).toBe(100);
    });
  });

  describe("maintain / hold scenarios", () => {
    it("maintains when RPE is on target", () => {
      const result = calculateWithinSessionAdjustment(createInput());
      expect(result.action).toBe("maintain");
      expect(result.nextSetWeight).toBe(100);
    });

    it("holds (maintains) when reps hit the top but RPE is one notch above target", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 10, rpe: 9 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("maintain");
      expect(result.nextSetWeight).toBe(100);
      expect(result.reason).toMatch(/hold/i);
    });
  });

  describe("decrease scenarios", () => {
    it("decreases when RPE is at/above the reduce gap (grinding)", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 8, rpe: 10 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("decrease");
      expect(result.nextSetWeight).toBe(95);
    });

    it("decreases when reps fall below the minimum, regardless of RPE", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 6, rpe: 8 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("decrease");
      expect(result.nextSetWeight).toBe(95);
    });

    it("never prescribes a negative next-set weight", () => {
      const input = createInput({
        completedSet: { weight: 2, reps: 4, rpe: 10 },
        plannedWeight: 2,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("decrease");
      expect(result.nextSetWeight).toBe(0);
    });
  });

  describe("no-RPE fallback", () => {
    it("maintains when reps are in range and no RPE is reported", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 9 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("maintain");
      expect(result.reason).toMatch(/no RPE/i);
    });

    it("does NOT increase without an RPE even when reps exceed the top of the range", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 12 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("maintain");
    });

    it("decreases when reps fall below the minimum with no RPE", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 5 } });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("decrease");
      expect(result.nextSetWeight).toBe(95);
    });
  });

  describe("newBaselineIfConfirmed", () => {
    it("flags a new baseline when the set cleared the planned weight at RPE <= 8", () => {
      const input = createInput({
        completedSet: { weight: 110, reps: 9, rpe: 8 },
        plannedWeight: 100,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.newBaselineIfConfirmed).toEqual({ weight: 110, reps: 9 });
    });

    it("does NOT flag a baseline when the over-plan set was at RPE 9+", () => {
      const input = createInput({
        completedSet: { weight: 110, reps: 9, rpe: 9 },
        plannedWeight: 100,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.newBaselineIfConfirmed).toBeUndefined();
    });

    it("does NOT flag a baseline at or below the planned weight", () => {
      const input = createInput({
        completedSet: { weight: 100, reps: 10, rpe: 7 },
        plannedWeight: 100,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.newBaselineIfConfirmed).toBeUndefined();
    });

    it("does NOT flag a baseline when reps fell below the minimum even if over plan", () => {
      const input = createInput({
        completedSet: { weight: 110, reps: 5, rpe: 7 },
        plannedWeight: 100,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.newBaselineIfConfirmed).toBeUndefined();
      expect(result.action).toBe("decrease"); // below min reps still drives the action
    });

    it("surfaces the baseline even on the last set (remainingSets === 0)", () => {
      const input = createInput({
        completedSet: { weight: 110, reps: 9, rpe: 7 },
        plannedWeight: 100,
        remainingSets: 0,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.newBaselineIfConfirmed).toEqual({ weight: 110, reps: 9 });
      expect(result.reason).toMatch(/last set/i);
    });
  });

  describe("config + targetRpe override", () => {
    it("respects a per-exercise targetRpe override", () => {
      // target 6: an RPE-6 set is now "on target", not an increase trigger.
      const input = createInput({
        completedSet: { weight: 100, reps: 10, rpe: 6 },
        targetRpe: 6,
      });
      const result = calculateWithinSessionAdjustment(input);
      expect(result.action).toBe("maintain");
    });

    it("respects a custom config (wider reduce gap)", () => {
      const input = createInput({ completedSet: { weight: 100, reps: 8, rpe: 10 } });
      const result = calculateWithinSessionAdjustment(input, {
        ...defaultWithinSessionConfig,
        reduceRpeGap: 3, // RPE 10 is only +2 over target 8 → no longer a decrease
      });
      expect(result.action).toBe("maintain");
    });
  });
});
