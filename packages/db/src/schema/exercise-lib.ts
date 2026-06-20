import { pgSchema, varchar, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const exerciseLib = pgSchema("exercise_lib");

export const exercises = exerciseLib.table("exercises", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  aliases: jsonb("aliases").$type<string[]>().default([]),

  equipment: jsonb("equipment").$type<string[]>().notNull(),
  movementPatterns: jsonb("movement_patterns").$type<string[]>().notNull(),
  primaryMuscles: jsonb("primary_muscles").$type<string[]>().notNull(),
  secondaryMuscles: jsonb("secondary_muscles").$type<string[]>().default([]),

  isCompound: boolean("is_compound").notNull(),
  isUnilateral: boolean("is_unilateral").notNull().default(false),
  difficulty: varchar("difficulty", { length: 20 }).notNull(),

  // Grip enum (nullable): null/none is never grip-filtered. See `Grip` in @gymapp/types.
  grip: varchar("grip", { length: 16 }),

  constraints: jsonb("constraints").$type<string[]>().default([]),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
