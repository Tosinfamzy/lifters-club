import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  BarChart3,
  Target,
  Dumbbell,
  TrendingUp,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

export default function LandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container relative py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="animate-fade-in text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              Train Smarter,{" "}
              <span className="text-primary">Not Harder</span>
            </h1>
            <p className="animate-fade-in delay-100 mt-6 text-lg text-muted-foreground md:text-xl opacity-0">
              Lifters Club analyzes your training and makes intelligent decisions
              so you can focus on what matters most — lifting.
            </p>
            <div className="animate-fade-in delay-200 mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center opacity-0">
              <Button size="lg" asChild className="group">
                <Link href="/sign-up">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#how-it-works">See How It Works</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Problem/Solution Section */}
      <section className="border-y border-border/40 bg-secondary/30">
        <div className="container py-16 md:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">
              Stop Guessing. Start Progressing.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Most lifters waste time second-guessing their training. Should I add
              weight? Reduce volume? Take a deload? Lifters Club removes the
              guesswork with data-driven decisions tailored to your performance.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Everything You Need to Progress
          </h2>
          <p className="mt-4 text-muted-foreground">
            Built by lifters, for lifters. Every feature is designed to help you
            make better training decisions.
          </p>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-3">
          <Card className="group border-border/40 bg-card/50 transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
            <CardContent className="pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-110">
                <Brain className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Intelligent Progression</h3>
              <p className="mt-2 text-muted-foreground">
                Automatic weight adjustments based on your performance, RPE, and
                recovery. No more guessing when to add weight.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-border/40 bg-card/50 transition-all duration-300 hover:border-green-500/50 hover:shadow-lg hover:shadow-green-500/5">
            <CardContent className="pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10 text-green-500 transition-transform duration-300 group-hover:scale-110">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Track Everything</h3>
              <p className="mt-2 text-muted-foreground">
                Log workouts, visualize progress, and identify trends over time.
                See your PRs, volume, and consistency at a glance.
              </p>
            </CardContent>
          </Card>

          <Card className="group border-border/40 bg-card/50 transition-all duration-300 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5">
            <CardContent className="pt-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 transition-transform duration-300 group-hover:scale-110">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-xl font-semibold">Smart Programs</h3>
              <p className="mt-2 text-muted-foreground">
                Programs that adapt to you, not the other way around. Your training
                evolves based on how you respond.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-y border-border/40 bg-secondary/30">
        <div className="container py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How It Works</h2>
            <p className="mt-4 text-muted-foreground">
              Three simple steps to smarter training
            </p>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-8 md:grid-cols-3">
            <div className="group text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground transition-transform duration-300 group-hover:scale-110">
                1
              </div>
              <h3 className="mt-6 text-xl font-semibold">Log Your Workouts</h3>
              <p className="mt-2 text-muted-foreground">
                Track sets, reps, weight, and RPE. The more data you log, the
                smarter your recommendations become.
              </p>
            </div>

            <div className="group text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground transition-transform duration-300 group-hover:scale-110">
                2
              </div>
              <h3 className="mt-6 text-xl font-semibold">Get Decisions</h3>
              <p className="mt-2 text-muted-foreground">
                Our engine analyzes your performance and generates justified
                recommendations for progression.
              </p>
            </div>

            <div className="group text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground transition-transform duration-300 group-hover:scale-110">
                3
              </div>
              <h3 className="mt-6 text-xl font-semibold">Progress Automatically</h3>
              <p className="mt-2 text-muted-foreground">
                Your program evolves with you. No more stalled progress or
                blindly following a static plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Decision Preview Section */}
      <section className="container py-20 md:py-28">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">
              Decisions That Make Sense
            </h2>
            <p className="mt-4 text-muted-foreground">
              Every recommendation comes with clear reasoning. Understand exactly
              why your program is changing and trust the process.
            </p>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                <span>Based on your actual performance data</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                <span>Considers RPE, volume, and recovery</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                <span>Transparent reasoning you can review</span>
              </li>
            </ul>
          </div>

          <Card className="border-border/40 bg-card transition-all duration-300 hover:shadow-xl hover:shadow-green-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Load Progression</p>
                  <p className="font-semibold">Bench Press</p>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-secondary p-4">
                <p className="text-lg font-semibold">
                  Increase to{" "}
                  <span className="text-green-500">102.5kg</span>
                </p>
                <p className="text-sm text-muted-foreground">+2.5kg from current</p>
              </div>

              <div className="mt-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Why this decision:
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Dumbbell className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>Hit top of rep range (10 reps) last session</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Dumbbell className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>RPE was 7 — room to progress safely</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Dumbbell className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span>Consistent performance over last 3 weeks</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/40 bg-secondary/30">
        <div className="container py-20 md:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Ready to Train Smarter?
            </h2>
            <p className="mt-4 text-muted-foreground">
              Join lifters who&apos;ve eliminated guesswork from their training.
              Start making progress you can trust.
            </p>
            <div className="mt-8">
              <Button size="lg" asChild className="group">
                <Link href="/sign-up">
                  Start Free Today
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
