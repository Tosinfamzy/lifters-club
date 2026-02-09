"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { OverrideReason } from "@/lib/api";
import { OVERRIDE_REASON_LABELS } from "@/lib/api";

interface OverrideReasonPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: OverrideReason) => void;
  isLoading?: boolean;
}

const OVERRIDE_REASONS: OverrideReason[] = [
  "felt_too_heavy",
  "felt_too_light",
  "equipment_unavailable",
  "time_constraint",
  "injury_concern",
  "other",
];

export function OverrideReasonPicker({
  open,
  onOpenChange,
  onConfirm,
  isLoading = false,
}: OverrideReasonPickerProps) {
  const [selectedReason, setSelectedReason] = useState<OverrideReason | null>(null);

  const handleConfirm = () => {
    if (selectedReason) {
      onConfirm(selectedReason);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedReason(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Why are you adjusting?</DialogTitle>
          <DialogDescription>
            Help improve future recommendations by telling us why you&apos;re making
            a different choice.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedReason ?? undefined}
          onValueChange={(value) => setSelectedReason(value as OverrideReason)}
          className="space-y-3"
        >
          {OVERRIDE_REASONS.map((reason) => (
            <div
              key={reason}
              className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-secondary/50 transition-colors"
            >
              <RadioGroupItem value={reason} id={reason} />
              <Label
                htmlFor={reason}
                className="flex-1 cursor-pointer font-normal"
              >
                {OVERRIDE_REASON_LABELS[reason]}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedReason || isLoading}
          >
            {isLoading ? "Saving..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
