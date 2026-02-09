"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, Dumbbell } from "lucide-react";
import { ExerciseSearch } from "./exercise-search";
import { SetInput } from "./set-input";
import type { Exercise } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ExerciseEntry {
  id: string;
  exercise: Exercise | null;
  sets: {
    weight: number | "";
    reps: number | "";
    rpe: number | "";
  }[];
}

interface LogWorkoutDialogProps {
  getToken: () => Promise<string | null>;
  onSuccess: () => void;
}

export function LogWorkoutDialog({ getToken, onSuccess }: LogWorkoutDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [date, setDate] = useState(() => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    return dateStr ?? "";
  });
  const [notes, setNotes] = useState("");
  const [overallRpe, setOverallRpe] = useState<number | "">("");
  const [exercises, setExercises] = useState<ExerciseEntry[]>([
    { id: crypto.randomUUID(), exercise: null, sets: [{ weight: "", reps: "", rpe: "" }] },
  ]);

  const resetForm = () => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    setDate(dateStr ?? "");
    setNotes("");
    setOverallRpe("");
    setExercises([
      { id: crypto.randomUUID(), exercise: null, sets: [{ weight: "", reps: "", rpe: "" }] },
    ]);
    setError(null);
  };

  const addExercise = () => {
    setExercises([
      ...exercises,
      { id: crypto.randomUUID(), exercise: null, sets: [{ weight: "", reps: "", rpe: "" }] },
    ]);
  };

  const removeExercise = (id: string) => {
    if (exercises.length > 1) {
      setExercises(exercises.filter((e) => e.id !== id));
    }
  };

  const updateExercise = (id: string, exercise: Exercise) => {
    setExercises(
      exercises.map((e) => (e.id === id ? { ...e, exercise } : e))
    );
  };

  const addSet = (exerciseId: string) => {
    setExercises(
      exercises.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: [...e.sets, { weight: "", reps: "", rpe: "" }] }
          : e
      )
    );
  };

  const removeSet = (exerciseId: string, setIndex: number) => {
    setExercises(
      exercises.map((e) =>
        e.id === exerciseId
          ? { ...e, sets: e.sets.filter((_, i) => i !== setIndex) }
          : e
      )
    );
  };

  const updateSet = (
    exerciseId: string,
    setIndex: number,
    field: "weight" | "reps" | "rpe",
    value: number | ""
  ) => {
    setExercises(
      exercises.map((e) =>
        e.id === exerciseId
          ? {
              ...e,
              sets: e.sets.map((s, i) =>
                i === setIndex ? { ...s, [field]: value } : s
              ),
            }
          : e
      )
    );
  };

  const validateForm = (): boolean => {
    // Check if at least one exercise is selected
    const validExercises = exercises.filter((e) => e.exercise !== null);
    if (validExercises.length === 0) {
      setError("Please add at least one exercise");
      return false;
    }

    // Check if each exercise has at least one valid set
    for (const entry of validExercises) {
      const validSets = entry.sets.filter(
        (s) => s.weight !== "" && s.reps !== ""
      );
      if (validSets.length === 0) {
        setError(`Please add at least one set for ${entry.exercise!.name}`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await getToken();

      // Build the request body
      if (!date) {
        setError("Please select a date");
        setIsSubmitting(false);
        return;
      }
      const workoutDate = new Date(date);
      workoutDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

      const body = {
        date: workoutDate.toISOString(),
        overallRpe: overallRpe !== "" ? overallRpe : undefined,
        notes: notes.trim() || undefined,
        exercises: exercises
          .filter((e) => e.exercise !== null)
          .map((e) => ({
            exerciseId: e.exercise!.id,
            sets: e.sets
              .filter((s) => s.weight !== "" && s.reps !== "")
              .map((s) => ({
                weight: Number(s.weight),
                reps: Number(s.reps),
                rpe: s.rpe !== "" ? Number(s.rpe) : undefined,
              })),
          })),
      };

      const response = await fetch(`${API_URL}/api/logs/retrospective`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to log workout`);
      }

      // Success
      resetForm();
      setOpen(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log workout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSets = exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.weight !== "" && s.reps !== "").length,
    0
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) {
        setError(null);
      }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="mr-2 h-4 w-4" />
          Log Past Workout
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Past Workout</DialogTitle>
          <DialogDescription>
            Record a workout you completed previously
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="workout-date">Date</Label>
            <Input
              id="workout-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Exercises */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Exercises</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addExercise}
              >
                <Plus className="mr-1 h-3 w-3" />
                Add Exercise
              </Button>
            </div>

            {exercises.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border p-4 space-y-4"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <ExerciseSearch
                      onSelect={(exercise) => updateExercise(entry.id, exercise)}
                      selectedId={entry.exercise?.id}
                    />
                  </div>
                  {exercises.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeExercise(entry.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${entry.exercise?.name || "exercise"}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                {entry.exercise && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      <Dumbbell className="h-3 w-3" />
                      <span>{entry.exercise.name}</span>
                    </div>

                    {/* Set headers */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="w-8">Set</span>
                      <span className="w-24">Weight (lbs)</span>
                      <span className="w-5" />
                      <span className="w-20">Reps</span>
                      <span className="w-16">RPE</span>
                    </div>

                    {/* Sets */}
                    {entry.sets.map((set, setIndex) => (
                      <SetInput
                        key={setIndex}
                        setNumber={setIndex + 1}
                        weight={set.weight}
                        reps={set.reps}
                        rpe={set.rpe}
                        onWeightChange={(v) =>
                          updateSet(entry.id, setIndex, "weight", v)
                        }
                        onRepsChange={(v) =>
                          updateSet(entry.id, setIndex, "reps", v)
                        }
                        onRpeChange={(v) =>
                          updateSet(entry.id, setIndex, "rpe", v)
                        }
                        onRemove={() => removeSet(entry.id, setIndex)}
                        showRemove={entry.sets.length > 1}
                      />
                    ))}

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addSet(entry.id)}
                      className="w-full mt-2"
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add Set
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Overall RPE */}
          <div className="space-y-2">
            <Label htmlFor="overall-rpe">Overall RPE (optional)</Label>
            <Input
              id="overall-rpe"
              type="number"
              placeholder="1-10"
              className="w-24"
              value={overallRpe}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") {
                  setOverallRpe("");
                } else {
                  const num = parseInt(val, 10);
                  if (!isNaN(num) && num >= 1 && num <= 10) {
                    setOverallRpe(num);
                  }
                }
              }}
              min={1}
              max={10}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              placeholder="How did the workout feel?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          {/* Summary & Submit */}
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <span className="text-sm text-muted-foreground">
              {exercises.filter((e) => e.exercise).length} exercise
              {exercises.filter((e) => e.exercise).length !== 1 ? "s" : ""},{" "}
              {totalSets} set{totalSets !== 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Workout
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
