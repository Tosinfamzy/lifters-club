import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import type { DecisionType } from "@gymapp/types";

/**
 * Badge configuration for each decision type
 */
const DECISION_BADGES: Record<
  DecisionType,
  { icon: string; color: string; bgColor: string }
> = {
  load_progression: { icon: "↑", color: "#10B981", bgColor: "#10B98120" },
  volume_adjustment: { icon: "±", color: "#3B82F6", bgColor: "#3B82F620" },
  exercise_rotation: { icon: "↻", color: "#F59E0B", bgColor: "#F59E0B20" },
  deload_recommendation: { icon: "↓", color: "#8B5CF6", bgColor: "#8B5CF620" },
  session_recovery: { icon: "~", color: "#6366F1", bgColor: "#6366F120" },
  missed_session: { icon: "⟳", color: "#EC4899", bgColor: "#EC489920" },
  weekly_plan_update: { icon: "📋", color: "#14B8A6", bgColor: "#14B8A620" },
  within_session: { icon: "⚡", color: "#10B981", bgColor: "#10B98120" },
};

export interface DecisionBadgeProps {
  type: DecisionType;
  summary: string;
  confidence: "low" | "medium" | "high";
  onPress: () => void;
}

/**
 * Small badge displayed next to exercise name showing the algorithm's recommendation.
 *
 * @example
 * <DecisionBadge
 *   type="load_progression"
 *   summary="+2.5kg"
 *   confidence="high"
 *   onPress={() => setShowModal(true)}
 * />
 */
export function DecisionBadge({
  type,
  summary,
  confidence,
  onPress,
}: DecisionBadgeProps) {
  const badge = DECISION_BADGES[type] ?? {
    icon: "•",
    color: "#64748B",
    bgColor: "#64748B20",
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: badge.bgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`View ${type.replace(/_/g, " ")} recommendation: ${summary}`}
      accessibilityRole="button"
    >
      <Text style={[styles.icon, { color: badge.color }]}>{badge.icon}</Text>
      <Text
        style={[styles.summary, { color: badge.color }]}
        numberOfLines={1}
      >
        {summary}
      </Text>
      {confidence !== "high" && (
        <View
          style={[
            styles.confidenceDot,
            confidence === "low" ? styles.confidenceLow : styles.confidenceMedium,
          ]}
        />
      )}
    </TouchableOpacity>
  );
}

/**
 * Compact version of the badge for tighter layouts
 */
export function DecisionBadgeCompact({
  type,
  onPress,
}: Pick<DecisionBadgeProps, "type" | "onPress">) {
  const badge = DECISION_BADGES[type] ?? {
    icon: "•",
    color: "#64748B",
    bgColor: "#64748B20",
  };

  return (
    <TouchableOpacity
      style={[styles.compactContainer, { backgroundColor: badge.bgColor }]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={`View ${type.replace(/_/g, " ")} recommendation`}
      accessibilityRole="button"
    >
      <Text style={[styles.compactIcon, { color: badge.color }]}>
        {badge.icon}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    maxWidth: 140,
  },
  icon: {
    fontSize: 12,
    fontWeight: "700",
  },
  summary: {
    fontSize: 11,
    fontWeight: "600",
    flexShrink: 1,
  },
  confidenceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginLeft: 2,
  },
  confidenceLow: {
    backgroundColor: "#F59E0B",
  },
  confidenceMedium: {
    backgroundColor: "#94A3B8",
  },
  compactContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  compactIcon: {
    fontSize: 12,
    fontWeight: "700",
  },
});
