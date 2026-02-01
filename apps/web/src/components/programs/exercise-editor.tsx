"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, RefreshCw } from "lucide-react";
import { ExerciseAlternativesDialog } from "./exercise-alternatives-dialog";
import type { Exercise } from "@/lib/api";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface ExerciseEditorProps {
  exercise: PlannedExercise;
  exerciseIndex: number;
  sessionIndex: number;
  exerciseList: Array<{ id: string; name: string }>;
  onSave: (
    sessionIndex: number,
    exerciseIndex: number,
    exercise: PlannedExercise
  ) => void;
  onCancel: () => void;
}

export function ExerciseEditor({
  exercise,
  exerciseIndex,
  sessionIndex,
  exerciseList,
  onSave,
  onCancel,
}: ExerciseEditorProps) {
  const [editedExercise, setEditedExercise] = useState<PlannedExercise>({
    ...exercise,
  });
  const [showAlternatives, setShowAlternatives] = useState(false);

  const handleSave = () => {
    onSave(sessionIndex, exerciseIndex, editedExercise);
  };

  const handleSelectAlternative = (newExercise: Exercise) => {
    setEditedExercise({ ...editedExercise, exerciseId: newExercise.id });
  };

  const currentExerciseName =
    exerciseList.find((e) => e.id === editedExercise.exerciseId)?.name ||
    editedExercise.exerciseId;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{currentExerciseName}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAlternatives(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Swap
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sets</label>
              <Input
                type="number"
                value={editedExercise.sets}
                onChange={(e) =>
                  setEditedExercise({
                    ...editedExercise,
                    sets: parseInt(e.target.value) || 1,
                  })
                }
                min={1}
                max={10}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Rest (sec)</label>
              <Input
                type="number"
                value={editedExercise.restSeconds}
                onChange={(e) =>
                  setEditedExercise({
                    ...editedExercise,
                    restSeconds: parseInt(e.target.value) || 60,
                  })
                }
                min={0}
                max={300}
                step={15}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Min Reps</label>
              <Input
                type="number"
                value={editedExercise.repRange[0]}
                onChange={(e) =>
                  setEditedExercise({
                    ...editedExercise,
                    repRange: [
                      parseInt(e.target.value) || 1,
                      editedExercise.repRange[1],
                    ],
                  })
                }
                min={1}
                max={50}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Reps</label>
              <Input
                type="number"
                value={editedExercise.repRange[1]}
                onChange={(e) =>
                  setEditedExercise({
                    ...editedExercise,
                    repRange: [
                      editedExercise.repRange[0],
                      parseInt(e.target.value) || 1,
                    ],
                  })
                }
                min={1}
                max={50}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <ExerciseAlternativesDialog
        exerciseId={editedExercise.exerciseId}
        exerciseName={currentExerciseName}
        open={showAlternatives}
        onOpenChange={setShowAlternatives}
        onSelect={handleSelectAlternative}
      />
    </>
  );
}
