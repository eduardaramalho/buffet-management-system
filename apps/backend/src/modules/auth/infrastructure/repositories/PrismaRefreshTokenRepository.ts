import type { PrismaClient } from "../../../../generated/client.js";
import type { RefreshTokenRepository } from "../../domain/auth.types.js";

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: { userId: string; tokenHash: string; expiresAt: Date; createdByIp?: string }) {
    return this.prisma.refreshToken.create({ data: input });
  }

  async findByHash(tokenHash: string) {
    return this.prisma.refreshToken.findFirst({ where: { tokenHash } });
  }

  async revoke(id: string) {
    await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}