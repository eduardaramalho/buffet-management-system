import type { EmailProvider } from "../../domain/auth.types.js";
import { logger } from "../../../../shared/config/logger.js";

export class ConsoleEmailProvider implements EmailProvider {
  async sendPasswordReset(input: { to: string; name: string; token: string }) {
    logger.info({ to: input.to, name: input.name, token: input.token }, "Password reset email");
  }
}