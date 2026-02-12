/**
 * Safely extract an error message from a Clerk error object.
 * Uses runtime type checking instead of unsafe `as` casts.
 */
export function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "errors" in err &&
    Array.isArray((err as Record<string, unknown>).errors)
  ) {
    const errors = (err as { errors: Array<{ message?: string }> }).errors;
    const message = errors[0]?.message;
    if (typeof message === "string") return message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
