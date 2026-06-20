import { describe, it, expect } from "vitest";
import type { Exercise, AthleteConstraints } from "@gymapp/types";
import { isExerciseAllowed, defaultConstraintResolverConfig } from "../constraints";

function createExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: "barbell-back-squat",
    name: "Barbell Back Squat",
    aliases: [],
    equipment: ["barbell"],
    movementPatterns: ["squat"],
    primaryMuscles: ["quads", "glutes"],
    secondaryMuscles: ["hamstrings"],
    isCompound: true,
    isUnilateral: false,
    difficulty: "intermediate",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createConstraints(overrides: Partial<AthleteConstraints> = {}): AthleteConstraints {
  return {
    equipment: [],
    mobility: [],
    ...overrides,
  };
}

describe("isExerciseAllowed", () => {
  describe("empty profile", () => {
    it("allows everything when no constraints are set", () => {
      const result = isExerciseAllowed(createExercise(), createConstraints());
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });

  describe("equipment restrictions", () => {
    it("blocks a barbell exercise under no_barbell", () => {
      const result = isExerciseAllowed(
        createExercise({ equipment: ["barbell"] }),
        createConstraints({ equipment: ["no_barbell"] })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("barbell");
      expect(result.reason).toContain("no_barbell");
    });

    it("allows a barbell exercise when only no_machine is set", () => {
      const result = isExerciseAllowed(
        createExercise({ equipment: ["barbell"] }),
        createConstraints({ equipment: ["no_machine"] })
      );
      expect(result.allowed).toBe(true);
    });

    it("blocks a machine exercise under no_machine", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "leg-press", equipment: ["machine"], movementPatterns: ["squat"] }),
        createConstraints({ equipment: ["no_machine"] })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("machine");
    });

    it("blocks a cable exercise under no_cable", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "cable-row", equipment: ["cable"], movementPatterns: ["pull_horizontal"] }),
        createConstraints({ equipment: ["no_cable"] })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("cable");
    });

    it("blocks a dumbbell exercise under no_dumbbell", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "db-press", equipment: ["dumbbell"], movementPatterns: ["push_horizontal"] }),
        createConstraints({ equipment: ["no_dumbbell"] })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("dumbbell");
    });
  });

  describe("mobility restrictions", () => {
    it("blocks an overhead press under no_overhead", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "ohp", equipment: ["barbell"], movementPatterns: ["push_vertical"] }),
        createConstraints({ mobility: ["no_overhead"] })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("push_vertical");
      expect(result.reason).toContain("no_overhead");
    });

    it("blocks a squat under no_deep_knee_flexion", () => {
      const result = isExerciseAllowed(
        createExercise({ movementPatterns: ["squat"] }),
        createConstraints({ mobility: ["no_deep_knee_flexion"] })
      );
      expect(result.allowed).toBe(false);
    });

    it("blocks a lunge under no_deep_knee_flexion", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "lunge", movementPatterns: ["lunge"] }),
        createConstraints({ mobility: ["no_deep_knee_flexion"] })
      );
      expect(result.allowed).toBe(false);
    });

    it("blocks a squat and a hinge under no_spinal_loading", () => {
      const squat = isExerciseAllowed(
        createExercise({ movementPatterns: ["squat"] }),
        createConstraints({ mobility: ["no_spinal_loading"] })
      );
      const hinge = isExerciseAllowed(
        createExercise({ id: "deadlift", movementPatterns: ["hinge"] }),
        createConstraints({ mobility: ["no_spinal_loading"] })
      );
      expect(squat.allowed).toBe(false);
      expect(hinge.allowed).toBe(false);
    });

    it("allows a press under no_spinal_loading", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "bench", equipment: ["barbell"], movementPatterns: ["push_horizontal"] }),
        createConstraints({ mobility: ["no_spinal_loading"] })
      );
      expect(result.allowed).toBe(true);
    });

    it("treats no_wrist_extension as context-only (does not filter) in the MVP", () => {
      const result = isExerciseAllowed(
        createExercise(),
        createConstraints({ mobility: ["no_wrist_extension"] })
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("banned exercise ids", () => {
    it("blocks an exercise listed in bannedExerciseIds", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "barbell-back-squat" }),
        createConstraints({ bannedExerciseIds: ["barbell-back-squat"] })
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("banned");
    });

    it("allows an exercise not listed in bannedExerciseIds", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "front-squat" }),
        createConstraints({ bannedExerciseIds: ["barbell-back-squat"] })
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("non-filtering fields", () => {
    it("does not filter on injuries (context only)", () => {
      const result = isExerciseAllowed(
        createExercise(),
        createConstraints({ injuries: [{ region: "knee", note: "ACL repair" }] })
      );
      expect(result.allowed).toBe(true);
    });

    it("does not filter on correctivePriorityExerciseIds", () => {
      const result = isExerciseAllowed(
        createExercise({ id: "barbell-back-squat" }),
        createConstraints({ correctivePriorityExerciseIds: ["barbell-back-squat"] })
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe("custom config", () => {
    it("respects a tuned mobility map", () => {
      const config = {
        ...defaultConstraintResolverConfig,
        mobilityMap: {
          ...defaultConstraintResolverConfig.mobilityMap,
          no_overhead: [],
        },
      };
      const result = isExerciseAllowed(
        createExercise({ id: "ohp", movementPatterns: ["push_vertical"] }),
        createConstraints({ mobility: ["no_overhead"] }),
        config
      );
      expect(result.allowed).toBe(true);
    });
  });
});
