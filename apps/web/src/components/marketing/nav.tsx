"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Dumbbell } from "lucide-react";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Dumbbell className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Lifters Club</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <a
            href="#features"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How It Works
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Get Started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
