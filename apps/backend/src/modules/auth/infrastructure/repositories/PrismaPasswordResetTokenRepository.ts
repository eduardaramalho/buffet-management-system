import type { PrismaClient } from "../../../../generated/client.js";
import type { PasswordResetTokenRepository } from "../../domain/auth.types.js";

export class PrismaPasswordResetTokenRepository implements PasswordResetTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(input: { userId: string; tokenHash: string; expiresAt: Date }) {
    return this.prisma.passwordResetToken.create({ data: input });
  }

  findByHash(tokenHash: string) {
    return this.prisma.passwordResetToken.findFirst({ where: { tokenHash } });
  }

  async markUsed(id: string) {
    await this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}