import { useState, useCallback, useRef, useEffect } from "react";
import { useApi } from "./use-api";
import { offlineQueue, createDecisionOutcomeOperation } from "../lib/offline/queue";
import type { DecisionType, OverrideReason } from "@gymapp/types";
import type { Workout } from "../lib/api";

export interface ExerciseDecision {
  id: string;
  exerciseId: string;
  type: DecisionType;
  summary: string;
  reasoning: string;
  confidence: "low" | "medium" | "high";
  recommendedValue: Record<string, unknown>;
}

function generateDecisionSummary(
  type: string,
  output: Record<string, unknown>
): string {
  switch (type) {
    case "load_progression": {
      const action = output.action as string;
      const newWeight = output.newWeight as number;
      if (action === "increase") return `↑ ${newWeight}lbs`;
      if (action === "decrease") return `↓ ${newWeight}lbs`;
      return `${newWeight}lbs`;
    }
    case "volume_adjustment": {
      const action = output.action as string;
      const newSetCount = output.newSetCount as number;
      if (action === "add_set") return `+1 set (${newSetCount})`;
      if (action === "reduce_set") return `${newSetCount} sets`;
      return `${newSetCount} sets`;
    }
    case "exercise_rotation":
      return "Swap suggested";
    case "deload_recommendation":
      return (output.recommended as boolean) ? "Deload" : "Continue";
    default:
      return "Adjustment";
  }
}

export function useExerciseDecisions(
  workout: Workout | null,
  isOnline: boolean
) {
  const api = useApi();
  const [exerciseDecisions, setExerciseDecisions] = useState<
    Map<string, ExerciseDecision>
  >(new Map());
  const [selectedDecision, setSelectedDecision] =
    useState<ExerciseDecision | null>(null);
  const [showDecisionModal, setShowDecisionModal] = useState(false);

  // Ref to track current online state (fixes stale closure in callbacks)
  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  const fetchExerciseDecisions = useCallback(async () => {
    if (!workout || !isOnline) return;

    try {
      const exerciseIds = workout.plannedExercises
        .map((ex) => ex.exerciseId)
        .filter(Boolean);

      if (exerciseIds.length === 0) return;

      const response = await api.getDecisionHistory({ limit: 50 });
      const decisionsMap = new Map<string, ExerciseDecision>();

      for (const decision of response.data || []) {
        const input = decision.input as { exerciseId?: string };
        if (input.exerciseId && exerciseIds.includes(input.exerciseId)) {
          if (!decisionsMap.has(input.exerciseId)) {
            const output = decision.output as Record<string, unknown>;
            decisionsMap.set(input.exerciseId, {
              exerciseId: input.exerciseId,
              id: decision.id,
              type: decision.type as DecisionType,
              summary: generateDecisionSummary(decision.type, output),
              reasoning: decision.reasoning,
              confidence:
                (output.confidence as "low" | "medium" | "high") ?? "medium",
              recommendedValue: output,
            });
          }
        }
      }

      setExerciseDecisions(decisionsMap);
    } catch (error) {
      console.error("Failed to fetch exercise decisions:", error);
    }
  }, [workout, isOnline, api]);

  const recordDecisionOutcome = useCallback(
    async (
      decisionId: string,
      outcome: "followed" | "overridden",
      overrideReason?: OverrideReason
    ) => {
      if (!isOnlineRef.current) {
        try {
          await offlineQueue.enqueue(
            createDecisionOutcomeOperation({
              decisionId,
              outcome,
              overrideReason,
            })
          );
        } catch (error) {
          console.error("Failed to queue decision outcome:", error);
        }
        return;
      }

      try {
        await api.recordDecisionOutcome(decisionId, {
          outcome,
          overrideReason,
        });
      } catch (error) {
        console.error("Failed to record decision outcome:", error);
        // Falls through to offline queue
        try {
          await offlineQueue.enqueue(
            createDecisionOutcomeOperation({
              decisionId,
              outcome,
              overrideReason,
            })
          );
        } catch (queueError) {
          console.error(
            "Failed to queue decision outcome for retry:",
            queueError
          );
        }
      }
    },
    [api]
  );

  const handleAcceptDecision = useCallback(() => {
    if (selectedDecision) {
      recordDecisionOutcome(selectedDecision.id, "followed");
      setShowDecisionModal(false);
      setSelectedDecision(null);
    }
  }, [selectedDecision, recordDecisionOutcome]);

  const handleOverrideDecision = useCallback(
    (reason: OverrideReason) => {
      if (selectedDecision) {
        recordDecisionOutcome(selectedDecision.id, "overridden", reason);
        setShowDecisionModal(false);
        setSelectedDecision(null);
      }
    },
    [selectedDecision, recordDecisionOutcome]
  );

  const openDecisionModal = useCallback(
    (exerciseId: string) => {
      const decision = exerciseDecisions.get(exerciseId);
      if (decision) {
        setSelectedDecision(decision);
        setShowDecisionModal(true);
      }
    },
    [exerciseDecisions]
  );

  return {
    exerciseDecisions,
    selectedDecision,
    showDecisionModal,
    setShowDecisionModal,
    fetchExerciseDecisions,
    openDecisionModal,
    handleAcceptDecision,
    handleOverrideDecision,
    // Exposed so the live within-session coach card can record its own
    // followed/overridden outcome against the persisted decision id.
    recordDecisionOutcome,
  };
}
