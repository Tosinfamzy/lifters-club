import * as Sentry from "@sentry/nextjs";

// Edge runtime config — applies to middleware.ts and any route segments
// configured with `runtime: 'edge'`. Note: edge runtime has a much smaller
// API surface than Node, so integrations like profiling are not available.
const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV ?? "development";

if (dsn && env !== "test") {
  Sentry.init({
    dsn,
    environment: env,
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1.0,

    tracesSampler: () => {
      const override = process.env.SENTRY_TRACES_SAMPLE_RATE;
      if (override !== undefined) {
        const parsed = Number(override);
        return Number.isFinite(parsed) ? parsed : 0.1;
      }
      return env === "production" ? 0.1 : 1.0;
    },

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
