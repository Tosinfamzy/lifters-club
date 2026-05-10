import * as Sentry from "@sentry/nextjs";

// Next.js loads this at startup for both Node (server) and Edge runtimes.
// The dispatch below pulls in the runtime-specific Sentry config.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Captures errors thrown inside React Server Components, route handlers,
// server actions, and middleware. Without this, those errors only land in
// the server logs.
export const onRequestError = Sentry.captureRequestError;
