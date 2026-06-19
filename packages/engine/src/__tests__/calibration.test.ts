import { describe, it, expect } from "vitest";
import {
  processCalibrationResults,
  getCalibrationPath,
  shouldRunCalibration,
} from "../calibration";
import { estimateOneRepMax } from "../estimation";
import type { CalibrationSetInput } from "../calibration";

describe("processCalibrationResults", () => {
  it("derives one baseline per exercise from logged sets", () => {
    const sets: CalibrationSetInput[] = [
      { exerciseId: "barbell-bench-press", weight: 100, reps: 8 },
      { exerciseId: "barbell-back-squat", weight: 140, reps: 8 },
    ];

    const results = processCalibrationResults(sets);

    expect(results).toHaveLength(2);
    expect(results.map((r) => r.exerciseId).sort()).toEqual([
      "barbell-back-squat",
      "barbell-bench-press",
    ]);
  });

  it("picks the heaviest set when multiple sets hit the target reps", () => {
    const sets: CalibrationSetInput[] = [
      { exerciseId: "barbell-bench-press", weight: 100, reps: 8 },
      { exerciseId: "barbell-bench-press", weight: 110, reps: 8 },
      { exerciseId: "barbell-bench-press", weight: 105, reps: 8 },
    ];

    const [result] = processCalibrationResults(sets);

    expect(result!.baselineWeight).toBe(110);
    expect(result!.baselineReps).toBe(8);
  });

  it("prefers a set near the target reps over a heavier far-off set", () => {
    // Heavy single is further from the 8-rep target than the lighter set
    const sets: CalibrationSetInput[] = [
      { exerciseId: "barbell-back-squat", weight: 180, reps: 2 },
      { exerciseId: "barbell-back-squat", weight: 140, reps: 8 },
    ];

    const [result] = processCalibrationResults(sets);

    expect(result!.baselineWeight).toBe(140);
    expect(result!.baselineReps).toBe(8);
  });

  it("estimates a 1RM from the chosen set", () => {
    const sets: CalibrationSetInput[] = [
      { exerciseId: "barbell-bench-press", weight: 100, reps: 8 },
    ];

    const [result] = processCalibrationResults(sets);

    expect(result!.estimatedE1RM).toBe(estimateOneRepMax(100, 8));
    expect(result!.estimatedE1RM).toBeGreaterThan(100);
  });

  it("respects a custom target rep count", () => {
    const sets: CalibrationSetInput[] = [
      { exerciseId: "barbell-bench-press", weight: 90, reps: 5 },
      { exerciseId: "barbell-bench-press", weight: 120, reps: 8 },
    ];

    // With a target of 5, the 5-rep set should win over the far-off 8-rep set
    const [result] = processCalibrationResults(sets, 5);

    expect(result!.baselineReps).toBe(5);
    expect(result!.baselineWeight).toBe(90);
  });

  it("returns an empty array for no sets", () => {
    expect(processCalibrationResults([])).toEqual([]);
  });
});

describe("getCalibrationPath", () => {
  it("prefers barbell when available", () => {
    expect(getCalibrationPath(["dumbbell", "barbell"])).toBe("barbell");
  });

  it("falls back to dumbbell without a barbell", () => {
    expect(getCalibrationPath(["dumbbell", "machines"])).toBe("dumbbell");
  });

  it("returns bodyweight for an empty equipment list", () => {
    expect(getCalibrationPath([])).toBe("bodyweight");
  });

  it("skips calibration for non-barbell/dumbbell equipment", () => {
    expect(getCalibrationPath(["machines", "cables"])).toBe("skip");
  });
});

describe("shouldRunCalibration", () => {
  it("is true when free weights are available", () => {
    expect(shouldRunCalibration(["barbell"])).toBe(true);
    expect(shouldRunCalibration(["dumbbell"])).toBe(true);
  });

  it("is false for bodyweight-only or machine-only setups", () => {
    expect(shouldRunCalibration([])).toBe(false);
    expect(shouldRunCalibration(["machines", "cables"])).toBe(false);
  });
});
