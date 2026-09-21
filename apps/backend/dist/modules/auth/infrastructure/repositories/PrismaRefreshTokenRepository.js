export class PrismaRefreshTokenRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(input) {
        return this.prisma.refreshToken.create({ data: input });
    }
    async findByHash(tokenHash) {
        return this.prisma.refreshToken.findFirst({ where: { tokenHash } });
    }
    async revoke(id) {
        await this.prisma.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
    }
}
