"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RpeDataPoint {
  date: string;
  rpe: number;
  workoutId?: string;
}

interface RpeTrendsChartProps {
  data: RpeDataPoint[];
}

export function RpeTrendsChart({ data }: RpeTrendsChartProps) {
  if (data.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>RPE Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            Need at least 2 workouts with RPE to show trends
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: formatDateLabel(d.date),
    rpe: d.rpe,
    fullDate: d.date,
  }));

  const avgRpe = data.reduce((sum, d) => sum + d.rpe, 0) / data.length;
  const minRpe = Math.min(...data.map((d) => d.rpe));
  const maxRpe = Math.max(...data.map((d) => d.rpe));

  // Determine trend
  const recentAvg =
    data.slice(-3).reduce((sum, d) => sum + d.rpe, 0) /
    Math.min(3, data.length);
  const olderAvg =
    data.slice(0, -3).length > 0
      ? data.slice(0, -3).reduce((sum, d) => sum + d.rpe, 0) /
        data.slice(0, -3).length
      : recentAvg;
  const trend = recentAvg - olderAvg;

  const getTrendLabel = () => {
    if (Math.abs(trend) < 0.3) return { text: "Stable", color: "text-muted-foreground" };
    if (trend > 0) return { text: "Increasing", color: "text-orange-500" };
    return { text: "Decreasing", color: "text-green-500" };
  };

  const trendInfo = getTrendLabel();

  return (
    <Card>
      <CardHeader>
        <CardTitle>RPE Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              domain={[5, 10]}
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              ticks={[5, 6, 7, 8, 9, 10]}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="font-medium">{d.name}</div>
                      <div className="text-sm">
                        RPE:{" "}
                        <span
                          className={
                            d.rpe >= 9
                              ? "text-red-500"
                              : d.rpe >= 8
                                ? "text-orange-500"
                                : d.rpe >= 7
                                  ? "text-yellow-500"
                                  : "text-green-500"
                          }
                        >
                          {d.rpe.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <ReferenceLine
              y={avgRpe}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="5 5"
              label={{
                value: `Avg: ${avgRpe.toFixed(1)}`,
                position: "right",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="rpe"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-4 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{avgRpe.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Average</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{minRpe.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Min</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{maxRpe.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Max</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${trendInfo.color}`}>
              {trendInfo.text}
            </div>
            <div className="text-xs text-muted-foreground">Trend</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
