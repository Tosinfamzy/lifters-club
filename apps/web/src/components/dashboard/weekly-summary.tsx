"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Dumbbell,
  TrendingUp,
  Loader2,
  Trophy,
} from "lucide-react";
import { useAppUser } from "@/providers/user-provider";
import { useWeeklySummary } from "@/lib/queries";

export function WeeklySummary() {
  const { isLoading: isUserLoading } = useAppUser();
  const [weekOffset, setWeekOffset] = useState(0);

  const { data: summary, isLoading } = useWeeklySummary(weekOffset);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    return `${startDate.toLocaleDateString("en-US", options)} - ${endDate.toLocaleDateString("en-US", options)}`;
  };

  const getWeekLabel = () => {
    if (weekOffset === 0) return "This Week";
    if (weekOffset === 1) return "Last Week";
    return `${weekOffset} Weeks Ago`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    }
    if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}k`;
    }
    return volume.toString();
  };

  if (isUserLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Weekly Summary</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              disabled={weekOffset >= 12}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground min-w-25 text-center">
              {getWeekLabel()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setWeekOffset((prev) => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>
          {formatDateRange(summary.weekStart, summary.weekEnd)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {summary.workoutCount === 0 ? (
          <div className="text-center py-8">
            <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No workouts logged this week</p>
          </div>
        ) : (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.workoutCount}</div>
                <div className="text-xs text-muted-foreground">Workouts</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{summary.totalSets}</div>
                <div className="text-xs text-muted-foreground">Sets</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{formatVolume(summary.totalVolume)}</div>
                <div className="text-xs text-muted-foreground">Volume (lbs)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {summary.averageRpe?.toFixed(1) || "—"}
                </div>
                <div className="text-xs text-muted-foreground">Avg RPE</div>
              </div>
            </div>

            {/* Day Breakdown */}
            <div>
              <p className="text-sm font-medium mb-2">Training Days</p>
              <div className="flex gap-1">
                {summary.dayBreakdown.map((day) => (
                  <div
                    key={day.day}
                    className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors ${
                      day.trained
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {day.day}
                  </div>
                ))}
              </div>
            </div>

            {/* Top Exercises */}
            {summary.exerciseBreakdown.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Top Exercises by Volume</p>
                <div className="space-y-2">
                  {summary.exerciseBreakdown.slice(0, 3).map((exercise) => {
                    const maxVolume = summary.exerciseBreakdown[0]?.totalVolume || 1;
                    const percentage = (exercise.totalVolume / maxVolume) * 100;

                    return (
                      <div key={exercise.exerciseId} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize truncate">
                            {exercise.exerciseId.replace(/-/g, " ")}
                          </span>
                          <span className="text-muted-foreground">
                            {formatVolume(exercise.totalVolume)} lbs
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Highlights */}
            {summary.highlights.length > 0 && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Highlights</span>
                </div>
                <ul className="space-y-1">
                  {summary.highlights.map((highlight, index) => (
                    <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 text-green-500" />
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
