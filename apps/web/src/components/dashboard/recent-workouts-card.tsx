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
  History,
  ArrowRight,
  Dumbbell,
  Loader2,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import type { Workout } from "@/lib/api";
import { formatRelativeDate } from "@/lib/format";

interface RecentWorkoutsCardProps {
  workouts: Workout[] | null;
  isLoading: boolean;
}

function formatExerciseName(exerciseId: string): string {
  return exerciseId
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RecentWorkoutsCard({ workouts, isLoading }: RecentWorkoutsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-[300px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const hasWorkouts = workouts && workouts.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Recent Workouts
        </CardTitle>
        <CardDescription>Your latest completed sessions</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasWorkouts ? (
          <div className="text-center py-6">
            <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No completed workouts yet. Start training to see your history here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {workouts.slice(0, 5).map((workout) => {
              const exerciseCount = workout.plannedExercises?.length || 0;
              const totalSets = workout.plannedExercises?.reduce(
                (sum, ex) => sum + ex.sets,
                0
              ) || 0;
              const firstExercise = workout.plannedExercises?.[0];

              return (
                <Link
                  key={workout.id}
                  href={`/history?workoutId=${workout.id}`}
                  className="block"
                >
                  <div className="flex items-center gap-3 rounded-lg bg-secondary p-3 hover:bg-secondary/80 transition-colors">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-green-500">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">
                          Week {workout.weekNumber}, Day {workout.dayNumber}
                        </p>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {exerciseCount} exercises
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {firstExercise
                          ? formatExerciseName(firstExercise.exerciseId)
                          : "No exercises"}
                        {exerciseCount > 1 && ` +${exerciseCount - 1} more`}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        {formatRelativeDate(workout.scheduledDate)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {totalSets} sets
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/history">
                View All History
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
