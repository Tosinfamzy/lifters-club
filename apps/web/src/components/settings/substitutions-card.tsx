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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Loader2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { PermanentSubstitution, SubstitutionReason } from "@gymapp/types";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";
import { ExercisePicker, type ExerciseOption } from "@/components/exercise-picker";

const REASON_OPTIONS: { value: SubstitutionReason; label: string }[] = [
  { value: "injury", label: "Injury" },
  { value: "anatomy", label: "Anatomy / build" },
  { value: "mobility", label: "Mobility" },
  { value: "fit_preference", label: "Preference / fit" },
  { value: "other", label: "Other" },
];

const REASON_LABELS: Record<SubstitutionReason, string> = Object.fromEntries(
  REASON_OPTIONS.map((o) => [o.value, o.label])
) as Record<SubstitutionReason, string>;

export function SubstitutionsCard() {
  const { appUser } = useAppUser();
  const api = useApi();
  const userId = appUser?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);
  const [subs, setSubs] = useState<PermanentSubstitution[]>([]);

  // Add-form state
  const [original, setOriginal] = useState<string>();
  const [substitute, setSubstitute] = useState<string>();
  const [reason, setReason] = useState<SubstitutionReason>("injury");
  const [note, setNote] = useState("");
  const [weightCarries, setWeightCarries] = useState(true);

  const nameOf = useMemo(() => {
    const map = new Map(exercises.map((e) => [e.id, e.name]));
    return (id: string) => map.get(id) ?? id;
  }, [exercises]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.getExercises({ limit: 200 }), api.getSubstitutions(userId)])
      .then(([exRes, subRes]) => {
        if (!active) return;
        setExercises(exRes.data ?? []);
        setSubs(subRes.data ?? []);
      })
      .catch((err) => {
        console.error("Failed to load substitutions:", err);
        toast.error("Failed to load substitutions");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, api]);

  const resetForm = () => {
    setOriginal(undefined);
    setSubstitute(undefined);
    setReason("injury");
    setNote("");
    setWeightCarries(true);
  };

  const canAdd = Boolean(original && substitute && original !== substitute);

  const handleAdd = async () => {
    if (!userId || !original || !substitute) return;
    setSaving(true);
    try {
      await api.updateSubstitution(userId, {
        originalExerciseId: original,
        substituteExerciseId: substitute,
        reason,
        note: note.trim() || undefined,
        weightCarries,
      });
      const refreshed = await api.getSubstitutions(userId);
      setSubs(refreshed.data ?? []);
      resetForm();
      toast.success("Substitution saved");
    } catch (err) {
      console.error("Failed to save substitution:", err);
      toast.error("Failed to save substitution");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (originalExerciseId: string) => {
    if (!userId) return;
    // Optimistic removal; restore on failure.
    const prev = subs;
    setSubs((s) => s.filter((x) => x.originalExerciseId !== originalExerciseId));
    try {
      await api.deleteSubstitution(userId, originalExerciseId);
    } catch (err) {
      console.error("Failed to remove substitution:", err);
      toast.error("Failed to remove substitution");
      setSubs(prev);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Permanent Substitutions</CardTitle>
        </div>
        <CardDescription>
          Swap an exercise everywhere — the engine will always program your substitute instead of
          the original, across every workout and generated plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {subs.length > 0 && (
              <ul className="space-y-2">
                {subs.map((s) => (
                  <li
                    key={s.originalExerciseId}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className="font-medium">{nameOf(s.originalExerciseId)}</span>
                      <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{nameOf(s.substituteExerciseId)}</span>
                      <span className="text-muted-foreground">· {REASON_LABELS[s.reason]}</span>
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(s.originalExerciseId)}
                      aria-label={`Remove substitution for ${nameOf(s.originalExerciseId)}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Replace</Label>
                  <ExercisePicker
                    exercises={exercises}
                    value={original}
                    onChange={setOriginal}
                    placeholder="Original exercise…"
                    exclude={substitute ? [substitute] : []}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>With</Label>
                  <ExercisePicker
                    exercises={exercises}
                    value={substitute}
                    onChange={setSubstitute}
                    placeholder="Substitute exercise…"
                    exclude={original ? [original] : []}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={(v) => setReason(v as SubstitutionReason)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Note (optional)</Label>
                  <Input
                    placeholder="e.g. left knee can't tolerate it"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <Switch id="weight-carries" checked={weightCarries} onCheckedChange={setWeightCarries} />
                  <Label htmlFor="weight-carries" className="text-sm font-normal">
                    Carry working weight to the substitute
                  </Label>
                </div>
                <Button type="button" onClick={handleAdd} disabled={!canAdd || saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="mr-1 h-4 w-4" /> Add substitution
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
