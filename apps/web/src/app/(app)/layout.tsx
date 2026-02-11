import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { OnboardingGuard } from "@/components/layout/onboarding-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <OnboardingGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </OnboardingGuard>
  );
}
