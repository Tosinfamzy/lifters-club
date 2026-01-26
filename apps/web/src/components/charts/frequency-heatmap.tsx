"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WorkoutDay {
  date: string;
  workoutCount: number;
}

interface FrequencyHeatmapProps {
  workouts: WorkoutDay[];
  weeks?: number;
}

export function FrequencyHeatmap({ workouts, weeks = 12 }: FrequencyHeatmapProps) {
  const { grid, monthLabels, stats } = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - weeks * 7);

    // Create a map of dates to workout counts
    const workoutMap = new Map<string, number>();
    workouts.forEach((w) => {
      const dateKey = w.date.split("T")[0] ?? w.date;
      workoutMap.set(dateKey, (workoutMap.get(dateKey) || 0) + w.workoutCount);
    });

    // Generate grid data (7 rows for days of week, columns for weeks)
    const gridData: { date: Date; count: number }[][] = [];
    const months: { label: string; week: number }[] = [];

    let currentDate = new Date(startDate);
    // Align to start of week (Sunday)
    currentDate.setDate(currentDate.getDate() - currentDate.getDay());

    let weekIndex = 0;
    let lastMonth = -1;

    while (currentDate <= today || weekIndex < weeks) {
      const weekData: { date: Date; count: number }[] = [];

      for (let day = 0; day < 7; day++) {
        const dateKey = currentDate.toISOString().split("T")[0] ?? "";
        const count = workoutMap.get(dateKey) || 0;
        weekData.push({ date: new Date(currentDate), count });

        // Track month labels
        if (currentDate.getMonth() !== lastMonth && currentDate <= today) {
          months.push({
            label: currentDate.toLocaleDateString("en-US", { month: "short" }),
            week: weekIndex,
          });
          lastMonth = currentDate.getMonth();
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      gridData.push(weekData);
      weekIndex++;

      if (weekIndex >= weeks) break;
    }

    // Calculate stats
    const totalWorkouts = workouts.reduce((sum, w) => sum + w.workoutCount, 0);
    const daysWithWorkouts = workouts.length;
    const avgPerWeek = totalWorkouts / weeks;

    return {
      grid: gridData,
      monthLabels: months,
      stats: { totalWorkouts, daysWithWorkouts, avgPerWeek },
    };
  }, [workouts, weeks]);

  const getIntensityClass = (count: number) => {
    if (count === 0) return "bg-muted";
    if (count === 1) return "bg-green-900/50";
    if (count === 2) return "bg-green-700/70";
    return "bg-green-500";
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Frequency</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Month labels */}
          <div className="flex text-xs text-muted-foreground ml-8">
            {monthLabels.map((month, i) => (
              <span
                key={i}
                className="absolute"
                style={{ marginLeft: `${month.week * 14 + 32}px` }}
              >
                {month.label}
              </span>
            ))}
          </div>

          {/* Heatmap grid */}
          <div className="flex gap-1 mt-6">
            {/* Day labels */}
            <div className="flex flex-col gap-1 text-xs text-muted-foreground pr-2">
              {dayLabels.map((day, i) => (
                <div key={day} className="h-3 flex items-center">
                  {i % 2 === 1 ? day : ""}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="flex gap-[2px]">
              {grid.map((week, weekIdx) => (
                <div key={weekIdx} className="flex flex-col gap-[2px]">
                  {week.map((day, dayIdx) => {
                    const isToday =
                      day.date.toDateString() === new Date().toDateString();
                    const isFuture = day.date > new Date();

                    return (
                      <div
                        key={dayIdx}
                        className={`w-3 h-3 rounded-sm ${
                          isFuture
                            ? "bg-transparent"
                            : getIntensityClass(day.count)
                        } ${isToday ? "ring-1 ring-primary" : ""}`}
                        title={`${day.date.toLocaleDateString()}: ${day.count} workout${day.count !== 1 ? "s" : ""}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 rounded-sm bg-muted" />
                <div className="w-3 h-3 rounded-sm bg-green-900/50" />
                <div className="w-3 h-3 rounded-sm bg-green-700/70" />
                <div className="w-3 h-3 rounded-sm bg-green-500" />
              </div>
              <span>More</span>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="text-center">
                <div className="font-bold">{stats.totalWorkouts}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="font-bold">{stats.avgPerWeek.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Per Week</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
