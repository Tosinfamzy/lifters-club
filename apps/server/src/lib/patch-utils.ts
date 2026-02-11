/**
 * Build an update data object from validated partial input.
 * Only includes fields that are explicitly provided (not undefined).
 */
export function buildPatchData<T extends Record<string, unknown>>(
  input: Partial<T>,
  options: { includeUpdatedAt?: boolean } = {}
): Record<string, unknown> {
  const { includeUpdatedAt = true } = options;
  const data: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      data[key] = value;
    }
  }

  if (includeUpdatedAt) {
    data.updatedAt = new Date();
  }

  return data;
}
