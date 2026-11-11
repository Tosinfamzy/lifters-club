import {
  DEFAULT_WEEK_START_DAY,
  DEFAULT_WEIGHT_UNIT,
  mergePreferences,
  resolveDisplayPreferences,
} from "../preferences";

describe("resolveDisplayPreferences", () => {
  it("defaults to lbs and a Sunday week start when nothing is stored", () => {
    expect(resolveDisplayPreferences(undefined)).toEqual({
      weightUnit: DEFAULT_WEIGHT_UNIT,
      weekStartDay: DEFAULT_WEEK_START_DAY,
    });
    expect(DEFAULT_WEEK_START_DAY).toBe("sunday");
    expect(DEFAULT_WEIGHT_UNIT).toBe("lbs");
  });

  it("returns stored values when they are valid", () => {
    expect(resolveDisplayPreferences({ weightUnit: "kg", weekStartDay: "monday" })).toEqual({
      weightUnit: "kg",
      weekStartDay: "monday",
    });
  });

  it("falls back to defaults for unrecognised stored values", () => {
    expect(resolveDisplayPreferences({ weightUnit: "stone", weekStartDay: 1 })).toEqual({
      weightUnit: "lbs",
      weekStartDay: "sunday",
    });
  });
});

describe("mergePreferences", () => {
  it("keeps unrelated preferences when changing a display preference", () => {
    const existing = { daysPerWeek: 4, tracksCycle: true, weightUnit: "lbs" };

    expect(mergePreferences(existing, { weekStartDay: "monday" })).toEqual({
      daysPerWeek: 4,
      tracksCycle: true,
      weightUnit: "lbs",
      weekStartDay: "monday",
    });
  });

  it("handles missing existing preferences", () => {
    expect(mergePreferences(null, { weightUnit: "kg" })).toEqual({ weightUnit: "kg" });
  });
});
