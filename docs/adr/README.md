# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for the Lifters Club project.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [0001](./0001-monorepo-turborepo-pnpm.md) | Monorepo with Turborepo + pnpm | Accepted | 2025-01-21 |
| [0002](./0002-separate-postgres-schemas.md) | Separate PostgreSQL Schemas | Accepted | 2025-01-21 |
| [0003](./0003-hono-backend.md) | Hono for Backend API | Accepted | 2025-01-21 |
| [0004](./0004-drizzle-orm.md) | Drizzle ORM | Accepted | 2025-01-21 |
| [0005](./0005-powersync-offline-first.md) | PowerSync for Offline-First Sync | Superseded | 2025-01-21 |
| [0006](./0006-clerk-authentication.md) | Clerk for Authentication | Accepted | 2025-01-21 |
| [0007](./0007-testing-strategy.md) | Testing Strategy | Accepted | 2025-01-21 |
| [0008](./0008-code-quality-principles.md) | Code Quality Principles | Accepted | 2025-01-21 |
| [0009](./0009-simple-offline-queue.md) | Simple Offline Queue with MMKV | Accepted | 2025-01-25 |
| [0010](./0010-observability-strategy.md) | Observability Strategy — Pino + Sentry over OTel | Accepted | 2026-03-02 |

## Creating a New ADR

1. Copy `template.md` to a new file with the next number: `XXXX-title-with-dashes.md`
2. Fill in all sections
3. Update this README with the new entry
4. Submit for review

## ADR Lifecycle

- **Proposed** - Under discussion
- **Accepted** - Approved and in effect
- **Deprecated** - No longer recommended but still valid for existing code
- **Superseded** - Replaced by a newer ADR (link to replacement)

## References

- [ADR GitHub Organization](https://adr.github.io/)
- [Michael Nygard's ADR Article](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
