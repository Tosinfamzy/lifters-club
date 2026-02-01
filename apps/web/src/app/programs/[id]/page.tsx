"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout";
import { useApi } from "@/lib/use-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  Calendar,
  Dumbbell,
  Edit2,
  Save,
  Loader2,
  CheckCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { ExerciseEditor } from "@/components/programs/exercise-editor";
import { DeleteProgramDialog } from "@/components/programs/delete-program-dialog";
import { AddExerciseDialog } from "@/components/programs/add-exercise-dialog";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface PlannedExercise {
  exerciseId: string;
  sets: number;
  repRange: [number, number];
  restSeconds: number;
  notes?: string;
}

interface SessionTemplate {
  dayNumber: number;
  name: string;
  focus: string[];
  exercises: PlannedExercise[];
}

interface ProgramTemplate {
  weeks: number;
  sessions: SessionTemplate[];
}

interface Program {
  id: string;
  name: string;
  description?: string;
  daysPerWeek: number;
  goal: "strength" | "hypertrophy" | "conditioning";
  level: "beginner" | "intermediate" | "advanced";
  template: ProgramTemplate;
}

interface Exercise {
  id: string;
  name: string;
}

export default function ProgramDetailPage() {
  const params = useParams();
  const api = useApi();

  const [program, setProgram] = useState<Program | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingExercise, setEditingExercise] = useState<{
    sessionIndex: number;
    exerciseIndex: number;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addExerciseSession, setAddExerciseSession] = useState<number | null>(null);

  const programId = params.id as string;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch program and exercises in parallel
      const [programRes, exercisesRes] = await Promise.all([
        fetch(`${API_URL}/api/programs/${programId}`),
        fetch(`${API_URL}/api/exercises?limit=100`),
      ]);

      if (programRes.ok) {
        const programData = await programRes.json();
        setProgram(programData.data);
      }

      if (exercisesRes.ok) {
        const exercisesData = await exercisesRes.json();
        setExercises(exercisesData.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch program:", error);
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExerciseSave = (
    sessionIndex: number,
    exerciseIndex: number,
    updatedExercise: PlannedExercise
  ) => {
    if (!program) return;

    const newTemplate = { ...program.template };
    const newSessions = [...newTemplate.sessions];
    const newExercises = [...newSessions[sessionIndex]!.exercises];
    newExercises[exerciseIndex] = updatedExercise;
    newSessions[sessionIndex] = {
      ...newSessions[sessionIndex]!,
      exercises: newExercises,
    };
    newTemplate.sessions = newSessions;

    setProgram({ ...program, template: newTemplate });
    setEditingExercise(null);
    setHasChanges(true);
  };

  const handleExerciseAdd = (
    sessionIndex: number,
    newExercise: PlannedExercise
  ) => {
    if (!program) return;

    const newTemplate = { ...program.template };
    const newSessions = [...newTemplate.sessions];
    const newExercises = [...newSessions[sessionIndex]!.exercises, newExercise];
    newSessions[sessionIndex] = {
      ...newSessions[sessionIndex]!,
      exercises: newExercises,
    };
    newTemplate.sessions = newSessions;

    setProgram({ ...program, template: newTemplate });
    setAddExerciseSession(null);
    setHasChanges(true);
  };

  const handleSaveProgram = async () => {
    if (!program) return;

    setIsSaving(true);
    try {
      await api.updateProgram(program.id, { template: program.template });
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to save program:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const getExerciseName = (exerciseId: string) => {
    return exercises.find((e) => e.id === exerciseId)?.name || exerciseId;
  };

  const goalColors = {
    hypertrophy: "bg-purple-500/10 text-purple-400",
    strength: "bg-blue-500/10 text-blue-400",
    conditioning: "bg-green-500/10 text-green-400",
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!program) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-lg text-muted-foreground">Program not found</p>
          <Button asChild className="mt-4">
            <Link href="/programs">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Programs
            </Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/programs">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{program.name}</h1>
                <Badge className={goalColors[program.goal]}>{program.goal}</Badge>
              </div>
              <p className="text-muted-foreground">
                {program.description || `${program.level} level program`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button onClick={handleSaveProgram} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            )}
            <DeleteProgramDialog
              programId={program.id}
              programName={program.name}
            />
          </div>
        </div>

        {/* Program Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Duration</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">
                  {program.template.weeks}
                </span>
                <span className="text-muted-foreground">weeks</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Frequency</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <span className="text-2xl font-bold">{program.daysPerWeek}</span>
                <span className="text-muted-foreground">days/week</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {program.template.sessions.length}
              </div>
              <p className="text-xs text-muted-foreground">unique sessions</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{program.level}</div>
              <p className="text-xs text-muted-foreground">difficulty</p>
            </CardContent>
          </Card>
        </div>

        {/* Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Training Sessions</CardTitle>
            <CardDescription>
              Click on a session to view and edit exercises
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {program.template.sessions.map((session, sessionIndex) => (
                <AccordionItem key={sessionIndex} value={`session-${sessionIndex}`}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold">Day {session.dayNumber}</span>
                      <span className="text-muted-foreground">
                        {session.name}
                      </span>
                      <div className="flex gap-1">
                        {session.focus.slice(0, 3).map((f) => (
                          <Badge key={f} variant="outline" className="text-xs">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-4">
                      {session.exercises.map((exercise, exerciseIndex) => {
                        const isEditing =
                          editingExercise?.sessionIndex === sessionIndex &&
                          editingExercise?.exerciseIndex === exerciseIndex;

                        if (isEditing) {
                          return (
                            <ExerciseEditor
                              key={exerciseIndex}
                              exercise={exercise}
                              exerciseIndex={exerciseIndex}
                              sessionIndex={sessionIndex}
                              exerciseList={exercises}
                              onSave={handleExerciseSave}
                              onCancel={() => setEditingExercise(null)}
                            />
                          );
                        }

                        return (
                          <div
                            key={exerciseIndex}
                            className="flex items-center justify-between rounded-lg bg-secondary p-4"
                          >
                            <div className="space-y-1">
                              <p className="font-medium">
                                {getExerciseName(exercise.exerciseId)}
                              </p>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <span>{exercise.sets} sets</span>
                                <span>
                                  {exercise.repRange[0]}-{exercise.repRange[1]} reps
                                </span>
                                <span>{exercise.restSeconds}s rest</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setEditingExercise({
                                  sessionIndex,
                                  exerciseIndex,
                                })
                              }
                            >
                              <Edit2 className="mr-2 h-4 w-4" />
                              Edit
                            </Button>
                          </div>
                        );
                      })}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => setAddExerciseSession(sessionIndex)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Exercise
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      <AddExerciseDialog
        sessionIndex={addExerciseSession ?? 0}
        open={addExerciseSession !== null}
        onOpenChange={(open) => !open && setAddExerciseSession(null)}
        onAdd={handleExerciseAdd}
      />
    </DashboardLayout>
  );
}
