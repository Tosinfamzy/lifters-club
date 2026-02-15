"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { fromLbs } from "@/lib/constants";

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
  title = "Progress",
}: ExerciseProgressChartProps) {
  const weightUnit = useWeightUnit();

  if (sessions.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-50 items-center justify-center text-muted-foreground">
            Need at least 2 sessions to show progress
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = sessions.map((s) => ({
    name: formatDateLabel(s.date),
    value: metric === "weight" ? fromLbs(s.bestWeight, weightUnit) : fromLbs(s.bestVolume, weightUnit),
    rpe: s.avgRpe,
    sets: s.totalSets,
  }));

  const values = chartData.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const change = maxValue > minValue
    ? ((maxValue - minValue) / minValue * 100).toFixed(1)
    : "0";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
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
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              domain={["dataMin - 10", "dataMax + 10"]}
              tickFormatter={(value) =>
                metric === "weight" ? `${value}` : `${Math.round(value / 1000)}k`
              }
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="font-medium">{data.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {metric === "weight" ? "Weight" : "Volume"}:{" "}
                        {weightUnit === "kg" ? data.value.toFixed(1) : Math.round(data.value)} {weightUnit}
                      </div>
                      {data.rpe && (
                        <div className="text-sm text-muted-foreground">
                          RPE: {data.rpe.toFixed(1)}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        Sets: {data.sets}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))" }}
            />
          </LineChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{minValue}</div>
            <div className="text-xs text-muted-foreground">Min</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{maxValue}</div>
            <div className="text-xs text-muted-foreground">Max</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">+{change}%</div>
            <div className="text-xs text-muted-foreground">Change</div>
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
