/**
 * Missed Session Handling
 *
 * Determines what to do when a user misses a scheduled workout.
 */

export type MissedReason =
  | "illness"
  | "injury"
  | "travel"
  | "schedule_conflict"
  | "fatigue"
  | "motivation"
  | "unknown";

export interface MissedSessionInput {
  /** Days since the missed session was scheduled */
  daysSinceMissed: number;
  /** Why the session was missed */
  reason: MissedReason;
  /** How many sessions have been missed in the current week */
  missedThisWeek: number;
  /** How many consecutive sessions have been missed */
  consecutiveMissed: number;
  /** Current week number in the program */
  weekNumber: number;
  /** Total weeks in the program */
  totalWeeks: number;
  /** Whether this was a key/priority session */
  wasKeySession: boolean;
}

export interface MissedSessionDecision {
  /** What action to take */
  action: "resume" | "repeat" | "regress" | "extend_program" | "skip_and_adjust";
  /** Which session to do next (if applicable) */
  nextSessionNumber?: number;
  /** Intensity adjustment for the next session */
  intensityAdjustment: number;
  /** Whether to extend the program by a week */
  extendProgram: boolean;
  /** Human-readable explanation */
  reason: string;
}

export interface MissedSessionConfig {
  /** Max days before considering a regress */
  maxDaysBeforeRegress: number;
  /** Max consecutive misses before extending program */
  maxConsecutiveMissesBeforeExtend: number;
  /** Intensity reduction per day missed */
  intensityReductionPerDay: number;
}

const defaultConfig: MissedSessionConfig = {
  maxDaysBeforeRegress: 7,
  maxConsecutiveMissesBeforeExtend: 3,
  intensityReductionPerDay: 0.02,
};

/**
 * Calculate how to handle a missed session
 */
export function calculateMissedSessionHandling(
  input: MissedSessionInput,
  config: MissedSessionConfig = defaultConfig
): MissedSessionDecision {
  const {
    daysSinceMissed,
    reason,
    missedThisWeek,
    consecutiveMissed,
    weekNumber,
    totalWeeks,
    wasKeySession,
  } = input;

  // Calculate intensity adjustment based on time away
  const baseIntensityReduction = Math.min(daysSinceMissed * config.intensityReductionPerDay, 0.2);

  // Illness or injury requires more caution
  if (reason === "illness" || reason === "injury") {
    if (daysSinceMissed <= 3) {
      return {
        action: "resume",
        intensityAdjustment: 1 - baseIntensityReduction - 0.1, // Extra 10% reduction
        extendProgram: false,
        reason: `Returning from ${reason} — resume with ${Math.round((1 - baseIntensityReduction - 0.1) * 100)}% intensity, listen to your body`,
      };
    }

    if (daysSinceMissed <= 7) {
      return {
        action: "repeat",
        intensityAdjustment: 0.8,
        extendProgram: false,
        reason: `${daysSinceMissed} days since ${reason} — repeat last completed session at 80% intensity`,
      };
    }

    return {
      action: "regress",
      intensityAdjustment: 0.7,
      extendProgram: true,
      reason: `Extended time away due to ${reason} — regress one week and extend program`,
    };
  }

  // Fatigue-related miss suggests deload might be needed
  if (reason === "fatigue") {
    return {
      action: "skip_and_adjust",
      intensityAdjustment: 0.85,
      extendProgram: false,
      reason: "Missed due to fatigue — skip this session, reduce intensity 15% for remainder of week",
    };
  }

  // Too many consecutive misses
  if (consecutiveMissed >= config.maxConsecutiveMissesBeforeExtend) {
    const isNearEnd = weekNumber > totalWeeks - 2;
    return {
      action: "regress",
      intensityAdjustment: 0.85,
      extendProgram: !isNearEnd,
      reason: `${consecutiveMissed} consecutive sessions missed — regress and ${isNearEnd ? "finish strong" : "extend program"}`,
    };
  }

  // Key session was missed - try to make it up
  if (wasKeySession && daysSinceMissed <= 3) {
    return {
      action: "repeat",
      intensityAdjustment: 1 - baseIntensityReduction,
      extendProgram: false,
      reason: `Key session missed ${daysSinceMissed} days ago — repeat it before moving on`,
    };
  }

  // Multiple misses this week
  if (missedThisWeek >= 2) {
    return {
      action: "skip_and_adjust",
      intensityAdjustment: 0.9,
      extendProgram: false,
      reason: `${missedThisWeek} sessions missed this week — consolidate remaining sessions`,
    };
  }

  // Standard case: recent miss, schedule conflict or motivation
  if (daysSinceMissed <= 2) {
    return {
      action: "resume",
      intensityAdjustment: 1.0,
      extendProgram: false,
      reason: "Recent miss — resume normal programming",
    };
  }

  if (daysSinceMissed <= config.maxDaysBeforeRegress) {
    return {
      action: "resume",
      intensityAdjustment: 1 - baseIntensityReduction,
      extendProgram: false,
      reason: `${daysSinceMissed} days since last session — resume at ${Math.round((1 - baseIntensityReduction) * 100)}% intensity`,
    };
  }

  // Long break
  return {
    action: "repeat",
    intensityAdjustment: 0.85,
    extendProgram: daysSinceMissed > 10,
    reason: `${daysSinceMissed} days away — repeat last session at reduced intensity`,
  };
}
