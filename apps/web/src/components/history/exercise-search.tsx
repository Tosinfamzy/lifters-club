"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Check } from "lucide-react";
import { API_BASE_URL, type Exercise } from "@/lib/api";
import { cn } from "@/lib/utils";

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
    if (!search.trim()) {
      setExercises([]);
      return;
    }

    const controller = new AbortController();

    const searchExercises = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/exercises/search/${encodeURIComponent(search)}`,
          { signal: controller.signal }
        );
        if (response.ok) {
          const data = await response.json();
          setExercises(data.data || []);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return; // Request cancelled, ignore
        }
        setExercises([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    const timer = setTimeout(searchExercises, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const handleSelect = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setSearch("");
    setIsOpen(false);
    setHighlightedIndex(-1);
    onSelect(exercise);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || exercises.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < exercises.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : exercises.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && exercises[highlightedIndex]) {
          handleSelect(exercises[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
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
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-label="Search exercises"
          role="combobox"
          aria-expanded={isOpen && exercises.length > 0}
          aria-controls="exercise-listbox"
          aria-autocomplete="list"
          aria-activedescendant={
            highlightedIndex >= 0 ? `exercise-option-${highlightedIndex}` : undefined
          }
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
          <ul
            id="exercise-listbox"
            role="listbox"
            aria-label="Exercise suggestions"
            className="max-h-60 overflow-auto py-1"
          >
            {exercises.map((exercise, index) => (
              <li
                key={exercise.id}
                id={`exercise-option-${index}`}
                role="option"
                aria-selected={highlightedIndex === index}
                className={cn(
                  "cursor-pointer px-3 py-2 hover:bg-secondary",
                  selectedId === exercise.id && "bg-secondary",
                  highlightedIndex === index && "bg-secondary"
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
