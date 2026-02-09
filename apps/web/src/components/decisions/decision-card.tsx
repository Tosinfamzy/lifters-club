"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Decision, DecisionType } from "@/lib/api";
import { DECISION_TYPE_LABELS } from "@/lib/api";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  Battery,
  Calendar,
  BarChart3,
  Activity,
  Check,
  Edit,
} from "lucide-react";

interface DecisionCardProps {
  decision: Decision;
  onSelect?: (decision: Decision) => void;
}

// Icons for decision types
const TYPE_ICONS: Record<DecisionType, React.ElementType> = {
  load_progression: TrendingUp,
  volume_adjustment: BarChart3,
  deload_check: Battery,
  exercise_rotation: RotateCcw,
  session_recovery: Activity,
  missed_session: Calendar,
  weekly_plan: Calendar,
  performance_trend: TrendingUp,
};

// Colors for decision types
const TYPE_COLORS: Record<DecisionType, string> = {
  load_progression: "bg-green-500/10 text-green-500 border-green-500/20",
  volume_adjustment: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  deload_check: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  exercise_rotation: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  session_recovery: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  missed_session: "bg-red-500/10 text-red-500 border-red-500/20",
  weekly_plan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  performance_trend: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getDecisionSummary(decision: Decision): string {
  const output = decision.output;

  switch (decision.type) {
    case "load_progression": {
      const action = output.action as string;
      const newWeight = output.newWeight as number;
      if (action === "increase") return `Increase to ${newWeight}`;
      if (action === "decrease") return `Decrease to ${newWeight}`;
      return "Maintain weight";
    }
    case "volume_adjustment": {
      const action = output.action as string;
      const newSetCount = output.newSetCount as number;
      if (action === "add_set") return `Add sets (${newSetCount} total)`;
      if (action === "reduce_set") return `Reduce sets (${newSetCount} total)`;
      return "Maintain volume";
    }
    case "deload_check": {
      const recommended = output.recommended as boolean;
      return recommended ? "Deload recommended" : "Continue training";
    }
    case "exercise_rotation": {
      const action = output.action as string;
      return action === "swap" ? "Rotate exercise" : "Keep current exercise";
    }
    case "session_recovery": {
      const recommendation = output.recommendation as string;
      if (recommendation === "rest_day") return "Rest day suggested";
      if (recommendation === "light_session") return "Light session";
      return "Full session OK";
    }
    case "missed_session": {
      const action = output.action as string;
      return action.replace(/_/g, " ");
    }
    case "weekly_plan": {
      const summary = output.summary as string;
      return summary?.slice(0, 50) + "..." || "Weekly plan generated";
    }
    case "performance_trend": {
      const trend = output.trend as string;
      return `Trend: ${trend}`;
    }
    default:
      return "Decision made";
  }
}

function getActionIcon(decision: Decision) {
  const output = decision.output;

  if (decision.type === "load_progression" || decision.type === "volume_adjustment") {
    const action = output.action as string;
    if (action === "increase" || action === "add_set") {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    if (action === "decrease" || action === "reduce_set") {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-yellow-500" />;
  }

  return null;
}

function OutcomeBadge({ decision }: { decision: Decision }) {
  if (!decision.outcome) {
    return (
      <Badge variant="outline" className="text-xs bg-muted/50">
        Pending
      </Badge>
    );
  }

  if (decision.outcome.status === "followed") {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-green-500/10 text-green-500 border-green-500/20"
      >
        <Check className="mr-1 h-3 w-3" />
        Followed
      </Badge>
    );
  }

  if (decision.outcome.status === "overridden") {
    return (
      <Badge
        variant="outline"
        className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
      >
        <Edit className="mr-1 h-3 w-3" />
        Adjusted
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs bg-muted/50">
      Ignored
    </Badge>
  );
}

export function DecisionCard({ decision, onSelect }: DecisionCardProps) {
  const Icon = TYPE_ICONS[decision.type];
  const colorClass = TYPE_COLORS[decision.type];

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onSelect?.(decision)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {DECISION_TYPE_LABELS[decision.type]}
              </CardTitle>
              <CardDescription className="text-xs">
                {formatRelativeTime(decision.createdAt)}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <OutcomeBadge decision={decision} />
            {getActionIcon(decision)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-sm font-medium">{getDecisionSummary(decision)}</p>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {decision.reasoning}
        </p>
      </CardContent>
    </Card>
  );
}
