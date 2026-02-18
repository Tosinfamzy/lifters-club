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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  PlayCircle,
  SkipForward,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { TrainingBlock, Program, Workout } from "@/lib/api";

interface TrainingBlockProgressProps {
  block: TrainingBlock;
  program: Program;
  workouts: Workout[];
  onWeekGenerated?: () => void;
}

const STATUS_ICONS: Record<Workout["status"], React.ElementType> = {
  pending: Circle,
  in_progress: PlayCircle,
  completed: CheckCircle,
  skipped: SkipForward,
};

const STATUS_COLORS: Record<Workout["status"], string> = {
  pending: "text-muted-foreground",
  in_progress: "text-blue-500",
  completed: "text-green-500",
  skipped: "text-yellow-500",
};

const STATUS_LABELS: Record<Workout["status"], string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  skipped: "Skipped",
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function TrainingBlockProgress({
  block,
  program,
  workouts,
  onWeekGenerated,
}: TrainingBlockProgressProps) {
  const api = useApi();
  const [isGenerating, setIsGenerating] = useState(false);
  const [forceDeload, setForceDeload] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<{
    weekNumber: number;
    isDeloadWeek: boolean;
    summary: string;
  } | null>(null);
  const [skippingWorkoutId, setSkippingWorkoutId] = useState<string | null>(null);
  const [confirmSkipId, setConfirmSkipId] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  const totalWeeks = program.template.weeks;
  const progressPercent = (block.currentWeek / totalWeeks) * 100;

  // Filter workouts for current week
  const currentWeekWorkouts = workouts.filter(
    (w) => w.weekNumber === block.currentWeek
  );

  // Check if current week is complete (account for locally-skipped workouts)
  const isWeekComplete =
    currentWeekWorkouts.length > 0 &&
    currentWeekWorkouts.every(
      (w) => w.status === "completed" || w.status === "skipped" || skippedIds.has(w.id)
    );

  // Check if program is complete
  const isProgramComplete =
    block.currentWeek >= totalWeeks && isWeekComplete;

  const handleSkipWorkout = async (workoutId: string) => {
    setSkippingWorkoutId(workoutId);
    setError(null);
    try {
      await api.updateWorkout(workoutId, { status: "skipped" });
      setSkippedIds((prev) => new Set(prev).add(workoutId));
      setConfirmSkipId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to skip workout");
    } finally {
      setSkippingWorkoutId(null);
    }
  };

  const handleGenerateWeek = async () => {
    setIsGenerating(true);
    setError(null);
    setGenerationResult(null);

    try {
      const response = await api.generateWeek(block.id, { forceDeload });
      setGenerationResult({
        weekNumber: response.data.weekNumber,
        isDeloadWeek: response.data.isDeloadWeek,
        summary: response.data.summary,
      });
      onWeekGenerated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate week");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isProgramComplete) {
    return (
      <Card className="border-green-500/30 bg-gradient-to-r from-green-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10 text-green-500">
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Program Complete!</CardTitle>
              <CardDescription>
                Congratulations on completing {program.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You&apos;ve finished all {totalWeeks} weeks of this program. Consider
            starting a new program or repeating this one with higher weights.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {program.name}
            </CardTitle>
            <CardDescription>
              Week {block.currentWeek} of {totalWeeks}
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-sm">
            {block.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Program Progress</span>
            <span className="font-medium">{Math.round(progressPercent)}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Current Week Workouts */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">This Week&apos;s Workouts</h4>
          {currentWeekWorkouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No workouts scheduled for this week yet.
            </p>
          ) : (
            <div className="space-y-2">
              {currentWeekWorkouts.map((workout) => {
                const effectiveStatus = skippedIds.has(workout.id) ? "skipped" : workout.status;
                const StatusIcon = STATUS_ICONS[effectiveStatus];
                const statusColor = STATUS_COLORS[effectiveStatus];
                const canSkip = effectiveStatus === "pending";
                const isConfirming = confirmSkipId === workout.id;
                const isSkipping = skippingWorkoutId === workout.id;

                return (
                  <div
                    key={workout.id}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`h-5 w-5 ${statusColor}`} />
                      <div>
                        <p className="text-sm font-medium">
                          Day {workout.dayNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {workout.plannedExercises?.length ?? 0} exercises
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canSkip && !isConfirming && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-yellow-500"
                          onClick={() => setConfirmSkipId(workout.id)}
                        >
                          <SkipForward className="mr-1 h-3 w-3" />
                          Skip
                        </Button>
                      )}
                      {isConfirming && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs border-yellow-500/50 text-yellow-500 hover:bg-yellow-500/10"
                            onClick={() => handleSkipWorkout(workout.id)}
                            disabled={isSkipping}
                          >
                            {isSkipping ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Confirm"
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => setConfirmSkipId(null)}
                            disabled={isSkipping}
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                      <div className="text-right">
                        <Badge
                          variant="outline"
                          className={`text-xs ${statusColor}`}
                        >
                          {STATUS_LABELS[effectiveStatus]}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(workout.scheduledDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Week Complete - Generate Next Week */}
        {isWeekComplete && block.currentWeek < totalWeeks && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <p className="font-medium">Week {block.currentWeek} Complete!</p>
            </div>

            {generationResult ? (
              <div className="space-y-2">
                <p className="text-sm text-green-600">
                  Week {generationResult.weekNumber} generated successfully!
                </p>
                {generationResult.isDeloadWeek && (
                  <Badge variant="secondary">Deload Week</Badge>
                )}
                <p className="text-xs text-muted-foreground">
                  {generationResult.summary}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Ready to generate week {block.currentWeek + 1}. The decision
                  engine will analyze your performance and adjust weights and
                  volumes accordingly.
                </p>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="deload"
                    checked={forceDeload}
                    onCheckedChange={setForceDeload}
                  />
                  <Label htmlFor="deload">Request deload week</Label>
                </div>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <Button
                  onClick={handleGenerateWeek}
                  disabled={isGenerating}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Week {block.currentWeek + 1}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Week in progress */}
        {!isWeekComplete && currentWeekWorkouts.length > 0 && (
          <div className="rounded-lg bg-secondary/50 p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Complete or skip remaining workouts to advance
              </p>
            </div>
          </div>
        )}

        {error && !isGenerating && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
