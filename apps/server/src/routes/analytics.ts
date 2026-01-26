import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@gymapp/db";
import { workoutLogs, loggedSets } from "@gymapp/db/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";

const analyticsRoutes = new Hono();

const userQuerySchema = z.object({
  userId: z.string().min(1),
});

// GET /analytics/exercise/:exerciseId/progress - Get exercise progress over time
analyticsRoutes.get(
  "/exercise/:exerciseId/progress",
  zValidator("query", userQuerySchema.extend({
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })),
  async (c) => {
    const exerciseId = c.req.param("exerciseId");
    const { userId, limit } = c.req.valid("query");

    // Get all sets for this exercise, grouped by workout date
    const sets = await db
      .select({
        weight: loggedSets.weight,
        reps: loggedSets.reps,
        rpe: loggedSets.rpe,
        date: workoutLogs.startedAt,
        logId: workoutLogs.id,
      })
      .from(loggedSets)
      .innerJoin(workoutLogs, eq(loggedSets.workoutLogId, workoutLogs.id))
      .where(and(
        eq(loggedSets.exerciseId, exerciseId),
        eq(workoutLogs.userId, userId)
      ))
      .orderBy(desc(workoutLogs.startedAt));

    // Group by workout session and calculate best set per session
    const sessionMap = new Map<string, {
      date: Date;
      bestWeight: number;
      bestVolume: number; // weight * reps
      totalSets: number;
      avgRpe: number | null;
    }>();

    for (const set of sets) {
      const existing = sessionMap.get(set.logId);
      const volume = set.weight * set.reps;

      if (!existing) {
        sessionMap.set(set.logId, {
          date: set.date,
          bestWeight: set.weight,
          bestVolume: volume,
          totalSets: 1,
          avgRpe: set.rpe,
        });
      } else {
        existing.bestWeight = Math.max(existing.bestWeight, set.weight);
        existing.bestVolume = Math.max(existing.bestVolume, volume);
        existing.totalSets += 1;
        if (set.rpe !== null && existing.avgRpe !== null) {
          existing.avgRpe = (existing.avgRpe * (existing.totalSets - 1) + set.rpe) / existing.totalSets;
        }
      }
    }

    // Convert to array and limit
    const progress = Array.from(sessionMap.values())
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(-limit);

    return c.json({
      data: {
        exerciseId,
        sessions: progress.map(s => ({
          date: s.date.toISOString(),
          bestWeight: s.bestWeight,
          bestVolume: s.bestVolume,
          totalSets: s.totalSets,
          avgRpe: s.avgRpe ? Number(s.avgRpe.toFixed(1)) : null,
        })),
      },
    });
  }
);

// GET /analytics/volume - Get weekly volume data
analyticsRoutes.get(
  "/volume",
  zValidator("query", userQuerySchema.extend({
    weeks: z.coerce.number().int().min(1).max(52).default(8),
  })),
  async (c) => {
    const { userId, weeks } = c.req.valid("query");

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - weeks * 7);

    const logs = await db
      .select({
        date: workoutLogs.startedAt,
        logId: workoutLogs.id,
      })
      .from(workoutLogs)
      .where(and(
        eq(workoutLogs.userId, userId),
        gte(workoutLogs.startedAt, startDate)
      ))
      .orderBy(workoutLogs.startedAt);

    // Get all sets for these logs
    const logIds = logs.map(l => l.logId);

    if (logIds.length === 0) {
      return c.json({
        data: {
          weeks: [],
        },
      });
    }

    const sets = await db
      .select({
        workoutLogId: loggedSets.workoutLogId,
        weight: loggedSets.weight,
        reps: loggedSets.reps,
      })
      .from(loggedSets)
      .where(sql`${loggedSets.workoutLogId} IN ${logIds}`);

    // Build volume per log
    const volumeByLog = new Map<string, number>();
    for (const set of sets) {
      const current = volumeByLog.get(set.workoutLogId) || 0;
      volumeByLog.set(set.workoutLogId, current + set.weight * set.reps);
    }

    // Group by week
    const weeklyData = new Map<string, {
      weekStart: Date;
      totalVolume: number;
      workoutCount: number;
      setCount: number;
    }>();

    for (const log of logs) {
      const date = new Date(log.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split("T")[0]!;

      const existing = weeklyData.get(weekKey);
      const volume = volumeByLog.get(log.logId) || 0;
      const logSets = sets.filter(s => s.workoutLogId === log.logId).length;

      if (!existing) {
        weeklyData.set(weekKey, {
          weekStart,
          totalVolume: volume,
          workoutCount: 1,
          setCount: logSets,
        });
      } else {
        existing.totalVolume += volume;
        existing.workoutCount += 1;
        existing.setCount += logSets;
      }
    }

    const weeksArray = Array.from(weeklyData.values())
      .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

    return c.json({
      data: {
        weeks: weeksArray.map(w => ({
          weekStart: w.weekStart.toISOString().split("T")[0],
          totalVolume: Math.round(w.totalVolume),
          workoutCount: w.workoutCount,
          setCount: w.setCount,
        })),
      },
    });
  }
);

// GET /analytics/personal-records - Get personal records for each exercise
analyticsRoutes.get(
  "/personal-records",
  zValidator("query", userQuerySchema),
  async (c) => {
    const { userId } = c.req.valid("query");

    // Get all sets for this user
    const sets = await db
      .select({
        exerciseId: loggedSets.exerciseId,
        weight: loggedSets.weight,
        reps: loggedSets.reps,
        date: workoutLogs.startedAt,
      })
      .from(loggedSets)
      .innerJoin(workoutLogs, eq(loggedSets.workoutLogId, workoutLogs.id))
      .where(eq(workoutLogs.userId, userId));

    // Find PR for each exercise (heaviest weight lifted)
    const prMap = new Map<string, {
      exerciseId: string;
      maxWeight: number;
      maxWeightReps: number;
      maxWeightDate: Date;
      maxVolume: number;
      maxVolumeWeight: number;
      maxVolumeReps: number;
      maxVolumeDate: Date;
    }>();

    for (const set of sets) {
      const existing = prMap.get(set.exerciseId);
      const volume = set.weight * set.reps;

      if (!existing) {
        prMap.set(set.exerciseId, {
          exerciseId: set.exerciseId,
          maxWeight: set.weight,
          maxWeightReps: set.reps,
          maxWeightDate: set.date,
          maxVolume: volume,
          maxVolumeWeight: set.weight,
          maxVolumeReps: set.reps,
          maxVolumeDate: set.date,
        });
      } else {
        if (set.weight > existing.maxWeight) {
          existing.maxWeight = set.weight;
          existing.maxWeightReps = set.reps;
          existing.maxWeightDate = set.date;
        }
        if (volume > existing.maxVolume) {
          existing.maxVolume = volume;
          existing.maxVolumeWeight = set.weight;
          existing.maxVolumeReps = set.reps;
          existing.maxVolumeDate = set.date;
        }
      }
    }

    const records = Array.from(prMap.values()).map(pr => ({
      exerciseId: pr.exerciseId,
      weightPR: {
        weight: pr.maxWeight,
        reps: pr.maxWeightReps,
        date: pr.maxWeightDate.toISOString(),
      },
      volumePR: {
        weight: pr.maxVolumeWeight,
        reps: pr.maxVolumeReps,
        volume: pr.maxVolume,
        date: pr.maxVolumeDate.toISOString(),
      },
    }));

    return c.json({
      data: {
        records: records.sort((a, b) => a.exerciseId.localeCompare(b.exerciseId)),
      },
    });
  }
);

// GET /analytics/summary - Get overall training summary
analyticsRoutes.get(
  "/summary",
  zValidator("query", userQuerySchema),
  async (c) => {
    const { userId } = c.req.valid("query");

    // Get all completed workout logs
    const logs = await db
      .select({
        id: workoutLogs.id,
        startedAt: workoutLogs.startedAt,
        completedAt: workoutLogs.completedAt,
        overallRpe: workoutLogs.overallRpe,
      })
      .from(workoutLogs)
      .where(eq(workoutLogs.userId, userId))
      .orderBy(desc(workoutLogs.startedAt));

    const completedLogs = logs.filter(l => l.completedAt);

    // Calculate stats
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const workoutsThisWeek = completedLogs.filter(l =>
      l.completedAt && new Date(l.completedAt) >= oneWeekAgo
    ).length;

    const workoutsThisMonth = completedLogs.filter(l =>
      l.completedAt && new Date(l.completedAt) >= oneMonthAgo
    ).length;

    const logsWithRpe = completedLogs.filter(l => l.overallRpe !== null);
    const avgRpe = logsWithRpe.length > 0
      ? logsWithRpe.reduce((sum, l) => sum + (l.overallRpe || 0), 0) / logsWithRpe.length
      : null;

    // Calculate average duration
    const durations = completedLogs
      .filter(l => l.completedAt)
      .map(l => {
        const start = new Date(l.startedAt);
        const end = new Date(l.completedAt!);
        return (end.getTime() - start.getTime()) / (1000 * 60); // minutes
      });

    const avgDuration = durations.length > 0
      ? durations.reduce((sum, d) => sum + d, 0) / durations.length
      : null;

    // Current streak
    let currentStreak = 0;
    const sortedLogs = [...completedLogs].sort((a, b) =>
      new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
    );

    if (sortedLogs.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let checkDate = today;
      for (const log of sortedLogs) {
        const logDate = new Date(log.completedAt!);
        logDate.setHours(0, 0, 0, 0);

        const diffDays = Math.floor((checkDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays <= 1) {
          currentStreak++;
          checkDate = logDate;
        } else {
          break;
        }
      }
    }

    return c.json({
      data: {
        totalWorkouts: completedLogs.length,
        workoutsThisWeek,
        workoutsThisMonth,
        averageRpe: avgRpe ? Number(avgRpe.toFixed(1)) : null,
        averageDuration: avgDuration ? Math.round(avgDuration) : null,
        currentStreak,
        lastWorkout: completedLogs[0]?.completedAt?.toISOString() || null,
      },
    });
  }
);

export { analyticsRoutes };
