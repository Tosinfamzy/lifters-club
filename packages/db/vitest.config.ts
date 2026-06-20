import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // The seed module builds a postgres client from DATABASE_URL at import time
    // (it never connects unless run directly). Provide a dummy so importing
    // `exerciseSeedData` in pure tests doesn't throw.
    env: {
      DATABASE_URL: "postgres://test:test@localhost:5433/lifters_test",
    },
  },
});
