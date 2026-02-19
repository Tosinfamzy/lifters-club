"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  VolumeChart,
  FrequencyHeatmap,
  RpeTrendsChart,
  PersonalRecords,
  StrengthProgress,
} from "@/components/charts";
import { useAppUser } from "@/providers/user-provider";
import { TrendingUp, Dumbbell, Clock, BarChart3, Loader2 } from "lucide-react";
import { formatRelativeDate } from "@/lib/format";
import {
  useVolumeAnalytics,
  useAnalyticsSummary,
  useWorkoutLogsForAnalytics,
  usePersonalRecords,
  useExercisesList,
} from "@/lib/queries";
import type { VolumeWeekData, WorkoutLog } from "@/lib/api";

interface WorkoutDay {
  date: string;
  workoutCount: number;
}

interface RpeDataPoint {
  date: string;
  rpe: number;
}

const PERIOD_OPTIONS = [
  { value: "4", label: "4 weeks" },
  { value: "8", label: "8 weeks" },
  { value: "12", label: "12 weeks" },
  { value: "24", label: "24 weeks" },
] as const;

export default function AnalyticsPage() {
  const { isLoading: isUserLoading } = useAppUser();
  const [weeks, setWeeks] = useState(12);

  const { data: volumeData = [], isLoading: isVolumeLoading } = useVolumeAnalytics(weeks);
  const { data: summary, isLoading: isSummaryLoading } = useAnalyticsSummary();
  const { data: logs = [], isLoading: isLogsLoading } = useWorkoutLogsForAnalytics();
  const { data: personalRecords = [], isLoading: isPrsLoading } = usePersonalRecords();
  const { data: exercises = [], isLoading: isExercisesLoading } = useExercisesList();

  const isLoading = isVolumeLoading || isSummaryLoading || isLogsLoading || isPrsLoading || isExercisesLoading;

  // Derive workout days for heatmap from volume data
  const workoutDays = useMemo(() => {
    const days: WorkoutDay[] = volumeData.flatMap((week: VolumeWeekData) => {
      const weekDays: WorkoutDay[] = [];
      if (week.workoutCount > 0) {
        const startDate = new Date(week.weekStart);
        for (let i = 0; i < week.workoutCount && i < 7; i++) {
          const dayDate = new Date(startDate);
          dayDate.setDate(startDate.getDate() + i * 2);
          weekDays.push({
            date: dayDate.toISOString(),
            workoutCount: 1,
          });
        }
      }
      return weekDays;
    });
    return days;
  }, [volumeData]);

  // Derive RPE data from logs
  const rpeData = useMemo(() => {
    const rpePoints: RpeDataPoint[] = logs
      .filter(
        (log): log is WorkoutLog & { completedAt: string; overallRpe: number } =>
          !!log.completedAt && !!log.overallRpe
      )
      .map((log) => ({
        date: log.completedAt,
        rpe: log.overallRpe,
      }))
      .reverse();
    return rpePoints;
  }, [logs]);

  if (isUserLoading || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">
              Track your training progress and performance metrics
            </p>
          </div>
          <Select
            value={String(weeks)}
            onValueChange={(v) => setWeeks(Number(v))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Current Streak
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.currentStreak}</div>
                <p className="text-xs text-muted-foreground">consecutive days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Dumbbell className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.workoutsThisMonth}
                </div>
                <p className="text-xs text-muted-foreground">
                  workouts completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Avg Duration
                </CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageDuration ? `${summary.averageDuration}m` : "\u2014"}
                </div>
                <p className="text-xs text-muted-foreground">per workout</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Average RPE</CardTitle>
                <BarChart3 className="h-4 w-4 text-purple-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.averageRpe?.toFixed(1) || "\u2014"}
                </div>
                <p className="text-xs text-muted-foreground">
                  training intensity
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <VolumeChart weeks={volumeData} />
          <FrequencyHeatmap workouts={workoutDays} weeks={weeks} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RpeTrendsChart data={rpeData} />
          <PersonalRecords records={personalRecords} />
        </div>

        {/* Strength Progress */}
        <StrengthProgress
          exercises={exercises}
        />

        {/* All Time Stats */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle>All Time</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {summary.totalWorkouts}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Workouts
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {summary.workoutsThisWeek}
                  </div>
                  <div className="text-sm text-muted-foreground">This Week</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {volumeData.reduce((sum, w) => sum + w.setCount, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Sets ({weeks}w)
                  </div>
                </div>
                {summary.lastWorkout && (
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {formatRelativeDate(summary.lastWorkout)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Last Workout
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
  );
}
