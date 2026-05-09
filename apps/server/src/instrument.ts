// Loaded via Node's --import flag BEFORE any other application module so
// that Sentry's auto-instrumentation (http, hono) hooks the right modules
// at require-time. Reads process.env directly to avoid coupling to
// config.ts (which validates DATABASE_URL etc. and isn't observability-only).
//
// Note: SQL span coverage is currently absent — the DB package uses
// postgres-js (porsager), which Sentry's built-in postgresIntegration
// (pg only) doesn't instrument. To get DB span timing we'd either switch
// drivers or wrap DB calls in explicit Sentry.startSpan calls.
import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN;
const env = process.env.NODE_ENV ?? "development";

if (dsn && env !== "test") {
  Sentry.init({
    dsn,
    environment: env,
    release: process.env.SENTRY_RELEASE,
    sampleRate: 1.0,
    serverName: "lifters-club-api",

    integrations: [nodeProfilingIntegration()],

    // CPU profiles attach to traces. 100% in dev, 10% in prod by default,
    // overridable via SENTRY_PROFILES_SAMPLE_RATE.
    profilesSampleRate: (() => {
      const override = process.env.SENTRY_PROFILES_SAMPLE_RATE;
      if (override !== undefined) {
        const parsed = Number(override);
        return Number.isFinite(parsed) ? parsed : 0.1;
      }
      return env === "production" ? 0.1 : 1.0;
    })(),

    tracesSampler: ({ name = "" }) => {
      if (
        name.includes("/health") ||
        name.includes("/api/docs") ||
        name.includes("/api/openapi.json") ||
        name === "GET /"
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

    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
      }
      return event;
    },
  });

  console.log("Sentry initialized");
}
