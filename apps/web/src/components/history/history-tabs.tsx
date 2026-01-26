"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, BarChart3 } from "lucide-react";

interface HistoryTabsProps {
  historyContent: React.ReactNode;
  analyticsContent: React.ReactNode;
}

export function HistoryTabs({ historyContent, analyticsContent }: HistoryTabsProps) {
  const [activeTab, setActiveTab] = useState<"history" | "analytics">("history");

  return (
    <div className="space-y-6">
      {/* Tab Buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "history" ? "default" : "outline"}
          onClick={() => setActiveTab("history")}
          className="flex items-center gap-2"
        >
          <Clock className="h-4 w-4" />
          History
        </Button>
        <Button
          variant={activeTab === "analytics" ? "default" : "outline"}
          onClick={() => setActiveTab("analytics")}
          className="flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Analytics
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === "history" ? historyContent : analyticsContent}
    </div>
  );
}
