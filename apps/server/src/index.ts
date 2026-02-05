import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { HTTPException } from "hono/http-exception";
import { openapi } from "./openapi";
import { config, getCorsOrigins } from "./config";
import { rateLimiter } from "./middleware/rate-limit";
import { securityHeaders, requestId } from "./middleware/security-headers";
import { initSentry, captureError, flushSentry } from "./lib/sentry";
import type { Env } from "./types";

// Initialize Sentry error tracking (must be before app creation)
initSentry();

const app = new Hono<Env>();

// Request ID for tracing (should be first)
app.use("*", requestId);

// Logging
app.use("*", logger());

// Security headers
app.use("*", securityHeaders);

// Rate limiting (before CORS to reject early)
app.use("*", rateLimiter());

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

  // Log unexpected errors with context (but don't expose internals)
  console.error({
    type: "unhandled_error",
    requestId: reqId,
    path: c.req.path,
    method: c.req.method,
    error: err.message,
    stack: config.NODE_ENV === "development" ? err.stack : undefined,
  });

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
  console.log(`\n${signal} received. Shutting down gracefully...`);

  // Flush pending Sentry events
  await flushSentry();

  // Give in-flight requests time to complete
  setTimeout(() => {
    console.log("Shutdown complete.");
    process.exit(0);
  }, 5000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Start server
console.log(`Server starting on http://0.0.0.0:${config.PORT}`);

serve({
  fetch: app.fetch,
  port: config.PORT,
  hostname: "0.0.0.0", // Listen on all interfaces for container/mobile access
});

export { app };
