# ADR-0003: Hono for Backend API

## Status

Accepted

## Date

2025-01-21

## Context

We need a backend framework for:
- Exercise Library REST API (public)
- Training API (authenticated)
- PowerSync upload handler
- Webhook receivers (Clerk)

Requirements:
- TypeScript-first
- Fast and lightweight
- Good middleware ecosystem
- Easy testing
- Potential to run on edge runtimes in future

## Decision

Use **Hono** as the backend framework.

### Key Features We'll Use

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors({ origin: ["http://localhost:3000"] }));

// Type-safe routes with Zod validation
app.post("/api/exercises",
  zValidator("json", createExerciseSchema),
  async (c) => {
    const data = c.req.valid("json");
    // data is fully typed
    return c.json(result, 201);
  }
);
```

### Project Structure

```
apps/server/src/
├── index.ts           # Entry point
├── routes/
│   ├── exercises.ts   # Exercise Library routes
│   ├── users.ts
│   ├── programs.ts
│   ├── workouts.ts
│   └── sync.ts        # PowerSync upload handler
├── middleware/
│   ├── auth.ts        # Clerk JWT verification
│   └── validation.ts  # Shared validation helpers
└── services/
    ├── exercise-library/
    └── training-engine/
```

## Consequences

### Positive

- Ultrafast (RegExpRouter, no linear loops)
- Lightweight (~14kB for hono/tiny preset)
- Zero dependencies, built on Web Standards
- First-class TypeScript support with excellent inference
- Clean, modern API design
- Built-in middleware for common needs (cors, logger, jwt)
- Runs anywhere: Node.js, Bun, Cloudflare Workers, Deno
- `@hono/zod-validator` for seamless Zod integration

### Negative

- Smaller community than Express (but growing rapidly)
- Less middleware ecosystem than Express (but sufficient for our needs)
- Team may be unfamiliar with it

### Neutral

- Different API patterns than Express (context-based vs req/res)
- Need to learn Hono-specific patterns

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Express | Huge ecosystem, very familiar | Dated API, slower, no native TS | Legacy patterns, performance |
| Fastify | Good performance, schema validation | Heavier, more complex setup | More than we need |
| tRPC | End-to-end type safety | Not REST, harder for public API | Exercise Library needs REST |
| Elysia | Very fast, good DX | Bun-only, smaller ecosystem | Runtime lock-in |

## References

- [Hono Documentation](https://hono.dev/docs/)
- [Hono Getting Started](https://hono.dev/docs/getting-started/basic)
- [Hono + Drizzle Tutorial](https://dev.to/aaronksaunders/getting-started-with-hono-js-and-drizzle-orm-2g6i)
- [GitHub - honojs/hono](https://github.com/honojs/hono)
