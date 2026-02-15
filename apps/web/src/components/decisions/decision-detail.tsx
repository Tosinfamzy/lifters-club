"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Decision, DecisionType, DecisionOutcome, OverrideReason } from "@/lib/api";
import { DECISION_TYPE_LABELS } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { OverrideReasonPicker } from "./override-reason-picker";
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
  Check,
  Edit,
  Loader2,
} from "lucide-react";

interface DecisionDetailProps {
  decision: Decision | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOutcomeRecorded?: (decisionId: string, outcome: DecisionOutcome) => void;
}

// Icons for decision types
const TYPE_ICONS: Record<DecisionType, React.ElementType> = {
  load_progression: TrendingUp,
  volume_adjustment: BarChart3,
  deload_recommendation: Battery,
  exercise_rotation: RotateCcw,
  session_recovery: Activity,
  missed_session: Calendar,
  weekly_plan_update: Calendar,
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
  onOutcomeRecorded,
}: DecisionDetailProps) {
  const api = useApi();
  const [isRecording, setIsRecording] = useState(false);
  const [showReasonPicker, setShowReasonPicker] = useState(false);
  const [recordedOutcome, setRecordedOutcome] = useState<DecisionOutcome | null>(null);

  // Reset local state when decision changes
  useEffect(() => {
    setRecordedOutcome(null);
    setShowReasonPicker(false);
    setIsRecording(false);
  }, [decision?.id]);

  if (!decision) return null;

  // Use existing outcome from the decision if available, otherwise use locally recorded outcome
  const effectiveOutcome = decision.outcome?.status ?? recordedOutcome;

  const Icon = TYPE_ICONS[decision.type];

  const handleFollow = async () => {
    setIsRecording(true);
    try {
      await api.recordDecisionOutcome(decision.id, { outcome: "followed" });
      setRecordedOutcome("followed");
      onOutcomeRecorded?.(decision.id, "followed");
    } catch (error) {
      console.error("Failed to record outcome:", error);
    } finally {
      setIsRecording(false);
    }
  };

  const handleOverride = async (reason: OverrideReason) => {
    setIsRecording(true);
    try {
      await api.recordDecisionOutcome(decision.id, {
        outcome: "overridden",
        overrideReason: reason,
      });
      setRecordedOutcome("overridden");
      setShowReasonPicker(false);
      onOutcomeRecorded?.(decision.id, "overridden");
    } catch (error) {
      console.error("Failed to record outcome:", error);
    } finally {
      setIsRecording(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setRecordedOutcome(null);
      setShowReasonPicker(false);
    }
    onOpenChange(newOpen);
  };

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
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
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

          {/* Action Buttons */}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            {!effectiveOutcome ? (
              <>
                <Button
                  onClick={handleFollow}
                  disabled={isRecording}
                  className="w-full sm:w-auto"
                >
                  {isRecording ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Follow Recommendation
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowReasonPicker(true)}
                  disabled={isRecording}
                  className="w-full sm:w-auto"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  I&apos;ll Adjust
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2 w-full justify-center">
                <Badge
                  variant="outline"
                  className={
                    effectiveOutcome === "followed"
                      ? "bg-green-500/10 text-green-500 border-green-500/20"
                      : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  }
                >
                  {effectiveOutcome === "followed" ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      Followed
                    </>
                  ) : (
                    <>
                      <Edit className="mr-1 h-3 w-3" />
                      Adjusted
                    </>
                  )}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Response recorded
                </span>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OverrideReasonPicker
        open={showReasonPicker}
        onOpenChange={setShowReasonPicker}
        onConfirm={handleOverride}
        isLoading={isRecording}
      />
    </>
  );
}
