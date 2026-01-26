"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Dumbbell,
  History,
  Library,
  Settings,
  Brain,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppUser } from "@/providers/user-provider";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Programs", href: "/programs", icon: Dumbbell },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Decisions", href: "/decisions", icon: Brain },
  { name: "History", href: "/history", icon: History },
  { name: "Exercises", href: "/exercises", icon: Library },
];

export function Sidebar() {
  const pathname = usePathname();
  const { appUser } = useAppUser();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border bg-card">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">Lifters Club</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-border p-3 space-y-2">
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === "/settings"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
          <div className="flex items-center gap-3 px-3 py-2">
            <UserButton
              afterSignOutUrl="/sign-in"
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">Account</span>
              {appUser && (
                <span className="text-xs text-primary capitalize">
                  {appUser.trainingLevel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
