/**
 * Session Recovery Adjustment
 *
 * Adjusts workout intensity/volume based on recovery indicators
 * before starting a session.
 */

export interface RecoveryInput {
  /** 1-10 scale: 1 = terrible, 10 = fully rested */
  sleepQuality: number;
  /** 1-10 scale: 1 = no soreness, 10 = extremely sore */
  muscleSoreness: number;
  /** 1-10 scale: 1 = no stress, 10 = extremely stressed */
  stressLevel: number;
  /** 1-10 scale: 1 = exhausted, 10 = full of energy */
  energyLevel: number;
  /** Hours since last workout */
  hoursSinceLastWorkout: number;
  /** Average RPE of last workout */
  lastWorkoutRpe?: number;
}

export interface RecoveryDecision {
  /** Multiplier for volume (e.g., 0.7 = reduce by 30%) */
  volumeModifier: number;
  /** Multiplier for intensity/weight (e.g., 0.9 = reduce by 10%) */
  intensityModifier: number;
  /** Overall readiness score 1-10 */
  readinessScore: number;
  /** Human-readable recommendation */
  recommendation: "full_session" | "reduced_volume" | "reduced_intensity" | "light_session" | "rest_day";
  /** Explanation for the decision */
  reason: string;
}

export interface RecoveryConfig {
  /** Minimum readiness score for full workout */
  fullWorkoutThreshold: number;
  /** Threshold for reduced volume recommendation */
  reducedVolumeThreshold: number;
  /** Threshold for light session recommendation */
  lightSessionThreshold: number;
  /** Minimum hours between sessions for full recovery credit */
  minRecoveryHours: number;
}

const defaultConfig: RecoveryConfig = {
  fullWorkoutThreshold: 7,
  reducedVolumeThreshold: 5,
  lightSessionThreshold: 3,
  minRecoveryHours: 48,
};

/**
 * Calculate session adjustments based on recovery status
 */
export function calculateSessionRecovery(
  input: RecoveryInput,
  config: RecoveryConfig = defaultConfig
): RecoveryDecision {
  const {
    sleepQuality,
    muscleSoreness,
    stressLevel,
    energyLevel,
    hoursSinceLastWorkout,
    lastWorkoutRpe,
  } = input;

  // Calculate readiness score (weighted average)
  // Higher is better for sleep, energy; lower is better for soreness, stress
  const sleepScore = sleepQuality;
  const sorenessScore = 11 - muscleSoreness; // Invert: low soreness = high score
  const stressScore = 11 - stressLevel; // Invert: low stress = high score
  const energyScore = energyLevel;

  // Recovery time factor (0-1, where 1 = fully recovered)
  const recoveryTimeFactor = Math.min(hoursSinceLastWorkout / config.minRecoveryHours, 1);

  // Previous workout intensity factor
  const lastWorkoutFactor = lastWorkoutRpe ? (11 - lastWorkoutRpe) / 10 : 0.7;

  // Weighted readiness calculation
  const baseReadiness =
    sleepScore * 0.3 +
    sorenessScore * 0.25 +
    stressScore * 0.15 +
    energyScore * 0.3;

  // Adjust for recovery time and previous workout
  const adjustedReadiness = baseReadiness * (0.7 + recoveryTimeFactor * 0.2 + lastWorkoutFactor * 0.1);

  // Clamp to 1-10
  const readinessScore = Math.max(1, Math.min(10, adjustedReadiness));

  // Determine recommendation and modifiers
  if (readinessScore >= config.fullWorkoutThreshold) {
    return {
      volumeModifier: 1.0,
      intensityModifier: 1.0,
      readinessScore: Math.round(readinessScore * 10) / 10,
      recommendation: "full_session",
      reason: `Readiness ${readinessScore.toFixed(1)}/10 — fully recovered, proceed as planned`,
    };
  }

  if (readinessScore >= config.reducedVolumeThreshold) {
    const volumeMod = 0.7 + (readinessScore - config.reducedVolumeThreshold) * 0.15;
    return {
      volumeModifier: Math.round(volumeMod * 100) / 100,
      intensityModifier: 1.0,
      readinessScore: Math.round(readinessScore * 10) / 10,
      recommendation: "reduced_volume",
      reason: `Readiness ${readinessScore.toFixed(1)}/10 — maintain intensity, reduce volume to ${Math.round(volumeMod * 100)}%`,
    };
  }

  if (readinessScore >= config.lightSessionThreshold) {
    const volumeMod = 0.5 + (readinessScore - config.lightSessionThreshold) * 0.1;
    const intensityMod = 0.8 + (readinessScore - config.lightSessionThreshold) * 0.05;
    return {
      volumeModifier: Math.round(volumeMod * 100) / 100,
      intensityModifier: Math.round(intensityMod * 100) / 100,
      readinessScore: Math.round(readinessScore * 10) / 10,
      recommendation: "reduced_intensity",
      reason: `Readiness ${readinessScore.toFixed(1)}/10 — reduce intensity to ${Math.round(intensityMod * 100)}% and volume to ${Math.round(volumeMod * 100)}%`,
    };
  }

  if (readinessScore >= 2) {
    return {
      volumeModifier: 0.4,
      intensityModifier: 0.6,
      readinessScore: Math.round(readinessScore * 10) / 10,
      recommendation: "light_session",
      reason: `Readiness ${readinessScore.toFixed(1)}/10 — light movement only, focus on recovery`,
    };
  }

  return {
    volumeModifier: 0,
    intensityModifier: 0,
    readinessScore: Math.round(readinessScore * 10) / 10,
    recommendation: "rest_day",
    reason: `Readiness ${readinessScore.toFixed(1)}/10 — rest day strongly recommended`,
  };
}
