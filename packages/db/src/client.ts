import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

let _queryClient: ReturnType<typeof postgres> | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    console.log("Initializing database connection...");
    _queryClient = postgres(connectionString, {
      max: 20,
      idle_timeout: 30,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
    });
    _db = drizzle(_queryClient, { schema });
    console.log("Database connection initialized");
  }
  return _db;
}

/** Close the database connection pool. Call during graceful shutdown. */
export async function closeDb(): Promise<void> {
  if (_queryClient) {
    await _queryClient.end();
    _queryClient = null;
    _db = null;
    console.log("Database connection closed");
  }
}

// Export a proxy that lazily initializes the db on first access
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_, prop) {
    return getDb()[prop as keyof PostgresJsDatabase<typeof schema>];
  },
});
