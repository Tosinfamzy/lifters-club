export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const FETCH_TIMEOUT_MS = 10_000;

export const RPE_SCALE = { min: 1, max: 10 } as const;

export const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  green: "hsl(142 71% 45%)",
  orange: "hsl(24 95% 53%)",
  purple: "hsl(262 83% 58%)",
} as const;

import type { WeightUnit } from "@gymapp/types";

export type { WeightUnit };

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;

/** Convert a stored lbs value to the user's display unit */
export function fromLbs(value: number, displayUnit: WeightUnit): number {
  return displayUnit === "kg" ? value * LBS_TO_KG : value;
}

/** Convert a user-entered value in their preferred unit to lbs for storage */
export function toLbs(value: number, inputUnit: WeightUnit): number {
  return inputUnit === "kg" ? value * KG_TO_LBS : value;
}

/** Input step size appropriate for the given unit */
export function getWeightStep(unit: WeightUnit): number {
  return unit === "kg" ? 0.5 : 2.5;
}

/**
 * Format a weight value for display with the given unit.
 * Weights are stored in lbs; converts automatically.
 */
export function formatWeight(
  value: number,
  displayUnit: WeightUnit,
  storedUnit: WeightUnit = "lbs"
): string {
  let converted = value;
  if (storedUnit !== displayUnit) {
    converted = displayUnit === "kg" ? value * LBS_TO_KG : value * KG_TO_LBS;
  }
  const formatted =
    displayUnit === "kg" ? converted.toFixed(1) : Math.round(converted).toString();
  return `${formatted} ${displayUnit}`;
}
