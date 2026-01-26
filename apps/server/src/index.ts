import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";
import { openapi } from "./openapi";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: process.env.NODE_ENV === "production"
      ? ["http://localhost:3000"]
      : "*", // Allow all origins in development for mobile testing
    credentials: true,
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "ok", timestamp: new Date().toISOString() }));

// API info
app.get("/", (c) => c.json({
  message: "Lifters Club API",
  version: "0.1.0",
  docs: "/api/docs",
}));

// Mount OpenAPI routes at /api (includes /api/exercises, /api/docs, /api/openapi.json)
app.route("/api", openapi);

// 404 handler
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = Number(process.env.PORT ?? 4000);

const hostname = process.env.NODE_ENV === "production" ? "localhost" : "0.0.0.0";

console.log(`Server starting on http://${hostname}:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname, // Listen on all interfaces in development for mobile access
});

export { app };
