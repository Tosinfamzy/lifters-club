import { View, Text, StyleSheet } from "react-native";
import { LineChart, Grid, YAxis, XAxis } from "react-native-svg-charts";
import * as shape from "d3-shape";

interface ProgressSession {
  date: string;
  bestWeight: number;
  bestVolume: number;
  totalSets: number;
  avgRpe: number | null;
}

interface ExerciseProgressChartProps {
  sessions: ProgressSession[];
  metric: "weight" | "volume";
  title?: string;
}

export function ExerciseProgressChart({
  sessions,
  metric,
  title,
}: ExerciseProgressChartProps) {
  if (sessions.length < 2) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            Need at least 2 sessions to show progress
          </Text>
        </View>
      </View>
    );
  }

  const data = sessions.map((s) =>
    metric === "weight" ? s.bestWeight : s.bestVolume
  );

  const labels = sessions.map((s) => {
    const date = new Date(s.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const minValue = Math.min(...data);
  const maxValue = Math.max(...data);
  const padding = (maxValue - minValue) * 0.1 || 10;

  const contentInset = { top: 20, bottom: 20 };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.chartContainer}>
        <YAxis
          data={data}
          contentInset={contentInset}
          svg={{ fontSize: 10, fill: "#94A3B8" }}
          min={minValue - padding}
          max={maxValue + padding}
          numberOfTicks={5}
          formatLabel={(value: number) =>
            metric === "weight" ? `${value}` : `${Math.round(value / 1000)}k`
          }
        />
        <View style={styles.chartInner}>
          <LineChart
            style={styles.chart}
            data={data}
            svg={{ stroke: "#3B82F6", strokeWidth: 2 }}
            contentInset={contentInset}
            curve={shape.curveMonotoneX}
            yMin={minValue - padding}
            yMax={maxValue + padding}
          >
            <Grid svg={{ stroke: "#334155", strokeWidth: 0.5 }} />
          </LineChart>
          <XAxis
            style={styles.xAxis}
            data={data}
            formatLabel={(_value: number, index: number) => labels[index] || ""}
            contentInset={{ left: 10, right: 10 }}
            svg={{ fontSize: 10, fill: "#94A3B8" }}
          />
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{minValue}</Text>
          <Text style={styles.statLabel}>Min</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{maxValue}</Text>
          <Text style={styles.statLabel}>Max</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {maxValue > minValue ? `+${((maxValue - minValue) / minValue * 100).toFixed(1)}%` : "0%"}
          </Text>
          <Text style={styles.statLabel}>Change</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 16,
  },
  title: {
    color: "#F8FAFC",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: "row",
    height: 200,
  },
  chartInner: {
    flex: 1,
    marginLeft: 10,
  },
  chart: {
    flex: 1,
  },
  xAxis: {
    marginTop: 10,
    height: 20,
  },
  emptyState: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#94A3B8",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#334155",
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    color: "#F8FAFC",
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 4,
  },
});
