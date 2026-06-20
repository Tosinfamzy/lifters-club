"use client";

import { useEffect, useState } from "react";
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
import { ShieldAlert, Loader2, CheckCircle, X, Plus } from "lucide-react";
import { toast } from "sonner";
import type {
  EquipmentConstraint,
  MobilityConstraint,
  GripRestriction,
  InjuryFlag,
} from "@gymapp/types";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";
import { ExercisePicker, type ExerciseOption } from "@/components/exercise-picker";

const EQUIPMENT_OPTIONS: { value: EquipmentConstraint; label: string }[] = [
  { value: "no_barbell", label: "No barbell" },
  { value: "no_machine", label: "No machines" },
  { value: "no_cable", label: "No cables" },
  { value: "no_dumbbell", label: "No dumbbells" },
];

const MOBILITY_OPTIONS: { value: MobilityConstraint; label: string }[] = [
  { value: "no_overhead", label: "No overhead" },
  { value: "no_wrist_extension", label: "No wrist extension" },
  { value: "no_deep_knee_flexion", label: "No deep knee flexion" },
  { value: "no_spinal_loading", label: "No spinal loading" },
  { value: "no_lumbar_flexion", label: "No lumbar flexion" },
];

const GRIP_OPTIONS: { value: GripRestriction; label: string }[] = [
  { value: "neutral_grip_only", label: "Neutral grip only" },
  { value: "no_pronated", label: "No pronated (overhand)" },
  { value: "no_supinated", label: "No supinated (underhand)" },
];

/** Toggle `value` in `list`, returning a new array. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}

function ChipGroup<T extends string>({ label, options, selected, onToggle }: ChipGroupProps<T>) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            size="sm"
            variant={selected.includes(opt.value) ? "default" : "outline"}
            onClick={() => onToggle(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Self-contained editor for the athlete's safety constraints (equipment /
 * mobility / grip restrictions + injury flags). Loads on mount and saves
 * independently of the page's preference save.
 *
 * `bannedExerciseIds` / `correctivePriorityExerciseIds` are round-tripped
 * unchanged — the PUT is delete-then-insert, so dropping them here would wipe
 * data this UI doesn't yet edit (those need the exercise picker, a later PR).
 */
interface ExerciseListFieldProps {
  label: string;
  description: string;
  ids: string[];
  exercises: ExerciseOption[];
  onChange: (ids: string[]) => void;
}

/** A removable-chip list of exercises with an add-picker. Used for the banned
 *  and corrective-priority lists (both hold exercise ids on the profile). */
function ExerciseListField({ label, description, ids, exercises, onChange }: ExerciseListFieldProps) {
  const nameOf = (id: string) => exercises.find((e) => e.id === id)?.name ?? id;
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      {ids.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {ids.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
            >
              {nameOf(id)}
              <button
                type="button"
                onClick={() => onChange(ids.filter((x) => x !== id))}
                aria-label={`Remove ${nameOf(id)}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <ExercisePicker
        exercises={exercises}
        exclude={ids}
        placeholder="Add an exercise…"
        onChange={(id) => {
          if (!ids.includes(id)) onChange([...ids, id]);
        }}
      />
    </div>
  );
}

export function ConstraintsCard() {
  const { appUser } = useAppUser();
  const api = useApi();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [equipment, setEquipment] = useState<EquipmentConstraint[]>([]);
  const [mobility, setMobility] = useState<MobilityConstraint[]>([]);
  const [grip, setGrip] = useState<GripRestriction[]>([]);
  const [injuries, setInjuries] = useState<InjuryFlag[]>([]);
  const [bannedExerciseIds, setBannedExerciseIds] = useState<string[]>([]);
  const [correctivePriorityExerciseIds, setCorrectivePriorityExerciseIds] = useState<string[]>([]);
  const [exercises, setExercises] = useState<ExerciseOption[]>([]);

  const [newRegion, setNewRegion] = useState("");
  const [newNote, setNewNote] = useState("");

  const userId = appUser?.id;

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    Promise.all([api.getConstraints(userId), api.getExercises({ limit: 200 })])
      .then(([cRes, exRes]) => {
        if (!active) return;
        if (cRes.data) {
          setEquipment(cRes.data.equipment ?? []);
          setMobility(cRes.data.mobility ?? []);
          setGrip(cRes.data.grip ?? []);
          setInjuries(cRes.data.injuries ?? []);
          setBannedExerciseIds(cRes.data.bannedExerciseIds ?? []);
          setCorrectivePriorityExerciseIds(cRes.data.correctivePriorityExerciseIds ?? []);
        }
        setExercises(exRes.data ?? []);
      })
      .catch((err) => {
        console.error("Failed to load constraints:", err);
        toast.error("Failed to load constraints");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, api]);

  const addInjury = () => {
    const region = newRegion.trim();
    if (!region) return;
    const note = newNote.trim();
    setInjuries((prev) => [...prev, note ? { region, note } : { region }]);
    setNewRegion("");
    setNewNote("");
  };

  const removeInjury = (index: number) => {
    setInjuries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.updateConstraints(userId, {
        equipment,
        mobility,
        grip,
        injuries,
        bannedExerciseIds,
        correctivePriorityExerciseIds,
      });
      setSaved(true);
      toast.success("Constraints saved");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save constraints:", err);
      toast.error("Failed to save constraints");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Training Constraints</CardTitle>
        </div>
        <CardDescription>
          Tell the engine what you can&apos;t safely do — it won&apos;t recommend movements that
          conflict with your injuries, available equipment, or grip restrictions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <ChipGroup
              label="Equipment to avoid"
              options={EQUIPMENT_OPTIONS}
              selected={equipment}
              onToggle={(v) => setEquipment((prev) => toggle(prev, v))}
            />
            <ChipGroup
              label="Movement restrictions"
              options={MOBILITY_OPTIONS}
              selected={mobility}
              onToggle={(v) => setMobility((prev) => toggle(prev, v))}
            />
            <ChipGroup
              label="Grip restrictions"
              options={GRIP_OPTIONS}
              selected={grip}
              onToggle={(v) => setGrip((prev) => toggle(prev, v))}
            />

            <div className="space-y-2">
              <Label>Injuries</Label>
              {injuries.length > 0 && (
                <ul className="space-y-2">
                  {injuries.map((injury, i) => (
                    <li
                      key={`${injury.region}-${i}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>
                        <span className="font-medium">{injury.region}</span>
                        {injury.note ? (
                          <span className="text-muted-foreground"> — {injury.note}</span>
                        ) : null}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => removeInjury(i)}
                        aria-label={`Remove ${injury.region}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Region (e.g. wrist)"
                  value={newRegion}
                  onChange={(e) => setNewRegion(e.target.value)}
                  className="sm:max-w-[180px]"
                />
                <Input
                  placeholder="Note (optional)"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
                <Button type="button" variant="outline" onClick={addInjury} disabled={!newRegion.trim()}>
                  <Plus className="mr-1 h-4 w-4" /> Add
                </Button>
              </div>
            </div>

            <ExerciseListField
              label="Banned exercises"
              description="Never program these — they're hard-excluded from recommendations and plans."
              ids={bannedExerciseIds}
              exercises={exercises}
              onChange={setBannedExerciseIds}
            />

            <ExerciseListField
              label="Corrective priority"
              description="Protected from volume reduction — the engine keeps these in even when cutting back."
              ids={correctivePriorityExerciseIds}
              exercises={exercises}
              onChange={setCorrectivePriorityExerciseIds}
            />

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : saved ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" /> Saved!
                  </>
                ) : (
                  "Save Constraints"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
