import app from "./app.js";
import { env } from "./shared/config/env.js";
import { logger } from "./shared/config/logger.js";

app.listen(env.port, () => {
  logger.info({ port: env.port }, "Backend started");
});