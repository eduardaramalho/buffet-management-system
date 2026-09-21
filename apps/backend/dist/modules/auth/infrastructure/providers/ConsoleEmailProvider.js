import { logger } from "../../../../shared/config/logger.js";
export class ConsoleEmailProvider {
    async sendPasswordReset(input) {
        logger.info({ to: input.to, name: input.name, token: input.token }, "Password reset email");
    }
}
