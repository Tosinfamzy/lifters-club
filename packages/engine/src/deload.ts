import type { DeloadDecision } from "@gymapp/types";
import type { DeloadInput } from "./types";

/**
 * Configuration for deload recommendations
 */
export interface DeloadConfig {
  rpeThresholdForDeload: number;
  consecutiveHardWeeksThreshold: number;
  maxWeeksWithoutDeload: number;
}

const defaultConfig: DeloadConfig = {
  rpeThresholdForDeload: 8.5,
  consecutiveHardWeeksThreshold: 4,
  maxWeeksWithoutDeload: 8,
};

/**
 * Calculate whether a deload week is recommended
 * based on recent training stress
 */
export function calculateDeloadNeed(
  input: DeloadInput,
  config: DeloadConfig = defaultConfig
): DeloadDecision {
  const { weekNumber, recentWeeklyRpe, missedSessions, consecutiveHardWeeks } = input;

  // Scheduled deload every N weeks
  if (weekNumber > 0 && weekNumber % config.maxWeeksWithoutDeload === 0) {
    return {
      recommended: true,
      reason: `Week ${weekNumber} — scheduled deload for recovery`,
    };
  }

  // Too many consecutive hard weeks
  if (consecutiveHardWeeks >= config.consecutiveHardWeeksThreshold) {
    return {
      recommended: true,
      reason: `${consecutiveHardWeeks} consecutive high-fatigue weeks — deload recommended`,
    };
  }

  // Recent average RPE too high
  if (recentWeeklyRpe.length >= 2) {
    const avgRpe = recentWeeklyRpe.reduce((sum, r) => sum + r, 0) / recentWeeklyRpe.length;
    if (avgRpe >= config.rpeThresholdForDeload) {
      return {
        recommended: true,
        reason: `Average RPE ${avgRpe.toFixed(1)} over recent weeks — deload recommended`,
      };
    }
  }

  // Missed sessions indicate recovery issues
  if (missedSessions >= 2) {
    return {
      recommended: true,
      reason: `${missedSessions} missed sessions — may indicate need for recovery`,
    };
  }

  return {
    recommended: false,
    reason: "Training load sustainable — continue as planned",
  };
}
