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

export type WeightUnit = "lbs" | "kg";

const KG_TO_LBS = 2.20462;
const LBS_TO_KG = 1 / KG_TO_LBS;

/**
 * Format a weight value with the given unit.
 * Weights are stored in lbs; pass `storedUnit` if the source is different.
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
  // Round to 1 decimal for kg, whole number for lbs
  const formatted =
    displayUnit === "kg" ? converted.toFixed(1) : Math.round(converted).toString();
  return `${formatted} ${displayUnit}`;
}
