import { describe, it, expect } from "vitest";
import { calculateLoadProgression, applyProgressionModifier } from "../progression";
import type { ProgressionInput } from "../types";

describe("calculateLoadProgression", () => {
  it("increases weight when hitting top of rep range with low RPE", () => {
    const input: ProgressionInput = {
      exerciseId: "bench-press",
      recentSets: [
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("increase");
    expect(result.newWeight).toBe(105); // +5kg for weights >= 50
    expect(result.reason).toContain("ready to progress");
  });

  it("uses smaller increment for lighter weights", () => {
    const input: ProgressionInput = {
      exerciseId: "lateral-raise",
      recentSets: [
        { reps: 15, rpe: 6, weight: 10 },
        { reps: 15, rpe: 6, weight: 10 },
      ],
      currentWeight: 10,
      targetRepRange: [12, 15],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("increase");
    expect(result.newWeight).toBe(12.5); // +2.5kg for weights < 50
  });

  it("decreases weight when below rep range", () => {
    const input: ProgressionInput = {
      exerciseId: "squat",
      recentSets: [
        { reps: 4, rpe: 9, weight: 140 },
        { reps: 3, rpe: 10, weight: 140 },
        { reps: 3, rpe: 10, weight: 140 },
      ],
      currentWeight: 140,
      targetRepRange: [6, 8],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("decrease");
    expect(result.newWeight).toBe(135);
    expect(result.reason).toContain("reduce load");
  });

  it("decreases weight when RPE is too high", () => {
    const input: ProgressionInput = {
      exerciseId: "deadlift",
      recentSets: [
        { reps: 6, rpe: 10, weight: 180 },
        { reps: 5, rpe: 10, weight: 180 },
      ],
      currentWeight: 180,
      targetRepRange: [5, 7],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("decrease");
    expect(result.reason).toContain("reduce load");
  });

  it("maintains weight when in target range with moderate RPE", () => {
    const input: ProgressionInput = {
      exerciseId: "row",
      recentSets: [
        { reps: 9, rpe: 8, weight: 80 },
        { reps: 8, rpe: 8, weight: 80 },
        { reps: 8, rpe: 8, weight: 80 },
      ],
      currentWeight: 80,
      targetRepRange: [8, 10],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("maintain");
    expect(result.newWeight).toBe(80);
    expect(result.reason).toContain("on track");
  });

  it("maintains weight with no recent data", () => {
    const input: ProgressionInput = {
      exerciseId: "press",
      recentSets: [],
      currentWeight: 60,
      targetRepRange: [6, 8],
    };

    const result = calculateLoadProgression(input);

    expect(result.action).toBe("maintain");
    expect(result.newWeight).toBe(60);
    expect(result.reason).toContain("No recent data");
  });

  it("uses default RPE of 7 when no RPE recorded", () => {
    const input: ProgressionInput = {
      exerciseId: "curl",
      recentSets: [
        { reps: 12, weight: 15 },
        { reps: 12, weight: 15 },
      ],
      currentWeight: 15,
      targetRepRange: [10, 12],
    };

    const result = calculateLoadProgression(input);

    // Default RPE 7 < threshold 8, so should increase
    expect(result.action).toBe("increase");
  });

  it("respects custom config", () => {
    const input: ProgressionInput = {
      exerciseId: "bench",
      recentSets: [
        { reps: 10, rpe: 7.5, weight: 100 },
        { reps: 10, rpe: 7.5, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    };

    // With stricter threshold, should maintain instead of increase
    const result = calculateLoadProgression(input, {
      rpeThresholdForIncrease: 7,
      rpeThresholdForDecrease: 9,
      smallIncrement: 2.5,
      largeIncrement: 5,
      weightThresholdForLargeIncrement: 50,
    });

    expect(result.action).toBe("maintain");
  });

  describe("self-tuned config (applyProgressionModifier)", () => {
    // An "increase" scenario at a heavy weight (uses the large increment).
    const increaseInput: ProgressionInput = {
      exerciseId: "bench-press",
      recentSets: [
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    };

    it("takes a smaller weight step under a conservative (0.8) config", () => {
      const defaultResult = calculateLoadProgression(increaseInput);
      const conservativeResult = calculateLoadProgression(
        increaseInput,
        applyProgressionModifier(0.8)
      );

      const defaultStep = defaultResult.newWeight - increaseInput.currentWeight;
      const conservativeStep = conservativeResult.newWeight - increaseInput.currentWeight;

      expect(conservativeResult.action).toBe("increase");
      expect(conservativeStep).toBeLessThan(defaultStep);
      expect(conservativeStep).toBeCloseTo(4.0); // 5 * 0.8
    });

    it("takes a larger weight step under an aggressive (1.1) config", () => {
      const defaultResult = calculateLoadProgression(increaseInput);
      const aggressiveResult = calculateLoadProgression(
        increaseInput,
        applyProgressionModifier(1.1)
      );

      const defaultStep = defaultResult.newWeight - increaseInput.currentWeight;
      const aggressiveStep = aggressiveResult.newWeight - increaseInput.currentWeight;

      expect(aggressiveResult.action).toBe("increase");
      expect(aggressiveStep).toBeGreaterThan(defaultStep);
      expect(aggressiveStep).toBeCloseTo(5.5); // 5 * 1.1
    });

    it("is identical to the default under a 1.0 (no-op) config", () => {
      const defaultResult = calculateLoadProgression(increaseInput);
      const noopResult = calculateLoadProgression(increaseInput, applyProgressionModifier(1.0));
      expect(noopResult).toEqual(defaultResult);
    });
  });

  describe("cycle phase", () => {
    // A clean "ready to increase" scenario at a heavy weight (large increment).
    const increaseInput: ProgressionInput = {
      exerciseId: "barbell-bench-press",
      recentSets: [
        { reps: 10, rpe: 7, weight: 100 },
        { reps: 10, rpe: 7, weight: 100 },
      ],
      currentWeight: 100,
      targetRepRange: [8, 10],
    };

    it("holds an earned increase during the menstrual phase (no new weight tests)", () => {
      // Arrange — same input that would normally increase to 105.
      const input: ProgressionInput = {
        ...increaseInput,
        cyclePhase: { phase: "menstrual", loadModifier: 0.9, allowNewWeightTests: false },
      };

      // Act
      const result = calculateLoadProgression(input);

      // Assert — increase is vetoed and held weight is scaled by 0.90.
      expect(result.action).not.toBe("increase");
      expect(result.action).toBe("maintain");
      expect(result.newWeight).toBe(90); // 100 (held) * 0.90
      expect(result.reason).toContain("menstrual");
    });

    it("scales a maintain decision by the menstrual loadModifier", () => {
      // Arrange — an in-range, moderate-RPE session that would maintain at 80.
      const input: ProgressionInput = {
        exerciseId: "row",
        recentSets: [
          { reps: 9, rpe: 8, weight: 80 },
          { reps: 8, rpe: 8, weight: 80 },
        ],
        currentWeight: 80,
        targetRepRange: [8, 10],
        cyclePhase: { phase: "menstrual", loadModifier: 0.9, allowNewWeightTests: false },
      };

      // Act
      const result = calculateLoadProgression(input);

      // Assert
      expect(result.action).toBe("maintain");
      expect(result.newWeight).toBe(72); // 80 * 0.90
    });

    it("scales a decrease decision by the menstrual loadModifier", () => {
      // Arrange — a grinding session that would decrease from 140 to 135.
      const input: ProgressionInput = {
        exerciseId: "squat",
        recentSets: [
          { reps: 4, rpe: 9, weight: 140 },
          { reps: 3, rpe: 10, weight: 140 },
        ],
        currentWeight: 140,
        targetRepRange: [6, 8],
        cyclePhase: { phase: "menstrual", loadModifier: 0.9, allowNewWeightTests: false },
      };

      // Act
      const result = calculateLoadProgression(input);

      // Assert — decrease survives the veto (it is not an increase) and is scaled.
      expect(result.action).toBe("decrease");
      expect(result.newWeight).toBe(121.5); // 135 * 0.90 = 121.5
    });

    it("progresses normally during the follicular phase (1.0, tests allowed)", () => {
      // Arrange
      const input: ProgressionInput = {
        ...increaseInput,
        cyclePhase: { phase: "follicular", loadModifier: 1.0, allowNewWeightTests: true },
      };

      // Act
      const result = calculateLoadProgression(input);

      // Assert — identical to no-cycle behavior.
      expect(result.action).toBe("increase");
      expect(result.newWeight).toBe(105);
    });

    it("blocks an increase via allowNewWeightTests:false even at loadModifier 1.0", () => {
      // Arrange — isolate the veto from any scaling.
      const input: ProgressionInput = {
        ...increaseInput,
        cyclePhase: { phase: "luteal", loadModifier: 1.0, allowNewWeightTests: false },
      };

      // Act
      const result = calculateLoadProgression(input);

      // Assert
      expect(result.action).toBe("maintain");
      expect(result.newWeight).toBe(100); // held at current, * 1.0
    });

    it("is byte-identical to the existing case when cyclePhase is undefined", () => {
      // Arrange — increaseInput has no cyclePhase.
      const withUndefined: ProgressionInput = { ...increaseInput, cyclePhase: undefined };

      // Act
      const baseline = calculateLoadProgression(increaseInput);
      const result = calculateLoadProgression(withUndefined);

      // Assert
      expect(result).toEqual(baseline);
      expect(result).toEqual({
        action: "increase",
        newWeight: 105,
        reason: "Averaging 10.0 reps at RPE 7.0 — ready to progress",
      });
    });

    it("vetoes an increase even under aggressive self-tuning (composition)", () => {
      // Arrange — aggressive tuning earns a bigger step; menstrual forbids it.
      const input: ProgressionInput = {
        ...increaseInput,
        cyclePhase: { phase: "menstrual", loadModifier: 0.9, allowNewWeightTests: false },
      };

      // Act — aggressive config (1.1) would push to 105.5 without the veto.
      const result = calculateLoadProgression(input, applyProgressionModifier(1.1));

      // Assert — still no increase; held at current, scaled by 0.90.
      expect(result.action).not.toBe("increase");
      expect(result.action).toBe("maintain");
      expect(result.newWeight).toBe(90); // 100 (held) * 0.90
    });

    it("scales the baseline-branch working weight by the loadModifier", () => {
      // Arrange — no recent sets, baseline provided.
      const baseInput: ProgressionInput = {
        exerciseId: "press",
        recentSets: [],
        currentWeight: 60,
        targetRepRange: [6, 8],
        baselineWeight: 80,
        baselineReps: 5,
      };
      const cycleInput: ProgressionInput = {
        ...baseInput,
        cyclePhase: { phase: "menstrual", loadModifier: 0.9, allowNewWeightTests: false },
      };

      // Act
      const baseline = calculateLoadProgression(baseInput);
      const result = calculateLoadProgression(cycleInput);

      // Assert — same action, working weight scaled by 0.90 (rounded to 0.5).
      expect(baseline.action).toBe("maintain");
      expect(result.action).toBe("maintain");
      expect(result.newWeight).toBe(Math.round(baseline.newWeight * 0.9 * 2) / 2);
    });

    it("honors a per-athlete override over the menstrual default", () => {
      // Arrange — athlete exceeds the hold: allow tests, only 5% taper.
      const input: ProgressionInput = {
        ...increaseInput,
        cyclePhase: { phase: "menstrual", loadModifier: 0.95, allowNewWeightTests: true },
      };

      // Act
      const result = calculateLoadProgression(input);

      // Assert — increase survives (tests allowed) and is scaled by 0.95,
      // rounded to the nearest 0.5kg (105 * 0.95 = 99.75 → 100).
      expect(result.action).toBe("increase");
      expect(result.newWeight).toBe(100);
    });
  });
});
