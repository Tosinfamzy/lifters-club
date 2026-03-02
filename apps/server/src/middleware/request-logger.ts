import type { Context, Next } from "hono";
import { logger, createChildLogger } from "../lib/logger";
import { Sentry } from "../lib/sentry";
import type { Env } from "../types";

/**
 * Request logging middleware
 *
 * Creates a child logger for each request with:
 * - requestId (from X-Request-Id header or generated)
 * - method
 * - path
 *
 * Logs request start and completion with timing
 */
export async function requestLogger(c: Context<Env>, next: Next) {
  const start = Date.now();
  const requestId = c.get("requestId") ?? "unknown";
  const method = c.req.method;
  const path = c.req.path;

  // Create a child logger with request context
  const reqLogger = createChildLogger({
    requestId,
    method,
    path,
  });

  // Store logger in context for use in route handlers
  c.set("logger", reqLogger);

  // Link Sentry scope to this request for automatic context on any event
  Sentry.getCurrentScope().setTag("requestId", requestId);
  Sentry.getCurrentScope().setExtra("path", path);

  // Log request start (only in debug mode to reduce noise)
  if (logger.level === "debug" || logger.level === "trace") {
    reqLogger.debug("Request started");
  }

  try {
    await next();
  } catch (error) {
    // Error will be handled by the error handler middleware
    throw error;
  }

  // Log request completion with structured fields
  const responseTime = Date.now() - start;
  const statusCode = c.res.status;
  const contentLength = c.res.headers.get("content-length");

  const completionFields = {
    statusCode,
    responseTime,
    userId: c.get("userId"),
    userAgent: c.req.header("user-agent"),
    route: c.req.routePath,
    contentLength: contentLength ? Number(contentLength) : undefined,
  };

  // Use appropriate log level based on status code
  if (statusCode >= 500) {
    reqLogger.error(completionFields, "Request completed with server error");
  } else if (statusCode >= 400) {
    reqLogger.warn(completionFields, "Request completed with client error");
  } else {
    reqLogger.info(completionFields, "Request completed");
  }
}
