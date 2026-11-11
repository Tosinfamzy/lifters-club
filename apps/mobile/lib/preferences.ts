import type { WeekStartDay, WeightUnit } from "@gymapp/types";

// Defaults when a user has never set the preference. lbs matches web's default.
export const DEFAULT_WEIGHT_UNIT: WeightUnit = "lbs";
export const DEFAULT_WEEK_START_DAY: WeekStartDay = "sunday";

export interface DisplayPreferences {
  weightUnit: WeightUnit;
  weekStartDay: WeekStartDay;
}

const WEIGHT_UNITS: readonly WeightUnit[] = ["lbs", "kg"];
const WEEK_START_DAYS: readonly WeekStartDay[] = ["sunday", "monday"];

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

/**
 * Reads display preferences from the user's stored preferences, falling back to
 * defaults for missing or unrecognised values (preferences is untyped jsonb).
 */
export function resolveDisplayPreferences(
  preferences: Record<string, unknown> | null | undefined
): DisplayPreferences {
  const weightUnit = preferences?.weightUnit;
  const weekStartDay = preferences?.weekStartDay;
  return {
    weightUnit: isOneOf(WEIGHT_UNITS, weightUnit) ? weightUnit : DEFAULT_WEIGHT_UNIT,
    weekStartDay: isOneOf(WEEK_START_DAYS, weekStartDay) ? weekStartDay : DEFAULT_WEEK_START_DAY,
  };
}

/** "100 lbs" / "45 kg". */
export function formatWeight(weight: number, unit: WeightUnit): string {
  return `${weight} ${unit}`;
}

/**
 * PATCH /users/:id replaces the whole preferences object, so updates must be
 * merged over the existing preferences or other settings would be wiped.
 */
export function mergePreferences(
  existing: Record<string, unknown> | null | undefined,
  changes: Partial<DisplayPreferences>
): Record<string, unknown> {
  return { ...(existing ?? {}), ...changes };
}
