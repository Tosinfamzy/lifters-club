# ADR-0010: Observability Strategy — Pino + Sentry over OpenTelemetry

## Status

Accepted

## Date

2026-03-02

## Context

Lifters Club runs a single-service architecture: mobile and web clients call a Hono API server backed by PostgreSQL. The project already has two observability tools in place:

- **Pino** — structured JSON logger with child loggers per request, request ID propagation, and sensitive field redaction
- **Sentry** — error tracking with stack traces, release tracking, and performance monitoring (10% tracesSampleRate in production)

The team has experience with OpenTelemetry (OTel) and GCP Observability from other projects. The question was whether to introduce OTel for distributed tracing and metrics.

The key gaps in the existing setup were:

1. **No userId in request-scoped logs** — the child logger was created before auth middleware ran, so route handler logs lacked user context
2. **Sentry context only on explicit errors** — requestId and userId were only attached via `captureError()`, not on the per-request Sentry scope
3. **Sparse completion logs** — request completion logs only included `statusCode` and `responseTime`, missing `userId`, `userAgent`, `route` (matched pattern), and response size

## Decision

Enhance the existing Pino + Sentry stack rather than introducing OpenTelemetry. Specifically:

1. **Enrich child logger after auth** — auth middleware creates a new Pino child with `userId`, so every downstream log line includes it automatically
2. **Structured completion logs** — request logger captures `userId`, `userAgent`, `route` (Hono matched pattern for low-cardinality grouping), and `contentLength` on every request
3. **Per-request Sentry scope** — request logger sets `requestId` as a Sentry tag and `path` as extra context; auth middleware sets `Sentry.setUser()`. Any Sentry event during the request carries full context.

Defer OTel until the architecture becomes distributed.

## Consequences

### Positive

- Zero new dependencies — uses existing Pino and @sentry/node
- Every log line from authenticated routes automatically includes userId
- Sentry errors/performance spans carry requestId + userId without explicit wiring
- `route` field (e.g. `/api/users/:id`) enables log aggregation without high-cardinality path explosion
- Minimal code change (2 middleware files, ~20 lines added)

### Negative

- No distributed traces across service boundaries (irrelevant with single-service architecture)
- No auto-instrumented spans for DB queries or HTTP calls (Sentry performance monitoring partially covers this)
- If we add services later, we'll need to retrofit OTel

### Neutral

- Log volume increases slightly due to additional fields per completion log
- Sentry scope must be managed carefully if we introduce async task processing (scope isolation)

## Alternatives Considered

| Alternative | Pros | Cons | Why Not Chosen |
|-------------|------|------|----------------|
| Full OTel stack (SDK + Collector + GCP backend) | Vendor-neutral, distributed tracing, auto-instrumentation for DB/HTTP | Significant setup overhead, collector infra to maintain, cost of trace storage, overkill for single-service | Premature — adds complexity without proportional benefit for current architecture |
| Pino + OTel exporter (hybrid) | Keeps Pino, adds trace context to logs | Still requires OTel SDK + collector, partial benefit without full tracing | Half-measure that adds dependency complexity without the full distributed tracing benefit |
| Replace Pino with OTel logging | Single observability framework | Loses Pino's simplicity and transport ecosystem, significant migration | Pino is working well, no reason to replace |

## Trigger to Revisit

Revisit this decision when any of the following occur:

- A second service is added (e.g., background job worker, notification service)
- A cache layer (Redis) is introduced with its own failure modes
- Sentry's performance monitoring feels insufficient for debugging latency
- The team needs cross-service request tracing

## References

- [Pino Child Loggers](https://getpino.io/#/docs/child-loggers)
- [Sentry Node.js SDK — Scopes](https://docs.sentry.io/platforms/javascript/guides/node/enriching-events/scopes/)
- [OpenTelemetry — When to Adopt](https://opentelemetry.io/docs/concepts/signals/)
- [ADR-0003: Hono for Backend API](./0003-hono-backend.md)

---

## Update — 2026-05-09: Multi-platform expansion

The strategy in this ADR (Pino + Sentry, defer OTel) still holds. What changed is the **scope** — Sentry now covers all three runtimes, and the server-side scope handling has been hardened. The original "Decision" section described the server-only state of 2026-03-02; this update documents what actually exists now.

### Sentry projects (all under `tosins-personal` org)

| Project | Slug | Runtime |
|---|---|---|
| Server (Hono) | `lifters-club-server` | `@sentry/node@10.52` (renamed from `node-hono`) |
| Web (Next.js 15) | `lifters-club-web` | `@sentry/nextjs@10.52` (client + server + edge) |
| Mobile (Expo / RN 0.81) | `lifters-club-mobile` | `@sentry/react-native@7.2` |

Region: EU (`o4510834109054976.ingest.de.sentry.io`).

### Server-side changes since the original decision

1. **Init lifted to `apps/server/src/instrument.ts`**, loaded via Node's `--import` flag (dev script + Dockerfile prod CMD). Sentry's auto-instrumentation hooks `http` and `hono` at require-time, so middleware and route handlers are spans automatically.
2. **Per-request scope isolation** via `apps/server/src/middleware/sentry-scope.ts` wrapping each request in `Sentry.withIsolationScope`. The original ADR described setting tags on `Sentry.getCurrentScope()`, which on `@sentry/node` v10 mutates a process-global current scope and leaks across concurrent requests. The new middleware fixes this; `requestId` / `path` / `method` tags and `Sentry.setUser(...)` from auth all land on the per-request isolation scope.
3. **5xx capture** — `app.onError` now also forwards `HTTPException` instances with `status >= 500` to Sentry (4xx are still treated as user errors and skipped).
4. **`tracesSampler`** drops `/health`, `/api/docs`, `/api/openapi.json`, and the root info endpoint to zero so they don't consume the trace budget. Other paths sample at 10% in prod / 100% in dev (overridable via `SENTRY_TRACES_SAMPLE_RATE`).
5. **CPU profiling** via `nodeProfilingIntegration()` from `@sentry/profiling-node`. Profile sample rate defaults to 100% dev / 10% prod (overridable via `SENTRY_PROFILES_SAMPLE_RATE`). Prebuilt binaries cover macOS arm64 + Linux x64 musl/glibc, so no Alpine build deps were needed.
6. **Release tagging in CI** — `.github/workflows/deploy-api.yml` sets `SENTRY_RELEASE=$GITHUB_SHA` on the Railway service before each `railway up`, and uses `getsentry/action-release@v1` to register the release in Sentry. The running server reads `process.env.SENTRY_RELEASE` in `instrument.ts`.

### Web (Next.js 15)

`@sentry/nextjs` set up via `withSentryConfig(...)` in `apps/web/next.config.mjs`. Three runtimes are initialized separately: `sentry.client.config.ts` (browser, auto-loaded by withSentryConfig), `sentry.server.config.ts` (Node, dispatched from `instrumentation.ts#register`), and `sentry.edge.config.ts` (Edge runtime, same dispatch). `instrumentation.ts` also exports `onRequestError = Sentry.captureRequestError` so RSC / route-handler / server-action / middleware errors are captured. `app/global-error.tsx` is the root error boundary required by Sentry. Session Replay is opt-in via `NEXT_PUBLIC_SENTRY_REPLAY=1` (off by default to keep bundle size and PII surface small; enabled mode masks all text and blocks all media). Source-map upload runs during `next build` when `SENTRY_AUTH_TOKEN` is set in the Vercel build env.

### Mobile (Expo SDK 54 / RN 0.81)

`@sentry/react-native` registered via `app.json` config plugin (`@sentry/react-native/expo`) so native iOS/Android modules are wired at prebuild time. `metro.config.js` wraps the default Expo Metro config with `getSentryExpoConfig` so `eas build` emits source maps and debug IDs for symbolication. SDK init runs at the top of `apps/mobile/app/_layout.tsx` before the existing `publishableKey` throw so initialization-time failures are captured. Default export is wrapped with `Sentry.wrap()`. The app's `ErrorBoundary` component now forwards every caught render error to Sentry with the React component stack attached. Cannot ship as OTA — picking up the Sentry native modules requires a fresh `eas build`.

### PII strip (consistent across platforms)

All three runtimes' `beforeSend` hooks strip `Authorization` and `Cookie` headers (case-insensitive) before events leave the SDK. This is independent of any Sentry server-side data scrubbing rules.

### What's still deferred

- **SQL span coverage** — Drizzle uses `postgres-js` (porsager), which Sentry's `postgresIntegration` (pg-only) doesn't instrument. Adding DB span timing would require a driver swap or manual `Sentry.startSpan` wrapping in `@gymapp/db`; neither has been done.
- **Source upload for server** — production runs TS directly via `tsx` (no compiled JS bundle), so the new Sentry CLI's `sourcemap upload` (which requires `.js` + `.map`) doesn't apply. Source-in-Sentry view for server stack frames will be added later via Sentry's GitHub repo integration (a Sentry settings change, no code change). Switching prod to compiled JS would undo the deliberate ESM-resolution decision documented in `apps/server/Dockerfile`.
- **OTel** — original deferral still holds. No second service yet.
