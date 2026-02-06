import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen">
      {/* Mobile header with hamburger */}
      <MobileNav />

      {/* Desktop sidebar (hidden on mobile) */}
      <Sidebar />

      {/* Main content - adjust padding for mobile header */}
      <main className="pt-16 md:pt-0 md:pl-64">
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
