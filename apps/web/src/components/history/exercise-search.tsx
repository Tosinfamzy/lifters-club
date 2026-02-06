"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check } from "lucide-react";
import type { Exercise } from "@/lib/api";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface ExerciseSearchProps {
  onSelect: (exercise: Exercise) => void;
  selectedId?: string;
  disabled?: boolean;
}

export function ExerciseSearch({
  onSelect,
  selectedId,
  disabled,
}: ExerciseSearchProps) {
  const [search, setSearch] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Search exercises when input changes
  useEffect(() => {
    const searchExercises = async () => {
      if (!search.trim()) {
        setExercises([]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `${API_URL}/api/exercises/search/${encodeURIComponent(search)}`
        );
        if (response.ok) {
          const data = await response.json();
          setExercises(data.data || []);
        }
      } catch {
        setExercises([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(searchExercises, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleSelect = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setSearch("");
    setIsOpen(false);
    onSelect(exercise);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder={selectedExercise ? selectedExercise.name : "Search exercises..."}
          className={cn(
            "pl-10 pr-10",
            selectedExercise && "placeholder:text-foreground"
          )}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {selectedExercise && !isLoading && (
          <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
        )}
      </div>

      {isOpen && search.trim() && exercises.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
          <ul className="max-h-60 overflow-auto py-1">
            {exercises.map((exercise) => (
              <li
                key={exercise.id}
                className={cn(
                  "cursor-pointer px-3 py-2 hover:bg-secondary",
                  selectedId === exercise.id && "bg-secondary"
                )}
                onClick={() => handleSelect(exercise)}
              >
                <div className="font-medium text-sm">{exercise.name}</div>
                <div className="text-xs text-muted-foreground">
                  {exercise.primaryMuscles.slice(0, 2).join(", ")} •{" "}
                  {exercise.equipment[0] || "Bodyweight"}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOpen && search.trim() && !isLoading && exercises.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
          No exercises found
        </div>
      )}
    </div>
  );
}
