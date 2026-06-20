import { describe, it, expect } from "vitest";
import { permanentSubstitutionSchema } from "../substitution";

describe("permanentSubstitutionSchema", () => {
  it("validates a complete, valid substitution", () => {
    const result = permanentSubstitutionSchema.safeParse({
      originalExerciseId: "leg-press",
      substituteExerciseId: "bulgarian-split-squat",
      reason: "anatomy",
      note: "leg press aggravates the knee",
      confirmedAt: "2026-06-19T00:00:00.000Z",
      weightCarries: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a self-map (original === substitute)", () => {
    const result = permanentSubstitutionSchema.safeParse({
      originalExerciseId: "leg-press",
      substituteExerciseId: "leg-press",
      reason: "other",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toContain("itself");
    }
  });

  it("rejects an invalid reason enum", () => {
    const result = permanentSubstitutionSchema.safeParse({
      originalExerciseId: "leg-press",
      substituteExerciseId: "hack-squat",
      reason: "vibes",
    });
    expect(result.success).toBe(false);
  });

  it("defaults weightCarries to true when omitted", () => {
    const result = permanentSubstitutionSchema.safeParse({
      originalExerciseId: "leg-press",
      substituteExerciseId: "hack-squat",
      reason: "fit_preference",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weightCarries).toBe(true);
    }
  });

  it("treats confirmedAt as optional", () => {
    const result = permanentSubstitutionSchema.safeParse({
      originalExerciseId: "leg-press",
      substituteExerciseId: "hack-squat",
      reason: "mobility",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty original exercise id", () => {
    const result = permanentSubstitutionSchema.safeParse({
      originalExerciseId: "",
      substituteExerciseId: "hack-squat",
      reason: "other",
    });
    expect(result.success).toBe(false);
  });
});
