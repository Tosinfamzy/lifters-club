import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { programs } from "./schema/training";

// Load .env from monorepo root only if DATABASE_URL not already set (e.g., in CI)
if (!process.env.DATABASE_URL) {
  config({ path: "../../.env" });
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

type ProgramInsert = typeof programs.$inferInsert;

// Template types
interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface SessionTemplate {
  dayNumber: number;
  name: string;
  focus: string[];
  exercises: PlannedExercise[];
}

interface ProgramTemplate {
  weeks: number;
  sessions: SessionTemplate[];
}

// ============ PROGRESSIVE PPL FROM HELL - 12 WEEKS ============
// Phase 2: Body Part Split (Weeks 5-12) - 5 days per week
// Features: Drop sets, Rest-pause sets, Supersets

const pplFromHellTemplate: ProgramTemplate = {
  weeks: 12,
  sessions: [
    // ============ DAY 1: CHEST ============
    {
      dayNumber: 1,
      name: "Chest Day",
      focus: ["chest", "triceps"],
      exercises: [
        {
          exerciseId: "dumbbell-bench-press",
          sets: 5,
          repRange: [10, 15],
          restSeconds: 90,
          notes: "Flat Dumbbell Press - 15, 10 reps + Drop Set (10, drop 10lbs x2)",
        },
        {
          exerciseId: "incline-barbell-press",
          sets: 5,
          repRange: [8, 12],
          restSeconds: 90,
          notes: "12, 10 reps + Rest-Pause (8, 3-5 breaths, to failure)",
        },
        {
          exerciseId: "smith-incline-press",
          sets: 5,
          repRange: [6, 10],
          restSeconds: 90,
          notes: "Smith High Incline - 10, 8 reps + Drop Set (6, 90%, 80%)",
        },
        {
          exerciseId: "machine-fly",
          sets: 3,
          repRange: [10, 15],
          restSeconds: 60,
          notes: "Machine Flys - 15, 12, 10 reps",
        },
        {
          exerciseId: "decline-bench-press",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "20 reps - pump set",
        },
        {
          exerciseId: "dip",
          sets: 1,
          repRange: [8, 20],
          restSeconds: 60,
          notes: "Dips to failure",
        },
        {
          exerciseId: "cable-fly",
          sets: 1,
          repRange: [10, 10],
          restSeconds: 60,
          notes: "Cable Fly - 10 reps finisher",
        },
      ],
    },

    // ============ DAY 2: BACK ============
    {
      dayNumber: 2,
      name: "Back Day",
      focus: ["lats", "mid_back", "traps"],
      exercises: [
        {
          exerciseId: "lat-pulldown",
          sets: 7,
          repRange: [10, 15],
          restSeconds: 60,
          notes: "Wide Grip Lat Pulldowns - 15 + Drop Set 1 (10, up pin x2) + Drop Set 2 (10, up pin x2)",
        },
        {
          exerciseId: "neutral-grip-pulldown",
          sets: 7,
          repRange: [10, 15],
          restSeconds: 60,
          notes: "V-Bar Lat Pulldowns - 15 + Drop Set 1 (10, up pin x2) + Drop Set 2 (10, up pin x2)",
        },
        {
          exerciseId: "cable-pullover",
          sets: 4,
          repRange: [15, 15],
          restSeconds: 60,
          notes: "Cable Pullovers - 15 + Drop Set (15, up pin x2)",
        },
        {
          exerciseId: "cable-row",
          sets: 5,
          repRange: [8, 15],
          restSeconds: 90,
          notes: "Seated Row V-Bar - 15, 10 + Drop Set (8, up pin x2)",
        },
        {
          exerciseId: "incline-dumbbell-row",
          sets: 4,
          repRange: [8, 15],
          restSeconds: 90,
          notes: "Incline Dumbbell High Elbow Row - 10, 8, 8, 15",
        },
        {
          exerciseId: "seated-row-high-elbow",
          sets: 1,
          repRange: [10, 10],
          restSeconds: 60,
          notes: "Seated Row High Elbow - 10 reps",
        },
        {
          exerciseId: "smith-bent-over-row",
          sets: 5,
          repRange: [8, 12],
          restSeconds: 90,
          notes: "Smith Bent Over Rows - 12, 10 + Rest-Pause (8, 3-5 breaths, N/A)",
        },
        {
          exerciseId: "barbell-shrug",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Smith Shrug Wide Grip - 20 reps",
        },
        {
          exerciseId: "hyper-extension",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Hyper Extensions (Flexion + Extension) - 20 reps",
        },
      ],
    },

    // ============ DAY 3: SHOULDERS ============
    {
      dayNumber: 3,
      name: "Shoulders Day",
      focus: ["front_delts", "side_delts", "rear_delts", "traps"],
      exercises: [
        {
          exerciseId: "incline-lateral-raise",
          sets: 4,
          repRange: [10, 20],
          restSeconds: 60,
          notes: "Incline Dumbbell Side Lateral - 10, 10, 20, 20",
        },
        {
          exerciseId: "cable-lateral-raise",
          sets: 1,
          repRange: [15, 15],
          restSeconds: 60,
          notes: "Cable Side Laterals Single Arm - 15 per side",
        },
        {
          exerciseId: "machine-lateral-raise",
          sets: 4,
          repRange: [20, 20],
          restSeconds: 45,
          notes: "Machine Side Laterals - 20 + Drop Set (20, up pin x3)",
        },
        {
          exerciseId: "dumbbell-shoulder-press",
          sets: 6,
          repRange: [10, 15],
          restSeconds: 60,
          notes: "Seated DB Press (Slightly Supinated) - 15, 12, 10 + Rest-Pause (10, 3-5 breaths x2) @ 65°",
        },
        {
          exerciseId: "rear-delt-barbell-raise",
          sets: 4,
          repRange: [10, 20],
          restSeconds: 60,
          notes: "Rear Delt Behind The Back Barbell Raise - 20, 20, 10, 10",
        },
        {
          exerciseId: "single-arm-dumbbell-rear-delt-raise",
          sets: 1,
          repRange: [10, 10],
          restSeconds: 60,
          notes: "Single Arm Dumbbell Rear Delt Raise - 10 per side",
        },
        {
          exerciseId: "lying-cable-rear-delt-row",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Lying Rear Delt Cable Row - 20 reps",
        },
        {
          exerciseId: "barbell-shrug",
          sets: 1,
          repRange: [30, 30],
          restSeconds: 60,
          notes: "Barbell Shrugs Wide Grip - 30 reps",
        },
      ],
    },

    // ============ DAY 4: ARMS ============
    {
      dayNumber: 4,
      name: "Arms Day",
      focus: ["biceps", "triceps", "forearms"],
      exercises: [
        {
          exerciseId: "cable-tricep-extension",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Straight Bar Extensions - 20 reps",
        },
        {
          exerciseId: "cable-curl",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Cable Straight Bar Curl - 20 reps",
        },
        {
          exerciseId: "overhead-dumbbell-extension",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Single Arm Overhead Dumbbell Extension - 20 per side",
        },
        {
          exerciseId: "preacher-curl",
          sets: 2,
          repRange: [10, 15],
          restSeconds: 60,
          notes: "Dumbbell Preacher Curl (FLAT SIDE) - 15, 10 per side",
        },
        {
          exerciseId: "reverse-grip-curl",
          sets: 1,
          repRange: [10, 10],
          restSeconds: 60,
          notes: "EZ Bar Reverse Grip Curls - 10 reps",
        },
        {
          exerciseId: "close-grip-bench-press",
          sets: 1,
          repRange: [20, 20],
          restSeconds: 60,
          notes: "Close Grip Press - 20 reps",
        },
        {
          exerciseId: "cable-ez-bar-curl",
          sets: 3,
          repRange: [30, 30],
          restSeconds: 30,
          notes: "SUPERSET with Cable French Press - Cable EZ Bar Curl 30 reps x 3 rounds",
        },
        {
          exerciseId: "cable-french-press",
          sets: 3,
          repRange: [30, 30],
          restSeconds: 60,
          notes: "SUPERSET with Cable EZ Bar Curl - Cable French Press 30 reps x 3 rounds",
        },
      ],
    },

    // ============ DAY 5: LEGS ============
    {
      dayNumber: 5,
      name: "Legs Day",
      focus: ["quads", "hamstrings", "glutes", "calves"],
      exercises: [
        {
          exerciseId: "leg-extension",
          sets: 9,
          repRange: [10, 20],
          restSeconds: 45,
          notes: "Leg Extensions - 20, 20, 20, 10, 10 + Drop Set (10, up pin x3)",
        },
        {
          exerciseId: "dumbbell-split-squat",
          sets: 1,
          repRange: [15, 15],
          restSeconds: 90,
          notes: "Dumbbell Quad Split Squat - 15 per side",
        },
        {
          exerciseId: "hack-squat",
          sets: 3,
          repRange: [10, 30],
          restSeconds: 120,
          notes: "Hack Squat Toes Low (QUAD) - 10, 20, 30 pyramid",
        },
        {
          exerciseId: "seated-leg-curl",
          sets: 4,
          repRange: [10, 20],
          restSeconds: 60,
          notes: "Seated Leg Curl - 10, 10, 20, 20",
        },
        {
          exerciseId: "smith-reverse-lunge",
          sets: 3,
          repRange: [10, 15],
          restSeconds: 90,
          notes: "Smith Reverse Lunges - 15, 15, 10 per side",
        },
        {
          exerciseId: "leg-press",
          sets: 4,
          repRange: [15, 20],
          restSeconds: 90,
          notes: "Leg Press Wide - 20 + Drop Set (15, drop 2 plates x2)",
        },
        {
          exerciseId: "monster-walk",
          sets: 1,
          repRange: [50, 50],
          restSeconds: 60,
          notes: "Monster Walk - 50 reps finisher",
        },
      ],
    },
  ],
};

const programSeedData: ProgramInsert[] = [
  {
    id: "progressive-ppl-from-hell",
    name: "Progressive PPL From HELL",
    description:
      "A brutal 12-week periodized program for intermediate to advanced lifters. Weeks 1-4: Traditional PPL (6 days). Weeks 5-12: Intensified 5-day body part split (Chest/Back/Shoulders/Arms/Legs). Features advanced techniques: drop sets, rest-pause sets, supersets, and pyramid training. Days 6-7 are rest.",
    daysPerWeek: 5,
    goal: "hypertrophy",
    level: "intermediate",
    template: pplFromHellTemplate as unknown as Record<string, unknown>,
  },
];

async function seedPrograms() {
  console.log("Seeding training programs...");

  try {
    // Clear existing programs
    await db.delete(programs);
    console.log("  Cleared existing programs");

    // Insert all programs
    for (const program of programSeedData) {
      await db.insert(programs).values(program);
      console.log(`  Inserted program: ${program.name}`);
    }

    console.log(`\nSeed completed! Inserted ${programSeedData.length} program(s).`);
  } catch (error) {
    console.error("Seed failed:", error);
    throw error;
  } finally {
    await client.end();
  }
}

seedPrograms();
