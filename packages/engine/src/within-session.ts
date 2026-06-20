/**
 * Within-session, set-by-set load adjustment.
 *
 * The rest of the engine is *cross-session* (log a session → advice for next
 * week). This function is the *live coach*: given the set the athlete just
 * finished, it prescribes the next set's load and — when a set clears the
 * planned weight at a sustainable effort — flags that next session's baseline
 * should be seeded from the achieved weight, not the planned one.
 *
 * See `docs/plans/issue-4-within-session.md` for the signed-off decision table.
 */

/**
 * One set the athlete just completed, in real terms (what they actually did,
 * which may differ from the plan — they might have gone heavier).
 */
export interface WithinSessionInput {
  completedSet: { weight: number; reps: number; rpe?: number };
  targetRepRange: [number, number];
  /** The session's planned working weight for this exercise. */
  plannedWeight: number;
  /** Sets remaining AFTER this one (0 = this was the last set). */
  remainingSets: number;
  /** Overrides `config.targetRpe` for this exercise/set when supplied. */
  targetRpe?: number;
}

/** Kept identical to {@link LoadDecision} for substitutability (LSP). */
export type WithinSessionAction = "increase" | "maintain" | "decrease";

export interface WithinSessionDecision {
  action: WithinSessionAction;
  /** Prescribed load for the next set (advisory if `remainingSets === 0`). */
  nextSetWeight: number;
  reason: string;
  /**
   * Present when the completed set cleared the planned weight at RPE ≤
   * `config.baselineMaxRpe` and held rep quality — i.e. a real mid-session PR
   * that should seed next session's `calculateLoadProgression` baseline.
   */
  newBaselineIfConfirmed?: { weight: number; reps: number };
}

export interface WithinSessionConfig {
  /** Prescribed effort for a working set; the deviation anchor. */
  targetRpe: number;
  /** Reported RPE this far (or more) BELOW target makes an increase eligible. */
  increaseRpeGap: number;
  /** Reported RPE this far (or more) ABOVE target triggers a decrease. */
  reduceRpeGap: number;
  smallIncrement: number;
  largeIncrement: number;
  weightThresholdForLargeIncrement: number;
  /** Max RPE at which an above-plan set is allowed to confirm a new baseline. */
  baselineMaxRpe: number;
}

/**
 * Defaults grounded in autoregulation literature: working sets live at RPE 7–9,
 * so target 8 (top of the band); a ±2 RPE deviation is the standard "adjust the
 * load" trigger (prescribed 8 / reported 10 → reduce; reported ≤6 → push). The
 * increment mirrors `calculateLoadProgression` so within- and cross-session
 * steps are consistent. See the plan doc for sources.
 */
export const defaultWithinSessionConfig: WithinSessionConfig = {
  targetRpe: 8,
  increaseRpeGap: 2,
  reduceRpeGap: 2,
  smallIncrement: 2.5,
  largeIncrement: 5,
  weightThresholdForLargeIncrement: 50,
  baselineMaxRpe: 8,
};

/**
 * Prescribe the next set's load from the set just completed.
 *
 * Decision order (RPE-driven when RPE is present, reps-only fallback otherwise):
 * 1. Below min reps OR RPE ≥ target+reduceRpeGap → decrease.
 * 2. RPE ≤ target−increaseRpeGap AND hit top of rep range → increase.
 * 3. RPE exactly target+1 while hitting top → maintain ("hold" — reason explains
 *    we don't add load yet despite the reps).
 * 4. Otherwise → maintain.
 *
 * Pure: depends only on its arguments.
 */
export function calculateWithinSessionAdjustment(
  input: WithinSessionInput,
  config: WithinSessionConfig = defaultWithinSessionConfig
): WithinSessionDecision {
  const { completedSet, targetRepRange, plannedWeight, remainingSets } = input;
  const [minReps, maxReps] = targetRepRange;
  const targetRpe = input.targetRpe ?? config.targetRpe;
  const { weight, reps, rpe } = completedSet;

  const increment =
    weight < config.weightThresholdForLargeIncrement
      ? config.smallIncrement
      : config.largeIncrement;

  const hitTopReps = reps >= maxReps;
  const belowMinReps = reps < minReps;

  // A mid-session PR: cleared the planned weight at a sustainable effort while
  // holding rep quality. Computed independently of the next-set action so it is
  // surfaced even on the last set (remainingSets === 0).
  const newBaselineIfConfirmed =
    weight > plannedWeight && rpe !== undefined && rpe <= config.baselineMaxRpe && !belowMinReps
      ? { weight, reps }
      : undefined;

  const lastSetNote = remainingSets === 0 ? " (last set — applies next time)" : "";
  const withBaseline = (decision: WithinSessionDecision): WithinSessionDecision =>
    newBaselineIfConfirmed ? { ...decision, newBaselineIfConfirmed } : decision;

  // Reps-only fallback when no RPE was reported — stay conservative, since we
  // cannot confirm the set was easy.
  if (rpe === undefined) {
    if (belowMinReps) {
      return withBaseline({
        action: "decrease",
        nextSetWeight: Math.max(0, weight - increment),
        reason: `${reps} reps, below the ${minReps}–${maxReps} target — reduce load${lastSetNote}`,
      });
    }
    return withBaseline({
      action: "maintain",
      nextSetWeight: weight,
      reason: `${reps} reps logged with no RPE — hold load${lastSetNote}`,
    });
  }

  // Decrease: grinding (RPE at/above the reduce gap) or missed the rep floor.
  if (rpe >= targetRpe + config.reduceRpeGap || belowMinReps) {
    const why = belowMinReps
      ? `${reps} reps at RPE ${rpe}, below the ${minReps}–${maxReps} target`
      : `RPE ${rpe} (target ${targetRpe}) — grinding`;
    return withBaseline({
      action: "decrease",
      nextSetWeight: Math.max(0, weight - increment),
      reason: `${why} — reduce load${lastSetNote}`,
    });
  }

  // Increase: came in clearly under target effort AND cleared the rep range.
  if (rpe <= targetRpe - config.increaseRpeGap && hitTopReps) {
    return withBaseline({
      action: "increase",
      nextSetWeight: weight + increment,
      reason: `${reps} reps at RPE ${rpe} (target ${targetRpe}) — room to add load${lastSetNote}`,
    });
  }

  // Hold: hit the reps but RPE is already a notch above target — keep the weight
  // rather than chase reps into a grind.
  if (rpe > targetRpe && hitTopReps) {
    return withBaseline({
      action: "maintain",
      nextSetWeight: weight,
      reason: `${reps} reps at RPE ${rpe} — hold load before adding${lastSetNote}`,
    });
  }

  return withBaseline({
    action: "maintain",
    nextSetWeight: weight,
    reason: `${reps} reps at RPE ${rpe} (target ${targetRpe}) — on target, maintain${lastSetNote}`,
  });
}
