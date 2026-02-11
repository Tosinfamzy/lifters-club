"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Dumbbell,
  Edit2,
  Save,
  X,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { type LoggedSet, type WorkoutLogWithSets } from "@/lib/api";
import { useApi } from "@/lib/use-api";

interface WorkoutDrawerProps {
  log: WorkoutLogWithSets | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

interface EditingSet {
  id: string;
  weight: number;
  reps: number;
  rpe: number | null;
}

export function WorkoutDrawer({
  log,
  open,
  onOpenChange,
  onUpdate,
}: WorkoutDrawerProps) {
  const api = useApi();
  const [editingSet, setEditingSet] = useState<EditingSet | null>(null);
  const [saving, setSaving] = useState(false);

  if (!log) return null;

  const duration = log.completedAt
    ? Math.round(
        (new Date(log.completedAt).getTime() -
          new Date(log.startedAt).getTime()) /
          (1000 * 60)
      )
    : null;

  // Group sets by exercise
  const setsByExercise = log.sets.reduce(
    (acc, set) => {
      const existing = acc[set.exerciseId];
      if (existing) {
        existing.push(set);
      } else {
        acc[set.exerciseId] = [set];
      }
      return acc;
    },
    {} as Record<string, LoggedSet[]>
  );

  const handleEdit = (set: LoggedSet) => {
    setEditingSet({
      id: set.id,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
    });
  };

  const handleCancel = () => {
    setEditingSet(null);
  };

  const handleSave = async () => {
    if (!editingSet) return;

    setSaving(true);
    try {
      await api.updateSet(log.id, editingSet.id, {
        weight: editingSet.weight,
        reps: editingSet.reps,
        rpe: editingSet.rpe,
      });

      setEditingSet(null);
      toast.success("Set updated");
      onUpdate?.();
    } catch (error) {
      console.error("Failed to update set:", error);
      toast.error("Failed to update set");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (setId: string) => {
    if (!confirm("Are you sure you want to delete this set?")) return;

    try {
      await api.deleteSet(log.id, setId);
      toast.success("Set deleted");
      onUpdate?.();
    } catch (error) {
      console.error("Failed to delete set:", error);
      toast.error("Failed to delete set");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Workout Details</SheetTitle>
          <SheetDescription>
            View and edit your logged workout data
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Workout Info */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{formatDate(log.startedAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {formatTime(log.startedAt)}
                {duration && ` (${duration} min)`}
              </span>
            </div>
            {log.overallRpe && (
              <div className="flex items-center gap-2 text-sm">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <span>Overall RPE: {log.overallRpe}</span>
              </div>
            )}
            {log.notes && (
              <p className="text-sm text-muted-foreground">{log.notes}</p>
            )}
          </div>

          {/* Sets by Exercise */}
          <div className="space-y-4">
            <h3 className="font-semibold">Logged Sets</h3>

            {Object.entries(setsByExercise).map(([exerciseId, sets]) => (
              <div key={exerciseId} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {exerciseId}
                  </Badge>
                </div>

                <div className="space-y-2">
                  {sets
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((set) => (
                      <div
                        key={set.id}
                        className="flex items-center gap-2 rounded-lg bg-secondary p-3"
                      >
                        <span className="w-8 text-sm text-muted-foreground">
                          #{set.setNumber}
                        </span>

                        {editingSet?.id === set.id ? (
                          <>
                            <Input
                              type="number"
                              value={editingSet.weight}
                              onChange={(e) =>
                                setEditingSet({
                                  ...editingSet,
                                  weight: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-20 h-8"
                              placeholder="Weight"
                            />
                            <span className="text-xs text-muted-foreground">
                              lbs ×
                            </span>
                            <Input
                              type="number"
                              value={editingSet.reps}
                              onChange={(e) =>
                                setEditingSet({
                                  ...editingSet,
                                  reps: parseInt(e.target.value) || 0,
                                })
                              }
                              className="w-16 h-8"
                              placeholder="Reps"
                            />
                            <Input
                              type="number"
                              value={editingSet.rpe ?? ""}
                              onChange={(e) =>
                                setEditingSet({
                                  ...editingSet,
                                  rpe: e.target.value
                                    ? parseFloat(e.target.value)
                                    : null,
                                })
                              }
                              className="w-16 h-8"
                              placeholder="RPE"
                              min={1}
                              max={10}
                              step={0.5}
                            />
                            <div className="ml-auto flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={handleSave}
                                disabled={saving}
                              >
                                {saving ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Save className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={handleCancel}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{set.weight} lbs</span>
                            <span className="text-muted-foreground">×</span>
                            <span className="font-medium">{set.reps} reps</span>
                            {set.rpe && (
                              <Badge variant="secondary" className="ml-2">
                                RPE {set.rpe}
                              </Badge>
                            )}
                            <div className="ml-auto flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleEdit(set)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDelete(set.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            ))}

            {log.sets.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                No sets logged for this workout
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
