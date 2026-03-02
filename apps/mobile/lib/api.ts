import { fetchWithTimeout } from "./fetch-with-timeout";
import { API_URL, FETCH_TIMEOUT_MS } from "./constants";

// Response types
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

// Exercise types
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

// Program types
export interface Program {
  id: string;
  name: string;
  description?: string;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  level: "beginner" | "intermediate" | "advanced";
  template: {
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
  };
  createdAt: string;
  updatedAt: string;
}

// Training block types
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

// Workout types
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
    exercise?: {
      id: string;
      name: string;
      equipment: string[];
      primaryMuscles: string[];
    };
  }[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  createdAt: string;
  updatedAt: string;
}

// Workout log types
export interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
  weekNumber?: number;
  dayNumber?: number;
  exerciseCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LoggedSet {
  id: string;
  workoutLogId?: string;
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

// User types
export interface User {
  id: string;
  clerkId: string;
  email: string;
  trainingLevel: "beginner" | "intermediate" | "advanced";
  primaryGoal: "strength" | "hypertrophy" | "conditioning";
  preferences: Record<string, unknown>;
  onboardingComplete?: boolean;
  baselineComplete?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Calibration / onboarding types
export type CalibrationPath = "barbell" | "dumbbell" | "bodyweight" | "skip";
export type BaselineMethod = "known_maxes" | "calibration" | "conservative_start";
export type BaselineSource = "user_input" | "calibration" | "inferred";

export interface CalibrationExercise {
  pattern: string;
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

export interface UserBaseline {
  id: string;
  userId: string;
  exerciseId: string;
  baselineWeight: number;
  baselineReps: number;
  estimatedE1RM?: number;
  source: BaselineSource;
  establishedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Decision types (matches @gymapp/types DecisionType)
export type DecisionType =
  | "load_progression"
  | "volume_adjustment"
  | "deload_recommendation"
  | "exercise_rotation"
  | "session_recovery"
  | "missed_session"
  | "weekly_plan_update";

export type DecisionOutcome = "followed" | "overridden" | "ignored";

export type OverrideReason =
  | "felt_too_heavy"
  | "felt_too_light"
  | "equipment_unavailable"
  | "time_constraint"
  | "injury_concern"
  | "other";

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

// Analytics types
export interface VolumeWeekData {
  weekStart: string;
  totalVolume: number;
  workoutCount: number;
  setCount: number;
}

export interface AnalyticsSummary {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  averageRpe: number | null;
  averageDuration: number | null;
  currentStreak: number;
  lastWorkout: string | null;
}

export interface ExerciseProgressSession {
  date: string;
  bestWeight: number;
  bestVolume: number;
  totalSets: number;
  avgRpe: number | null;
}

// Readiness types
export interface ReadinessResult {
  score: number;
  recommendation: string;
  adjustments: string[];
}

// Load recommendation types
export interface LoadRecommendation {
  exerciseId: string;
  action: "increase" | "maintain" | "decrease";
  currentWeight: number;
  recommendedWeight: number;
  reason: string;
  confidence: string;
}

// Week generation types
export interface GenerateWeekResponse {
  workouts: Workout[];
  decisions: { id: string; type: string; reasoning: string }[];
  weekNumber: number;
  isDeloadWeek: boolean;
  summary: string;
}

// Standalone workout types
export interface StandaloneWorkout {
  id: string;
  userId: string;
  name?: string;
  scheduledDate: string;
  focusMuscles: string[];
  exercises: {
    exerciseId: string;
    sets: number;
    repRange: [number, number];
    restSeconds: number;
    targetWeight?: number;
    notes?: string;
  }[];
  status: "pending" | "in_progress" | "completed" | "skipped";
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GenerateStandaloneWorkoutResponse {
  workout: StandaloneWorkout;
  reasoning: string[];
  estimatedDuration: number;
}

// ─── API Client ────────────────────────────────────────────────────────────

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Create a scoped client with the given token.
   * Does not mutate the original — safe for concurrent use.
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

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetchWithTimeout(
      url,
      { ...options, headers },
      FETCH_TIMEOUT_MS
    );

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        error: `HTTP ${response.status}`,
      }));
      throw new ApiRequestError(
        error.error || `HTTP ${response.status}`,
        response.status
      );
    }

    return response.json();
  }

  /**
   * Raw request for the offline provider's dynamic endpoint construction.
   * Returns the raw Response for status code inspection.
   */
  async rawRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return fetchWithTimeout(url, { ...options, headers }, FETCH_TIMEOUT_MS);
  }

  // ─── Exercises (public) ────────────────────────────────────────────────

  async getExercises(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    difficulty?: string;
    equipment?: string;
    muscleGroup?: string;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.offset) searchParams.set("offset", String(params.offset));
    if (params?.search) searchParams.set("search", params.search);
    if (params?.difficulty) searchParams.set("difficulty", params.difficulty);
    if (params?.equipment) searchParams.set("equipment", params.equipment);
    if (params?.muscleGroup) searchParams.set("muscleGroup", params.muscleGroup);

    const query = searchParams.toString();
    return this.request<PaginatedResponse<Exercise>>(
      `/api/exercises${query ? `?${query}` : ""}`
    );
  }

  async getExercise(id: string) {
    return this.request<ApiResponse<Exercise>>(`/api/exercises/${id}`);
  }

  async getExerciseSubstitutes(
    exerciseId: string,
    params?: { limit?: number; equipment?: string[] }
  ) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.equipment?.length)
      searchParams.set("equipment", params.equipment.join(","));

    const query = searchParams.toString();
    return this.request<ExerciseSubstitutesResponse>(
      `/api/exercises/${exerciseId}/substitutes${query ? `?${query}` : ""}`
    );
  }

  // ─── Programs (public) ────────────────────────────────────────────────

  async getPrograms(params?: { goal?: string; level?: string }) {
    const searchParams = new URLSearchParams();
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

  // ─── Training Blocks (protected) ──────────────────────────────────────

  async pauseTrainingBlock(blockId: string) {
    return this.request<ApiResponse<TrainingBlock>>(
      `/api/workouts/training-blocks/${blockId}`,
      { method: "PATCH", body: JSON.stringify({ status: "paused" }) }
    );
  }

  async createTrainingBlock(data: {
    id: string;
    userId: string;
    programId: string;
    startDate: string;
  }) {
    return this.request<ApiResponse<TrainingBlock>>(
      "/api/workouts/training-blocks",
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  // ─── Workouts (protected) ─────────────────────────────────────────────

  async getTodaysWorkout() {
    return this.request<ApiResponse<Workout | null>>("/api/workouts/today");
  }

  async getWorkout(workoutId: string) {
    return this.request<ApiResponse<Workout>>(`/api/workouts/${workoutId}`);
  }

  async getWorkouts(params: { trainingBlockId: string }) {
    const searchParams = new URLSearchParams();
    searchParams.set("trainingBlockId", params.trainingBlockId);
    return this.request<ApiResponse<Workout[]>>(
      `/api/workouts?${searchParams}`
    );
  }

  async updateWorkout(id: string, data: { status: Workout["status"] }) {
    return this.request<ApiResponse<Workout>>(`/api/workouts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async generateWeek(
    trainingBlockId: string,
    options?: { forceDeload?: boolean }
  ) {
    return this.request<ApiResponse<GenerateWeekResponse>>(
      `/api/workouts/training-blocks/${trainingBlockId}/generate-week`,
      { method: "POST", body: JSON.stringify(options ?? {}) }
    );
  }

  // ─── Workout Logs (protected) ─────────────────────────────────────────

  async getWorkoutLogs(params?: { limit?: number; workoutId?: string }) {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.workoutId) searchParams.set("workoutId", params.workoutId);

    return this.request<ApiResponse<WorkoutLog[]>>(
      `/api/logs?${searchParams}`
    );
  }

  async getWorkoutLog(logId: string) {
    return this.request<ApiResponse<WorkoutLogWithSets>>(`/api/logs/${logId}`);
  }

  async createWorkoutLog(data: {
    workoutId: string;
    userId: string;
    startedAt: string;
  }) {
    return this.request<ApiResponse<WorkoutLog>>("/api/logs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async completeWorkoutLog(
    logId: string,
    data: { overallRpe?: number; notes?: string }
  ) {
    return this.request<ApiResponse<WorkoutLog>>(
      `/api/logs/${logId}/complete`,
      { method: "PATCH", body: JSON.stringify(data) }
    );
  }

  // ─── Sets (protected) ─────────────────────────────────────────────────

  async createLoggedSet(
    logId: string,
    data: {
      exerciseId: string;
      setNumber: number;
      weight: number;
      reps: number;
      rpe?: number;
      notes?: string;
    }
  ) {
    return this.request<ApiResponse<LoggedSet>>(`/api/logs/${logId}/sets`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateLoggedSet(
    logId: string,
    setId: string,
    data: { weight?: number; reps?: number; rpe?: number | null }
  ) {
    return this.request<ApiResponse<LoggedSet>>(
      `/api/logs/${logId}/sets/${setId}`,
      { method: "PATCH", body: JSON.stringify(data) }
    );
  }

  async deleteLoggedSet(logId: string, setId: string) {
    return this.request<{ message: string }>(
      `/api/logs/${logId}/sets/${setId}`,
      { method: "DELETE" }
    );
  }

  // ─── Users (protected) ────────────────────────────────────────────────

  async getCurrentUser() {
    return this.request<
      ApiResponse<User & { activeTrainingBlock?: TrainingBlock }>
    >("/api/users/me");
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

  // ─── Onboarding / Calibration (protected) ──────────────────────────────

  async getCalibrationPlan(userId: string, equipment: string[]) {
    const equipmentStr = equipment.join(",");
    return this.request<ApiResponse<CalibrationPlanResponse>>(
      `/api/users/${userId}/calibration-plan?equipment=${equipmentStr}`
    );
  }

  async saveUserBaselines(
    userId: string,
    baselines: { exerciseId: string; weight: number; reps: number; source: BaselineSource }[]
  ) {
    return this.request<ApiResponse<UserBaseline[]>>(
      `/api/users/${userId}/baselines`,
      { method: "POST", body: JSON.stringify({ baselines }) }
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

  // ─── Readiness (protected) ────────────────────────────────────────────

  async submitReadiness(data: {
    userId: string;
    workoutId: string;
    sleepQuality: number;
    muscleSoreness: number;
    stressLevel: number;
    energyLevel: number;
  }) {
    return this.request<ApiResponse<ReadinessResult>>(
      "/api/users/readiness/extended",
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  // ─── Decisions (protected) ────────────────────────────────────────────

  async getDecisionHistory(params: { limit?: number }) {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set("limit", String(params.limit));

    return this.request<ApiResponse<Decision[]>>(
      `/api/decisions/history?${searchParams}`
    );
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
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  async getLoadProgression(data: {
    exerciseId: string;
    recentSets: { weight: number; reps: number; rpe?: number }[];
    targetRepRange: [number, number];
    currentWeight: number;
  }) {
    return this.request<ApiResponse<LoadRecommendation>>(
      "/api/decisions/load-progression",
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  // ─── Standalone Workouts (protected) ──────────────────────────────────

  async generateStandaloneWorkout(data: {
    scheduledDate: string;
    focusMuscles: string[];
    name?: string;
    sessionDurationMinutes?: number;
  }) {
    return this.request<ApiResponse<GenerateStandaloneWorkoutResponse>>(
      "/api/standalone-workouts/generate",
      { method: "POST", body: JSON.stringify(data) }
    );
  }

  async getStandaloneWorkout(id: string) {
    return this.request<ApiResponse<StandaloneWorkout>>(
      `/api/standalone-workouts/${id}`
    );
  }

  async startStandaloneWorkout(id: string) {
    return this.request<ApiResponse<StandaloneWorkout>>(
      `/api/standalone-workouts/${id}/start`,
      { method: "POST" }
    );
  }

  async completeStandaloneWorkout(id: string) {
    return this.request<ApiResponse<StandaloneWorkout>>(
      `/api/standalone-workouts/${id}/complete`,
      { method: "POST" }
    );
  }

  // ─── Analytics (protected) ────────────────────────────────────────────

  async getAnalyticsSummary() {
    return this.request<ApiResponse<AnalyticsSummary>>(
      "/api/analytics/summary"
    );
  }

  async getVolumeAnalytics(weeks = 8) {
    return this.request<ApiResponse<{ weeks: VolumeWeekData[] }>>(
      `/api/analytics/volume?weeks=${weeks}`
    );
  }

  async getExerciseProgress(
    exerciseId: string,
    userId: string,
    limit = 10
  ) {
    return this.request<ApiResponse<{ sessions: ExerciseProgressSession[] }>>(
      `/api/analytics/exercise/${exerciseId}/progress?userId=${userId}&limit=${limit}`
    );
  }
}

// Custom error class with status code
export class ApiRequestError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export const api = new ApiClient(API_URL);
