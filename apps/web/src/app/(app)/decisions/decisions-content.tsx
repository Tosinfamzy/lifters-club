"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DecisionCard, DecisionDetail } from "@/components/decisions";
import { useAppUser } from "@/providers/user-provider";
import type { Decision, DecisionType } from "@/lib/api";
import { DECISION_TYPE_LABELS } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import {
  Brain,
  Filter,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Battery,
  RotateCcw,
  Activity,
  Calendar,
} from "lucide-react";

const DECISION_TYPE_OPTIONS: { value: DecisionType | "all"; label: string; icon: React.ElementType }[] = [
  { value: "all", label: "All Decisions", icon: Brain },
  { value: "load_progression", label: "Load", icon: TrendingUp },
  { value: "volume_adjustment", label: "Volume", icon: BarChart3 },
  { value: "deload_check", label: "Deload", icon: Battery },
  { value: "exercise_rotation", label: "Rotation", icon: RotateCcw },
  { value: "session_recovery", label: "Recovery", icon: Activity },
  { value: "missed_session", label: "Missed", icon: Calendar },
  { value: "weekly_plan", label: "Weekly Plan", icon: Calendar },
  { value: "performance_trend", label: "Trend", icon: TrendingUp },
];

export function DecisionsContent() {
  const { appUser } = useAppUser();
  const api = useApi();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<DecisionType | "all">("all");
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    async function fetchDecisions() {
      if (!appUser?.id) return;

      setLoading(true);
      setError(null);

      try {
        const params: { userId: string; type?: string; limit?: number } = {
          userId: appUser.id,
          limit: 50,
        };

        if (selectedType !== "all") {
          params.type = selectedType;
        }

        const response = await api.getDecisionHistory(params);
        if (isMountedRef.current) {
          setDecisions(response.data || []);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to load decisions");
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }

    fetchDecisions();
    return () => {
      isMountedRef.current = false;
    };
  }, [appUser?.id, selectedType]);

  const handleSelectDecision = (decision: Decision) => {
    setSelectedDecision(decision);
    setDetailOpen(true);
  };

  // Group decisions by date
  const groupedDecisions = decisions.reduce((groups, decision) => {
    const date = new Date(decision.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(decision);
    return groups;
  }, {} as Record<string, Decision[]>);

  // Stats
  const stats = {
    total: decisions.length,
    thisWeek: decisions.filter((d) => {
      const date = new Date(d.createdAt);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays < 7;
    }).length,
    byType: decisions.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  if (!appUser) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Sign in to view your training decisions</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              AI-powered adjustments
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.thisWeek}</div>
            <p className="text-xs text-muted-foreground">
              decisions made
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Most Common</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(() => {
                const sorted = Object.entries(stats.byType).sort((a, b) => b[1] - a[1]);
                const topType = sorted[0]?.[0] as DecisionType | undefined;
                return topType ? DECISION_TYPE_LABELS[topType] : "—";
              })()}
            </div>
            <p className="text-xs text-muted-foreground">
              decision type
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        {DECISION_TYPE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = selectedType === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(option.value)}
              className="flex-shrink-0"
            >
              <Icon className="h-4 w-4 mr-1" />
              {option.label}
            </Button>
          );
        })}
      </div>

      {/* Decision List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Decision History</CardTitle>
              <CardDescription>
                {selectedType === "all"
                  ? "All training decisions"
                  : `${DECISION_TYPE_LABELS[selectedType]} decisions`}
              </CardDescription>
            </div>
            {loading && (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading && decisions.length === 0 ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto text-muted-foreground animate-spin" />
              <p className="text-muted-foreground mt-2">Loading decisions...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          ) : decisions.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground mt-2">No decisions yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                As you train, the AI will make adjustments to your program
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedDecisions).map(([date, dateDecisions]) => (
                <div key={date}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    {date}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {dateDecisions.map((decision) => (
                      <DecisionCard
                        key={decision.id}
                        decision={decision}
                        onSelect={handleSelectDecision}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Detail Modal */}
      <DecisionDetail
        decision={selectedDecision}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
