import pino from "pino";

// Use process.env directly to avoid config validation during module load
// This allows the logger to be imported in tests without requiring all env vars
const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const isDevelopment = nodeEnv === "development";
const isTest = nodeEnv === "test";

/**
 * Structured logging with Pino
 *
 * Log levels (in order of severity):
 * - trace: Very detailed debugging
 * - debug: Debugging info, not for production
 * - info: Normal operations worth recording
 * - warn: Something unexpected but handled
 * - error: Something failed
 * - fatal: App cannot continue
 *
 * Production runs at 'info' level, development at 'debug', tests at 'silent'
 */
export const logger = pino({
  level: isTest ? "silent" : isProduction ? "info" : "debug",
  transport:
    isDevelopment && !isTest
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined, // JSON output in production, no output in tests
  base: {
    service: "lifters-api",
    env: nodeEnv,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Redact sensitive fields
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token"],
    censor: "[REDACTED]",
  },
});

/**
 * Create a child logger with additional context
 * Use this for request-scoped logging
 *
 * @example
 * const reqLogger = createChildLogger({ requestId: 'abc123', userId: 'user_456' })
 * reqLogger.info('Processing request')
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}

export type Logger = typeof logger;
