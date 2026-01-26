"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Decision, DecisionType } from "@/lib/api";
import { DECISION_TYPE_LABELS } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Battery,
  Calendar,
  BarChart3,
  Activity,
  Info,
  Target,
  ArrowRight,
} from "lucide-react";

interface DecisionDetailProps {
  decision: Decision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Icons for decision types
const TYPE_ICONS: Record<DecisionType, React.ElementType> = {
  load_progression: TrendingUp,
  volume_adjustment: BarChart3,
  deload_check: Battery,
  exercise_rotation: RotateCcw,
  session_recovery: Activity,
  missed_session: Calendar,
  weekly_plan: Calendar,
  performance_trend: TrendingUp,
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderLoadProgressionDetail(decision: Decision) {
  const input = decision.input;
  const output = decision.output;

  return (
    <div className="space-y-4">
      {/* What was analyzed */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> What Was Analyzed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exercise</span>
            <span className="font-medium">{input.exerciseId as string}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Weight</span>
            <span className="font-medium">{input.currentWeight as number} lbs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Target Rep Range</span>
            <span className="font-medium">{(input.targetRepRange as number[]).join("-")} reps</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sets Analyzed</span>
            <span className="font-medium">{(input.recentSets as unknown[]).length} sets</span>
          </div>
        </CardContent>
      </Card>

      {/* Decision */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> Decision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">
              {input.currentWeight as number}
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="text-2xl font-bold text-primary">
              {output.newWeight as number}
            </div>
            <span className="text-sm text-muted-foreground">lbs</span>
          </div>
          <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-xs font-medium ${
            output.action === "increase"
              ? "bg-green-500/10 text-green-500"
              : output.action === "decrease"
              ? "bg-red-500/10 text-red-500"
              : "bg-yellow-500/10 text-yellow-500"
          }`}>
            {output.action === "increase" && <TrendingUp className="h-3 w-3" />}
            {output.action === "decrease" && <TrendingDown className="h-3 w-3" />}
            {output.action === "maintain" && <Minus className="h-3 w-3" />}
            {(output.action as string).charAt(0).toUpperCase() + (output.action as string).slice(1)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderVolumeAdjustmentDetail(decision: Decision) {
  const input = decision.input;
  const output = decision.output;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> What Was Analyzed
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Exercise</span>
            <span className="font-medium">{input.exerciseId as string}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current Set Count</span>
            <span className="font-medium">{input.currentSetCount as number} sets</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> Decision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold">
              {input.currentSetCount as number}
            </div>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <div className="text-2xl font-bold text-primary">
              {output.newSetCount as number}
            </div>
            <span className="text-sm text-muted-foreground">sets</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function renderGenericDetail(decision: Decision) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" /> Input Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-3 rounded-lg overflow-auto max-h-40">
            {JSON.stringify(decision.input, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4" /> Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-secondary p-3 rounded-lg overflow-auto max-h-40">
            {JSON.stringify(decision.output, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export function DecisionDetail({
  decision,
  open,
  onOpenChange,
}: DecisionDetailProps) {
  if (!decision) return null;

  const Icon = TYPE_ICONS[decision.type];

  const renderDetail = () => {
    switch (decision.type) {
      case "load_progression":
        return renderLoadProgressionDetail(decision);
      case "volume_adjustment":
        return renderVolumeAdjustmentDetail(decision);
      default:
        return renderGenericDetail(decision);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <DialogTitle>{DECISION_TYPE_LABELS[decision.type]}</DialogTitle>
          </div>
          <DialogDescription>
            {formatDateTime(decision.createdAt)}
          </DialogDescription>
        </DialogHeader>

        {/* Reasoning */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-sm font-medium mb-1">Why this decision?</p>
          <p className="text-sm text-muted-foreground">{decision.reasoning}</p>
        </div>

        {/* Detail sections */}
        {renderDetail()}
      </DialogContent>
    </Dialog>
  );
}
