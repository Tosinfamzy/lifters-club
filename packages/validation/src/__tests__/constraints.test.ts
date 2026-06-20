import { describe, it, expect } from "vitest";
import { athleteConstraintsSchema, gripRestrictionSchema } from "../constraints";

describe("gripRestrictionSchema", () => {
  it("accepts each valid grip restriction", () => {
    for (const value of ["neutral_grip_only", "no_pronated", "no_supinated"]) {
      expect(gripRestrictionSchema.safeParse(value).success).toBe(true);
    }
  });

  it("rejects an invalid grip restriction", () => {
    expect(gripRestrictionSchema.safeParse("no_neutral").success).toBe(false);
  });
});

describe("athleteConstraintsSchema grip axis", () => {
  it("accepts a profile with a grip restriction", () => {
    const result = athleteConstraintsSchema.safeParse({
      grip: ["neutral_grip_only"],
    });
    expect(result.success).toBe(true);
    expect(result.data?.grip).toEqual(["neutral_grip_only"]);
  });

  it("defaults grip to [] when omitted", () => {
    const result = athleteConstraintsSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data?.grip).toEqual([]);
  });

  it("rejects an invalid grip enum value", () => {
    const result = athleteConstraintsSchema.safeParse({
      grip: ["no_overhead"],
    });
    expect(result.success).toBe(false);
  });
});
