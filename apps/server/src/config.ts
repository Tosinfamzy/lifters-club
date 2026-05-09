import { z } from "zod";

/**
 * Environment configuration schema with validation
 * Fails fast at startup if required variables are missing
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Auth
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),

  // Server
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // CORS - comma-separated list of allowed origins
  CORS_ORIGINS: z.string().optional(),

  // Rate limiting (optional, defaults provided)
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_RELEASE: z.string().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
  SENTRY_PROFILES_SAMPLE_RATE: z.coerce.number().min(0).max(1).optional(),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    console.error("Environment validation failed:\n" + errors);
    process.exit(1);
  }

  return result.data;
}

export const config = validateEnv();

/**
 * Get CORS origins based on environment
 * Production: uses CORS_ORIGINS env var or defaults to production domains
 * Development: allows any origin for easier local/mobile testing
 */
export function getCorsOrigins(): string[] | ((origin: string) => string | undefined | null) {
  if (config.CORS_ORIGINS) {
    return config.CORS_ORIGINS.split(",").map((origin) => origin.trim());
  }

  if (config.NODE_ENV === "production") {
    return [
      "https://theliftersclub.com",
      "https://www.theliftersclub.com",
      "https://lifters-club.vercel.app",
    ];
  }

  // Development: allow any origin for local/mobile testing
  // This is safe because:
  // 1. Only applies in development mode
  // 2. Native mobile apps don't send Origin headers anyway
  // 3. Makes testing from any device on local network easy
  return (origin: string) => origin;
}
