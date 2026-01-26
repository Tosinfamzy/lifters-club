# ADR-0001: Monorepo with Turborepo + pnpm

## Status

Accepted

## Date

2025-01-21

## Context

The Lifters Club application consists of multiple interconnected systems:
- Exercise Library API (standalone, reusable)
- Training App backend (Hono server)
- Training App frontend (Next.js)
- Shared packages (types, validation, database, engine)

We need a strategy for organizing and managing these codebases that allows:
- Coordinated changes across packages
- Shared tooling and configuration
- Efficient CI/CD pipelines
- Clear dependency relationships

## Decision

Use **Turborepo** with **pnpm workspaces** for monorepo management.

### Structure

```
lifters-club/
├── apps/
│   ├── web/          # Next.js frontend
│   └── server/       # Hono backend
├── packages/
│   ├── types/        # @gymapp/types
│   ├── db/           # @gymapp/db
│   ├── engine/       # @gymapp/engine
│   └── validation/   # @gymapp/validation
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Key Configuration

**pnpm-workspace.yaml:**
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**turbo.json:**
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

## Consequences

### Positive

- Single repository for all coordinated changes
- pnpm's strict dependency isolation prevents phantom dependencies
- Turborepo's remote caching reduces CI times (30s → 0.2s for cached)
- Shared TypeScript configuration across packages
- Atomic commits across multiple packages
- Simplified dependency management between internal packages

### Negative

- Slightly more complex initial setup
- Team members need to learn Turborepo conventions
- Large repository size over time

### Neutral

- Requires pnpm (not npm or yarn) - acceptable as pnpm is mature
- CI/CD pipelines need Turborepo-aware configuration

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Nx | More features, powerful generators | Heavier, steeper learning curve, more opinionated | Overkill for our needs |
| Lerna | Familiar to many | Largely deprecated, less maintained | Not actively developed |
| Separate repos | Full isolation | Coordination overhead, version drift, difficult cross-cutting changes | Too much friction for tightly coupled packages |
| npm/yarn workspaces only | Built-in, no extra tool | No caching, no task orchestration | Missing key features |

## References

- [Turborepo Documentation](https://turborepo.dev/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [Nhost's Turborepo Configuration](https://nhost.io/blog/how-we-configured-pnpm-and-turborepo-for-our-monorepo)
