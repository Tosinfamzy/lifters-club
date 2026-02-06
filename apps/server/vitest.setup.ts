import { config } from "dotenv";

// Load .env.test from monorepo root for tests (takes precedence)
// Falls back to .env if .env.test doesn't exist
config({ path: "../../.env.test" });
config({ path: "../../.env" });
