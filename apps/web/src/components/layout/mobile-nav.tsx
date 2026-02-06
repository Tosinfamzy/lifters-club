"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Dumbbell, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { navigation } from "./sidebar";
import { cn } from "@/lib/utils";
import { useAppUser } from "@/providers/user-provider";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { appUser } = useAppUser();

  return (
    <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-card flex items-center justify-between px-4">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center gap-2">
        <Dumbbell className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Lifters Club</span>
      </Link>

      {/* Hamburger Menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex h-16 items-center gap-2 border-b border-border px-6">
              <Dumbbell className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">Lifters Club</span>
            </div>

            {/* Nav Items */}
            <nav className="flex-1 space-y-1 px-3 py-4">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setOpen(false)}
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

            {/* Footer with Settings + User */}
            <div className="border-t border-border p-3 space-y-2">
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
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
                  appearance={{ elements: { avatarBox: "h-8 w-8" } }}
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
        </SheetContent>
      </Sheet>
    </div>
  );
}
