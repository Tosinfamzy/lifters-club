# @gymapp/web - Development Standards

> Next.js 15 frontend for the Lifters Club application.

## Purpose

This app provides:
- User-facing training interface (web dashboard)
- Exercise library browser
- Program management

> **Note:** Offline workout logging is handled by the mobile app (`@gymapp/mobile`) using MMKV + offline queue. The web app is online-only.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth**: Clerk
- **Data Fetching**: React Server Components + API routes

## Project Structure

```
src/
├── app/                      # App Router
│   ├── (auth)/               # Authenticated routes (grouped)
│   │   ├── dashboard/
│   │   ├── workout/
│   │   └── history/
│   ├── (public)/             # Public routes
│   │   └── exercises/
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/
│   ├── ui/                   # shadcn/ui components
│   ├── workout/              # Workout-specific components
│   └── exercises/            # Exercise-specific components
├── lib/
│   └── api-client.ts         # API client utilities
└── hooks/                    # Custom React hooks
```

## App Router Patterns

### Route Groups

```
app/
├── (auth)/                   # Requires authentication
│   ├── layout.tsx            # Auth check wrapper
│   ├── dashboard/page.tsx
│   └── workout/[id]/page.tsx
├── (public)/                 # No auth required
│   └── exercises/page.tsx
└── layout.tsx                # Root layout (providers)
```

### Layouts

```tsx
// app/layout.tsx - Root layout
import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}

// app/(auth)/layout.tsx - Protected routes
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
```

### Server vs Client Components

```tsx
// ✅ Server Component (default) - data fetching
// app/exercises/page.tsx
async function ExercisesPage() {
  const exercises = await fetchExercises(); // Server-side fetch

  return (
    <div>
      <h1>Exercises</h1>
      <ExerciseList exercises={exercises} />
    </div>
  );
}

// ✅ Client Component - interactivity
// components/workout/set-logger.tsx
"use client";

import { useState } from "react";

export function SetLogger({ exerciseId }: { exerciseId: string }) {
  const [reps, setReps] = useState(0);
  const [weight, setWeight] = useState(0);

  return (
    <form onSubmit={handleSubmit}>
      {/* Interactive form */}
    </form>
  );
}
```

### When to Use Each

| Use Server Components | Use Client Components |
|----------------------|----------------------|
| Fetching data | Event handlers (onClick, onChange) |
| Accessing backend resources | useState, useEffect, useReducer |
| Keeping sensitive data on server | Browser APIs |
| Reducing client JS | Real-time updates |
| Static content | Interactive forms |

## Styling with Tailwind + shadcn/ui

### Component Pattern

```tsx
// components/ui/button.tsx (shadcn/ui)
// Auto-generated, customize variants in components.json

// components/workout/workout-card.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function WorkoutCard({ workout }: { workout: Workout }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{workout.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={() => startWorkout(workout.id)}>
          Start Workout
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Tailwind Best Practices

```tsx
// ✅ Good - readable, semantic groupings
<div className="flex flex-col gap-4 p-6 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-semibold text-gray-900">Title</h2>
  <p className="text-gray-600">Description</p>
</div>

// ✅ Good - extract repeated patterns
const cardStyles = "bg-white rounded-lg shadow-md p-6";
const headingStyles = "text-xl font-semibold text-gray-900";

// ❌ Bad - too many classes, hard to read
<div className="flex flex-col items-start justify-center gap-4 p-6 m-4 bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow duration-200 ease-in-out">
```

## Component Guidelines

### File Naming

```
components/
├── ui/                       # shadcn/ui (PascalCase)
│   ├── button.tsx
│   └── card.tsx
├── workout/                  # Feature components (kebab-case files)
│   ├── workout-card.tsx      # <WorkoutCard />
│   ├── set-logger.tsx        # <SetLogger />
│   └── index.ts              # Barrel export
└── exercises/
    ├── exercise-list.tsx
    └── exercise-filter.tsx
```

### Component Structure

```tsx
// ✅ Good component structure
"use client"; // Only if needed

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Exercise } from "@gymapp/types";

interface ExerciseCardProps {
  exercise: Exercise;
  onSelect?: (id: string) => void;
}

export function ExerciseCard({ exercise, onSelect }: ExerciseCardProps) {
  // Hooks first
  const [isExpanded, setIsExpanded] = useState(false);

  // Handlers
  const handleSelect = () => {
    onSelect?.(exercise.id);
  };

  // Render
  return (
    <div className="p-4 border rounded-lg">
      <h3 className="font-semibold">{exercise.name}</h3>
      {isExpanded && (
        <p className="text-gray-600">{exercise.difficulty}</p>
      )}
      <Button onClick={handleSelect}>Select</Button>
    </div>
  );
}
```

### Prop Types

```tsx
// ✅ Use interface for props
interface WorkoutCardProps {
  workout: Workout;
  onStart?: () => void;
  isLoading?: boolean;
}

// ✅ Use children prop correctly
interface CardProps {
  children: React.ReactNode;
  className?: string;
}

// ❌ Avoid any
interface BadProps {
  data: any;
}
```

## Data Fetching

### Server Components

```tsx
// ✅ Fetch in Server Components
async function ExercisesPage() {
  const exercises = await fetch(`${API_URL}/api/exercises`).then(r => r.json());
  return <ExerciseList exercises={exercises} />;
}
```

## Error Handling

### Error Boundaries

```tsx
// app/workout/[id]/error.tsx
"use client";

export default function WorkoutError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="p-4 text-center">
      <h2 className="text-xl font-bold text-red-600">Something went wrong</h2>
      <p className="text-gray-600">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
```

### Loading States

```tsx
// app/workout/[id]/loading.tsx
export default function WorkoutLoading() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
```

## Testing

### Component Tests

```tsx
import { render, screen } from "@testing-library/react";
import { ExerciseCard } from "./exercise-card";

describe("ExerciseCard", () => {
  it("renders exercise name", () => {
    render(<ExerciseCard exercise={mockExercise} />);
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<ExerciseCard exercise={mockExercise} onSelect={onSelect} />);

    await userEvent.click(screen.getByRole("button", { name: /select/i }));
    expect(onSelect).toHaveBeenCalledWith("bench-press");
  });
});
```

## Performance

### Image Optimization

```tsx
import Image from "next/image";

// ✅ Good - uses next/image
<Image
  src="/exercises/bench-press.jpg"
  alt="Bench Press"
  width={400}
  height={300}
  priority={isAboveFold}
/>

// ❌ Bad - unoptimized
<img src="/exercises/bench-press.jpg" alt="Bench Press" />
```

### Dynamic Imports

```tsx
import dynamic from "next/dynamic";

// Lazy load heavy components
const ExerciseChart = dynamic(() => import("./exercise-chart"), {
  loading: () => <Skeleton className="h-64" />,
});
```

## References

- [Next.js App Router](https://nextjs.org/docs/app)
- [Next.js 15 Best Practices](https://dev.to/bajrayejoon/best-practices-for-organizing-your-nextjs-15-2025-53ji)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS Best Practices](https://tailwindcss.com/docs/reusing-styles)
