import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import { openapi } from "./openapi";
import { config, getCorsOrigins } from "./config";
import { rateLimiter } from "./middleware/rate-limit";
import { securityHeaders, requestId } from "./middleware/security-headers";
import { requestLogger } from "./middleware/request-logger";
import { sentryScope } from "./middleware/sentry-scope";
import { captureError, flushSentry } from "./lib/sentry";
import { closeDb } from "@gymapp/db";
import { logger } from "./lib/logger";
import type { Env } from "./types";

// Sentry.init runs in instrument.ts via Node's --import flag, before this file loads.

const app = new Hono<Env>();

// Request ID for tracing (should be first)
app.use("*", requestId);

// Sentry isolation scope per-request. Must run after requestId so the
// requestId tag is attached, and before any other middleware so that
// downstream Sentry.setUser / setTag calls land on the isolated scope.
app.use("*", sentryScope);

// Structured logging with Pino (creates child logger with request context)
app.use("*", requestLogger);

// Security headers
app.use("*", securityHeaders);

// Rate limiting (before CORS to reject early)
// Skip entirely in development for easier testing, skip public routes in production
app.use("*", rateLimiter({
  skip: (c) => {
    // No rate limiting in development mode
    if (config.NODE_ENV === "development") {
      return true;
    }
    const path = c.req.path;
    // Public exercise/program endpoints get higher limits (applied in openapi.ts)
    return path.startsWith("/api/exercises") || path.startsWith("/api/programs");
  }
}));

// CORS with proper origin handling
app.use(
  "*",
  cors({
    origin: getCorsOrigins(),
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"],
    maxAge: 600, // Cache preflight for 10 minutes
  })
);

// Health check (no rate limit, no auth)
app.get("/health", (c) =>
  c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
  })
);

// API info
app.get("/", (c) =>
  c.json({
    message: "Lifters Club API",
    version: "0.1.0",
    docs: "/api/docs",
  })
);

// Debug routes for verifying observability setup. Disabled in production.
if (config.NODE_ENV !== "production") {
  app.get("/api/debug/sentry-throw", () => {
    throw new Error("Test error from /api/debug/sentry-throw");
  });
}

// Mount OpenAPI routes at /api (includes /api/exercises, /api/docs, /api/openapi.json)
app.route("/api", openapi);

// 404 handler
app.notFound((c) => {
  const requestId = c.get("requestId");
  return c.json({ error: "Not found", requestId }, 404);
});

// Error handler with proper categorization
app.onError((err, c) => {
  const reqId = c.get("requestId") as string | undefined;
  const userId = c.get("userId") as string | undefined;

  // Handle known HTTP exceptions (validation errors, auth errors, etc.)
  if (err instanceof HTTPException) {
    // 4xx are user-facing and shouldn't page; 5xx are real server errors and
    // should be captured to Sentry like any other unexpected throw.
    if (err.status >= 500) {
      captureError(err, {
        requestId: reqId,
        userId,
        path: c.req.path,
        method: c.req.method,
      });
    }
    return c.json(
      {
        error: err.message,
        requestId: reqId,
      },
      err.status
    );
  }

  // Capture unexpected errors to Sentry
  captureError(err, {
    requestId: reqId,
    userId,
    path: c.req.path,
    method: c.req.method,
  });

  // Log unexpected errors with structured logger
  logger.error(
    {
      requestId: reqId,
      userId,
      path: c.req.path,
      method: c.req.method,
      err, // Pino handles Error objects specially
    },
    "Unhandled error"
  );

  // Generic error response (don't leak internal details)
  return c.json(
    {
      error: "Internal server error",
      requestId: reqId,
    },
    500
  );
});

// Graceful shutdown handling
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Shutdown signal received, shutting down gracefully");

  // Flush pending Sentry events
  await flushSentry();

  // Close database connection pool
  await closeDb();

  // Give in-flight requests time to complete
  setTimeout(() => {
    logger.info("Shutdown complete");
    process.exit(0);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
logger.info({ port: config.PORT, env: config.NODE_ENV }, "Server starting");

serve({
  fetch: app.fetch,
  port: config.PORT,
  hostname: "0.0.0.0", // Listen on all interfaces for container/mobile access
});

export { app };
