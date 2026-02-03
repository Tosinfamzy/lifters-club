import { View, Text, StyleSheet } from "react-native";
import { BarChart, Grid, YAxis, XAxis } from "react-native-svg-charts";

interface WeekData {
  weekStart: string;
  totalVolume: number;
  workoutCount: number;
  setCount: number;
}

interface VolumeChartProps {
  weeks: WeekData[];
  title?: string;
}

export function VolumeChart({ weeks, title }: VolumeChartProps) {
  if (weeks.length === 0) {
    return (
      <View style={styles.container}>
        {title && <Text style={styles.title}>{title}</Text>}
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No volume data available</Text>
        </View>
      </View>
    );
  }

  const data = weeks.map((w) => w.totalVolume);
  const labels = weeks.map((w) => {
    const date = new Date(w.weekStart);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const contentInset = { top: 20, bottom: 20 };

  const totalVolume = data.reduce((sum, v) => sum + v, 0);
  const avgVolume = totalVolume / data.length;
  const totalWorkouts = weeks.reduce((sum, w) => sum + w.workoutCount, 0);

  return (
    <View style={styles.container}>
      {title && <Text style={styles.title}>{title}</Text>}
      <View style={styles.chartContainer}>
        <YAxis
          data={data}
          contentInset={contentInset}
          svg={{ fontSize: 10, fill: "#94A3B8" }}
          numberOfTicks={5}
          formatLabel={(value: number) => `${Math.round(value / 1000)}k`}
        />
        <View style={styles.chartInner}>
          <BarChart
            style={styles.chart}
            data={data}
            svg={{ fill: "#3B82F6" }}
            contentInset={contentInset}
            spacingInner={0.3}
          >
            <Grid svg={{ stroke: "#334155", strokeWidth: 0.5 }} />
          </BarChart>
          <XAxis
            style={styles.xAxis}
            data={data}
            formatLabel={(_value: number, index: number) => labels[index] || ""}
            contentInset={{ left: 20, right: 20 }}
            svg={{ fontSize: 9, fill: "#94A3B8" }}
          />
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{Math.round(avgVolume / 1000)}k</Text>
          <Text style={styles.statLabel}>Avg Volume</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>Workouts</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {(totalWorkouts / weeks.length).toFixed(1)}
          </Text>
          <Text style={styles.statLabel}>Per Week</Text>
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
    height: 180,
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
