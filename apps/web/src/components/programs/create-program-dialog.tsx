"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Loader2, Plus } from "lucide-react";
import { useApi } from "@/lib/use-api";
import type { CreateProgramInput, ProgramTemplate } from "@/lib/api";

interface CreateProgramDialogProps {
  trigger?: React.ReactNode;
}

function generateProgramId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function createDefaultTemplate(daysPerWeek: number): ProgramTemplate {
  const sessions = Array.from({ length: daysPerWeek }, (_, i) => ({
    dayNumber: i + 1,
    name: `Day ${i + 1}`,
    focus: ["full body"],
    exercises: [],
  }));

  return {
    weeks: 4,
    sessions,
  };
}

export function CreateProgramDialog({ trigger }: CreateProgramDialogProps) {
  const router = useRouter();
  const api = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState("3");
  const [goal, setGoal] = useState<"strength" | "hypertrophy" | "conditioning">("hypertrophy");
  const [level, setLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");

  const resetForm = () => {
    setName("");
    setDescription("");
    setDaysPerWeek("3");
    setGoal("hypertrophy");
    setLevel("intermediate");
    setError(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Program name is required");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const programId = generateProgramId(name);
      const days = parseInt(daysPerWeek, 10);

      const input: CreateProgramInput = {
        id: programId,
        name: name.trim(),
        description: description.trim() || undefined,
        daysPerWeek: days,
        goal,
        level,
        template: createDefaultTemplate(days),
      };

      const response = await api.createProgram(input);
      setIsOpen(false);
      resetForm();
      router.push(`/programs/${response.data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create program");
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Program
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Program</DialogTitle>
          <DialogDescription>
            Create a new training program. You can add exercises after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Program Name</Label>
            <Input
              id="name"
              placeholder="e.g., Push Pull Legs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="Brief description of the program"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isCreating}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="daysPerWeek">Days per Week</Label>
              <Select
                value={daysPerWeek}
                onValueChange={setDaysPerWeek}
                disabled={isCreating}
              >
                <SelectTrigger id="daysPerWeek">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                    <SelectItem key={day} value={String(day)}>
                      {day} {day === 1 ? "day" : "days"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="level">Level</Label>
              <Select
                value={level}
                onValueChange={(v) => setLevel(v as typeof level)}
                disabled={isCreating}
              >
                <SelectTrigger id="level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="goal">Training Goal</Label>
            <Select
              value={goal}
              onValueChange={(v) => setGoal(v as typeof goal)}
              disabled={isCreating}
            >
              <SelectTrigger id="goal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hypertrophy">Hypertrophy (Muscle Growth)</SelectItem>
                <SelectItem value="strength">Strength</SelectItem>
                <SelectItem value="conditioning">Conditioning</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              "Create Program"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
