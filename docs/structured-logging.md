# Structured Logging: A Developer's Guide

## What is Structured Logging?

**Traditional logging** outputs human-readable strings:
```
Auth error: Invalid token for user john@example.com
```

**Structured logging** outputs machine-parseable data (usually JSON):
```json
{
  "level": "error",
  "message": "Auth error",
  "error": "Invalid token",
  "userId": "user_123",
  "email": "john@example.com",
  "requestId": "req_abc123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "path": "/api/workouts",
  "method": "GET"
}
```

---

## Why Does This Matter?

### 1. **Searchability**

With traditional logs, finding all auth errors for a specific user requires regex:
```bash
grep "Auth error" logs.txt | grep "john@example.com"
```

With structured logs, you query by field:
```sql
-- In a log aggregator like Datadog, Loki, or CloudWatch
level = "error" AND userId = "user_123"
```

### 2. **Correlation**

When a user reports "the app broke at 2pm", you need to find all related logs.

**Traditional:** Good luck searching through thousands of lines.

**Structured:** Query by `requestId` to see the entire request lifecycle:
```
requestId = "req_abc123"
```

This shows you:
1. Request received
2. Auth validated
3. Database query started
4. Database query failed ← The actual problem
5. Error response sent

### 3. **Aggregation & Metrics**

Structured logs can be aggregated into metrics:

```
Count of errors by path in last hour:
┌─────────────────────┬───────┐
│ path                │ count │
├─────────────────────┼───────┤
│ /api/workouts       │ 142   │
│ /api/decisions      │ 23    │
│ /api/users          │ 8     │
└─────────────────────┴───────┘
```

This is impossible with unstructured text logs.

### 4. **Alerting**

Set up alerts based on specific conditions:
- "Alert me if `level=error AND path=/api/payments` exceeds 10/minute"
- "Alert me if `responseTime > 2000ms` for any endpoint"

---

## The Anatomy of a Structured Log

```json
{
  "level": "info",           // Severity: trace, debug, info, warn, error, fatal
  "message": "Request completed",
  "timestamp": "2024-01-15T10:30:00.000Z",

  // Request context
  "requestId": "req_abc123", // Unique ID for this request
  "method": "POST",
  "path": "/api/workouts/123/complete",
  "statusCode": 200,
  "responseTime": 145,       // milliseconds

  // User context
  "userId": "user_456",

  // Business context
  "workoutId": "workout_789",
  "action": "complete_workout",

  // Environment
  "service": "lifters-api",
  "environment": "production",
  "version": "1.2.3"
}
```

---

## Log Levels Explained

| Level | When to Use | Example |
|-------|-------------|---------|
| **trace** | Extremely detailed debugging | `Entering function calculateProgression with args: {...}` |
| **debug** | Debugging info, not for production | `Cache miss for key: user_123_baselines` |
| **info** | Normal operations worth recording | `Workout completed`, `User signed up` |
| **warn** | Something unexpected but handled | `Rate limit approaching for IP 1.2.3.4` |
| **error** | Something failed | `Database query failed`, `External API timeout` |
| **fatal** | App cannot continue | `Cannot connect to database, shutting down` |

**Production typically runs at `info` level** - you see info, warn, error, fatal.
**Development runs at `debug` level** - you see everything except trace.

---

## Current State: console.log

Here's what we have now in the codebase:

```typescript
// apps/server/src/middleware/auth.ts
catch (err) {
  console.error("Auth error:", err);  // Unstructured, no context
  return c.json({ error: "Invalid or expired token" }, 401);
}

// apps/server/src/index.ts
console.error({
  type: "unhandled_error",
  requestId: reqId,
  path: c.req.path,
  // ...
});  // Better! But console.error doesn't format JSON nicely
```

### Problems with console.log/error:

1. **No log levels** - Can't filter by severity
2. **No timestamps** - When did this happen?
3. **Inconsistent format** - Some logs are strings, some are objects
4. **No automatic context** - Must manually add requestId everywhere
5. **Poor production output** - Objects print as `[Object object]` or multi-line

---

## The Solution: A Logging Library

Popular choices for Node.js:

| Library | Pros | Cons |
|---------|------|------|
| **Pino** | Fastest, great defaults, low overhead | Less features than Winston |
| **Winston** | Most features, very flexible | Slower, more complex |
| **Bunyan** | Good balance, built-in CLI | Less active development |

**Recommendation: Pino** - It's fast, simple, and perfect for APIs.

---

## What Structured Logging Looks Like in Practice

### Before (current code):

```typescript
// Scattered console.log statements
console.log("Processing workout completion");
console.log("User:", userId);
console.log("Workout:", workoutId);
// ... later
console.error("Failed to complete workout:", error);
```

**Output:**
```
Processing workout completion
User: user_123
Workout: workout_456
Failed to complete workout: Error: Database connection lost
```

### After (with Pino):

```typescript
import { logger } from "../lib/logger";

logger.info({ workoutId, userId }, "Processing workout completion");
// ... later
logger.error({ workoutId, userId, error }, "Failed to complete workout");
```

**Output:**
```json
{"level":30,"time":1705312200000,"msg":"Processing workout completion","workoutId":"workout_456","userId":"user_123"}
{"level":50,"time":1705312201000,"msg":"Failed to complete workout","workoutId":"workout_456","userId":"user_123","error":{"message":"Database connection lost","stack":"..."}}
```

### In Development (with pino-pretty):

```
[10:30:00] INFO: Processing workout completion
    workoutId: "workout_456"
    userId: "user_123"
[10:30:01] ERROR: Failed to complete workout
    workoutId: "workout_456"
    userId: "user_123"
    error: Database connection lost
```

---

## Request Context: The Magic of Child Loggers

The most powerful feature is **automatic context propagation**.

Instead of passing `requestId` to every log call:

```typescript
// Tedious and error-prone
logger.info({ requestId }, "Starting request");
logger.info({ requestId }, "Validating input");
logger.info({ requestId }, "Querying database");
logger.info({ requestId }, "Returning response");
```

Create a **child logger** with context:

```typescript
// In middleware - create once per request
const requestLogger = logger.child({
  requestId: crypto.randomUUID(),
  method: c.req.method,
  path: c.req.path,
});
c.set("logger", requestLogger);

// In route handlers - context is automatic
const log = c.get("logger");
log.info("Starting request");        // requestId included automatically
log.info("Validating input");        // requestId included automatically
log.info("Querying database");       // requestId included automatically
log.info("Returning response");      // requestId included automatically
```

Every log from this request includes `requestId`, `method`, and `path` automatically.

---

## Log Aggregation: Where Logs Go

In production, logs go to a **log aggregation service**:

| Service | Type | Cost |
|---------|------|------|
| **Datadog** | SaaS | $$$ but powerful |
| **Loki + Grafana** | Self-hosted | Free, great with Grafana |
| **CloudWatch Logs** | AWS | Pay per GB |
| **Logtail/Better Stack** | SaaS | Affordable, good DX |
| **Axiom** | SaaS | Generous free tier |

These services let you:
- Search logs across all servers
- Create dashboards
- Set up alerts
- Correlate with traces and metrics

For Railway (your deployment), logs are automatically collected. You can forward them to any of these services.

---

## Implementation Plan for Lifters Club

Here's what we'll build:

### 1. Create a Logger Module

```typescript
// apps/server/src/lib/logger.ts
import pino from "pino";
import { config } from "../config";

export const logger = pino({
  level: config.NODE_ENV === "production" ? "info" : "debug",
  transport: config.NODE_ENV === "development"
    ? { target: "pino-pretty" }  // Pretty print in dev
    : undefined,                  // JSON in production
});
```

### 2. Add Request Logging Middleware

```typescript
// Automatic logging for every request
app.use("*", async (c, next) => {
  const start = Date.now();
  const requestLogger = logger.child({
    requestId: c.get("requestId"),
    method: c.req.method,
    path: c.req.path,
  });

  c.set("logger", requestLogger);

  await next();

  requestLogger.info({
    statusCode: c.res.status,
    responseTime: Date.now() - start,
  }, "Request completed");
});
```

### 3. Use in Route Handlers

```typescript
// In any route
app.post("/api/workouts/:id/complete", async (c) => {
  const log = c.get("logger");

  log.info("Starting workout completion");

  try {
    const result = await completeWorkout(id);
    log.info({ result }, "Workout completed successfully");
    return c.json(result);
  } catch (error) {
    log.error({ error }, "Failed to complete workout");
    throw error;
  }
});
```

---

## Quick Reference: Pino API

```typescript
// Basic logging
logger.info("Simple message");
logger.info({ key: "value" }, "Message with data");

// Log levels
logger.trace("Very detailed");
logger.debug("Debugging info");
logger.info("Normal operation");
logger.warn("Warning");
logger.error("Error occurred");
logger.fatal("App crashing");

// With errors (Pino handles Error objects specially)
logger.error({ err: error }, "Something failed");

// Child loggers (inherit parent context)
const childLog = logger.child({ userId: "123" });
childLog.info("This includes userId automatically");

// Timing
const start = Date.now();
// ... do work
logger.info({ duration: Date.now() - start }, "Operation completed");
```

---

## Summary

| Aspect | console.log | Structured Logging |
|--------|-------------|-------------------|
| Format | Text strings | JSON objects |
| Searchable | Regex only | Field queries |
| Context | Manual | Automatic (child loggers) |
| Levels | None | trace → fatal |
| Performance | OK | Optimized (Pino is async) |
| Production | Hard to analyze | Easy to aggregate |

**Bottom line:** Structured logging turns your logs from "write-only" debug output into a queryable, actionable data source for understanding your production system.

---

## Further Reading

- [Pino Documentation](https://getpino.io/)
- [12 Factor App: Logs](https://12factor.net/logs)
- [Logging Best Practices](https://www.loggly.com/ultimate-guide/node-logging-basics/)
