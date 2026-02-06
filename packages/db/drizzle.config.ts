import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env from monorepo root only if DATABASE_URL not already set (e.g., in CI)
if (!process.env.DATABASE_URL) {
  config({ path: "../../.env" });
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  schemaFilter: ["exercise_lib", "training"],
  verbose: true,
  strict: true,
});
