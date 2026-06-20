import { View, Text, StyleSheet } from "react-native";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react-native";
import type { WithinSessionSuggestion } from "./workout.types";

interface WithinSessionCoachCardProps {
  suggestion: WithinSessionSuggestion;
}

const ACTION_META = {
  increase: { color: "#22C55E", label: "Add load", Icon: TrendingUp },
  decrease: { color: "#EF4444", label: "Reduce load", Icon: TrendingDown },
  maintain: { color: "#3B82F6", label: "Hold load", Icon: Minus },
} as const;

/** Signed delta string vs the weight just done, e.g. "+5", "-5", "—". */
function formatDelta(next: number, previous: number): string {
  const delta = Math.round((next - previous) * 10) / 10;
  if (delta === 0) return "—";
  return delta > 0 ? `+${delta}` : `${delta}`;
}

/**
 * Compact live coach card shown inside the rest-timer overlay between sets:
 * the prescribed next-set load, the delta vs the set just done, and the engine's
 * reason. Display-only for now — accept/override + baseline promotion land in
 * later PRs.
 */
export function WithinSessionCoachCard({ suggestion }: WithinSessionCoachCardProps) {
  const meta = ACTION_META[suggestion.action];
  const { Icon } = meta;
  const delta = formatDelta(suggestion.nextSetWeight, suggestion.previousWeight);

  return (
    <View style={[styles.card, { borderColor: meta.color }]}>
      <View style={styles.header}>
        <Icon size={16} color={meta.color} />
        <Text style={[styles.headerLabel, { color: meta.color }]}>{meta.label}</Text>
      </View>

      <View style={styles.weightRow}>
        <Text style={styles.weightLabel}>Next set</Text>
        <Text style={styles.weightValue}>{suggestion.nextSetWeight}</Text>
        {delta !== "—" && (
          <Text style={[styles.delta, { color: meta.color }]}>{delta}</Text>
        )}
      </View>

      <Text style={styles.reason}>{suggestion.reason}</Text>

      {suggestion.newBaselineIfConfirmed && (
        <View style={styles.prHint}>
          <Sparkles size={13} color="#FACC15" />
          <Text style={styles.prHintText}>New best weight — nice work</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    width: "100%",
    backgroundColor: "#0F172A",
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  headerLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weightRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  },
  weightLabel: {
    color: "#94A3B8",
    fontSize: 13,
  },
  weightValue: {
    color: "#F8FAFC",
    fontSize: 26,
    fontWeight: "700",
  },
  delta: {
    fontSize: 16,
    fontWeight: "700",
  },
  reason: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  prHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
  },
  prHintText: {
    color: "#FACC15",
    fontSize: 12,
    fontWeight: "600",
  },
});
