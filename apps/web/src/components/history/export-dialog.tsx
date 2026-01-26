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
import { Download, Loader2 } from "lucide-react";

interface WorkoutLog {
  id: string;
  workoutId: string;
  userId: string;
  startedAt: string;
  completedAt?: string;
  overallRpe?: number;
  notes?: string;
}

interface ExportDialogProps {
  workouts: WorkoutLog[];
}

export function ExportDialog({ workouts }: ExportDialogProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);

    try {
      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === "csv") {
        const headers = [
          "ID",
          "Workout ID",
          "Started At",
          "Completed At",
          "Duration (min)",
          "Overall RPE",
          "Notes",
        ];
        const rows = workouts.map((w) => {
          const duration = w.completedAt
            ? Math.round(
                (new Date(w.completedAt).getTime() -
                  new Date(w.startedAt).getTime()) /
                  (1000 * 60)
              )
            : "";
          return [
            w.id,
            w.workoutId,
            w.startedAt,
            w.completedAt || "",
            duration,
            w.overallRpe || "",
            (w.notes || "").replace(/"/g, '""'),
          ];
        });

        content =
          headers.join(",") +
          "\n" +
          rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
        filename = `workout-history-${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      } else {
        content = JSON.stringify(
          workouts.map((w) => ({
            id: w.id,
            workoutId: w.workoutId,
            startedAt: w.startedAt,
            completedAt: w.completedAt,
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
        filename = `workout-history-${new Date().toISOString().split("T")[0]}.json`;
        mimeType = "application/json";
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
    } finally {
      setExporting(false);
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

        <div className="py-4">
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Format</Label>
              <RadioGroup
                value={format}
                onValueChange={(value) => setFormat(value as "csv" | "json")}
                className="mt-2"
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

            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground">
                {workouts.length} workout{workouts.length !== 1 ? "s" : ""} will
                be exported
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={exporting || workouts.length === 0}>
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
