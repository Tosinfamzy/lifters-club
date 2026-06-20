import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from "react-native";
import { X, Check, Edit3, ChevronRight } from "lucide-react-native";
import type { DecisionType, OverrideReason } from "@gymapp/types";
import { OVERRIDE_REASON_LABELS } from "@gymapp/types";

/**
 * Configuration for each decision type display
 */
const DECISION_TYPE_CONFIG: Record<
  DecisionType,
  { label: string; icon: string; color: string }
> = {
  load_progression: { label: "Weight Adjustment", icon: "↑", color: "#10B981" },
  volume_adjustment: { label: "Volume Change", icon: "±", color: "#3B82F6" },
  exercise_rotation: { label: "Exercise Swap", icon: "↻", color: "#F59E0B" },
  deload_recommendation: { label: "Deload", icon: "↓", color: "#8B5CF6" },
  session_recovery: { label: "Recovery", icon: "~", color: "#6366F1" },
  missed_session: { label: "Missed Session", icon: "⟳", color: "#EC4899" },
  weekly_plan_update: { label: "Plan Update", icon: "📋", color: "#14B8A6" },
  within_session: { label: "Live Set Coaching", icon: "⚡", color: "#10B981" },
};

/**
 * Confidence level styling
 */
const CONFIDENCE_CONFIG: Record<
  "low" | "medium" | "high",
  { label: string; color: string; bgColor: string }
> = {
  high: { label: "High confidence", color: "#10B981", bgColor: "#10B98120" },
  medium: { label: "Moderate confidence", color: "#F59E0B", bgColor: "#F59E0B20" },
  low: { label: "Low confidence", color: "#EF4444", bgColor: "#EF444420" },
};

export interface DecisionExplanationModalProps {
  visible: boolean;
  decision: {
    id: string;
    type: DecisionType;
    summary: string;
    reasoning: string;
    confidence: "low" | "medium" | "high";
  };
  onAccept: () => void;
  onOverride: (reason: OverrideReason) => void;
  onClose: () => void;
}

/**
 * Modal showing the algorithm's recommendation with accept/override options.
 *
 * @example
 * <DecisionExplanationModal
 *   visible={showModal}
 *   decision={{
 *     id: "dec_123",
 *     type: "load_progression",
 *     summary: "Increase to 85kg",
 *     reasoning: "You completed 10 reps at RPE 7 last session...",
 *     confidence: "high",
 *   }}
 *   onAccept={() => recordOutcome("followed")}
 *   onOverride={(reason) => recordOutcome("overridden", reason)}
 *   onClose={() => setShowModal(false)}
 * />
 */
export function DecisionExplanationModal({
  visible,
  decision,
  onAccept,
  onOverride,
  onClose,
}: DecisionExplanationModalProps) {
  const [showReasonPicker, setShowReasonPicker] = useState(false);

  const typeConfig = DECISION_TYPE_CONFIG[decision.type] ?? {
    label: "Recommendation",
    icon: "•",
    color: "#64748B",
  };
  const confidenceConfig = CONFIDENCE_CONFIG[decision.confidence];

  const handleOverrideSelect = (reason: OverrideReason) => {
    setShowReasonPicker(false);
    onOverride(reason);
  };

  const handleClose = () => {
    setShowReasonPicker(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={styles.content} onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.typeIcon,
                  { backgroundColor: `${typeConfig.color}20` },
                ]}
              >
                <Text style={[styles.typeIconText, { color: typeConfig.color }]}>
                  {typeConfig.icon}
                </Text>
              </View>
              <View>
                <Text style={styles.typeLabel}>{typeConfig.label}</Text>
                <View
                  style={[
                    styles.confidenceBadge,
                    { backgroundColor: confidenceConfig.bgColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.confidenceText,
                      { color: confidenceConfig.color },
                    ]}
                  >
                    {confidenceConfig.label}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Summary */}
          <View style={styles.summaryContainer}>
            <Text style={styles.summaryText}>{decision.summary}</Text>
          </View>

          {/* Reasoning */}
          <ScrollView
            style={styles.reasoningContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.reasoningLabel}>Why this recommendation?</Text>
            <Text style={styles.reasoningText}>{decision.reasoning}</Text>
          </ScrollView>

          {/* Actions */}
          {showReasonPicker ? (
            <View style={styles.reasonPicker}>
              <Text style={styles.reasonPickerTitle}>
                Why are you adjusting?
              </Text>
              {(Object.keys(OVERRIDE_REASON_LABELS) as OverrideReason[]).map(
                (reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={styles.reasonOption}
                    onPress={() => handleOverrideSelect(reason)}
                  >
                    <Text style={styles.reasonOptionText}>
                      {OVERRIDE_REASON_LABELS[reason]}
                    </Text>
                    <ChevronRight size={16} color="#64748B" />
                  </TouchableOpacity>
                )
              )}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowReasonPicker(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFFFFF" />
                <Text style={styles.acceptButtonText}>Got it</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overrideButton}
                onPress={() => setShowReasonPicker(true)}
                activeOpacity={0.8}
              >
                <Edit3 size={18} color="#64748B" />
                <Text style={styles.overrideButtonText}>I'll adjust</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#1E293B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 34,
    maxHeight: "80%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  typeIconText: {
    fontSize: 20,
    fontWeight: "700",
  },
  typeLabel: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: "600",
  },
  closeButton: {
    padding: 4,
  },
  summaryContainer: {
    backgroundColor: "#0F172A",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryText: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  reasoningContainer: {
    maxHeight: 160,
    marginBottom: 20,
  },
  reasoningLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reasoningText: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  acceptButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  overrideButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  overrideButtonText: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
  },
  reasonPicker: {
    gap: 8,
  },
  reasonPickerTitle: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#334155",
    padding: 14,
    borderRadius: 10,
  },
  reasonOptionText: {
    color: "#F8FAFC",
    fontSize: 14,
  },
  cancelButton: {
    alignItems: "center",
    padding: 14,
    marginTop: 4,
  },
  cancelButtonText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
  },
});
