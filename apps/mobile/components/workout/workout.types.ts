export interface LoggedSet {
  id?: string;
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  completed: boolean;
  skipped?: boolean;
}

export interface ExerciseProgress {
  exerciseId: string;
  exerciseName: string;
  plannedSets: number;
  repRange: [number, number];
  restSeconds: number;
  sets: LoggedSet[];
  lastPerformance?: {
    weight: number;
    reps: number;
    rpe?: number;
  };
}

export interface LoadRecommendation {
  exerciseId: string;
  action: "increase" | "maintain" | "decrease";
  newWeight: number;
  reason: string;
}

/**
 * Live per-set coaching shown during rest, produced from the set just completed.
 * Mirrors the engine's WithinSessionDecision plus the UI anchor (`previousWeight`,
 * `setIndex`) and the persisted `decisionId` (for accept/override in a later PR).
 */
export interface WithinSessionSuggestion {
  exerciseId: string;
  exerciseIndex: number;
  setIndex: number;
  action: "increase" | "maintain" | "decrease";
  nextSetWeight: number;
  previousWeight: number;
  reason: string;
  decisionId: string | null;
  newBaselineIfConfirmed?: { weight: number; reps: number };
}
