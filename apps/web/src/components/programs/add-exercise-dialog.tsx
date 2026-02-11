"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Search } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { Exercise } from "@/lib/api";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface AddExerciseDialogProps {
  sessionIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (sessionIndex: number, exercise: PlannedExercise) => void;
}

export function AddExerciseDialog({
  sessionIndex,
  open,
  onOpenChange,
  onAdd,
}: AddExerciseDialogProps) {
  const api = useApi();
  const [isLoading, setIsLoading] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>("");
  const [sets, setSets] = useState(3);
  const [minReps, setMinReps] = useState(8);
  const [maxReps, setMaxReps] = useState(12);
  const [restSeconds, setRestSeconds] = useState(90);

  const fetchExercises = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.getExercises({ limit: 100 });
      setExercises(response.data);
    } catch (error) {
      console.error("Failed to fetch exercises:", error);
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (open) {
      fetchExercises();
    }
  }, [open, fetchExercises]);

  const handleAdd = () => {
    if (!selectedExerciseId) return;

    const exercise: PlannedExercise = {
      exerciseId: selectedExerciseId,
      sets,
      repRange: [minReps, maxReps],
      restSeconds,
    };

    onAdd(sessionIndex, exercise);
    handleClose();
  };

  const handleClose = () => {
    setSelectedExerciseId("");
    setSets(3);
    setMinReps(8);
    setMaxReps(12);
    setRestSeconds(90);
    setSearchTerm("");
    onOpenChange(false);
  };

  const filteredExercises = exercises.filter(
    (e) =>
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.primaryMuscles.some((m) =>
        m.toLowerCase().includes(searchTerm.toLowerCase())
      ) ||
      e.equipment.some((eq) =>
        eq.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const selectedExercise = exercises.find((e) => e.id === selectedExerciseId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Exercise
          </DialogTitle>
          <DialogDescription>
            Add a new exercise to this session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search */}
          <div className="space-y-2">
            <Label>Search Exercises</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, muscle, equipment..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Exercise Selection */}
          <div className="space-y-2">
            <Label>Exercise</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : (
              <Select
                value={selectedExerciseId}
                onValueChange={setSelectedExerciseId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an exercise..." />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {filteredExercises.map((exercise) => (
                    <SelectItem key={exercise.id} value={exercise.id}>
                      <div className="flex flex-col">
                        <span>{exercise.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {exercise.primaryMuscles.slice(0, 2).join(", ")}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {selectedExercise && (
            <div className="rounded-lg bg-secondary p-3 text-sm">
              <p className="font-medium">{selectedExercise.name}</p>
              <p className="text-muted-foreground">
                {selectedExercise.equipment.join(", ")} •{" "}
                {selectedExercise.difficulty}
              </p>
            </div>
          )}

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sets</Label>
              <Input
                type="number"
                value={sets}
                onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                min={1}
                max={10}
              />
            </div>
            <div className="space-y-2">
              <Label>Rest (sec)</Label>
              <Input
                type="number"
                value={restSeconds}
                onChange={(e) => setRestSeconds(parseInt(e.target.value) || 60)}
                min={0}
                max={300}
                step={15}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Reps</Label>
              <Input
                type="number"
                value={minReps}
                onChange={(e) => setMinReps(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Reps</Label>
              <Input
                type="number"
                value={maxReps}
                onChange={(e) => setMaxReps(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={!selectedExerciseId}>
            <Plus className="mr-2 h-4 w-4" />
            Add Exercise
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
