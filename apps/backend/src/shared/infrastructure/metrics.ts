import type { NextFunction, Request, Response } from "express";
import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [metricsRegistry]
});

const httpRequests = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"] as const,
  registers: [metricsRegistry]
});

// Valor fixo para requisições sem rota casada (404, 401/403 de middlewares de router, 429 do
// rate limit). Usar a URL concreta criaria uma série nova no Prometheus a cada URL varrida por bots.
export const UNMATCHED_ROUTE_LABEL = "unmatched";

const getRoute = (request: Request): string => {
  const route = request.route?.path;
  if (route) return `${request.baseUrl}${Array.isArray(route) ? route[0] : route}`;
  return UNMATCHED_ROUTE_LABEL;
};

export const httpMetricsMiddleware = (request: Request, response: Response, next: NextFunction) => {
  const startedAt = process.hrtime.bigint();

  response.once("finish", () => {
    const durationInSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const labels = {
      method: request.method,
      route: getRoute(request),
      status_code: String(response.statusCode)
    };

    httpRequestDuration.observe(labels, durationInSeconds);
    httpRequests.inc(labels);
  });

  next();
};
