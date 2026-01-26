import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { ExerciseGrid } from "@/components/exercises/exercise-grid";
import { api } from "@/lib/api";

async function getExercises() {
  try {
    const response = await api.getExercises({ limit: 100 });
    return response.data;
  } catch {
    return [];
  }
}

export default async function ExercisesPage() {
  const exercises = await getExercises();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Exercise Library</h1>
          <p className="text-muted-foreground">
            Browse and search all available exercises
          </p>
        </div>

        {/* Exercise Grid with Search */}
        {exercises.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No exercises found. Make sure the API server is running on port 4000.</p>
              <p className="text-sm mt-2">Run: <code>make dev-server</code> or <code>make up</code></p>
            </CardContent>
          </Card>
        ) : (
          <ExerciseGrid initialExercises={exercises} />
        )}
      </div>
    </DashboardLayout>
  );
}
