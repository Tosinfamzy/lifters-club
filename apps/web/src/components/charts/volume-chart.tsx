"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface WeekData {
  weekStart: string;
  totalVolume: number;
  workoutCount: number;
  setCount: number;
}

interface VolumeChartProps {
  weeks: WeekData[];
}

export function VolumeChart({ weeks }: VolumeChartProps) {
  if (weeks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Training Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No volume data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = weeks.map((w) => ({
    name: formatWeekLabel(w.weekStart),
    volume: Math.round(w.totalVolume / 1000),
    workouts: w.workoutCount,
    sets: w.setCount,
  }));

  const totalVolume = weeks.reduce((sum, w) => sum + w.totalVolume, 0);
  const avgVolume = totalVolume / weeks.length;
  const totalWorkouts = weeks.reduce((sum, w) => sum + w.workoutCount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Training Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              tickFormatter={(value) => `${value}k`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-sm">
                      <div className="font-medium">{data.name}</div>
                      <div className="text-sm text-muted-foreground">
                        Volume: {data.volume}k lbs
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Workouts: {data.workouts}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Sets: {data.sets}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="volume" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 grid grid-cols-3 gap-4 border-t pt-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{Math.round(avgVolume / 1000)}k</div>
            <div className="text-xs text-muted-foreground">Avg Volume</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{totalWorkouts}</div>
            <div className="text-xs text-muted-foreground">Workouts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {(totalWorkouts / weeks.length).toFixed(1)}
            </div>
            <div className="text-xs text-muted-foreground">Per Week</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatWeekLabel(weekStart: string): string {
  const date = new Date(weekStart);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
