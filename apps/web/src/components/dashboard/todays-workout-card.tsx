"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dumbbell,
  Calendar,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Loader2,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import type { DecisionType, TodaysWorkoutResponse } from "@/lib/api";

interface TodaysWorkoutCardProps {
  data: TodaysWorkoutResponse | null;
  isLoading: boolean;
}

const DECISION_ICONS: Partial<Record<DecisionType, React.ElementType>> = {
  load_progression: TrendingUp,
  volume_adjustment: BarChart3,
};

const DECISION_COLORS: Partial<Record<DecisionType, string>> = {
  load_progression: "bg-green-500/10 text-green-500 border-green-500/20",
  volume_adjustment: "bg-blue-500/10 text-blue-500 border-blue-500/20",
};

function formatExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function TodaysWorkoutCard({ data, isLoading }: TodaysWorkoutCardProps) {
  if (isLoading) {
    return (
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="flex h-[200px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium mb-1">No workout scheduled today</p>
          <p className="text-sm text-muted-foreground mb-4">
            Start a program to see your daily workouts here
          </p>
          <Button variant="outline" asChild>
            <Link href="/programs">
              Browse Programs
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { workout, decisions } = data;
  const exerciseCount = workout.plannedExercises?.length || 0;
  const totalSets = workout.plannedExercises?.reduce((sum, ex) => sum + ex.sets, 0) || 0;

  // Create a map of exerciseId to decision for quick lookup
  const decisionMap = new Map(decisions.map((d) => [d.exerciseId, d]));

  return (
    <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Today&apos;s Workout</CardTitle>
              <CardDescription>
                Week {workout.weekNumber}, Day {workout.dayNumber}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {exerciseCount} exercises
            </Badge>
            <Badge variant="outline" className="font-normal">
              {totalSets} sets
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Exercise List */}
        <div className="space-y-2">
          {workout.plannedExercises?.slice(0, 4).map((exercise) => {
            const decision = decisionMap.get(exercise.exerciseId);
            const DecisionIcon = decision ? DECISION_ICONS[decision.type] : null;
            const decisionColor = decision ? DECISION_COLORS[decision.type] : "";

            return (
              <div
                key={exercise.exerciseId}
                className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-sm">
                    {formatExerciseName(exercise.exerciseId)}
                  </span>
                  {decision && DecisionIcon && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${decisionColor}`}
                    >
                      <DecisionIcon className="mr-1 h-3 w-3" />
                      {decision.summary}
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {exercise.sets} × {exercise.repRange[0]}-{exercise.repRange[1]}
                </span>
              </div>
            );
          })}
          {exerciseCount > 4 && (
            <p className="text-sm text-muted-foreground text-center py-1">
              +{exerciseCount - 4} more exercises
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button className="flex-1" variant="outline" asChild>
            <Link href={`/history?workoutId=${workout.id}`}>
              View Details
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button className="flex-1" disabled>
            <Smartphone className="mr-2 h-4 w-4" />
            Log on Mobile
          </Button>
        </div>

        {/* Decisions Summary */}
        {decisions.length > 0 && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
            <p className="text-sm font-medium mb-1">
              {decisions.length} recommendation{decisions.length !== 1 ? "s" : ""} for today
            </p>
            <p className="text-xs text-muted-foreground">
              The decision engine has suggestions for{" "}
              {decisions.map((d) => formatExerciseName(d.exerciseId)).join(", ")}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
