export class PrismaAuditRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async record(input) {
        await this.prisma.auditLog.create({ data: { ...input, changes: input.changes } });
    }
}
