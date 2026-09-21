import pino from "pino";
import { env } from "./env.js";

const isDevelopment = env.nodeEnv === "development";

export const logger = pino({
  level: env.logLevel,
  // pino-pretty is development-only for readable local logs; production keeps JSON for lower overhead and log ingestion compatibility.
  transport: isDevelopment
    ? {
        target: "pino-pretty",
        options: { colorize: true }
      }
    : undefined
});