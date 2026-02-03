import Link from "next/link";
import { Dumbbell } from "lucide-react";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              <span className="font-bold">Lifters Club</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Train smarter with AI-powered decisions.
            </p>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="#features" className="hover:text-foreground transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-foreground transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <Link href="/exercises" className="hover:text-foreground transition-colors">
                  Exercise Library
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-muted-foreground/50">About (Coming Soon)</span>
              </li>
              <li>
                <span className="text-muted-foreground/50">Contact (Coming Soon)</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <span className="text-muted-foreground/50">Privacy Policy (Coming Soon)</span>
              </li>
              <li>
                <span className="text-muted-foreground/50">Terms of Service (Coming Soon)</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border/40 pt-8 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Lifters Club. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
