import * as Sentry from "@sentry/nextjs";

// Auto-loaded by withSentryConfig at the start of the client bundle.
// Reads from NEXT_PUBLIC_SENTRY_DSN because client-side env vars must
// be exposed at build time via the NEXT_PUBLIC_ prefix.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
const env = process.env.NODE_ENV ?? "development";

if (dsn && env !== "test") {
  Sentry.init({
    dsn,
    environment: env,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    sampleRate: 1.0,

    // Forward client warnings/errors as structured Sentry logs (low volume,
    // byte-billed). Scoped to warn+error to avoid noisy info-level chatter.
    enableLogs: true,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
      // Session Replay is opt-in via env. Default off to keep client bundle
      // size and PII surface small. To enable: set NEXT_PUBLIC_SENTRY_REPLAY=1.
      ...(process.env.NEXT_PUBLIC_SENTRY_REPLAY === "1"
        ? [
            Sentry.replayIntegration({
              maskAllText: true,
              blockAllMedia: true,
            }),
          ]
        : []),
    ],

    tracesSampleRate: env === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NEXT_PUBLIC_SENTRY_REPLAY === "1" ? 1.0 : 0,
  });
}
