import type { PrismaClient } from "../../../../generated/client.js";
import type { AuditRepository } from "../../domain/user-management.types.js";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: { userId?: string; action: string; entity: string; entityId?: string; changes?: Record<string, unknown> }) {
    await this.prisma.auditLog.create({ data: { ...input, changes: input.changes as never } });
  }
}