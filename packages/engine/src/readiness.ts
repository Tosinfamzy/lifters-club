/**
 * Session readiness calculation
 *
 * Evaluates pre-workout factors to determine training readiness
 * and recommend session modifications.
 */

export interface ReadinessInput {
  sleepQuality: number; // 1-5 scale (1 = poor, 5 = excellent)
  muscleSoreness: number; // 1-5 scale (1 = none, 5 = severe)
  stressLevel: number; // 1-5 scale (1 = low, 5 = high)
  energyLevel: number; // 1-5 scale (1 = exhausted, 5 = energized)
}

export type ReadinessRecommendation = "proceed" | "modify" | "rest";

export interface ReadinessResult {
  score: number; // 0-100 readiness score
  recommendation: ReadinessRecommendation;
  volumeModifier: number; // e.g., 0.8 means reduce volume by 20%
  intensityModifier: number; // e.g., 0.9 means reduce intensity by 10%
  adjustments: string[]; // Human-readable adjustment suggestions
  reason: string; // Explanation for the recommendation
}

export interface ReadinessConfig {
  weights: {
    sleep: number;
    soreness: number;
    stress: number;
    energy: number;
  };
  thresholds: {
    proceed: number; // Score >= this = proceed as planned
    modify: number; // Score >= this but < proceed = modify session
    // Score < modify = rest
  };
}

const defaultConfig: ReadinessConfig = {
  weights: {
    sleep: 0.35, // Sleep is most important factor
    soreness: 0.25,
    stress: 0.2,
    energy: 0.2,
  },
  thresholds: {
    proceed: 70,
    modify: 50,
  },
};

/**
 * Calculate session readiness based on pre-workout check-in data
 *
 * @param input - User's reported readiness factors (all 1-5 scale)
 * @param config - Optional configuration for weights and thresholds
 * @returns ReadinessResult with score, recommendation, and modifiers
 *
 * @example
 * ```typescript
 * const result = calculateSessionReadiness({
 *   sleepQuality: 4,
 *   muscleSoreness: 2,
 *   stressLevel: 3,
 *   energyLevel: 4,
 * });
 * // { score: 76, recommendation: 'proceed', volumeModifier: 1.0, ... }
 * ```
 */
export function calculateSessionReadiness(
  input: ReadinessInput,
  config: ReadinessConfig = defaultConfig
): ReadinessResult {
  const { weights, thresholds } = config;

  // Validate inputs are within range
  const clamp = (value: number): number => Math.min(5, Math.max(1, value));
  const sleep = clamp(input.sleepQuality);
  const soreness = clamp(input.muscleSoreness);
  const stress = clamp(input.stressLevel);
  const energy = clamp(input.energyLevel);

  // Calculate weighted score
  // For soreness and stress, invert the scale (high values = bad)
  const rawScore =
    sleep * weights.sleep +
    (6 - soreness) * weights.soreness + // Invert: 5 soreness → 1, 1 soreness → 5
    (6 - stress) * weights.stress + // Invert: 5 stress → 1, 1 stress → 5
    energy * weights.energy;

  // Convert to 0-100 scale (max raw score is 5, min is 1)
  const score = Math.round((rawScore / 5) * 100);

  // Determine recommendation based on thresholds
  if (score >= thresholds.proceed) {
    return {
      score,
      recommendation: "proceed",
      volumeModifier: 1.0,
      intensityModifier: 1.0,
      adjustments: [],
      reason: "Good to train as planned",
    };
  }

  if (score >= thresholds.modify) {
    const adjustments = generateAdjustments(input, "modify");
    return {
      score,
      recommendation: "modify",
      volumeModifier: 0.85,
      intensityModifier: 0.9,
      adjustments,
      reason: "Moderate fatigue detected - consider reducing intensity",
    };
  }

  // Rest recommendation
  const adjustments = generateAdjustments(input, "rest");
  return {
    score,
    recommendation: "rest",
    volumeModifier: 0.5,
    intensityModifier: 0.7,
    adjustments,
    reason: "High fatigue - recovery recommended",
  };
}

/**
 * Generate specific adjustment recommendations based on input factors
 */
function generateAdjustments(
  input: ReadinessInput,
  recommendation: ReadinessRecommendation
): string[] {
  const adjustments: string[] = [];

  if (recommendation === "rest") {
    adjustments.push("Consider a light session or complete rest day");
    return adjustments;
  }

  // Specific factor-based recommendations
  if (input.sleepQuality <= 2) {
    adjustments.push("Reduce training volume - poor sleep recovery");
  }

  if (input.muscleSoreness >= 4) {
    adjustments.push("Avoid training sore muscle groups");
    adjustments.push("Consider active recovery or mobility work");
  }

  if (input.stressLevel >= 4) {
    adjustments.push("Keep session shorter than usual");
    adjustments.push("Focus on compound movements only");
  }

  if (input.energyLevel <= 2) {
    adjustments.push("Cap RPE at 7-8 for main lifts");
    adjustments.push("Skip accessory work if needed");
  }

  // Default modification adjustments
  if (adjustments.length === 0) {
    adjustments.push("Reduce working sets by 1 per exercise");
    adjustments.push("Keep RPE below 8");
  }

  return adjustments;
}
