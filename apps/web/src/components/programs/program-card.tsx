"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Calendar, Dumbbell, Loader2, CheckCircle, Settings } from "lucide-react";
import Link from "next/link";
import { useAppUser } from "@/providers/user-provider";
import type { Program } from "@/lib/api";

interface ProgramCardProps {
  program: Program;
}

export function ProgramCard({ program }: ProgramCardProps) {
  const { appUser } = useAppUser();
  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartProgram = async () => {
    if (!appUser) {
      setError("Please complete onboarding first");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      // Generate a unique ID for the training block
      const blockId = `block-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const userId = appUser.id;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/workouts/training-blocks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: blockId,
            userId,
            programId: program.id,
            startDate,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to start program");
      }

      setSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Card className="relative">
      <div className="absolute right-4 top-4">
        <span
          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
            program.goal === "hypertrophy"
              ? "bg-purple-500/10 text-purple-400"
              : program.goal === "strength"
              ? "bg-blue-500/10 text-blue-400"
              : "bg-green-500/10 text-green-400"
          }`}
        >
          {program.goal}
        </span>
      </div>
      <CardHeader>
        <CardTitle>{program.name}</CardTitle>
        <CardDescription>
          {program.description || `${program.level} level program`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            <span>{program.template.weeks} weeks</span>
          </div>
          <div className="flex items-center gap-1">
            <Dumbbell className="h-4 w-4" />
            <span>{program.daysPerWeek} days/week</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {program.template.sessions.length} session types • {program.level}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <Link href={`/programs/${program.id}`}>
              <Settings className="mr-2 h-4 w-4" />
              Customize
            </Link>
          </Button>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1">Start</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start {program.name}</DialogTitle>
              <DialogDescription>
                Begin this {program.template.weeks}-week program. Your workouts
                will be scheduled automatically.
              </DialogDescription>
            </DialogHeader>

            {success ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <p className="text-lg font-medium">Program Started!</p>
                <p className="text-sm text-muted-foreground">
                  Your first workout is ready.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Date</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>

                  <div className="rounded-lg bg-secondary p-4 space-y-2">
                    <p className="text-sm font-medium">Program Details</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• {program.template.weeks} weeks total</li>
                      <li>• {program.daysPerWeek} workouts per week</li>
                      <li>• Focus: {program.goal}</li>
                      <li>• Level: {program.level}</li>
                    </ul>
                  </div>

                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                    disabled={isStarting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleStartProgram} disabled={isStarting}>
                    {isStarting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Starting...
                      </>
                    ) : (
                      "Start Program"
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
