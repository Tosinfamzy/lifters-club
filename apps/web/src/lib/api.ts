// Server-side (Docker): use internal service name; Client-side (browser): use public URL
const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface ApiError {
  error: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Set the auth token for subsequent requests
   */
  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    // Add auth header if token is set
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
      }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Exercises
  async getExercises(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    difficulty?: string;
    equipment?: string;
    movementPattern?: string;
    muscleGroup?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.difficulty) searchParams.set("difficulty", params.difficulty);
    if (params?.equipment) searchParams.set("equipment", params.equipment);
    if (params?.movementPattern) searchParams.set("movementPattern", params.movementPattern);
    if (params?.muscleGroup) searchParams.set("muscleGroup", params.muscleGroup);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<Exercise>>(
      `/api/exercises${query ? `?${query}` : ""}`
    );
  }

  async getExercise(id: string) {
    return this.request<ApiResponse<Exercise>>(`/api/exercises/${id}`);
  }

  async searchExercises(term: string) {
    return this.request<ApiResponse<Exercise[]>>(`/api/exercises/search/${encodeURIComponent(term)}`);
  }

  async getExerciseSubstitutes(
    exerciseId: string,
    params?: {
      limit?: number;
      equipment?: string[];
      maxDifficulty?: string;
      exclude?: string[];
    }
  ) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.equipment?.length) searchParams.set("equipment", params.equipment.join(","));
    if (params?.maxDifficulty) searchParams.set("maxDifficulty", params.maxDifficulty);
    if (params?.exclude?.length) searchParams.set("exclude", params.exclude.join(","));

    const query = searchParams.toString();
    return this.request<ExerciseSubstitutesResponse>(
      `/api/exercises/${exerciseId}/substitutes${query ? `?${query}` : ""}`
    );
  }

  // Programs
  async getPrograms(params?: {
    limit?: number;
    offset?: number;
    goal?: string;
    level?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    if (params?.goal) searchParams.set("goal", params.goal);
    if (params?.level) searchParams.set("level", params.level);

    const query = searchParams.toString();
    return this.request<ApiResponse<Program[]>>(
      `/api/programs${query ? `?${query}` : ""}`
    );
  }

  async getProgram(id: string) {
    return this.request<ApiResponse<Program>>(`/api/programs/${id}`);
  }

  async createProgram(data: CreateProgramInput) {
    return this.request<ApiResponse<Program>>("/api/programs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteProgram(id: string) {
    return this.request<{ message: string }>(`/api/programs/${id}`, {
      method: "DELETE",
    });
  }

  async updateProgram(id: string, data: Partial<Omit<Program, 'id' | 'createdAt' | 'updatedAt'>>) {
    return this.request<ApiResponse<Program>>(`/api/programs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Training Blocks
  async getTrainingBlocks(userId: string, status?: string) {
    const searchParams = new URLSearchParams({ userId });
    if (status) searchParams.set("status", status);
    return this.request<ApiResponse<TrainingBlock[]>>(
      `/api/workouts/training-blocks?${searchParams}`
    );
  }

  async createTrainingBlock(data: CreateTrainingBlockInput) {
    return this.request<ApiResponse<TrainingBlock>>("/api/workouts/training-blocks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getTrainingBlock(id: string) {
    return this.request<ApiResponse<{ trainingBlock: TrainingBlock; program: Program }>>(
      `/api/workouts/training-blocks/${id}`
    );
  }

  // Workouts
  async getTodaysWorkout(userId: string) {
    return this.request<ApiResponse<TodaysWorkoutResponse | null>>(
      `/api/workouts/today?userId=${userId}`
    );
  }

  async getRecentWorkouts(userId: string, limit = 10) {
    return this.request<ApiResponse<Workout[]>>(
      `/api/workouts/recent?userId=${userId}&limit=${limit}`
    );
  }

  async getWorkouts(params: {
    userId?: string;
    trainingBlockId?: string;
    status?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params.userId) searchParams.set("userId", params.userId);
    if (params.trainingBlockId) searchParams.set("trainingBlockId", params.trainingBlockId);
    if (params.status) searchParams.set("status", params.status);
    return this.request<ApiResponse<Workout[]>>(
      `/api/workouts?${searchParams}`
    );
  }

  // Workout Logs
  async getWorkoutLogs(params: { userId?: string; workoutId?: string; limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params.userId) searchParams.set("userId", params.userId);
    if (params.workoutId) searchParams.set("workoutId", params.workoutId);
    if (params.limit) searchParams.set("limit", String(params.limit));
    return this.request<ApiResponse<WorkoutLog[]>>(`/api/logs?${searchParams}`);
  }

  // Users
  async getCurrentUser(clerkId: string) {
    return this.request<ApiResponse<User & { activeTrainingBlock?: TrainingBlock }>>(
      `/api/users/me?clerkId=${clerkId}`
    );
  }

  async createUser(data: {
    id: string;
    clerkId: string;
    email: string;
    trainingLevel: string;
    primaryGoal: string;
  }) {
    return this.request<ApiResponse<User>>("/api/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Decisions
  async getDecisionHistory(params: {
    userId: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    const searchParams = new URLSearchParams({ userId: params.userId });
    if (params.type) searchParams.set("type", params.type);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));
    return this.request<ApiResponse<Decision[]>>(
      `/api/decisions/history?${searchParams}`
    );
  }

  async getDecision(id: string) {
    return this.request<ApiResponse<Decision>>(`/api/decisions/${id}`);
  }

  async recordDecisionOutcome(
    decisionId: string,
    data: {
      outcome: DecisionOutcome;
      overrideReason?: OverrideReason;
      actualValue?: Record<string, unknown>;
    }
  ) {
    return this.request<ApiResponse<DecisionOutcomeRecord>>(
      `/api/decisions/${decisionId}/outcome`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  // User Baselines
  async getUserBaselines(userId: string) {
    return this.request<ApiResponse<UserBaseline[]>>(`/api/users/${userId}/baselines`);
  }

  async saveUserBaselines(
    userId: string,
    baselines: { exerciseId: string; weight: number; reps: number; source: "user_input" | "calibration" | "inferred" }[]
  ) {
    return this.request<ApiResponse<UserBaseline[]>>(`/api/users/${userId}/baselines`, {
      method: "POST",
      body: JSON.stringify({ baselines }),
    });
  }

  async getCalibrationPlan(userId: string, equipment: string[]) {
    const equipmentStr = equipment.join(",");
    return this.request<ApiResponse<CalibrationPlanResponse>>(
      `/api/users/${userId}/calibration-plan?equipment=${equipmentStr}`
    );
  }

  async updateOnboardingStatus(
    userId: string,
    data: { onboardingComplete?: boolean; baselineComplete?: boolean }
  ) {
    return this.request<ApiResponse<User>>(`/api/users/${userId}/onboarding`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }
}

// Types
export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  equipment: string[];
  movementPatterns: string[];
  primaryMuscles: string[];
  secondaryMuscles: string[];
  isCompound: boolean;
  isUnilateral: boolean;
  difficulty: "beginner" | "intermediate" | "advanced";
  constraints: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScoredSubstitute {
  exercise: Exercise;
  score: number;
  reasons: string[];
}

export interface ExerciseSubstitutesResponse {
  data: {
    source: Exercise;
    substitutes: ScoredSubstitute[];
  };
}

export interface ProgramTemplate {
  weeks: number;
  sessions: {
    dayNumber: number;
    name: string;
    focus: string[];
    exercises: {
      exerciseId: string;
      sets: number;
      repRange: [number, number];
      restSeconds: number;
      notes?: string;
    }[];
  }[];
}

export interface Program {
  id: string;
  name: string;
  description?: string;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  level: "beginner" | "intermediate" | "advanced";
  template: ProgramTemplate;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProgramInput {
  id: string;
  name: string;
  description?: string;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  level: "beginner" | "intermediate" | "advanced";
  template: ProgramTemplate;
}

export interface CreateTrainingBlockInput {
  id: string;
  userId: string;
  programId: string;
  startDate: string;
}

export interface TrainingBlock {
  id: string;
  userId: string;
  programId: string;
  startDate: string;
  endDate?: string;
  currentWeek: number;
  status: "active" | "completed" | "paused";
  createdAt: string;
  updatedAt: string;
}

export interface Workout {
  id: string;
  trainingBlockId: string;
  scheduledDate: string;
  weekNumber: number;
  dayNumber: number;
  plannedExercises: {
    exerciseId: string;
    sets: number;
    repRange: [number, number];
    restSeconds: number;
    notes?: string;
  }[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  clerkId: string;
  email: string;
  trainingLevel: "beginner" | "intermediate" | "advanced";
  primaryGoal: "strength" | "hypertrophy" | "conditioning";
  preferences: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  userId: string;
  workoutId: string | null;
  type: DecisionType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  reasoning: string;
  createdAt: string;
  outcome?: {
    status: DecisionOutcome;
    overrideReason?: OverrideReason;
    success: boolean | null;
    recordedAt: string;
  } | null;
}

export interface UserBaseline {
  id: string;
  userId: string;
  exerciseId: string;
  baselineWeight: number;
  baselineReps: number;
  estimatedE1RM?: number;
  source: "user_input" | "calibration" | "inferred";
  establishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalibrationExercise {
  pattern: string;
  exerciseId: string;
  exerciseName: string;
}

export interface CalibrationPlanResponse {
  path: "barbell" | "dumbbell" | "bodyweight" | "skip";
  plan: {
    path: string;
    exercises: CalibrationExercise[];
    instructions: string;
  } | null;
  needsCalibration: boolean;
}

export type DecisionType =
  | "load_progression"
  | "volume_adjustment"
  | "deload_check"
  | "exercise_rotation"
  | "session_recovery"
  | "missed_session"
  | "weekly_plan"
  | "performance_trend";

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  load_progression: "Load Progression",
  volume_adjustment: "Volume Adjustment",
  deload_check: "Deload Check",
  exercise_rotation: "Exercise Rotation",
  session_recovery: "Session Recovery",
  missed_session: "Missed Session",
  weekly_plan: "Weekly Plan",
  performance_trend: "Performance Trend",
};

export interface ExerciseDecision {
  exerciseId: string;
  decisionId: string;
  type: DecisionType;
  summary: string;
  reasoning: string;
  confidence: "low" | "medium" | "high";
  recommendedValue: unknown;
}

export interface TodaysWorkoutResponse {
  workout: Workout;
  decisions: ExerciseDecision[];
}

export type OverrideReason =
  | "felt_too_heavy"
  | "felt_too_light"
  | "equipment_unavailable"
  | "time_constraint"
  | "injury_concern"
  | "other";

export const OVERRIDE_REASON_LABELS: Record<OverrideReason, string> = {
  felt_too_heavy: "Felt too heavy",
  felt_too_light: "Felt too light",
  equipment_unavailable: "Equipment unavailable",
  time_constraint: "Time constraint",
  injury_concern: "Injury concern",
  other: "Other reason",
};

export type DecisionOutcome = "followed" | "overridden" | "ignored";

export interface DecisionOutcomeRecord {
  id: string;
  decisionId: string;
  userId: string;
  outcome: DecisionOutcome;
  success: boolean | null;
  overrideReason?: OverrideReason;
  expectedValue?: Record<string, unknown>;
  actualValue?: Record<string, unknown>;
  evaluatedAt?: string;
  createdAt: string;
}

export const api = new ApiClient(API_BASE_URL);
