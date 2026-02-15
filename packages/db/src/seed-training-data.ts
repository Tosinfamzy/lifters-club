import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, like, and } from "drizzle-orm";
import {
  users,
  trainingBlocks,
  workouts,
  workoutLogs,
  loggedSets,
  decisions,
  decisionOutcomes,
  readinessChecks,
  userBaselines,
} from "./schema/training";

// Load .env from monorepo root
if (!process.env.DATABASE_URL) {
  config({ path: "../../.env" });
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// ============ CONSTANTS ============

const USER_ID = "user-user_38i";
const BLOCK_ID = "user-user-38i-progressive-ppl-from-hell-1770667221052";
const PROGRAM_ID = "progressive-ppl-from-hell";

// Week 1 starts Feb 9, 2026
const WEEK_DATES: Record<number, string[]> = {
  1: ["2026-02-09", "2026-02-10", "2026-02-11", "2026-02-12", "2026-02-13"],
  2: ["2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20"],
  3: ["2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27"],
};

// ============ PLANNED EXERCISES JSONB (exact copy from the program template) ============
// These are embedded so the seed script can bootstrap week 1 workouts on a fresh DB

const PLANNED_EXERCISES: Record<number, Record<string, unknown>[]> = {
  1: [
    { exerciseId: "dumbbell-bench-press", sets: 5, repRange: [10, 15], restSeconds: 90, notes: "Flat Dumbbell Press - 15, 10 reps + Drop Set (10, drop 10lbs x2)" },
    { exerciseId: "incline-barbell-press", sets: 5, repRange: [8, 12], restSeconds: 90, notes: "12, 10 reps + Rest-Pause (8, 3-5 breaths, to failure)" },
    { exerciseId: "smith-incline-press", sets: 5, repRange: [6, 10], restSeconds: 90, notes: "Smith High Incline - 10, 8 reps + Drop Set (6, 90%, 80%)" },
    { exerciseId: "machine-fly", sets: 3, repRange: [10, 15], restSeconds: 60, notes: "Machine Flys - 15, 12, 10 reps" },
    { exerciseId: "decline-bench-press", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "20 reps - pump set" },
    { exerciseId: "dip", sets: 1, repRange: [8, 20], restSeconds: 60, notes: "Dips to failure" },
    { exerciseId: "cable-fly", sets: 1, repRange: [10, 10], restSeconds: 60, notes: "Cable Fly - 10 reps finisher" },
  ],
  2: [
    { exerciseId: "lat-pulldown", sets: 7, repRange: [10, 15], restSeconds: 60, notes: "Wide Grip Lat Pulldowns - 15 + Drop Set 1 (10, up pin x2) + Drop Set 2 (10, up pin x2)" },
    { exerciseId: "neutral-grip-pulldown", sets: 7, repRange: [10, 15], restSeconds: 60, notes: "V-Bar Lat Pulldowns - 15 + Drop Set 1 (10, up pin x2) + Drop Set 2 (10, up pin x2)" },
    { exerciseId: "cable-pullover", sets: 4, repRange: [15, 15], restSeconds: 60, notes: "Cable Pullovers - 15 + Drop Set (15, up pin x2)" },
    { exerciseId: "cable-row", sets: 5, repRange: [8, 15], restSeconds: 90, notes: "Seated Row V-Bar - 15, 10 + Drop Set (8, up pin x2)" },
    { exerciseId: "incline-dumbbell-row", sets: 4, repRange: [8, 15], restSeconds: 90, notes: "Incline Dumbbell High Elbow Row - 10, 8, 8, 15" },
    { exerciseId: "seated-row-high-elbow", sets: 1, repRange: [10, 10], restSeconds: 60, notes: "Seated Row High Elbow - 10 reps" },
    { exerciseId: "smith-bent-over-row", sets: 5, repRange: [8, 12], restSeconds: 90, notes: "Smith Bent Over Rows - 12, 10 + Rest-Pause (8, 3-5 breaths, N/A)" },
    { exerciseId: "barbell-shrug", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Smith Shrug Wide Grip - 20 reps" },
    { exerciseId: "hyper-extension", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Hyper Extensions (Flexion + Extension) - 20 reps" },
  ],
  3: [
    { exerciseId: "incline-lateral-raise", sets: 4, repRange: [10, 20], restSeconds: 60, notes: "Incline Dumbbell Side Lateral - 10, 10, 20, 20" },
    { exerciseId: "cable-lateral-raise", sets: 1, repRange: [15, 15], restSeconds: 60, notes: "Cable Side Laterals Single Arm - 15 per side" },
    { exerciseId: "machine-lateral-raise", sets: 4, repRange: [20, 20], restSeconds: 45, notes: "Machine Side Laterals - 20 + Drop Set (20, up pin x3)" },
    { exerciseId: "dumbbell-shoulder-press", sets: 6, repRange: [10, 15], restSeconds: 60, notes: "Seated DB Press (Slightly Supinated) - 15, 12, 10 + Rest-Pause (10, 3-5 breaths x2) @ 65°" },
    { exerciseId: "rear-delt-barbell-raise", sets: 4, repRange: [10, 20], restSeconds: 60, notes: "Rear Delt Behind The Back Barbell Raise - 20, 20, 10, 10" },
    { exerciseId: "single-arm-dumbbell-rear-delt-raise", sets: 1, repRange: [10, 10], restSeconds: 60, notes: "Single Arm Dumbbell Rear Delt Raise - 10 per side" },
    { exerciseId: "lying-cable-rear-delt-row", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Lying Rear Delt Cable Row - 20 reps" },
    { exerciseId: "barbell-shrug", sets: 1, repRange: [30, 30], restSeconds: 60, notes: "Barbell Shrugs Wide Grip - 30 reps" },
  ],
  4: [
    { exerciseId: "cable-tricep-extension", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Straight Bar Extensions - 20 reps" },
    { exerciseId: "cable-curl", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Cable Straight Bar Curl - 20 reps" },
    { exerciseId: "overhead-dumbbell-extension", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Single Arm Overhead Dumbbell Extension - 20 per side" },
    { exerciseId: "preacher-curl", sets: 2, repRange: [10, 15], restSeconds: 60, notes: "Dumbbell Preacher Curl (FLAT SIDE) - 15, 10 per side" },
    { exerciseId: "reverse-grip-curl", sets: 1, repRange: [10, 10], restSeconds: 60, notes: "EZ Bar Reverse Grip Curls - 10 reps" },
    { exerciseId: "close-grip-bench-press", sets: 1, repRange: [20, 20], restSeconds: 60, notes: "Close Grip Press - 20 reps" },
    { exerciseId: "cable-ez-bar-curl", sets: 3, repRange: [30, 30], restSeconds: 30, notes: "SUPERSET with Cable French Press - Cable EZ Bar Curl 30 reps x 3 rounds" },
    { exerciseId: "cable-french-press", sets: 3, repRange: [30, 30], restSeconds: 60, notes: "SUPERSET with Cable EZ Bar Curl - Cable French Press 30 reps x 3 rounds" },
  ],
  5: [
    { exerciseId: "leg-extension", sets: 9, repRange: [10, 20], restSeconds: 45, notes: "Leg Extensions - 20, 20, 20, 10, 10 + Drop Set (10, up pin x3)" },
    { exerciseId: "dumbbell-split-squat", sets: 1, repRange: [15, 15], restSeconds: 90, notes: "Dumbbell Quad Split Squat - 15 per side" },
    { exerciseId: "hack-squat", sets: 3, repRange: [10, 30], restSeconds: 120, notes: "Hack Squat Toes Low (QUAD) - 10, 20, 30 pyramid" },
    { exerciseId: "seated-leg-curl", sets: 4, repRange: [10, 20], restSeconds: 60, notes: "Seated Leg Curl - 10, 10, 20, 20" },
    { exerciseId: "smith-reverse-lunge", sets: 3, repRange: [10, 15], restSeconds: 90, notes: "Smith Reverse Lunges - 15, 15, 10 per side" },
    { exerciseId: "leg-press", sets: 4, repRange: [15, 20], restSeconds: 90, notes: "Leg Press Wide - 20 + Drop Set (15, drop 2 plates x2)" },
    { exerciseId: "monster-walk", sets: 1, repRange: [50, 50], restSeconds: 60, notes: "Monster Walk - 50 reps finisher" },
  ],
};

function wid(week: number, day: number) {
  return `${BLOCK_ID}-w${week}-d${day}`;
}

function logId(week: number, day: number) {
  return `seed-log-w${week}-d${day}`;
}

function setId(week: number, day: number, exerciseIdx: number, setNum: number) {
  return `seed-set-w${week}d${day}-e${exerciseIdx}-s${setNum}`;
}

// ============ PLANNED EXERCISES PER DAY (from DB) ============

// Day 1 - Chest
const day1Exercises = [
  { exerciseId: "dumbbell-bench-press", sets: 5, repRange: [10, 15] as [number, number] },
  { exerciseId: "incline-barbell-press", sets: 5, repRange: [8, 12] as [number, number] },
  { exerciseId: "smith-incline-press", sets: 5, repRange: [6, 10] as [number, number] },
  { exerciseId: "machine-fly", sets: 3, repRange: [10, 15] as [number, number] },
  { exerciseId: "decline-bench-press", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "dip", sets: 1, repRange: [8, 20] as [number, number] },
  { exerciseId: "cable-fly", sets: 1, repRange: [10, 10] as [number, number] },
];

// Day 2 - Back
const day2Exercises = [
  { exerciseId: "lat-pulldown", sets: 7, repRange: [10, 15] as [number, number] },
  { exerciseId: "neutral-grip-pulldown", sets: 7, repRange: [10, 15] as [number, number] },
  { exerciseId: "cable-pullover", sets: 4, repRange: [15, 15] as [number, number] },
  { exerciseId: "cable-row", sets: 5, repRange: [8, 15] as [number, number] },
  { exerciseId: "incline-dumbbell-row", sets: 4, repRange: [8, 15] as [number, number] },
  { exerciseId: "seated-row-high-elbow", sets: 1, repRange: [10, 10] as [number, number] },
  { exerciseId: "smith-bent-over-row", sets: 5, repRange: [8, 12] as [number, number] },
  { exerciseId: "barbell-shrug", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "hyper-extension", sets: 1, repRange: [20, 20] as [number, number] },
];

// Day 3 - Shoulders
const day3Exercises = [
  { exerciseId: "incline-lateral-raise", sets: 4, repRange: [10, 20] as [number, number] },
  { exerciseId: "cable-lateral-raise", sets: 1, repRange: [15, 15] as [number, number] },
  { exerciseId: "machine-lateral-raise", sets: 4, repRange: [20, 20] as [number, number] },
  { exerciseId: "dumbbell-shoulder-press", sets: 6, repRange: [10, 15] as [number, number] },
  { exerciseId: "rear-delt-barbell-raise", sets: 4, repRange: [10, 20] as [number, number] },
  { exerciseId: "single-arm-dumbbell-rear-delt-raise", sets: 1, repRange: [10, 10] as [number, number] },
  { exerciseId: "lying-cable-rear-delt-row", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "barbell-shrug", sets: 1, repRange: [30, 30] as [number, number] },
];

// Day 4 - Arms
const day4Exercises = [
  { exerciseId: "cable-tricep-extension", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "cable-curl", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "overhead-dumbbell-extension", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "preacher-curl", sets: 2, repRange: [10, 15] as [number, number] },
  { exerciseId: "reverse-grip-curl", sets: 1, repRange: [10, 10] as [number, number] },
  { exerciseId: "close-grip-bench-press", sets: 1, repRange: [20, 20] as [number, number] },
  { exerciseId: "cable-ez-bar-curl", sets: 3, repRange: [30, 30] as [number, number] },
  { exerciseId: "cable-french-press", sets: 3, repRange: [30, 30] as [number, number] },
];

// Day 5 - Legs
const day5Exercises = [
  { exerciseId: "leg-extension", sets: 9, repRange: [10, 20] as [number, number] },
  { exerciseId: "dumbbell-split-squat", sets: 1, repRange: [15, 15] as [number, number] },
  { exerciseId: "hack-squat", sets: 3, repRange: [10, 30] as [number, number] },
  { exerciseId: "seated-leg-curl", sets: 4, repRange: [10, 20] as [number, number] },
  { exerciseId: "smith-reverse-lunge", sets: 3, repRange: [10, 15] as [number, number] },
  { exerciseId: "leg-press", sets: 4, repRange: [15, 20] as [number, number] },
  { exerciseId: "monster-walk", sets: 1, repRange: [50, 50] as [number, number] },
];

const dayExercises = [day1Exercises, day2Exercises, day3Exercises, day4Exercises, day5Exercises];

// ============ REALISTIC WORKING WEIGHTS (kg) ============
// Intermediate male doing hypertrophy PPL, with slight progressive overload per week

type WeightMap = Record<string, { baseWeight: number; weeklyIncrement: number }>;

const exerciseWeights: WeightMap = {
  // Day 1 - Chest
  "dumbbell-bench-press": { baseWeight: 32, weeklyIncrement: 2 },
  "incline-barbell-press": { baseWeight: 60, weeklyIncrement: 2.5 },
  "smith-incline-press": { baseWeight: 50, weeklyIncrement: 2.5 },
  "machine-fly": { baseWeight: 45, weeklyIncrement: 2.5 },
  "decline-bench-press": { baseWeight: 60, weeklyIncrement: 0 },
  "dip": { baseWeight: 0, weeklyIncrement: 0 }, // bodyweight
  "cable-fly": { baseWeight: 15, weeklyIncrement: 0 },

  // Day 2 - Back
  "lat-pulldown": { baseWeight: 60, weeklyIncrement: 2.5 },
  "neutral-grip-pulldown": { baseWeight: 55, weeklyIncrement: 2.5 },
  "cable-pullover": { baseWeight: 30, weeklyIncrement: 2.5 },
  "cable-row": { baseWeight: 55, weeklyIncrement: 2.5 },
  "incline-dumbbell-row": { baseWeight: 22, weeklyIncrement: 2 },
  "seated-row-high-elbow": { baseWeight: 40, weeklyIncrement: 0 },
  "smith-bent-over-row": { baseWeight: 50, weeklyIncrement: 2.5 },
  "barbell-shrug": { baseWeight: 60, weeklyIncrement: 0 },
  "hyper-extension": { baseWeight: 10, weeklyIncrement: 0 },

  // Day 3 - Shoulders
  "incline-lateral-raise": { baseWeight: 10, weeklyIncrement: 1 },
  "cable-lateral-raise": { baseWeight: 7.5, weeklyIncrement: 0 },
  "machine-lateral-raise": { baseWeight: 20, weeklyIncrement: 2.5 },
  "dumbbell-shoulder-press": { baseWeight: 22, weeklyIncrement: 2 },
  "rear-delt-barbell-raise": { baseWeight: 15, weeklyIncrement: 0 },
  "single-arm-dumbbell-rear-delt-raise": { baseWeight: 8, weeklyIncrement: 0 },
  "lying-cable-rear-delt-row": { baseWeight: 10, weeklyIncrement: 0 },

  // Day 4 - Arms
  "cable-tricep-extension": { baseWeight: 25, weeklyIncrement: 0 },
  "cable-curl": { baseWeight: 22.5, weeklyIncrement: 0 },
  "overhead-dumbbell-extension": { baseWeight: 14, weeklyIncrement: 0 },
  "preacher-curl": { baseWeight: 12, weeklyIncrement: 1 },
  "reverse-grip-curl": { baseWeight: 20, weeklyIncrement: 0 },
  "close-grip-bench-press": { baseWeight: 50, weeklyIncrement: 0 },
  "cable-ez-bar-curl": { baseWeight: 20, weeklyIncrement: 0 },
  "cable-french-press": { baseWeight: 17.5, weeklyIncrement: 0 },

  // Day 5 - Legs
  "leg-extension": { baseWeight: 45, weeklyIncrement: 2.5 },
  "dumbbell-split-squat": { baseWeight: 20, weeklyIncrement: 0 },
  "hack-squat": { baseWeight: 80, weeklyIncrement: 5 },
  "seated-leg-curl": { baseWeight: 40, weeklyIncrement: 2.5 },
  "smith-reverse-lunge": { baseWeight: 30, weeklyIncrement: 0 },
  "leg-press": { baseWeight: 140, weeklyIncrement: 5 },
  "monster-walk": { baseWeight: 0, weeklyIncrement: 0 }, // band
};

// ============ HELPERS ============

function randBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomRpe(base: number): number {
  // Return RPE in 0.5 increments around the base
  const offsets = [-1, -0.5, 0, 0, 0.5, 0.5, 1];
  const offset = offsets[Math.floor(Math.random() * offsets.length)]!;
  return Math.min(10, Math.max(5, base + offset));
}

function getWeight(exerciseId: string, week: number): number {
  const info = exerciseWeights[exerciseId];
  if (!info) return 20;
  return info.baseWeight + info.weeklyIncrement * (week - 1);
}

// Generate reps for a set based on exercise rep range and set number
function generateReps(repRange: [number, number], setNumber: number, totalSets: number): number {
  const [min, max] = repRange;
  if (min === max) return min;
  // Earlier sets tend to hit higher reps, later sets fatigue
  const fatigueRatio = setNumber / totalSets;
  const targetRep = max - Math.round((max - min) * fatigueRatio);
  // Add some variance
  return Math.max(min, Math.min(max, targetRep + randBetween(-1, 1)));
}

// Calculate readiness score matching the engine formula
function calculateReadinessScore(sleep: number, soreness: number, stress: number, energy: number): number {
  const rawScore = sleep * 0.35 + (6 - soreness) * 0.25 + (6 - stress) * 0.2 + energy * 0.2;
  return Math.round((rawScore / 5) * 100);
}

function getReadinessRecommendation(score: number): string {
  if (score >= 70) return "proceed";
  if (score >= 50) return "modify";
  return "rest";
}

// ============ SEED FUNCTIONS ============

async function ensureTrainingBlockAndWeek1() {
  console.log("Checking for training block and week 1 workouts...");

  // Check if training block exists
  const existingBlock = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.id, BLOCK_ID))
    .limit(1);

  if (existingBlock.length === 0) {
    console.log("  Training block not found — creating it...");
    await db.insert(trainingBlocks).values({
      id: BLOCK_ID,
      userId: USER_ID,
      programId: PROGRAM_ID,
      startDate: WEEK_DATES[1]![0]!,
      currentWeek: 1,
      status: "active",
    });
    console.log("  Created training block");
  } else {
    console.log("  Training block already exists");
  }

  // Check if week 1 workouts exist
  const existingWeek1 = await db
    .select()
    .from(workouts)
    .where(
      and(
        eq(workouts.trainingBlockId, BLOCK_ID),
        eq(workouts.weekNumber, 1)
      )
    );

  if (existingWeek1.length === 0) {
    console.log("  Week 1 workouts not found — creating them...");
    const week1Workouts: (typeof workouts.$inferInsert)[] = [];
    for (let day = 1; day <= 5; day++) {
      week1Workouts.push({
        id: wid(1, day),
        trainingBlockId: BLOCK_ID,
        scheduledDate: WEEK_DATES[1]![day - 1]!,
        weekNumber: 1,
        dayNumber: day,
        plannedExercises: PLANNED_EXERCISES[day]!,
        status: "pending",
      });
    }
    await db.insert(workouts).values(week1Workouts);
    console.log(`  Created ${week1Workouts.length} week 1 workouts`);
  } else {
    console.log(`  Week 1 workouts already exist (${existingWeek1.length} found)`);
  }
}

async function cleanSeedData() {
  console.log("Cleaning existing seed data...");

  // Delete in FK-safe order
  await db.delete(decisionOutcomes).where(like(decisionOutcomes.id, "seed-%"));
  await db.delete(decisions).where(like(decisions.id, "seed-%"));
  await db.delete(readinessChecks).where(like(readinessChecks.id, "seed-%"));
  await db.delete(userBaselines).where(like(userBaselines.id, "seed-%"));
  await db.delete(loggedSets).where(like(loggedSets.id, "seed-%"));
  // Delete the existing empty workout log from mobile
  await db.delete(workoutLogs).where(like(workoutLogs.id, "offline-%"));
  await db.delete(workoutLogs).where(like(workoutLogs.id, "seed-%"));

  // Delete week 2 and 3 workouts if they exist from a previous run
  await db.delete(workouts).where(like(workouts.id, `${BLOCK_ID}-w2-%`));
  await db.delete(workouts).where(like(workouts.id, `${BLOCK_ID}-w3-%`));

  console.log("  Cleaned seed data");
}

async function generateWeek2And3Workouts() {
  console.log("Generating week 2 and 3 workouts...");

  const newWorkouts: (typeof workouts.$inferInsert)[] = [];

  for (const week of [2, 3]) {
    for (let day = 1; day <= 5; day++) {
      const plannedExercises = PLANNED_EXERCISES[day];
      if (!plannedExercises) continue;

      newWorkouts.push({
        id: wid(week, day),
        trainingBlockId: BLOCK_ID,
        scheduledDate: WEEK_DATES[week]![day - 1]!,
        weekNumber: week,
        dayNumber: day,
        plannedExercises,
        status: "pending", // Will update status later
      });
    }
  }

  await db.insert(workouts).values(newWorkouts);
  console.log(`  Created ${newWorkouts.length} workouts for weeks 2-3`);
}

async function seedWorkoutLogs() {
  console.log("Seeding workout logs and logged sets...");

  // Complete workouts: all of week 1 (5), all of week 2 (5), first 2 of week 3 = 12 total
  // Skipped: w3-d3 (shoulders)
  // Pending: w3-d4, w3-d5

  const completedWorkouts: { week: number; day: number }[] = [];
  for (let d = 1; d <= 5; d++) completedWorkouts.push({ week: 1, day: d });
  for (let d = 1; d <= 5; d++) completedWorkouts.push({ week: 2, day: d });
  completedWorkouts.push({ week: 3, day: 1 });
  completedWorkouts.push({ week: 3, day: 2 });

  const logs: (typeof workoutLogs.$inferInsert)[] = [];
  const sets: (typeof loggedSets.$inferInsert)[] = [];

  for (const { week, day } of completedWorkouts) {
    const date = WEEK_DATES[week]![day - 1]!;
    const startHour = randBetween(6, 8); // morning gym sessions
    const startedAt = new Date(`${date}T${String(startHour).padStart(2, "0")}:${String(randBetween(0, 30)).padStart(2, "0")}:00Z`);
    const completedAt = new Date(startedAt.getTime() + randBetween(55, 85) * 60 * 1000); // 55-85 min sessions

    const exercises = dayExercises[day - 1]!;

    // Base RPE varies slightly per session
    const sessionBaseRpe = 7 + (Math.random() * 1.5 - 0.5); // 6.5-8.5 range
    const overallRpe = Math.round(sessionBaseRpe * 2) / 2; // round to 0.5

    logs.push({
      id: logId(week, day),
      workoutId: wid(week, day),
      userId: USER_ID,
      startedAt,
      completedAt,
      overallRpe,
      notes: null,
    });

    // Generate sets for each exercise
    for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
      const ex = exercises[exIdx]!;
      const weight = getWeight(ex.exerciseId, week);

      for (let s = 1; s <= ex.sets; s++) {
        const reps = generateReps(ex.repRange, s, ex.sets);
        // RPE tends to climb through the session and within sets
        const baseRpeForSet = sessionBaseRpe + (exIdx / exercises.length) * 0.5 + (s / ex.sets) * 0.5;
        const rpe = randomRpe(Math.min(9.5, baseRpeForSet));

        sets.push({
          id: setId(week, day, exIdx, s),
          workoutLogId: logId(week, day),
          exerciseId: ex.exerciseId,
          setNumber: s,
          weight: weight > 0 ? weight : 0,
          reps,
          rpe,
          notes: null,
        });
      }
    }
  }

  // Insert logs first, then sets (FK dependency)
  await db.insert(workoutLogs).values(logs);
  console.log(`  Created ${logs.length} workout logs`);
  await db.insert(loggedSets).values(sets);
  console.log(`  Created ${sets.length} logged sets`);

  // Update workout statuses
  for (const { week, day } of completedWorkouts) {
    await db
      .update(workouts)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(workouts.id, wid(week, day)));
  }

  // Mark w3-d3 as skipped
  await db
    .update(workouts)
    .set({ status: "skipped", updatedAt: new Date() })
    .where(eq(workouts.id, wid(3, 3)));

  // w3-d4 and w3-d5 remain pending
  console.log("  Updated workout statuses");
}

async function seedBaselines() {
  console.log("Seeding user baselines...");

  // Brzycki formula: e1RM = weight * (36 / (37 - reps))
  function estimateE1RM(weight: number, reps: number): number {
    if (reps <= 0 || reps >= 37) return weight;
    return Math.round(weight * (36 / (37 - reps)) * 10) / 10;
  }

  const baselines: (typeof userBaselines.$inferInsert)[] = [
    {
      id: "seed-baseline-dumbbell-bench-press",
      userId: USER_ID,
      exerciseId: "dumbbell-bench-press",
      baselineWeight: 32,
      baselineReps: 12,
      estimatedE1RM: estimateE1RM(32, 12),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-incline-barbell-press",
      userId: USER_ID,
      exerciseId: "incline-barbell-press",
      baselineWeight: 60,
      baselineReps: 10,
      estimatedE1RM: estimateE1RM(60, 10),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-lat-pulldown",
      userId: USER_ID,
      exerciseId: "lat-pulldown",
      baselineWeight: 60,
      baselineReps: 12,
      estimatedE1RM: estimateE1RM(60, 12),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-cable-row",
      userId: USER_ID,
      exerciseId: "cable-row",
      baselineWeight: 55,
      baselineReps: 12,
      estimatedE1RM: estimateE1RM(55, 12),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-dumbbell-shoulder-press",
      userId: USER_ID,
      exerciseId: "dumbbell-shoulder-press",
      baselineWeight: 22,
      baselineReps: 12,
      estimatedE1RM: estimateE1RM(22, 12),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-hack-squat",
      userId: USER_ID,
      exerciseId: "hack-squat",
      baselineWeight: 80,
      baselineReps: 10,
      estimatedE1RM: estimateE1RM(80, 10),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-leg-press",
      userId: USER_ID,
      exerciseId: "leg-press",
      baselineWeight: 140,
      baselineReps: 15,
      estimatedE1RM: estimateE1RM(140, 15),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
    {
      id: "seed-baseline-smith-bent-over-row",
      userId: USER_ID,
      exerciseId: "smith-bent-over-row",
      baselineWeight: 50,
      baselineReps: 10,
      estimatedE1RM: estimateE1RM(50, 10),
      source: "user_input",
      establishedAt: new Date("2026-02-09T10:00:00Z"),
    },
  ];

  await db.insert(userBaselines).values(baselines);
  console.log(`  Created ${baselines.length} baselines`);
}

async function seedReadinessChecks() {
  console.log("Seeding readiness checks...");

  // Create checks for a selection of completed workouts
  const checkData: { week: number; day: number; sleep: number; soreness: number; stress: number; energy: number }[] = [
    // Week 1 - mostly fresh and motivated at start
    { week: 1, day: 1, sleep: 4, soreness: 1, stress: 2, energy: 5 },
    { week: 1, day: 3, sleep: 4, soreness: 3, stress: 2, energy: 4 },
    { week: 1, day: 5, sleep: 3, soreness: 3, stress: 3, energy: 3 },
    // Week 2 - settling in, one rough day
    { week: 2, day: 1, sleep: 4, soreness: 2, stress: 2, energy: 4 },
    { week: 2, day: 2, sleep: 2, soreness: 4, stress: 4, energy: 2 }, // rough day
    { week: 2, day: 3, sleep: 4, soreness: 2, stress: 2, energy: 4 },
    { week: 2, day: 5, sleep: 5, soreness: 2, stress: 1, energy: 5 }, // great day
    // Week 3
    { week: 3, day: 1, sleep: 4, soreness: 2, stress: 3, energy: 4 },
    { week: 3, day: 2, sleep: 3, soreness: 3, stress: 3, energy: 3 },
  ];

  const checks: (typeof readinessChecks.$inferInsert)[] = checkData.map((c) => {
    const score = calculateReadinessScore(c.sleep, c.soreness, c.stress, c.energy);
    return {
      id: `seed-readiness-w${c.week}-d${c.day}`,
      userId: USER_ID,
      workoutLogId: logId(c.week, c.day),
      sleepQuality: c.sleep,
      muscleSoreness: c.soreness,
      stressLevel: c.stress,
      energyLevel: c.energy,
      score,
      recommendation: getReadinessRecommendation(score),
    };
  });

  await db.insert(readinessChecks).values(checks);
  console.log(`  Created ${checks.length} readiness checks`);
}

async function seedDecisions() {
  console.log("Seeding decisions and outcomes...");

  const allDecisions: (typeof decisions.$inferInsert)[] = [];
  const allOutcomes: (typeof decisionOutcomes.$inferInsert)[] = [];

  let decisionIdx = 0;

  // Helper to create a decision + optional outcome
  function addDecision(opts: {
    workoutId: string;
    type: string;
    exerciseId?: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    reasoning: string;
    outcome?: {
      result: "followed" | "overridden" | "ignored";
      success: boolean | null;
      overrideReason?: string;
      expectedValue?: Record<string, unknown>;
      actualValue?: Record<string, unknown>;
    };
  }) {
    decisionIdx++;
    const dId = `seed-decision-${String(decisionIdx).padStart(3, "0")}`;

    allDecisions.push({
      id: dId,
      userId: USER_ID,
      workoutId: opts.workoutId,
      type: opts.type,
      input: opts.input,
      output: opts.output,
      reasoning: opts.reasoning,
      algorithmVersion: "1.0.0",
    });

    if (opts.outcome) {
      allOutcomes.push({
        id: `seed-outcome-${String(decisionIdx).padStart(3, "0")}`,
        decisionId: dId,
        userId: USER_ID,
        outcome: opts.outcome.result,
        success: opts.outcome.success,
        overrideReason: opts.outcome.overrideReason ?? null,
        expectedValue: opts.outcome.expectedValue ?? null,
        actualValue: opts.outcome.actualValue ?? null,
        evaluatedAt: opts.outcome.success !== null ? new Date() : null,
      });
    }
  }

  // === WEEK 2 LOAD PROGRESSION DECISIONS ===

  // Day 1 - Chest: DB Bench progress
  addDecision({
    workoutId: wid(2, 1),
    type: "load_progression",
    input: {
      exerciseId: "dumbbell-bench-press",
      currentWeight: 32,
      targetRepRange: [10, 15],
      recentSets: [
        { reps: 14, rpe: 7, weight: 32 },
        { reps: 12, rpe: 7.5, weight: 32 },
        { reps: 11, rpe: 8, weight: 32 },
      ],
    },
    output: { action: "increase", newWeight: 34 },
    reasoning: "Consistently hitting top of rep range with RPE < 8. Ready for 2kg increase.",
    outcome: { result: "followed", success: true, expectedValue: { weight: 34 }, actualValue: { weight: 34 } },
  });

  // Day 1 - Incline Barbell
  addDecision({
    workoutId: wid(2, 1),
    type: "load_progression",
    input: {
      exerciseId: "incline-barbell-press",
      currentWeight: 60,
      targetRepRange: [8, 12],
      recentSets: [
        { reps: 11, rpe: 7, weight: 60 },
        { reps: 9, rpe: 8, weight: 60 },
      ],
    },
    output: { action: "increase", newWeight: 62.5 },
    reasoning: "Hitting target range at moderate RPE. Small 2.5kg increment appropriate for barbell press.",
    outcome: { result: "followed", success: true, expectedValue: { weight: 62.5 }, actualValue: { weight: 62.5 } },
  });

  // Day 2 - Lat Pulldown
  addDecision({
    workoutId: wid(2, 2),
    type: "load_progression",
    input: {
      exerciseId: "lat-pulldown",
      currentWeight: 60,
      targetRepRange: [10, 15],
      recentSets: [
        { reps: 14, rpe: 7, weight: 60 },
        { reps: 12, rpe: 7.5, weight: 60 },
      ],
    },
    output: { action: "increase", newWeight: 62.5 },
    reasoning: "Comfortably hitting reps with low RPE. Ready for progression.",
    outcome: { result: "overridden", success: null, overrideReason: "felt_too_heavy" },
  });

  // Day 2 - Smith Row
  addDecision({
    workoutId: wid(2, 2),
    type: "load_progression",
    input: {
      exerciseId: "smith-bent-over-row",
      currentWeight: 50,
      targetRepRange: [8, 12],
      recentSets: [
        { reps: 11, rpe: 7, weight: 50 },
        { reps: 10, rpe: 7.5, weight: 50 },
      ],
    },
    output: { action: "increase", newWeight: 52.5 },
    reasoning: "Solid performance in target range. Progress by 2.5kg.",
    outcome: { result: "followed", success: true, expectedValue: { weight: 52.5 }, actualValue: { weight: 52.5 } },
  });

  // Day 3 - Shoulder Press
  addDecision({
    workoutId: wid(2, 3),
    type: "load_progression",
    input: {
      exerciseId: "dumbbell-shoulder-press",
      currentWeight: 22,
      targetRepRange: [10, 15],
      recentSets: [
        { reps: 13, rpe: 7.5, weight: 22 },
        { reps: 11, rpe: 8, weight: 22 },
      ],
    },
    output: { action: "increase", newWeight: 24 },
    reasoning: "Hitting upper range. 2kg dumbbell jump is appropriate.",
    outcome: { result: "followed", success: true, expectedValue: { weight: 24 }, actualValue: { weight: 24 } },
  });

  // Day 5 - Hack Squat
  addDecision({
    workoutId: wid(2, 5),
    type: "load_progression",
    input: {
      exerciseId: "hack-squat",
      currentWeight: 80,
      targetRepRange: [10, 30],
      recentSets: [
        { reps: 15, rpe: 7, weight: 80 },
        { reps: 22, rpe: 8, weight: 80 },
      ],
    },
    output: { action: "increase", newWeight: 85 },
    reasoning: "Strong performance on pyramid sets. 5kg jump appropriate for machine compound.",
    outcome: { result: "followed", success: true, expectedValue: { weight: 85 }, actualValue: { weight: 85 } },
  });

  // Day 5 - Leg Press
  addDecision({
    workoutId: wid(2, 5),
    type: "load_progression",
    input: {
      exerciseId: "leg-press",
      currentWeight: 140,
      targetRepRange: [15, 20],
      recentSets: [
        { reps: 18, rpe: 7.5, weight: 140 },
        { reps: 16, rpe: 8, weight: 140 },
      ],
    },
    output: { action: "increase", newWeight: 145 },
    reasoning: "Hitting target range. Progress by 5kg.",
    outcome: { result: "followed", success: true, expectedValue: { weight: 145 }, actualValue: { weight: 145 } },
  });

  // === WEEK 2 VOLUME ADJUSTMENT DECISIONS ===

  addDecision({
    workoutId: wid(2, 1),
    type: "volume_adjustment",
    input: {
      exerciseId: "smith-incline-press",
      currentSetCount: 5,
      recentPerformance: [
        { completedSets: 5, targetSets: 5, avgRpe: 8.5 },
      ],
    },
    output: { action: "reduce", newSetCount: 4, reason: "High RPE across all sets suggests volume is too high" },
    reasoning: "Average RPE 8.5 is above threshold. Reducing from 5 to 4 sets to improve recovery.",
    outcome: { result: "ignored", success: null },
  });

  addDecision({
    workoutId: wid(2, 2),
    type: "volume_adjustment",
    input: {
      exerciseId: "lat-pulldown",
      currentSetCount: 7,
      recentPerformance: [
        { completedSets: 7, targetSets: 7, avgRpe: 7.2 },
      ],
    },
    output: { action: "maintain", newSetCount: 7, reason: "Volume is manageable at current RPE" },
    reasoning: "7 sets completed with moderate RPE. No adjustment needed.",
    outcome: { result: "followed", success: true },
  });

  addDecision({
    workoutId: wid(2, 5),
    type: "volume_adjustment",
    input: {
      exerciseId: "leg-extension",
      currentSetCount: 9,
      recentPerformance: [
        { completedSets: 9, targetSets: 9, avgRpe: 7.8 },
      ],
    },
    output: { action: "maintain", newSetCount: 9, reason: "Handling volume well for isolation work" },
    reasoning: "9 sets of leg extensions with acceptable RPE. Maintaining current volume.",
    outcome: { result: "followed", success: true },
  });

  // === WEEK 3 LOAD PROGRESSION DECISIONS ===

  addDecision({
    workoutId: wid(3, 1),
    type: "load_progression",
    input: {
      exerciseId: "dumbbell-bench-press",
      currentWeight: 34,
      targetRepRange: [10, 15],
      recentSets: [
        { reps: 13, rpe: 7.5, weight: 34 },
        { reps: 10, rpe: 8, weight: 34 },
      ],
    },
    output: { action: "maintain", newWeight: 34 },
    reasoning: "Still adapting to new weight. Maintain 34kg until consistently hitting top of range.",
    outcome: { result: "followed", success: null }, // pending evaluation
  });

  addDecision({
    workoutId: wid(3, 1),
    type: "load_progression",
    input: {
      exerciseId: "incline-barbell-press",
      currentWeight: 62.5,
      targetRepRange: [8, 12],
      recentSets: [
        { reps: 10, rpe: 8, weight: 62.5 },
        { reps: 8, rpe: 8.5, weight: 62.5 },
      ],
    },
    output: { action: "maintain", newWeight: 62.5 },
    reasoning: "RPE slightly elevated at new weight. Maintain until more comfortable.",
    outcome: { result: "followed", success: null },
  });

  addDecision({
    workoutId: wid(3, 2),
    type: "load_progression",
    input: {
      exerciseId: "cable-row",
      currentWeight: 57.5,
      targetRepRange: [8, 15],
      recentSets: [
        { reps: 13, rpe: 7, weight: 57.5 },
        { reps: 10, rpe: 7.5, weight: 57.5 },
      ],
    },
    output: { action: "increase", newWeight: 60 },
    reasoning: "Adapting well to previous increase. Ready for another 2.5kg bump.",
    outcome: { result: "overridden", success: null, overrideReason: "time_constraint" },
  });

  addDecision({
    workoutId: wid(3, 2),
    type: "load_progression",
    input: {
      exerciseId: "smith-bent-over-row",
      currentWeight: 52.5,
      targetRepRange: [8, 12],
      recentSets: [
        { reps: 10, rpe: 7.5, weight: 52.5 },
        { reps: 9, rpe: 8, weight: 52.5 },
      ],
    },
    output: { action: "increase", newWeight: 55 },
    reasoning: "Good performance at 52.5kg. Progress to 55kg.",
    outcome: { result: "followed", success: null },
  });

  // === WEEK 3 VOLUME ADJUSTMENT ===

  addDecision({
    workoutId: wid(3, 1),
    type: "volume_adjustment",
    input: {
      exerciseId: "machine-fly",
      currentSetCount: 3,
      recentPerformance: [
        { completedSets: 3, targetSets: 3, avgRpe: 6.5 },
        { completedSets: 3, targetSets: 3, avgRpe: 6.8 },
      ],
    },
    output: { action: "increase", newSetCount: 4, reason: "Low RPE suggests capacity for more volume" },
    reasoning: "Consistently low RPE on machine flys. Adding 1 set to increase stimulus.",
    outcome: { result: "overridden", success: null, overrideReason: "felt_too_light" },
  });

  // === DELOAD CHECK (week 3) ===

  addDecision({
    workoutId: wid(3, 1),
    type: "deload_recommendation",
    input: {
      weekCount: 3,
      recentWeeklyRpe: [7.5, 7.8],
      fatigueIndicators: { sleepQualityTrend: "stable", sorenessLevel: "moderate" },
    },
    output: { shouldDeload: false, reason: "Not yet necessary" },
    reasoning: "Only 3 weeks in, RPE trending up slightly but within normal range. No deload needed yet. Reassess at week 5.",
  });

  // === MISSED SESSION (w3-d3 was skipped) ===

  addDecision({
    workoutId: wid(3, 3),
    type: "missed_session",
    input: {
      missedWorkoutId: wid(3, 3),
      daysMissed: 1,
      previousConsecutiveMisses: 0,
    },
    output: { action: "skip_and_continue", reason: "Single miss, continue with next session" },
    reasoning: "One missed shoulder session with no prior consecutive misses. Continue with arms (day 4) as scheduled. Shoulder volume will be covered next week.",
    outcome: { result: "followed", success: null },
  });

  // === WEEK 3 MORE LOAD DECISIONS ===

  addDecision({
    workoutId: wid(3, 1),
    type: "load_progression",
    input: {
      exerciseId: "smith-incline-press",
      currentWeight: 52.5,
      targetRepRange: [6, 10],
      recentSets: [
        { reps: 9, rpe: 7.5, weight: 52.5 },
        { reps: 7, rpe: 8, weight: 52.5 },
      ],
    },
    output: { action: "increase", newWeight: 55 },
    reasoning: "Hitting mid-range reps at acceptable RPE. Ready for 2.5kg increase.",
    outcome: { result: "followed", success: null },
  });

  addDecision({
    workoutId: wid(3, 2),
    type: "load_progression",
    input: {
      exerciseId: "lat-pulldown",
      currentWeight: 60,
      targetRepRange: [10, 15],
      recentSets: [
        { reps: 14, rpe: 7.5, weight: 60 },
        { reps: 12, rpe: 8, weight: 60 },
      ],
    },
    output: { action: "increase", newWeight: 62.5 },
    reasoning: "User stayed at 60kg last week (overrode previous increase). Recommending again as performance is strong.",
    outcome: { result: "followed", success: null },
  });

  // Insert decisions first, then outcomes
  await db.insert(decisions).values(allDecisions);
  console.log(`  Created ${allDecisions.length} decisions`);
  await db.insert(decisionOutcomes).values(allOutcomes);
  console.log(`  Created ${allOutcomes.length} decision outcomes`);
}

async function updateTrainingBlockAndUser() {
  console.log("Updating training block and user flags...");

  // Update training block to week 3
  await db
    .update(trainingBlocks)
    .set({ currentWeek: 3, updatedAt: new Date() })
    .where(eq(trainingBlocks.id, BLOCK_ID));

  // Mark user as onboarding and baseline complete
  await db
    .update(users)
    .set({
      onboardingComplete: true,
      baselineComplete: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, USER_ID));

  console.log("  Updated training block to week 3");
  console.log("  Marked user onboarding + baseline complete");
}

// ============ MAIN ============

async function seed() {
  console.log("=== Seeding Training Data for Tosin ===\n");

  try {
    await ensureTrainingBlockAndWeek1();
    await cleanSeedData();
    await generateWeek2And3Workouts();
    await seedWorkoutLogs();
    await seedBaselines();
    await seedReadinessChecks();
    await seedDecisions();
    await updateTrainingBlockAndUser();

    console.log("\n=== Seed completed successfully! ===");
  } catch (error) {
    console.error("\nSeed failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

seed();
