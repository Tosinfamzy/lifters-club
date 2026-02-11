import { Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import { exerciseRoutes } from "./routes/exercises";
import { programRoutes } from "./routes/programs";
import { workoutRoutes } from "./routes/workouts";
import { logRoutes } from "./routes/logs";
import { decisionRoutes } from "./routes/decisions";
import { userRoutes } from "./routes/users";
import { analyticsRoutes } from "./routes/analytics";
import { notificationRoutes } from "./routes/notifications";
import { templateRoutes } from "./routes/templates";
import { standaloneWorkoutRoutes } from "./routes/standalone-workouts";
import { weeklyPlanRoutes } from "./routes/weekly-plans";
import { authMiddleware } from "./middleware/auth";
import { publicRateLimiter } from "./middleware/rate-limit";
import { config } from "./config";
import { openAPISpec } from "./openapi-spec";

// Create main API router
const openapi = new Hono();

// Public routes (no auth required) - use more permissive rate limiter (200/min vs 100/min)
// Skip in development for easier testing
if (config.NODE_ENV !== "development") {
  openapi.use("/exercises/*", publicRateLimiter);
  openapi.use("/programs/*", publicRateLimiter);
}
openapi.route("/exercises", exerciseRoutes);
openapi.route("/programs", programRoutes); // Programs are public to browse

// Protected routes (require Clerk JWT)
// Apply auth middleware before mounting protected routers
openapi.use("/users/*", authMiddleware);
openapi.use("/workouts/*", authMiddleware);
openapi.use("/logs/*", authMiddleware);
openapi.use("/decisions/*", authMiddleware);
openapi.use("/analytics/*", authMiddleware);
openapi.use("/notifications/*", authMiddleware);
openapi.use("/templates/*", authMiddleware);
openapi.use("/standalone-workouts/*", authMiddleware);
openapi.use("/weekly-plans/*", authMiddleware);

// Mount protected routes
openapi.route("/workouts", workoutRoutes);
openapi.route("/logs", logRoutes);
openapi.route("/decisions", decisionRoutes);
openapi.route("/users", userRoutes);
openapi.route("/analytics", analyticsRoutes);
openapi.route("/notifications", notificationRoutes);
openapi.route("/templates", templateRoutes);
openapi.route("/standalone-workouts", standaloneWorkoutRoutes);
openapi.route("/weekly-plans", weeklyPlanRoutes);

openapi.get("/openapi.json", (c) => c.json(openAPISpec));

// Swagger UI
openapi.get("/docs", swaggerUI({ url: "/api/openapi.json" }));

export { openapi };
