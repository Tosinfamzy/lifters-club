"use client";

import { useState } from "react";
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
import { CalendarDays, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import type { CyclePhase } from "@gymapp/types";
import { useAppUser } from "@/providers/user-provider";
import { useApi } from "@/lib/use-api";

type PhaseConfig = { loadModifier: number; allowNewWeightTests: boolean };

/**
 * Engine defaults (source of truth: `defaultCyclePhaseConfig` in
 * `@gymapp/engine`). Inlined because the web app doesn't depend on the engine.
 */
const DEFAULTS: Record<CyclePhase, PhaseConfig> = {
  menstrual: { loadModifier: 0.9, allowNewWeightTests: false },
  follicular: { loadModifier: 1.0, allowNewWeightTests: true },
  ovulatory: { loadModifier: 1.0, allowNewWeightTests: true },
  luteal: { loadModifier: 0.95, allowNewWeightTests: true },
};

const PHASES: { phase: CyclePhase; label: string; hint: string }[] = [
  { phase: "menstrual", label: "Menstrual", hint: "Hold load, no new maxes" },
  { phase: "follicular", label: "Follicular", hint: "Best for strength — progress freely" },
  { phase: "ovulatory", label: "Ovulatory", hint: "Progress freely" },
  { phase: "luteal", label: "Luteal", hint: "Mild taper" },
];

const MIN_PCT = 50;
const MAX_PCT = 100;

function clampPct(n: number): number {
  return Math.min(MAX_PCT, Math.max(MIN_PCT, n));
}

export function CyclePhaseCard() {
  const { appUser, refetch } = useAppUser();
  const api = useApi();

  const savedTracks = Boolean(appUser?.preferences?.tracksCycle);
  const savedOverrides = (appUser?.preferences?.cyclePhaseOverrides ?? {}) as Partial<
    Record<CyclePhase, PhaseConfig>
  >;

  const [tracksCycle, setTracksCycle] = useState(savedTracks);
  const [config, setConfig] = useState<Record<CyclePhase, PhaseConfig>>(() => {
    const seeded = {} as Record<CyclePhase, PhaseConfig>;
    for (const { phase } of PHASES) {
      seeded[phase] = savedOverrides[phase] ?? DEFAULTS[phase];
    }
    return seeded;
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const setLoadPct = (phase: CyclePhase, pct: number) => {
    setConfig((prev) => ({
      ...prev,
      [phase]: { ...prev[phase], loadModifier: clampPct(pct) / 100 },
    }));
  };

  const setAllowTests = (phase: CyclePhase, allow: boolean) => {
    setConfig((prev) => ({ ...prev, [phase]: { ...prev[phase], allowNewWeightTests: allow } }));
  };

  const handleSave = async () => {
    if (!appUser) return;
    setSaving(true);
    setSaved(false);
    try {
      await api.updateUser(appUser.id, {
        preferences: {
          ...appUser.preferences,
          tracksCycle,
          cyclePhaseOverrides: config,
        },
      });
      setSaved(true);
      toast.success("Cycle settings saved");
      await refetch();
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Failed to save cycle settings:", err);
      toast.error("Failed to save cycle settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Cycle Phase</CardTitle>
          </div>
          <Switch checked={tracksCycle} onCheckedChange={setTracksCycle} aria-label="Track cycle phase" />
        </div>
        <CardDescription>
          Treat menstrual-cycle phase as a systematic loading protocol (distinct from daily
          readiness). When on, you can adjust how each phase scales load and whether new max
          attempts are allowed.
        </CardDescription>
      </CardHeader>
      {tracksCycle && (
        <CardContent className="space-y-4">
          {PHASES.map(({ phase, label, hint }) => (
            <div
              key={phase}
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={MIN_PCT}
                    max={MAX_PCT}
                    step={5}
                    value={Math.round(config[phase].loadModifier * 100)}
                    onChange={(e) => setLoadPct(phase, Number(e.target.value))}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">% load</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`tests-${phase}`}
                    checked={config[phase].allowNewWeightTests}
                    onCheckedChange={(v) => setAllowTests(phase, v)}
                  />
                  <Label htmlFor={`tests-${phase}`} className="text-xs font-normal">
                    New maxes
                  </Label>
                </div>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Load % is a soft default; the firmer lever is the &ldquo;new maxes&rdquo; toggle (a
            conservative no-new-PR choice during a phase).
          </p>
        </CardContent>
      )}
      <CardContent>
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
              "Save Cycle Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
