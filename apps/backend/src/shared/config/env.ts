import "dotenv/config";
import { parseTrustProxy } from "./trustProxy.js";
import { parseCookieSecure } from "./cookieSecure.js";

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} não configurada`);
  return value;
};

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_ACCESS_SECRET"),
  accessTokenTtl: process.env.JWT_ACCESS_TTL ?? "15m",
  refreshTokenTtlMs: Number(process.env.JWT_REFRESH_TTL_MS ?? 604800000),
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  logLevel: process.env.LOG_LEVEL ?? "info",
  nodeEnv,
  cookieSecure: parseCookieSecure(process.env.COOKIE_SECURE, nodeEnv),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY)
};