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
