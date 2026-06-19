import { z } from "zod";
import type { MovementPattern } from "@gymapp/types";
import type { CalibrationPath } from "@gymapp/types";

// Server-side (Docker): use internal service name; Client-side (browser): use public URL
export const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.API_URL_INTERNAL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

// Enums for validation matching TypeScript types
const decisionTypes = [
  "load_progression",
  "volume_adjustment",
  "deload_recommendation",
  "exercise_rotation",
  "session_recovery",
  "missed_session",
  "weekly_plan_update",
] as const;

const overrideReasons = [
  "felt_too_heavy",
  "felt_too_light",
  "equipment_unavailable",
  "time_constraint",
  "injury_concern",
  "other",
] as const;

// Zod schemas for runtime validation
const DecisionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workoutId: z.string().nullable(),
  type: z.enum(decisionTypes),
  input: z.record(z.unknown()),
  output: z.record(z.unknown()),
  reasoning: z.string(),
  createdAt: z.string(),
  outcome: z
    .object({
      status: z.enum(["followed", "overridden", "ignored"]),
      overrideReason: z.enum(overrideReasons).optional(),
      success: z.boolean().nullable(),
      recordedAt: z.string(),
    })
    .nullable()
    .optional(),
});

const WorkoutSchema = z.object({
  id: z.string(),
  trainingBlockId: z.string(),
  scheduledDate: z.string(),
  weekNumber: z.number(),
  dayNumber: z.number(),
  plannedExercises: z.array(
    z.object({
      exerciseId: z.string(),
      sets: z.number(),
      repRange: z.tuple([z.number(), z.number()]),
      restSeconds: z.number(),
      notes: z.string().optional(),
    })
  ),
  status: z.enum(["pending", "in_progress", "completed", "skipped"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const AnalyticsSummarySchema = z.object({
  totalWorkouts: z.number(),
  workoutsThisWeek: z.number(),
  workoutsThisMonth: z.number(),
  averageRpe: z.number().nullable(),
  averageDuration: z.number().nullable(),
  currentStreak: z.number(),
  lastWorkout: z.string().nullable(),
});

// Validation helper - logs warnings but falls back to unvalidated data
function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown, context: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`API response validation failed for ${context}:`, result.error.issues);
    return data as T; // Fallback for backwards compatibility
  }
  return result.data;
}

function validateArrayResponse<T>(schema: z.ZodSchema<T>, data: unknown[], context: string): T[] {
  return data.map((item, index) => validateResponse(schema, item, `${context}[${index}]`));
}

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
   * Create a scoped client that uses the given token for requests.
   * Does not mutate the original instance — safe for concurrent use.
   */
  withToken(token: string | null): ApiClient {
    const client = new ApiClient(this.baseUrl);
    client.token = token;
    return client;
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

  async generateWeek(trainingBlockId: string, options?: { forceDeload?: boolean }) {
    return this.request<ApiResponse<GenerateWeekResponse>>(
      `/api/workouts/training-blocks/${trainingBlockId}/generate-week`,
      {
        method: "POST",
        body: JSON.stringify(options ?? {}),
      }
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
    const response = await this.request<ApiResponse<Workout[]>>(
      `/api/workouts?${searchParams}`
    );
    return {
      ...response,
      data: validateArrayResponse(WorkoutSchema, response.data || [], "workouts"),
    };
  }

  async updateWorkout(id: string, data: { status: Workout["status"] }) {
    return this.request<ApiResponse<Workout>>(`/api/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Workout Logs
  async getWorkoutLogs(params: { userId?: string; workoutId?: string; limit?: number; offset?: number }) {
    const searchParams = new URLSearchParams();
    if (params.userId) searchParams.set("userId", params.userId);
    if (params.workoutId) searchParams.set("workoutId", params.workoutId);
    if (params.limit) searchParams.set("limit", String(params.limit));
    if (params.offset) searchParams.set("offset", String(params.offset));
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
    const response = await this.request<ApiResponse<Decision[]>>(
      `/api/decisions/history?${searchParams}`
    );
    return {
      ...response,
      data: validateArrayResponse(DecisionSchema, response.data || [], "decisions"),
    };
  }

  async getDecision(id: string) {
    const response = await this.request<ApiResponse<Decision>>(`/api/decisions/${id}`);
    return {
      ...response,
      data: validateResponse(DecisionSchema, response.data, "decision"),
    };
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

  async getCalibrationPlan(userId: string, equipment: string[], goal?: string) {
    const params = new URLSearchParams({ equipment: equipment.join(",") });
    if (goal) params.set("goal", goal);
    return this.request<ApiResponse<CalibrationPlanResponse>>(
      `/api/users/${userId}/calibration-plan?${params.toString()}`
    );
  }

  // Derive baselines from completed calibration test sets. The server runs the
  // engine to pick the best set per exercise and estimate a 1RM.
  async submitCalibrationResults(
    userId: string,
    sets: { exerciseId: string; weight: number; reps: number }[],
    targetReps?: number
  ) {
    return this.request<
      ApiResponse<{
        baselines: UserBaseline[];
        results: { exerciseId: string; baselineWeight: number; baselineReps: number; estimatedE1RM: number }[];
      }>
    >(`/api/users/${userId}/calibration-results`, {
      method: "POST",
      body: JSON.stringify(targetReps ? { sets, targetReps } : { sets }),
    });
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

  // User profile management
  async updateUser(
    userId: string,
    data: {
      trainingLevel?: string;
      primaryGoal?: string;
      preferences?: Record<string, unknown>;
    }
  ) {
    return this.request<ApiResponse<User>>(`/api/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  // Workout log details
  async getWorkoutLog(logId: string) {
    return this.request<ApiResponse<WorkoutLogWithSets>>(`/api/logs/${logId}`);
  }

  async logRetrospectiveWorkout(data: {
    date: string;
    overallRpe?: number;
    notes?: string;
    exercises: {
      exerciseId: string;
      sets: { weight: number; reps: number; rpe?: number }[];
    }[];
  }) {
    return this.request<ApiResponse<WorkoutLog>>("/api/logs/retrospective", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Set management
  async updateSet(
    logId: string,
    setId: string,
    data: { weight?: number; reps?: number; rpe?: number | null }
  ) {
    return this.request<ApiResponse<LoggedSet>>(`/api/logs/${logId}/sets/${setId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteSet(logId: string, setId: string) {
    return this.request<{ message: string }>(`/api/logs/${logId}/sets/${setId}`, {
      method: "DELETE",
    });
  }

  // Analytics
  async getVolumeAnalytics(userId: string, weeks = 12) {
    return this.request<ApiResponse<{ weeks: VolumeWeekData[] }>>(
      `/api/analytics/volume?userId=${userId}&weeks=${weeks}`
    );
  }

  async getPersonalRecords(userId: string) {
    return this.request<ApiResponse<{ records: PersonalRecord[] }>>(
      `/api/analytics/personal-records?userId=${userId}`
    );
  }

  async getExerciseProgress(
    exerciseId: string,
    userId: string,
    limit = 20
  ) {
    return this.request<ApiResponse<{ sessions: ExerciseProgressSession[] }>>(
      `/api/analytics/exercise/${exerciseId}/progress?userId=${userId}&limit=${limit}`
    );
  }

  async getWeeklySummary(userId: string, weekOffset = 0) {
    return this.request<ApiResponse<WeeklySummaryData>>(
      `/api/analytics/weekly-summary?userId=${userId}&weekOffset=${weekOffset}`
    );
  }

  async getAnalyticsSummary(userId: string) {
    const response = await this.request<
      ApiResponse<{
        totalWorkouts: number;
        workoutsThisWeek: number;
        workoutsThisMonth: number;
        averageRpe: number | null;
        averageDuration: number | null;
        currentStreak: number;
        lastWorkout: string | null;
      }>
    >(`/api/analytics/summary?userId=${userId}`);
    return {
      ...response,
      data: validateResponse(AnalyticsSummarySchema, response.data, "analyticsSummary"),
    };
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
  pattern: MovementPattern;
  exerciseId: string;
  exerciseName: string;
}

export interface CalibrationPlanResponse {
  path: CalibrationPath;
  plan: {
    path: CalibrationPath;
    exercises: CalibrationExercise[];
    instructions: string;
  } | null;
  needsCalibration: boolean;
}

export type DecisionType =
  | "load_progression"
  | "volume_adjustment"
  | "deload_recommendation"
  | "exercise_rotation"
  | "session_recovery"
  | "missed_session"
  | "weekly_plan_update";

export const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  load_progression: "Load Progression",
  volume_adjustment: "Volume Adjustment",
  deload_recommendation: "Deload Check",
  exercise_rotation: "Exercise Rotation",
  session_recovery: "Session Recovery",
  missed_session: "Missed Session",
  weekly_plan_update: "Weekly Plan",
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

export interface GenerateWeekResponse {
  workouts: Workout[];
  decisions: { id: string; type: string; reasoning: string }[];
  weekNumber: number;
  isDeloadWeek: boolean;
  summary: string;
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

export interface LoggedSet {
  id: string;
  exerciseId: string;
  setNumber: number;
  weight: number;
  reps: number;
  rpe: number | null;
  notes: string | null;
}

export interface WorkoutLogWithSets extends WorkoutLog {
  sets: LoggedSet[];
}

export interface VolumeWeekData {
  weekStart: string;
  totalVolume: number;
  workoutCount: number;
  setCount: number;
}

export interface PersonalRecord {
  exerciseId: string;
  exerciseName?: string;
  weightPR: { weight: number; reps: number; date: string } | null;
  volumePR: { weight: number; reps: number; volume: number; date: string } | null;
}

export interface ExerciseProgressSession {
  date: string;
  bestWeight: number;
  bestVolume: number;
  totalSets: number;
  avgRpe: number | null;
}

export interface WeeklySummaryData {
  weekStart: string;
  weekEnd: string;
  workoutCount: number;
  totalVolume: number;
  totalSets: number;
  averageRpe: number | null;
  averageDuration: number | null;
  exerciseBreakdown: {
    exerciseId: string;
    totalVolume: number;
    totalSets: number;
    maxWeight: number;
  }[];
  dayBreakdown: {
    day: string;
    workouts: number;
    trained: boolean;
  }[];
  highlights: string[];
}

export const api = new ApiClient(API_BASE_URL);
