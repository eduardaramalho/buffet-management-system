import type { PrismaClient } from "../../../../generated/client.js";
import type {
  CollaboratorListFilter,
  CollaboratorRecord,
  CollaboratorRepository,
  CollaboratorStatus,
  CreateCollaboratorInput,
  UpdateCollaboratorInput,
} from "../../domain/team.types.js";

export class PrismaCollaboratorRepository implements CollaboratorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.collaborator.findFirst({ where: { id, deletedAt: null } }) as Promise<CollaboratorRecord | null>;
  }

  list(filter: CollaboratorListFilter) {
    return this.prisma.collaborator.findMany({
      where: { deletedAt: null, ...(filter.search ? { name: { contains: filter.search } } : {}) },
      orderBy: { name: "asc" },
    }) as Promise<CollaboratorRecord[]>;
  }

  create(input: CreateCollaboratorInput) {
    return this.prisma.collaborator.create({ data: input }) as Promise<CollaboratorRecord>;
  }

  update(id: string, input: UpdateCollaboratorInput) {
    return this.prisma.collaborator.update({ where: { id }, data: input }) as Promise<CollaboratorRecord>;
  }

  setStatus(id: string, status: CollaboratorStatus) {
    return this.prisma.collaborator.update({ where: { id }, data: { status } }) as Promise<CollaboratorRecord>;
  }
}
