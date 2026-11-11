import { describe, it, expect } from "vitest";
import { userPreferencesSchema, weekStartDaySchema } from "../training";

const basePreferences = {
  equipmentAvailable: ["barbell"],
  daysPerWeek: 4,
  sessionDurationMinutes: 60,
};

describe("weekStartDaySchema", () => {
  it.each(["sunday", "monday"])("accepts %s", (day) => {
    expect(weekStartDaySchema.safeParse(day).success).toBe(true);
  });

  it.each(["saturday", "Sunday", "", 0])("rejects %p", (day) => {
    expect(weekStartDaySchema.safeParse(day).success).toBe(false);
  });
});

describe("userPreferencesSchema display preferences", () => {
  it("accepts preferences without weekStartDay (defaults are applied by clients)", () => {
    expect(userPreferencesSchema.safeParse(basePreferences).success).toBe(true);
  });

  it("accepts a valid weekStartDay and weightUnit", () => {
    const result = userPreferencesSchema.safeParse({
      ...basePreferences,
      weightUnit: "kg",
      weekStartDay: "monday",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown weekStartDay", () => {
    const result = userPreferencesSchema.safeParse({ ...basePreferences, weekStartDay: "friday" });
    expect(result.success).toBe(false);
  });
});
