import { DashboardLayout } from "@/components/layout";
import { DecisionsContent } from "./decisions-content";

export default function DecisionsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Training Decisions</h1>
          <p className="text-muted-foreground">
            Understand why your program changes and see the AI reasoning behind each adjustment
          </p>
        </div>

        {/* Content */}
        <DecisionsContent />
      </div>
    </DashboardLayout>
  );
}
