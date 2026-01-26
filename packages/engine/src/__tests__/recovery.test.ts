import { describe, it, expect } from "vitest";
import { calculateSessionRecovery } from "../recovery";
import type { RecoveryInput } from "../recovery";

describe("calculateSessionRecovery", () => {
  it("recommends full session when fully recovered", () => {
    const input: RecoveryInput = {
      sleepQuality: 9,
      muscleSoreness: 2,
      stressLevel: 2,
      energyLevel: 9,
      hoursSinceLastWorkout: 48,
      lastWorkoutRpe: 7,
    };

    const result = calculateSessionRecovery(input);

    expect(result.recommendation).toBe("full_session");
    expect(result.volumeModifier).toBe(1.0);
    expect(result.intensityModifier).toBe(1.0);
    expect(result.readinessScore).toBeGreaterThanOrEqual(7);
  });

  it("recommends reduced volume when moderately recovered", () => {
    const input: RecoveryInput = {
      sleepQuality: 6,
      muscleSoreness: 5,
      stressLevel: 5,
      energyLevel: 6,
      hoursSinceLastWorkout: 48,
      lastWorkoutRpe: 8,
    };

    const result = calculateSessionRecovery(input);

    expect(result.recommendation).toBe("reduced_volume");
    expect(result.volumeModifier).toBeLessThan(1.0);
    expect(result.intensityModifier).toBe(1.0);
  });

  it("recommends reduced intensity when poorly recovered", () => {
    const input: RecoveryInput = {
      sleepQuality: 4,
      muscleSoreness: 7,
      stressLevel: 7,
      energyLevel: 4,
      hoursSinceLastWorkout: 24,
      lastWorkoutRpe: 9,
    };

    const result = calculateSessionRecovery(input);

    expect(["reduced_intensity", "light_session"]).toContain(result.recommendation);
    expect(result.volumeModifier).toBeLessThan(1.0);
    expect(result.intensityModifier).toBeLessThan(1.0);
  });

  it("recommends rest day when very poorly recovered", () => {
    const input: RecoveryInput = {
      sleepQuality: 2,
      muscleSoreness: 9,
      stressLevel: 9,
      energyLevel: 2,
      hoursSinceLastWorkout: 12,
      lastWorkoutRpe: 10,
    };

    const result = calculateSessionRecovery(input);

    expect(["light_session", "rest_day"]).toContain(result.recommendation);
    expect(result.readinessScore).toBeLessThanOrEqual(3);
  });

  it("accounts for time since last workout", () => {
    const baseInput: RecoveryInput = {
      sleepQuality: 7,
      muscleSoreness: 5,
      stressLevel: 5,
      energyLevel: 7,
      hoursSinceLastWorkout: 24,
      lastWorkoutRpe: 7,
    };

    const shortRecovery = calculateSessionRecovery(baseInput);
    const longRecovery = calculateSessionRecovery({
      ...baseInput,
      hoursSinceLastWorkout: 72,
    });

    // Longer recovery should result in higher readiness
    expect(longRecovery.readinessScore).toBeGreaterThanOrEqual(shortRecovery.readinessScore);
  });

  it("handles missing lastWorkoutRpe", () => {
    const input: RecoveryInput = {
      sleepQuality: 8,
      muscleSoreness: 3,
      stressLevel: 3,
      energyLevel: 8,
      hoursSinceLastWorkout: 48,
    };

    const result = calculateSessionRecovery(input);

    expect(result.recommendation).toBe("full_session");
    expect(result.readinessScore).toBeGreaterThan(0);
  });

  it("returns readiness score between 1 and 10", () => {
    const inputs: RecoveryInput[] = [
      { sleepQuality: 1, muscleSoreness: 10, stressLevel: 10, energyLevel: 1, hoursSinceLastWorkout: 0 },
      { sleepQuality: 10, muscleSoreness: 1, stressLevel: 1, energyLevel: 10, hoursSinceLastWorkout: 100 },
      { sleepQuality: 5, muscleSoreness: 5, stressLevel: 5, energyLevel: 5, hoursSinceLastWorkout: 48 },
    ];

    for (const input of inputs) {
      const result = calculateSessionRecovery(input);
      expect(result.readinessScore).toBeGreaterThanOrEqual(1);
      expect(result.readinessScore).toBeLessThanOrEqual(10);
    }
  });
});
