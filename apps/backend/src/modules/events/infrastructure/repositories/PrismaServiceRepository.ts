import type { PrismaClient } from "../../../../generated/client.js";
import type { ServiceRepository } from "../../domain/event.types.js";

export class PrismaServiceRepository implements ServiceRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.service.findFirst({ where: { id, deletedAt: null } });
  }

  list() {
    return this.prisma.service.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } });
  }

  create(input: { name: string; isCustom: boolean }) {
    return this.prisma.service.create({ data: input });
  }

  update(id: string, input: { name?: string; isCustom?: boolean }) {
    return this.prisma.service.update({ where: { id }, data: input });
  }

  softDelete(id: string) {
    return this.prisma.service.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}