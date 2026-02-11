"use client";

import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Download, Loader2, FileSpreadsheet, FileJson } from "lucide-react";
import { toast } from "sonner";
import { type WorkoutLog, type WorkoutLogWithSets } from "@/lib/api";
import { useApi } from "@/lib/use-api";

interface ExportDialogProps {
  workouts: WorkoutLog[];
}

type ExportType = "summary" | "detailed";
type ExportFormat = "csv" | "json";

export function ExportDialog({ workouts }: ExportDialogProps) {
  const api = useApi();
  const [exportType, setExportType] = useState<ExportType>("summary");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setProgress(0);

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (exportType === "detailed") {
        // Fetch detailed data for each workout
        const detailedWorkouts: WorkoutLogWithSets[] = [];
        for (let i = 0; i < workouts.length; i++) {
          const workout = workouts[i];
          if (!workout) continue;

          setProgressText(`Fetching workout ${i + 1} of ${workouts.length}...`);
          setProgress(((i + 1) / workouts.length) * 100);

          const response = await api.getWorkoutLog(workout.id);
          if (response.data) {
            detailedWorkouts.push(response.data);
          }
        }

        setProgressText("Generating export file...");

        if (format === "csv") {
          content = generateDetailedCsv(detailedWorkouts);
          filename = `workout-history-detailed-${new Date().toISOString().split("T")[0]}.csv`;
          mimeType = "text/csv";
        } else {
          content = generateDetailedJson(detailedWorkouts);
          filename = `workout-history-detailed-${new Date().toISOString().split("T")[0]}.json`;
          mimeType = "application/json";
        }
      } else {
        // Summary export (original behavior)
        if (format === "csv") {
          content = generateSummaryCsv(workouts);
          filename = `workout-history-${new Date().toISOString().split("T")[0]}.csv`;
          mimeType = "text/csv";
        } else {
          content = generateSummaryJson(workouts);
          filename = `workout-history-${new Date().toISOString().split("T")[0]}.json`;
          mimeType = "application/json";
        }
      }

      // Create and trigger download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setOpen(false);
    } catch (error) {
      console.error("Export failed:", error);
      toast.error("Export failed");
    } finally {
      setExporting(false);
      setProgress(0);
      setProgressText("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Workout History</DialogTitle>
          <DialogDescription>
            Download your workout history in your preferred format.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Export Type */}
          <div>
            <Label className="text-sm font-medium">Export Type</Label>
            <RadioGroup
              value={exportType}
              onValueChange={(value) => setExportType(value as ExportType)}
              className="mt-2 grid grid-cols-2 gap-3"
              disabled={exporting}
            >
              <label
                htmlFor="summary"
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                  exportType === "summary"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                } ${exporting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <RadioGroupItem value="summary" id="summary" className="sr-only" />
                <FileSpreadsheet className="h-6 w-6" />
                <div className="text-center">
                  <p className="font-medium text-sm">Summary</p>
                  <p className="text-xs text-muted-foreground">
                    Basic workout info
                  </p>
                </div>
              </label>
              <label
                htmlFor="detailed"
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                  exportType === "detailed"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                } ${exporting ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <RadioGroupItem value="detailed" id="detailed" className="sr-only" />
                <FileJson className="h-6 w-6" />
                <div className="text-center">
                  <p className="font-medium text-sm">Detailed</p>
                  <p className="text-xs text-muted-foreground">
                    Includes all sets
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {/* Format */}
          <div>
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup
              value={format}
              onValueChange={(value) => setFormat(value as ExportFormat)}
              className="mt-2"
              disabled={exporting}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="csv" id="csv" />
                <Label htmlFor="csv" className="font-normal">
                  CSV (Spreadsheet)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="json" id="json" />
                <Label htmlFor="json" className="font-normal">
                  JSON (Structured data)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Info box */}
          <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              {workouts.length} workout{workouts.length !== 1 ? "s" : ""} will be
              exported
            </p>
            {exportType === "detailed" && (
              <p className="text-xs text-muted-foreground">
                Detailed export includes: exercise names, sets, reps, weight, and
                RPE for each set.
              </p>
            )}
          </div>

          {/* Progress */}
          {exporting && exportType === "detailed" && (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {progressText}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || workouts.length === 0}
          >
            {exporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Summary export functions (original behavior)
function generateSummaryCsv(workouts: WorkoutLog[]): string {
  const headers = [
    "Date",
    "Duration (min)",
    "Overall RPE",
    "Notes",
  ];
  const rows = workouts.map((w) => {
    const duration = w.completedAt
      ? Math.round(
          (new Date(w.completedAt).getTime() - new Date(w.startedAt).getTime()) /
            (1000 * 60)
        )
      : "";
    return [
      w.completedAt ? new Date(w.completedAt).toLocaleDateString() : new Date(w.startedAt).toLocaleDateString(),
      duration,
      w.overallRpe || "",
      (w.notes || "").replace(/"/g, '""'),
    ];
  });

  return (
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
  );
}

function generateSummaryJson(workouts: WorkoutLog[]): string {
  return JSON.stringify(
    workouts.map((w) => ({
      date: w.completedAt || w.startedAt,
      durationMinutes: w.completedAt
        ? Math.round(
            (new Date(w.completedAt).getTime() -
              new Date(w.startedAt).getTime()) /
              (1000 * 60)
          )
        : null,
      overallRpe: w.overallRpe,
      notes: w.notes,
    })),
    null,
    2
  );
}

// Detailed export functions (includes all sets)
function generateDetailedCsv(workouts: WorkoutLogWithSets[]): string {
  const headers = [
    "Date",
    "Workout RPE",
    "Workout Notes",
    "Exercise ID",
    "Set #",
    "Weight (lbs)",
    "Reps",
    "Set RPE",
    "Set Notes",
  ];

  const rows: (string | number)[][] = [];

  for (const workout of workouts) {
    const date = workout.completedAt
      ? new Date(workout.completedAt).toLocaleDateString()
      : new Date(workout.startedAt).toLocaleDateString();

    if (workout.sets.length === 0) {
      // Workout with no sets
      rows.push([
        date,
        workout.overallRpe || "",
        (workout.notes || "").replace(/"/g, '""'),
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
    } else {
      for (const set of workout.sets) {
        rows.push([
          date,
          workout.overallRpe || "",
          (workout.notes || "").replace(/"/g, '""'),
          set.exerciseId,
          set.setNumber,
          set.weight,
          set.reps,
          set.rpe || "",
          (set.notes || "").replace(/"/g, '""'),
        ]);
      }
    }
  }

  return (
    headers.join(",") +
    "\n" +
    rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n")
  );
}

function generateDetailedJson(workouts: WorkoutLogWithSets[]): string {
  return JSON.stringify(
    workouts.map((w) => ({
      date: w.completedAt || w.startedAt,
      durationMinutes: w.completedAt
        ? Math.round(
            (new Date(w.completedAt).getTime() -
              new Date(w.startedAt).getTime()) /
              (1000 * 60)
          )
        : null,
      overallRpe: w.overallRpe,
      notes: w.notes,
      sets: w.sets.map((s) => ({
        exerciseId: s.exerciseId,
        setNumber: s.setNumber,
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        notes: s.notes,
      })),
    })),
    null,
    2
  );
}
