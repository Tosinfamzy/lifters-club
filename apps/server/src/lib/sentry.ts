import * as Sentry from "@sentry/node";
import { config } from "../config";

/**
 * Initialize Sentry error tracking
 *
 * Sentry provides:
 * - Error aggregation and deduplication
 * - Stack trace analysis
 * - Release tracking
 * - Performance monitoring (optional)
 *
 * @see https://docs.sentry.io/platforms/javascript/guides/node/
 */
export function initSentry() {
  if (!config.SENTRY_DSN) {
    if (config.NODE_ENV === "production") {
      console.warn(
        "SENTRY_DSN not configured. Error tracking is disabled in production."
      );
    }
    return;
  }

  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,

    // Capture 100% of errors in production
    sampleRate: 1.0,

    // Performance monitoring - sample 10% of transactions in production
    tracesSampleRate: config.NODE_ENV === "production" ? 0.1 : 1.0,

    // Don't send errors in test environment
    enabled: config.NODE_ENV !== "test",

    // Attach server name for distributed tracing
    serverName: "lifters-club-api",

    // Filter out sensitive data
    beforeSend(event) {
      // Remove authorization headers
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  console.log("Sentry error tracking initialized");
}

/**
 * Capture an exception with additional context
 */
export function captureError(
  error: Error,
  context?: {
    requestId?: string;
    userId?: string;
    path?: string;
    method?: string;
    extra?: Record<string, unknown>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag("requestId", context.requestId);
    }
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }
    if (context?.path) {
      scope.setTag("path", context.path);
    }
    if (context?.method) {
      scope.setTag("method", context.method);
    }
    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    Sentry.captureException(error);
  });
}

/**
 * Flush pending events before shutdown
 * Call this during graceful shutdown
 */
export async function flushSentry() {
  await Sentry.close(2000);
}

export { Sentry };
