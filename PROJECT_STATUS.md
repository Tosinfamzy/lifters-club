# Lifters Club — Project Status

> **The canonical, up-to-date status lives in [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md).**
> This file is a short snapshot and a pointer — do not duplicate detail here.

## Snapshot

Lifters Club is a **training decision engine** that turns workout history into justified
next-week training decisions. Monorepo: Turborepo + pnpm, TypeScript 5.7 strict.

| Component | State |
|-----------|-------|
| `@gymapp/types` / `@gymapp/validation` | ✅ Shared types + Zod schemas |
| `@gymapp/engine` | ✅ 14 pure-function decision modules, well tested |
| `@gymapp/db` | ✅ Drizzle + Postgres, 2 schemas, migrations + seeds |
| `apps/server` | ✅ Hono REST API (25+ endpoints), Sentry, integration tests, deploys to Railway |
| `apps/web` | ✅ Next.js 15, 12 routes, Clerk + Sentry, deploys to Vercel |
| `apps/mobile` | ✅ Expo 54, full workout-logging app at near-parity with web |

## Open threads (see docs/PROJECT-STATUS.md → "What's wired but incomplete")

1. **Calibration completion endpoint** — onboarding offers "calibration" as a baseline
   method, but no backend endpoint turns completed calibration workouts into baselines
   (`processCalibrationResults()` exists in the engine, never called). *Highest-value gap.*
2. **Feedback-driven self-tuning** — `getProgressionModifier()` exists but isn't wired
   into decision routes, so decisions don't yet adjust based on historical accuracy.
3. **Auto-evaluation coverage** — only `load_progression` and `volume_adjustment`
   auto-evaluate on workout completion; other decision types are manual-only.
4. **First mobile dev build** — Sentry native modules need `eas build --profile development`.
5. **Offline sync** — mobile has basic MMKV set-queueing; full reconnect-flush not done.

## Common commands

```bash
pnpm install        # install deps (corepack enable first if pnpm isn't on PATH)
pnpm build          # build all packages (Turborepo)
pnpm typecheck      # tsc across the monorepo
pnpm test           # Vitest
pnpm dev            # run all apps in dev
pnpm db:push        # push schema; pnpm db:seed / db:seed:programs for data
```
