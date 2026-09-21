export class PrismaPasswordResetTokenRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    create(input) {
        return this.prisma.passwordResetToken.create({ data: input });
    }
    findByHash(tokenHash) {
        return this.prisma.passwordResetToken.findFirst({ where: { tokenHash } });
    }
    async markUsed(id) {
        await this.prisma.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
    }
}
