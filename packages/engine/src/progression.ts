import type { CyclePhase, CyclePhaseConfig, EquipmentInstance, LoadDecision } from "@gymapp/types";
import type { ProgressionInput } from "./types";
import { calculateWorkingWeight, estimateOneRepMax, roundToHalfKg } from "./estimation";

/**
 * Snap a target weight DOWN to a load the given machine can actually make.
 *
 * Achievable weights are `{ minWeight + k·incrementConstraint : k ≥ 0 }`. We
 * round DOWN (signed-off default) so the engine never prescribes a weight the
 * machine can't load — prescribing an unachievable-high weight forces the
 * athlete to guess, which is worse than a hair lighter. No constraint → no-op.
 *
 * The `* 1000` round kills floating-point drift from the multiply (the result
 * is a real plate weight, not an arbitrary float).
 */
function snapDownToEquipment(target: number, equipment: EquipmentInstance): number {
  const min = equipment.minWeight ?? 0;
  const inc = equipment.incrementConstraint;
  if (inc === undefined || inc <= 0) return target;
  if (target <= min) return min;
  const steps = Math.floor((target - min) / inc);
  return Math.round((min + steps * inc) * 1000) / 1000;
}

/**
 * Apply the machine's increment constraint to a decision's `newWeight`. Runs
 * LAST (after cycle-phase scaling) — it is the physical reality of the
 * equipment, applied to whatever load the other axes settled on. Annotates the
 * reason only when the snap actually changed the weight.
 *
 * Pure: depends only on its arguments.
 */
function applyEquipmentSnap(decision: LoadDecision, equipment: EquipmentInstance): LoadDecision {
  const snapped = snapDownToEquipment(decision.newWeight, equipment);
  if (snapped === decision.newWeight) return decision;
  return {
    ...decision,
    newWeight: snapped,
    reason: `${decision.reason} (snapped to ${snapped}kg for this machine)`,
  };
}

/**
 * Default per-phase load modifiers for cycle-phase load modification.
 *
 * WHY these values: the strongest reviews find no/weak influence of cycle phase
 * on strength (poor phase-detection methodology), so this is an opt-in,
 * overridable tool — not a performance claim. The ENFORCED lever is the
 * `allowNewWeightTests` veto (a conservative no-new-max choice during menses);
 * the `loadModifier` % is an advisory soft default. Where a directional signal
 * exists it matches these defaults: early follicular [≈ menses] is "unfavorable
 * for all strength classes" → menstrual hold + no new maxes (0.90, false);
 * late follicular/ovulatory = best for strength (estrogen) → progress freely
 * (1.00, true); luteal = progesterone fatigue, "lower load" proposed → a mild
 * conservative taper (0.95, true). Overridable per athlete (some exceed the
 * menstrual hold at high readiness).
 */
export const defaultCyclePhaseConfig: Record<
  CyclePhase,
  { loadModifier: number; allowNewWeightTests: boolean }
> = {
  menstrual: { loadModifier: 0.9, allowNewWeightTests: false },
  follicular: { loadModifier: 1.0, allowNewWeightTests: true },
  ovulatory: { loadModifier: 1.0, allowNewWeightTests: true },
  luteal: { loadModifier: 0.95, allowNewWeightTests: true },
};

/**
 * Apply a resolved cycle-phase protocol to a load decision.
 *
 * Sits AFTER self-tuning and the core branch (see {@link calculateLoadProgression}
 * precedence). Two effects, in order:
 * 1. Increase-veto: when `allowNewWeightTests === false`, an earned `increase`
 *    is demoted to `maintain` and pinned to the current weight (no new max).
 * 2. Load scale: the surviving action's `newWeight` is scaled by `loadModifier`
 *    (a hold/reduce factor ≤ 1), rounded to 0.5kg. A `loadModifier` of 1 is a
 *    no-op (no re-rounding).
 *
 * The `reason` is rewritten so it agrees with the prescribed weight — e.g. a
 * vetoed increase under menstrual 0.90 is "no new weight tests, load held at
 * 90%", not the (false) "holding load" that contradicts the 10% cut.
 *
 * Pure: depends only on its arguments.
 */
function applyCyclePhase(
  decision: LoadDecision,
  cyclePhase: CyclePhaseConfig,
  currentWeight: number
): LoadDecision {
  const { phase, dayOfPhase, loadModifier, allowNewWeightTests } = cyclePhase;
  let { action, newWeight, reason } = decision;

  // Increase-veto runs first so aggressive self-tuning can't leak an increase
  // past a phase that forbids new weight tests.
  const vetoed = action === "increase" && !allowNewWeightTests;
  if (vetoed) {
    action = "maintain";
    newWeight = currentWeight;
  }

  // Scale only when the modifier actually changes the load (avoids re-rounding
  // an already-quantized weight when loadModifier === 1).
  const scaledWeight = loadModifier !== 1 ? roundToHalfKg(newWeight * loadModifier) : newWeight;
  const pct = Math.round(loadModifier * 100);
  const phaseLabel = dayOfPhase ? `${phase} phase (day ${dayOfPhase})` : `${phase} phase`;

  // Keep the explanation honest about both the veto and the load level.
  if (vetoed) {
    reason =
      loadModifier !== 1
        ? `${phaseLabel} — no new weight tests, load held at ${pct}%`
        : `${phaseLabel} — no new weight tests`;
  } else if (loadModifier !== 1) {
    reason = `${reason} (${phaseLabel}: load at ${pct}%)`;
  }

  return { action, newWeight: scaledWeight, reason };
}

/**
 * Configuration for load progression decisions
 */
export interface ProgressionConfig {
  rpeThresholdForIncrease: number;
  rpeThresholdForDecrease: number;
  smallIncrement: number;
  largeIncrement: number;
  weightThresholdForLargeIncrement: number;
}

const defaultConfig: ProgressionConfig = {
  rpeThresholdForIncrease: 8,
  rpeThresholdForDecrease: 9,
  smallIncrement: 2.5,
  largeIncrement: 5,
  weightThresholdForLargeIncrement: 50,
};

/**
 * Self-tuning constants for {@link applyProgressionModifier}.
 *
 * These translate the scalar modifier from `getProgressionModifier`
 * (0.8 conservative / 1.0 no-op / 1.1 aggressive) into a tuned config.
 * They are isolated and named so the mapping is reviewable and retunable
 * without touching the translation logic. See
 * `docs/plans/decision-self-tuning.md` for the rationale.
 */

/**
 * RPE-threshold nudge applied to `rpeThresholdForIncrease` when tuning.
 * Conservative modifiers subtract it (progress sooner is harder),
 * aggressive modifiers add it. Kept small so tuning stays in-window.
 */
const RPE_THRESHOLD_NUDGE = 0.5;

/**
 * Clamp bounds for `rpeThresholdForIncrease`. The evidence-based working
 * range is RPE 7-9; RPE 6 is below the useful progression range, so the
 * floor is 7.
 */
const MIN_RPE_THRESHOLD_FOR_INCREASE = 7;
const MAX_RPE_THRESHOLD_FOR_INCREASE = 9;

/**
 * Lower clamp for tuned increments, in kg. Matches the smallest practical
 * real-world plate jump (microplates), so a conservative modifier never
 * produces a sub-practical increment.
 */
const MIN_INCREMENT = 1.0;

/**
 * Upper clamp multiplier for tuned increments, relative to each increment's
 * default. Bounds the worst case of an aggressive modifier to 2x default.
 */
const MAX_INCREMENT_MULTIPLE_OF_DEFAULT = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Translate a scalar progression modifier into a tuned {@link ProgressionConfig}.
 *
 * Semantics (see `docs/plans/decision-self-tuning.md` tuning table):
 * - `modifier === 1.0` → returns the config unchanged (exact no-op).
 * - increments are scaled by `modifier`, then clamped to
 *   `[MIN_INCREMENT, MAX_INCREMENT_MULTIPLE_OF_DEFAULT × default]`.
 * - `rpeThresholdForIncrease` is nudged ∓`RPE_THRESHOLD_NUDGE`
 *   (conservative lowers it, aggressive raises it), then clamped to
 *   `[MIN_RPE_THRESHOLD_FOR_INCREASE, MAX_RPE_THRESHOLD_FOR_INCREASE]`.
 * - `rpeThresholdForDecrease` and `weightThresholdForLargeIncrement` are
 *   left untouched.
 *
 * Pure: depends only on its arguments.
 *
 * @param modifier - Scalar from `getProgressionModifier` (0.8 | 1.0 | 1.1)
 * @param config - Base config to tune (defaults to the module default)
 * @returns A tuned config (a new object; never mutates the input)
 */
export function applyProgressionModifier(
  modifier: number,
  config: ProgressionConfig = defaultConfig
): ProgressionConfig {
  // Exact no-op preserves cold-start behavior byte-for-byte.
  if (modifier === 1.0) {
    return config;
  }

  const rpeDelta = modifier < 1 ? -RPE_THRESHOLD_NUDGE : RPE_THRESHOLD_NUDGE;

  return {
    ...config,
    smallIncrement: clamp(
      config.smallIncrement * modifier,
      MIN_INCREMENT,
      defaultConfig.smallIncrement * MAX_INCREMENT_MULTIPLE_OF_DEFAULT
    ),
    largeIncrement: clamp(
      config.largeIncrement * modifier,
      MIN_INCREMENT,
      defaultConfig.largeIncrement * MAX_INCREMENT_MULTIPLE_OF_DEFAULT
    ),
    rpeThresholdForIncrease: clamp(
      config.rpeThresholdForIncrease + rpeDelta,
      MIN_RPE_THRESHOLD_FOR_INCREASE,
      MAX_RPE_THRESHOLD_FOR_INCREASE
    ),
  };
}

/**
 * Calculate whether to increase, maintain, or decrease weight
 * based on recent set performance.
 *
 * Cycle phase and self-tuning are ORTHOGONAL axes that compose without
 * colliding: self-tuning flows through `config` (how aggressive the
 * increment/threshold are) while cycle phase flows through `input.cyclePhase`
 * (whether an increase is allowed and how the target is scaled). When
 * `input.cyclePhase` is absent, the result is byte-identical to the pre-cycle
 * behavior.
 *
 * Precedence: self-tuning(config) → core branch → cycle increase-veto →
 * cycle loadModifier scale. The increase-veto sits AFTER tuning so that
 * aggressive self-tuning can never leak an `increase` past a phase that forbids
 * new weight tests (e.g. a menstrual hold).
 */
export function calculateLoadProgression(
  input: ProgressionInput,
  config: ProgressionConfig = defaultConfig
): LoadDecision {
  const {
    recentSets,
    currentWeight,
    targetRepRange,
    baselineWeight,
    baselineReps,
    cyclePhase,
    equipment,
  } = input;
  const [minReps, maxReps] = targetRepRange;

  // Finalize a core decision through the post-processing axes, in precedence
  // order: cycle-phase (veto + load scale) → equipment snap (physical reality,
  // last). Each guard keeps an absent axis byte-identical to pre-axis behavior.
  const finalize = (decision: LoadDecision): LoadDecision => {
    const afterCycle = cyclePhase
      ? applyCyclePhase(decision, cyclePhase, currentWeight)
      : decision;
    return equipment ? applyEquipmentSnap(afterCycle, equipment) : afterCycle;
  };

  // When no recent sets, prefer this machine's confirmed working weight, then a
  // supplied baseline, then hold the current weight.
  if (recentSets.length === 0) {
    if (equipment?.confirmedWorkingWeight !== undefined) {
      return finalize({
        action: "maintain",
        newWeight: equipment.confirmedWorkingWeight,
        reason: `Using confirmed working weight on this machine (${equipment.confirmedWorkingWeight}kg)`,
      });
    }

    if (baselineWeight !== undefined && baselineReps !== undefined) {
      // Calculate working weight from baseline for target rep range
      const targetReps = Math.floor((minReps + maxReps) / 2);
      const e1rm = estimateOneRepMax(baselineWeight, baselineReps);
      const workingWeight = calculateWorkingWeight(e1rm, targetReps);

      return finalize({
        action: "maintain",
        newWeight: workingWeight,
        reason: `Using baseline weight as starting point (${baselineWeight}×${baselineReps} → ${workingWeight}kg for ${targetReps} reps)`,
      });
    }

    return finalize({
      action: "maintain",
      newWeight: currentWeight,
      reason: "No recent data to base decision on",
    });
  }

  // Calculate average reps and RPE from recent sets
  const avgReps = recentSets.reduce((sum, s) => sum + s.reps, 0) / recentSets.length;
  const setsWithRpe = recentSets.filter((s) => s.rpe !== undefined);
  const avgRpe =
    setsWithRpe.length > 0
      ? setsWithRpe.reduce((sum, s) => sum + s.rpe!, 0) / setsWithRpe.length
      : 7; // Default assumption

  const increment =
    currentWeight < config.weightThresholdForLargeIncrement
      ? config.smallIncrement
      : config.largeIncrement;

  // Decision logic
  if (avgReps >= maxReps && avgRpe < config.rpeThresholdForIncrease) {
    // Hitting top of rep range with room to spare → increase
    return finalize({
      action: "increase",
      newWeight: currentWeight + increment,
      reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — ready to progress`,
    });
  }

  if (avgReps < minReps || avgRpe > config.rpeThresholdForDecrease) {
    // Below rep range or grinding → decrease
    return finalize({
      action: "decrease",
      newWeight: Math.max(0, currentWeight - increment),
      reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — reduce load to maintain quality`,
    });
  }

  return finalize({
    action: "maintain",
    newWeight: currentWeight,
    reason: `Averaging ${avgReps.toFixed(1)} reps at RPE ${avgRpe.toFixed(1)} — on track, maintain load`,
  });
}
