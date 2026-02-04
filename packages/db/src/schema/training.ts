import { pgSchema, varchar, text, jsonb, integer, timestamp, date, real } from "drizzle-orm/pg-core";

export const training = pgSchema("training");

export const users = training.table("users", {
  id: varchar("id", { length: 64 }).primaryKey(),
  clerkId: varchar("clerk_id", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),

  trainingLevel: varchar("training_level", { length: 20 }).notNull(),
  primaryGoal: varchar("primary_goal", { length: 20 }).notNull(),
  preferences: jsonb("preferences").$type<Record<string, unknown>>().notNull(),

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
});

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
});

export const workoutLogs = training.table("workout_logs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  workoutId: varchar("workout_id", { length: 64 }).notNull().references(() => workouts.id),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),

  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),

  overallRpe: real("overall_rpe"),
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});

export const decisions = training.table("decisions", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull().references(() => users.id),
  workoutId: varchar("workout_id", { length: 64 }).references(() => workouts.id),

  type: varchar("type", { length: 50 }).notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().notNull(),
  output: jsonb("output").$type<Record<string, unknown>>().notNull(),
  reasoning: text("reasoning").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
});
