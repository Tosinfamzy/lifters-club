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
