import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV ?? "development";

if (dsn && env !== "test") {
  Sentry.init({
    dsn,
    environment: env,
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1.0,

    tracesSampler: ({ name = "" }) => {
      // Drop noisy paths from traces
      if (
        name.includes("/api/health") ||
        name.endsWith("/_next/static") ||
        name.includes("/_next/data")
      ) {
        return 0;
      }

      const override = process.env.SENTRY_TRACES_SAMPLE_RATE;
      if (override !== undefined) {
        const parsed = Number(override);
        return Number.isFinite(parsed) ? parsed : 0.1;
      }
      return env === "production" ? 0.1 : 1.0;
    },

    // Mirror the server app's PII strip — Authorization tokens and session
    // cookies should never reach Sentry.
    beforeSend(event) {
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        delete headers.authorization;
        delete headers.Authorization;
        delete headers.cookie;
        delete headers.Cookie;
      }
      return event;
    },
  });
}
