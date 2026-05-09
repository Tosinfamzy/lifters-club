import * as Sentry from "@sentry/node";

// Sentry.init runs in `apps/server/src/instrument.ts`, loaded via Node's
// --import flag before this module. Per-request isolation lives in
// middleware/sentry-scope.ts. This file holds the helpers used by route
// handlers and the graceful-shutdown path.

/**
 * Capture an exception with additional context.
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
 * Flush pending events before shutdown. Called during graceful shutdown.
 */
export async function flushSentry() {
  await Sentry.close(2000);
}

export { Sentry };
