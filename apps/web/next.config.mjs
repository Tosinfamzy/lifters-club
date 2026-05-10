import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@gymapp/types", "@gymapp/validation"],
};

export default withSentryConfig(nextConfig, {
  // Sentry org/project. Source-map upload happens during `next build` when
  // SENTRY_AUTH_TOKEN is set (configured as a Vercel build env var).
  org: "tosins-personal",
  project: "lifters-club-web",

  // Suppress Sentry plugin output locally; let it speak in CI.
  silent: !process.env.CI,

  // Upload a wider set of files so source maps cover library code too.
  widenClientFileUpload: true,

  // Tree-shake Sentry's logger statements out of the production bundle.
  disableLogger: true,

  // No automatic Vercel cron monitors — we don't use Next.js cron yet.
  automaticVercelMonitors: false,
});
