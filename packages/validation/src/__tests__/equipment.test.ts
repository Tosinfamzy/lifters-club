import { describe, it, expect } from "vitest";
import { equipmentInstanceSchema, equipmentInstanceInputSchema } from "../equipment";

describe("equipmentInstanceSchema", () => {
  it("validates a complete instance", () => {
    const result = equipmentInstanceSchema.safeParse({
      exerciseId: "cable-row",
      incrementConstraint: 5,
      minWeight: 5,
      confirmedWorkingWeight: 40,
      label: "blue cable station",
    });
    expect(result.success).toBe(true);
  });

  it("validates a minimal instance (exerciseId only)", () => {
    const result = equipmentInstanceSchema.safeParse({ exerciseId: "cable-row" });
    expect(result.success).toBe(true);
  });

  it("requires an exerciseId", () => {
    const result = equipmentInstanceSchema.safeParse({ incrementConstraint: 5 });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive increment", () => {
    const result = equipmentInstanceSchema.safeParse({
      exerciseId: "cable-row",
      incrementConstraint: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative minWeight", () => {
    const result = equipmentInstanceSchema.safeParse({
      exerciseId: "cable-row",
      minWeight: -5,
    });
    expect(result.success).toBe(false);
  });
});

describe("equipmentInstanceInputSchema (engine-input variant)", () => {
  it("validates bounds without an exerciseId", () => {
    const result = equipmentInstanceInputSchema.safeParse({ incrementConstraint: 2.5 });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive increment", () => {
    const result = equipmentInstanceInputSchema.safeParse({ incrementConstraint: -1 });
    expect(result.success).toBe(false);
  });
});
