"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronsUpDown, Check } from "lucide-react";

/** Minimal exercise shape the picker needs — decoupled from any full Exercise type. */
export interface ExerciseOption {
  id: string;
  name: string;
}

interface ExercisePickerProps {
  /** Full exercise list to choose from (loaded once by the parent). */
  exercises: ExerciseOption[];
  /** Currently selected exercise id, if any. */
  value?: string;
  onChange: (exerciseId: string) => void;
  placeholder?: string;
  /** Exercise ids to hide from the list (e.g. the already-chosen original). */
  exclude?: string[];
  disabled?: boolean;
}

/**
 * Reusable searchable exercise picker. Renders a trigger button showing the
 * selected exercise; opening it presents a search box over a filtered list.
 * Filters client-side against the passed-in list (the library is small), so it
 * needs no per-keystroke network calls.
 */
export function ExercisePicker({
  exercises,
  value,
  onChange,
  placeholder = "Select an exercise…",
  exclude = [],
  disabled,
}: ExercisePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = exercises.find((e) => e.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises
      .filter((e) => !exclude.includes(e.id))
      .filter((e) => (q ? e.name.toLowerCase().includes(q) : true))
      .slice(0, 50);
  }, [exercises, exclude, query]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.name : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Choose an exercise</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search exercises…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No exercises match &ldquo;{query}&rdquo;
            </p>
          ) : (
            filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => handleSelect(e.id)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                <span>{e.name}</span>
                {e.id === value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
