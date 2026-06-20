"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cog, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { EquipmentInstanceInput } from "@gymapp/validation";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";
import { ExercisePicker, type ExerciseOption } from "@/components/exercise-picker";

/** Parse a number input; blank/invalid → undefined. */
function num(s: string): number | undefined {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** One-line summary of an instance's saved limits. */
function summarize(i: EquipmentInstanceInput): string {
  const parts: string[] = [];
  if (i.incrementConstraint !== undefined) parts.push(`${i.incrementConstraint}kg steps`);
  if (i.minWeight !== undefined) parts.push(`min ${i.minWeight}kg`);
  if (i.confirmedWorkingWeight !== undefined) parts.push(`~${i.confirmedWorkingWeight}kg working`);
  return parts.join(" · ") || "no limits set";
}

export function EquipmentInstancesCard() {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [instances, setInstances] = useState<EquipmentInstanceInput[]>([]);

  // Add-form state (numbers held as strings for clean empty handling).
  const [exerciseId, setExerciseId] = useState<string>();
  const [increment, setIncrement] = useState("");
  const [minWeight, setMinWeight] = useState("");
  const [confirmed, setConfirmed] = useState("");
  const [label, setLabel] = useState("");

  const nameOf = useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) ?? id;
  }, [exercises]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.getExercises({ limit: 200 }), api.getEquipmentInstances(userId)])
      .then(([exRes, instRes]) => {
        if (!active) return;
        setExercises(exRes.data ?? []);
        setInstances(instRes.data ?? []);
      })
      .catch((err) => {
        console.error("Failed to load equipment instances:", err);
        toast.error("Failed to load equipment");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, api]);

  const resetForm = () => {
    setExerciseId(undefined);
    setIncrement("");
    setMinWeight("");
    setConfirmed("");
    setLabel("");
  };

  const incrementVal = num(increment);
  // Mirror the server bound: increment must be positive when provided.
  const incrementInvalid = increment.trim() !== "" && (incrementVal === undefined || incrementVal <= 0);
  const hasAnyLimit =
    increment.trim() !== "" || minWeight.trim() !== "" || confirmed.trim() !== "";
  const canAdd = Boolean(exerciseId) && hasAnyLimit && !incrementInvalid;

  const handleAdd = async () => {
    if (!userId || !exerciseId) return;
    setSaving(true);
    try {
      await api.updateEquipmentInstance(userId, {
        exerciseId,
        incrementConstraint: incrementVal,
        minWeight: num(minWeight),
        confirmedWorkingWeight: num(confirmed),
        label: label.trim() || undefined,
      });
      const refreshed = await api.getEquipmentInstances(userId);
      setInstances(refreshed.data ?? []);
      resetForm();
      toast.success("Machine saved");
    } catch (err) {
      console.error("Failed to save equipment instance:", err);
      toast.error("Failed to save machine");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    const prev = instances;
    setInstances((list) => list.filter((x) => x.exerciseId !== id));
    try {
      await api.deleteEquipmentInstance(userId, id);
    } catch (err) {
      console.error("Failed to remove equipment instance:", err);
      toast.error("Failed to remove machine");
      setInstances(prev);
    }
  };

  // Exclude exercises that already have an instance from the add picker.
  const takenIds = useMemo(() => instances.map((i) => i.exerciseId), [instances]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Cog className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Equipment & Machines</CardTitle>
        </div>
        <CardDescription>
          Tell the engine a machine&apos;s real limits — its smallest weight step and a confirmed
          working weight — so it never prescribes a load the machine can&apos;t actually make.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {instances.length > 0 && (
              <ul className="space-y-2">
                {instances.map((i) => (
                  <li
                    key={i.exerciseId}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">
                        {nameOf(i.exerciseId)}
                        {i.label ? (
                          <span className="text-muted-foreground"> ({i.label})</span>
                        ) : null}
                      </span>
                      <span className="text-muted-foreground">{summarize(i)}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(i.exerciseId)}
                      aria-label={`Remove machine for ${nameOf(i.exerciseId)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="space-y-1.5">
                <Label>Exercise</Label>
                <ExercisePicker
                  exercises={exercises}
                  value={exerciseId}
                  onChange={setExerciseId}
                  placeholder="Which exercise / machine…"
                  exclude={takenIds}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Weight step (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.5"
                    placeholder="e.g. 5"
                    value={increment}
                    onChange={(e) => setIncrement(e.target.value)}
                  />
                  {incrementInvalid && (
                    <p className="text-xs text-destructive">Must be greater than 0.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Min weight (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.5"
                    placeholder="optional"
                    value={minWeight}
                    onChange={(e) => setMinWeight(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Working weight (kg)</Label>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.5"
                    placeholder="optional"
                    value={confirmed}
                    onChange={(e) => setConfirmed(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="w-full max-w-[240px] space-y-1.5">
                  <Label>Label (optional)</Label>
                  <Input
                    placeholder="e.g. blue cable station"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleAdd} disabled={!canAdd || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" /> Add machine
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
