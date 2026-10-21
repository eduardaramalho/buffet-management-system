import type { PrismaClient } from "../../../../generated/client.js";
import type { AuditLogRecord, AuditRepository } from "../../domain/user-management.types.js";

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async record(input: { userId?: string; action: string; entity: string; entityId?: string; changes?: Record<string, unknown> }) {
    await this.prisma.auditLog.create({ data: { ...input, changes: input.changes as never } });
  }

  async listByEntity(entity: string, entityId: string, limit: number): Promise<AuditLogRecord[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { actor: { select: { name: true } } },
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      changes: log.changes,
      actorName: log.actor?.name ?? null,
      createdAt: log.createdAt,
    }));
  }
}