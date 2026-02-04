"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import type { Exercise } from "@/lib/api";

interface ExerciseGridProps {
  initialExercises: Exercise[];
}

export function ExerciseGrid({ initialExercises }: ExerciseGridProps) {
  const [exercises, setExercises] = useState<Exercise[]>(initialExercises);
  const [search, setSearch] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Search exercises when debounced search changes
  const searchExercises = useCallback(async (term: string) => {
    if (!term.trim()) {
      setExercises(initialExercises);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/exercises/search/${encodeURIComponent(term)}`
      );
      if (response.ok) {
        const data = await response.json();
        setExercises(data.data || []);
      }
    } catch {
      // On error, filter locally
      const filtered = initialExercises.filter(
        (ex) =>
          ex.name.toLowerCase().includes(term.toLowerCase()) ||
          ex.primaryMuscles.some((m) =>
            m.toLowerCase().includes(term.toLowerCase())
          )
      );
      setExercises(filtered);
    } finally {
      setIsSearching(false);
    }
  }, [initialExercises]);

  useEffect(() => {
    searchExercises(debouncedSearch);
  }, [debouncedSearch, searchExercises]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Results info */}
      <p className="text-sm text-muted-foreground">
        {search ? `Found ${exercises.length} exercises` : `${exercises.length} exercises`}
      </p>

      {/* Exercise Grid */}
      {exercises.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>No exercises found matching &quot;{search}&quot;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {exercises.map((exercise) => (
            <Link key={exercise.id} href={`/exercises/${exercise.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{exercise.name}</CardTitle>
                  <CardDescription>
                    {exercise.movementPatterns[0] || "General"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {exercise.primaryMuscles.slice(0, 3).map((muscle) => (
                      <span
                        key={muscle}
                        className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {muscle}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{exercise.equipment[0] || "Bodyweight"}</span>
                    <span
                      className={
                        exercise.difficulty === "beginner"
                          ? "text-green-400"
                          : exercise.difficulty === "intermediate"
                          ? "text-yellow-400"
                          : "text-red-400"
                      }
                    >
                      {exercise.difficulty}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
