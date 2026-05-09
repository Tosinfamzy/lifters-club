import type { Context, Next } from "hono";
import * as Sentry from "@sentry/node";
import type { Env } from "../types";

// Wraps each request in a Sentry isolation scope so that user/tag/extra data
// set during one request never leaks into concurrent requests sharing the
// same Node process. Without this, Sentry.setUser() and similar mutate a
// process-global current scope.
export async function sentryScope(c: Context<Env>, next: Next) {
  await Sentry.withIsolationScope(async (scope) => {
    const requestId = c.get("requestId");
    if (requestId) {
      scope.setTag("requestId", requestId);
    }
    scope.setTag("path", c.req.path);
    scope.setTag("method", c.req.method);
    await next();
  });
}
