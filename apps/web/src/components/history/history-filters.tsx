"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, X } from "lucide-react";

interface HistoryFiltersProps {
  onFiltersChange: (filters: HistoryFilters) => void;
}

export interface HistoryFilters {
  dateFrom?: string;
  dateTo?: string;
  sortBy: "date" | "duration" | "rpe";
  sortOrder: "asc" | "desc";
}

export function HistoryFilters({ onFiltersChange }: HistoryFiltersProps) {
  const [filters, setFilters] = useState<HistoryFilters>({
    sortBy: "date",
    sortOrder: "desc",
  });

  const handleChange = (key: keyof HistoryFilters, value: string) => {
    const newFilters = { ...filters, [key]: value || undefined };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClearDates = () => {
    const newFilters = { ...filters, dateFrom: undefined, dateTo: undefined };
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) => handleChange("dateFrom", e.target.value)}
            className="w-40"
            placeholder="From"
          />
          <span className="text-muted-foreground">to</span>
          <Input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) => handleChange("dateTo", e.target.value)}
            className="w-40"
            placeholder="To"
          />
          {(filters.dateFrom || filters.dateTo) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleClearDates}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Sort by:</span>
        <Select
          value={filters.sortBy}
          onValueChange={(value) =>
            handleChange("sortBy", value as HistoryFilters["sortBy"])
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Date</SelectItem>
            <SelectItem value="duration">Duration</SelectItem>
            <SelectItem value="rpe">RPE</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.sortOrder}
          onValueChange={(value) =>
            handleChange("sortOrder", value as HistoryFilters["sortOrder"])
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest first</SelectItem>
            <SelectItem value="asc">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
