import { pgSchema, varchar, text, jsonb, integer, timestamp, date, real, boolean, index } from "drizzle-orm/pg-core";

export const training = pgSchema("training");

export const users = training.table("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),

  trainingLevel: varchar("training_level", { length: 20 }).notNull(),
  primaryGoal: varchar("primary_goal", { length: 20 }).notNull(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),

  // Onboarding progress tracking
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  baselineComplete: boolean("baseline_complete").notNull().default(false),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const programs = training.table("programs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  daysPerWeek: integer("days_per_week").notNull(),
  goal: varchar("goal", { length: 20 }).notNull(),
  level: varchar("level", { length: 20 }).notNull(),

  template: jsonb("template").$type<Record<string, unknown>>().notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingBlocks = training.table("training_blocks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  programId: varchar("program_id", { length: 64 }).notNull().references(() => programs.id),

  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  currentWeek: integer("current_week").notNull().default(1),

  status: varchar("status", { length: 20 }).notNull().default("active"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("training_blocks_user_status_idx").on(table.userId, table.status),
]);

export const workouts = training.table("workouts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  trainingBlockId: varchar("training_block_id", { length: 64 }).notNull().references(() => trainingBlocks.id),

  scheduledDate: date("scheduled_date").notNull(),
  weekNumber: integer("week_number").notNull(),
  dayNumber: integer("day_number").notNull(),

  plannedExercises: jsonb("planned_exercises").$type<Record<string, unknown>[]>().notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("workouts_block_date_idx").on(table.trainingBlockId, table.scheduledDate),
  index("workouts_status_idx").on(table.status),
]);

export const workoutLogs = training.table("workout_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workoutId: varchar("workout_id", { length: 64 }).references(() => workouts.id), // Nullable for retrospective logs
  standaloneWorkoutId: varchar("standalone_workout_id", { length: 64 }), // Nullable - references standaloneWorkouts (added later due to circular dep)
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),

  overallRpe: real("overall_rpe"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("workout_logs_user_created_idx").on(table.userId, table.createdAt),
  index("workout_logs_workout_idx").on(table.workoutId),
  index("workout_logs_standalone_workout_idx").on(table.standaloneWorkoutId),
]);

export const loggedSets = training.table("logged_sets", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workoutLogId: varchar("workout_log_id", { length: 64 }).notNull().references(() => workoutLogs.id),
  exerciseId: varchar("exercise_id", { length: 64 }).notNull(),

  setNumber: integer("set_number").notNull(),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
  rpe: real("rpe"),

  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("logged_sets_exercise_created_idx").on(table.exerciseId, table.createdAt),
  index("logged_sets_workout_log_idx").on(table.workoutLogId),
]);

export const decisions = training.table("decisions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  workoutId: varchar("workout_id", { length: 64 }).references(() => workouts.id),

  type: varchar("type", { length: 50 }).notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  output: jsonb("output").$type<Record<string, unknown>>().notNull(),
  reasoning: text("reasoning").notNull(),

  // Algorithm version for tracking which engine version made the decision
  algorithmVersion: varchar("algorithm_version", { length: 20 }).notNull().default("1.0.0"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("decisions_user_id_idx").on(table.userId),
  index("decisions_type_idx").on(table.type),
  index("decisions_created_at_idx").on(table.createdAt),
]);

// Decision outcomes - tracks what happened after a decision was made
export const decisionOutcomes = training.table("decision_outcomes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  decisionId: varchar("decision_id", { length: 64 }).notNull().references(() => decisions.id),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  // What happened
  outcome: varchar("outcome", { length: 20 }).notNull(), // 'followed' | 'overridden' | 'ignored'
  success: boolean("success"), // null if not yet determined

  // If overridden, why?
  overrideReason: varchar("override_reason", { length: 50 }),

  // Evidence
  expectedValue: jsonb("expected_value").$type<Record<string, unknown>>(),
  actualValue: jsonb("actual_value").$type<Record<string, unknown>>(),

  evaluatedAt: timestamp("evaluated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("decision_outcomes_user_id_idx").on(table.userId),
  index("decision_outcomes_decision_id_idx").on(table.decisionId),
]);

// Push notification tokens for web and mobile
export const pushTokens = training.table("push_tokens", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  token: text("token").notNull(),
  platform: varchar("platform", { length: 20 }).notNull(), // 'web', 'ios', 'android'
  deviceId: varchar("device_id", { length: 255 }),

  isActive: integer("is_active").notNull().default(1),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pre-workout readiness check-ins for historical analysis
export const readinessChecks = training.table("readiness_checks", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  workoutLogId: varchar("workout_log_id", { length: 64 }).references(() => workoutLogs.id),

  // Input factors (1-5 scale)
  sleepQuality: integer("sleep_quality").notNull(),
  muscleSoreness: integer("muscle_soreness").notNull(),
  stressLevel: integer("stress_level").notNull(),
  energyLevel: integer("energy_level").notNull(),

  // Calculated results
  score: integer("score").notNull(),
  recommendation: varchar("recommendation", { length: 20 }).notNull(), // 'proceed', 'modify', 'rest'

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("readiness_checks_user_created_idx").on(table.userId, table.createdAt),
]);

// User baseline weights for exercises - established during onboarding or calibration
export const userBaselines = training.table("user_baselines", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  exerciseId: varchar("exercise_id", { length: 64 }).notNull(),

  // Baseline performance
  baselineWeight: real("baseline_weight").notNull(),
  baselineReps: integer("baseline_reps").notNull(),
  estimatedE1RM: real("estimated_e1rm"),

  // How the baseline was established
  source: varchar("source", { length: 20 }).notNull(), // 'user_input' | 'calibration' | 'inferred'

  establishedAt: timestamp("established_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("user_baselines_user_id_idx").on(table.userId),
  index("user_baselines_exercise_id_idx").on(table.exerciseId),
]);

// Workout templates - reusable workout blueprints (e.g., "Back Day", "Push Day")
export const workoutTemplates = training.table("workout_templates", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  focusMuscles: jsonb("focus_muscles").$type<string[]>().notNull(), // MuscleGroup[]
  exercises: jsonb("exercises").$type<Record<string, unknown>[]>().notNull(), // PlannedExercise[]

  estimatedDurationMinutes: integer("estimated_duration_minutes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("workout_templates_user_id_idx").on(table.userId),
]);

// Weekly plans - standalone week of workouts (not tied to multi-week programs)
export const weeklyPlans = training.table("weekly_plans", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  startDate: date("start_date").notNull(),
  daysPerWeek: integer("days_per_week").notNull(),

  goal: varchar("goal", { length: 20 }).notNull(), // 'strength' | 'hypertrophy' | 'conditioning'
  status: varchar("status", { length: 20 }).notNull().default("active"), // 'active' | 'completed' | 'archived'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("weekly_plans_user_status_idx").on(table.userId, table.status),
]);

// Standalone workouts - individual workout instances not tied to programs
export const standaloneWorkouts = training.table("standalone_workouts", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  templateId: varchar("template_id", { length: 64 }).references(() => workoutTemplates.id), // nullable - if created from template
  weeklyPlanId: varchar("weekly_plan_id", { length: 64 }).references(() => weeklyPlans.id), // nullable - if part of weekly plan

  name: varchar("name", { length: 255 }).notNull(),
  scheduledDate: date("scheduled_date").notNull(),
  dayOfWeek: integer("day_of_week"), // 1-7 for weekly plan placement

  plannedExercises: jsonb("planned_exercises").$type<Record<string, unknown>[]>().notNull(), // PlannedExercise[]
  focusMuscles: jsonb("focus_muscles").$type<string[]>().notNull(), // MuscleGroup[]

  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending' | 'in_progress' | 'completed' | 'skipped'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("standalone_workouts_user_date_idx").on(table.userId, table.scheduledDate),
  index("standalone_workouts_weekly_plan_idx").on(table.weeklyPlanId),
  index("standalone_workouts_status_idx").on(table.status),
]);
