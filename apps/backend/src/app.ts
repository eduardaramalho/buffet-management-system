import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { authRoutes } from "./modules/auth/presentation/routes/auth.routes.js";
import { createAuthRoutes } from "./modules/auth/presentation/routes/auth.routes.js";
import type { AuthController } from "./modules/auth/presentation/controllers/AuthController.js";
import { userRoutes } from "./modules/auth/presentation/routes/user.routes.js";
import { roleRoutes } from "./modules/auth/presentation/routes/role.routes.js";
import { eventRoutes } from "./modules/events/presentation/routes/event.routes.js";
import { serviceRoutes } from "./modules/events/presentation/routes/service.routes.js";
import { teamRoutes } from "./modules/teams/presentation/routes/team.routes.js";
import { collaboratorRoutes } from "./modules/teams/presentation/routes/collaborator.routes.js";
import { ruleRoutes } from "./modules/rules/presentation/routes/rule.routes.js";
import { ruleEvaluationRoutes } from "./modules/rules/presentation/routes/ruleEvaluation.routes.js";
import { taskRoutes } from "./modules/tasks/presentation/routes/task.routes.js";
import { ruleApplicationRoutes } from "./modules/tasks/presentation/routes/ruleApplication.routes.js";
import { dashboardRoutes } from "./modules/dashboard/presentation/routes/dashboard.routes.js";
import { errorHandler } from "./shared/middlewares/errorHandler.js";
import { env } from "./shared/config/env.js";
import { logger } from "./shared/config/logger.js";
import { httpMetricsMiddleware, metricsRegistry } from "./shared/infrastructure/metrics.js";

const GLOBAL_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const GLOBAL_RATE_LIMIT_MAX_REQUESTS = 600;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const SENSITIVE_AUTH_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const SENSITIVE_AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5;

const allowedOrigins = env.corsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const globalApiLimiter = rateLimit({
  windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS,
  max: GLOBAL_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas requisições em pouco tempo" }
});

const loginLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  max: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas de login. Tente novamente mais tarde." }
});

const sensitiveAuthLimiter = rateLimit({
  windowMs: SENSITIVE_AUTH_RATE_LIMIT_WINDOW_MS,
  max: SENSITIVE_AUTH_RATE_LIMIT_MAX_ATTEMPTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Tente novamente mais tarde." }
});

export const createRateLimitTestApp = (controller: AuthController) => {
  const testApp = express();
  testApp.use(express.json());
  testApp.use("/api/v1/auth/login", rateLimit({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    max: LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Muitas tentativas de login. Tente novamente mais tarde." }
  }));
  testApp.use("/api/v1/auth", createAuthRoutes(controller));
  return testApp;
};

const app = express();

app.use(
  pinoHttp({
    logger,
    genReqId: (_request, response) => {
      const requestId = randomUUID();
      response.setHeader("x-request-id", requestId);
      return requestId;
    },
    customProps: (request, response) => ({
      requestId: request.id,
      method: request.method,
      route: request.originalUrl,
      status: response.statusCode
    })
  })
);

app.use(
  helmet({
    // API responses are JSON-only; keeping CSP disabled avoids breaking legitimate API payloads while still sending the baseline security headers.
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    // Tokens are exchanged in the request body today, so browser credentials are not required for the frontend flow.
    credentials: false,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use((request: Request, response: Response, next: NextFunction) => {
  const requestOrigin = request.headers.origin;

  if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
    return response.status(403).json({ message: "Origin não permitida" });
  }

  return next();
});

app.use(httpMetricsMiddleware);

app.get("/api/v1/metrics", async (_request, response, next) => {
  try {
    response.setHeader("Content-Type", metricsRegistry.contentType);
    response.send(await metricsRegistry.metrics());
  } catch (error) {
    next(error);
  }
});

app.use(globalApiLimiter);
app.use("/api/v1/auth/login", loginLimiter);
app.use("/api/v1/auth/forgot-password", sensitiveAuthLimiter);
app.use("/api/v1/auth/reset-password", sensitiveAuthLimiter);
app.use(express.json());
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/roles", roleRoutes);
app.use("/api/v1/events", eventRoutes);
app.use("/api/v1/services", serviceRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/v1/collaborators", collaboratorRoutes);
app.use("/api/v1/rules", ruleRoutes);
app.use("/api/v1/events", ruleEvaluationRoutes);
app.use("/api/v1/tasks", taskRoutes);
app.use("/api/v1/events", ruleApplicationRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);

app.get("/api/v1/health", (_req, res) => {
  res.json({
    status: "ok"
  });
});

app.use(errorHandler);

export default app;