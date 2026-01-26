"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save, X, RefreshCw } from "lucide-react";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface Exercise {
  id: string;
  name: string;
}

interface ExerciseEditorProps {
  exercise: PlannedExercise;
  exerciseIndex: number;
  sessionIndex: number;
  exerciseList: Exercise[];
  onSave: (
    sessionIndex: number,
    exerciseIndex: number,
    exercise: PlannedExercise
  ) => void;
  onCancel: () => void;
  onSwapExercise?: (
    sessionIndex: number,
    exerciseIndex: number,
    newExerciseId: string
  ) => void;
}

export function ExerciseEditor({
  exercise,
  exerciseIndex,
  sessionIndex,
  exerciseList,
  onSave,
  onCancel,
  onSwapExercise,
}: ExerciseEditorProps) {
  const [editedExercise, setEditedExercise] = useState<PlannedExercise>({
    ...exercise,
  });
  const [showExerciseSwap, setShowExerciseSwap] = useState(false);

  const handleSave = () => {
    onSave(sessionIndex, exerciseIndex, editedExercise);
  };

  const handleSwapExercise = (newExerciseId: string) => {
    setEditedExercise({ ...editedExercise, exerciseId: newExerciseId });
    setShowExerciseSwap(false);
    if (onSwapExercise) {
      onSwapExercise(sessionIndex, exerciseIndex, newExerciseId);
    }
  };

  const currentExerciseName =
    exerciseList.find((e) => e.id === editedExercise.exerciseId)?.name ||
    editedExercise.exerciseId;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{currentExerciseName}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExerciseSwap(!showExerciseSwap)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Swap
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showExerciseSwap && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Replace with:</label>
            <Select onValueChange={handleSwapExercise}>
              <SelectTrigger>
                <SelectValue placeholder="Select exercise..." />
              </SelectTrigger>
              <SelectContent>
                {exerciseList
                  .filter((e) => e.id !== editedExercise.exerciseId)
                  .map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

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
  );
}
