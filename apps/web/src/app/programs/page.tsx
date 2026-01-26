import { DashboardLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ProgramCard } from "@/components/programs/program-card";
import { api } from "@/lib/api";

async function getPrograms() {
  try {
    const response = await api.getPrograms({ limit: 20 });
    return response.data;
  } catch {
    return [];
  }
}

export default async function ProgramsPage() {
  const programs = await getPrograms();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Programs</h1>
            <p className="text-muted-foreground">
              Browse available training programs
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Program
          </Button>
        </div>

        {/* Programs Grid */}
        {programs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No programs found. Make sure the API server is running on port 4000.</p>
              <p className="text-sm mt-2">Run: <code>make dev-server</code> or <code>make up</code></p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
