"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { getWeightStep } from "@/lib/constants";
import type { WeightUnit } from "@gymapp/types";

interface SetInputProps {
  setNumber: number;
  weight: number | "";
  reps: number | "";
  rpe: number | "";
  weightUnit?: WeightUnit;
  onWeightChange: (value: number | "") => void;
  onRepsChange: (value: number | "") => void;
  onRpeChange: (value: number | "") => void;
  onRemove: () => void;
  showRemove: boolean;
}

export function SetInput({
  setNumber,
  weight,
  reps,
  rpe,
  weightUnit = "lbs",
  onWeightChange,
  onRepsChange,
  onRpeChange,
  onRemove,
  showRemove,
}: SetInputProps) {
  const handleNumberChange = (
    value: string,
    onChange: (v: number | "") => void,
    allowDecimal = false
  ) => {
    if (value === "") {
      onChange("");
      return;
    }
    const num = allowDecimal ? parseFloat(value) : parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      onChange(num);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <span className="w-8 text-sm text-muted-foreground font-medium">
        #{setNumber}
      </span>
      <Input
        type="number"
        placeholder="Weight"
        className="w-24"
        value={weight}
        onChange={(e) => handleNumberChange(e.target.value, onWeightChange, true)}
        min={0}
        max={2000}
        step={getWeightStep(weightUnit)}
      />
      <span className="text-muted-foreground">×</span>
      <Input
        type="number"
        placeholder="Reps"
        className="w-20"
        value={reps}
        onChange={(e) => handleNumberChange(e.target.value, onRepsChange)}
        min={1}
        max={100}
      />
      <Input
        type="number"
        placeholder="RPE"
        className="w-16"
        value={rpe}
        onChange={(e) => handleNumberChange(e.target.value, onRpeChange)}
        min={1}
        max={10}
        step={0.5}
      />
      {showRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      {!showRemove && <div className="w-8" />}
    </div>
  );
}
