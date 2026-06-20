import { buildWithinSessionInput } from "../within-session";
import type { ExerciseProgress, LoggedSet } from "../workout.types";

function set(overrides: Partial<LoggedSet> = {}): LoggedSet {
  return { setNumber: 1, weight: "100", reps: "8", rpe: "8", completed: true, ...overrides };
}

function exercise(overrides: Partial<ExerciseProgress> = {}): ExerciseProgress {
  return {
    exerciseId: "seated-leg-curl",
    exerciseName: "Seated Leg Curl",
    plannedSets: 3,
    repRange: [8, 12],
    restSeconds: 90,
    sets: [set(), set({ setNumber: 2, completed: false }), set({ setNumber: 3, completed: false })],
    ...overrides,
  };
}

describe("buildWithinSessionInput", () => {
  it("builds the engine input from the completed set", () => {
    const input = buildWithinSessionInput(exercise({ lastPerformance: { weight: 95, reps: 8 } }), 0);
    expect(input).toEqual({
      exerciseId: "seated-leg-curl",
      completedSet: { weight: 100, reps: 8, rpe: 8 },
      targetRepRange: [8, 12],
      plannedWeight: 95,
      remainingSets: 2,
    });
  });

  it("counts only uncompleted sets after the index as remaining", () => {
    const ex = exercise({
      sets: [set(), set({ setNumber: 2 }), set({ setNumber: 3, completed: false })],
    });
    // setIndex 1 completed; only set 3 remains.
    expect(buildWithinSessionInput(ex, 1)?.remainingSets).toBe(1);
  });

  it("derives plannedWeight from the first completed set when no lastPerformance", () => {
    const ex = exercise({
      lastPerformance: undefined,
      sets: [
        set({ setNumber: 1, weight: "90", completed: true }),
        set({ setNumber: 2, weight: "100", completed: true }),
        set({ setNumber: 3, completed: false }),
      ],
    });
    expect(buildWithinSessionInput(ex, 1)?.plannedWeight).toBe(90);
  });

  it("omits rpe when not provided", () => {
    const ex = exercise({ sets: [set({ rpe: "" }), set({ setNumber: 2, completed: false })] });
    expect(buildWithinSessionInput(ex, 0)?.completedSet.rpe).toBeUndefined();
  });

  it("returns null when the set lacks weight or reps", () => {
    expect(buildWithinSessionInput(exercise({ sets: [set({ weight: "" })] }), 0)).toBeNull();
    expect(buildWithinSessionInput(exercise({ sets: [set({ reps: "" })] }), 0)).toBeNull();
  });

  it("returns null for an out-of-range index", () => {
    expect(buildWithinSessionInput(exercise(), 9)).toBeNull();
  });
});
